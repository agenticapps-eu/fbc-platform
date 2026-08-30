-- AGE-667 — Einen Beitrag jetzt schreiben und später live schalten.
--
-- `public.posts` trug bisher nur `created_at`, und das war zugleich
-- „geschrieben am" und „sichtbar seit". Diese Migration trennt die beiden:
-- `veroeffentlicht_ab` sagt, ab wann der Beitrag für andere existiert.
--
-- ══ GERECHNET, NICHT GESCHALTET ════════════════════════════════════════════
-- Sichtbar ist ein Beitrag, wenn `veroeffentlicht_ab <= now()` — oder wenn der
-- Betrachter sein Autor ist. Es gibt KEINEN Lauf, der eine Fahne umlegt: ein
-- solcher Lauf wäre ein Fehlerfall, den es sonst nicht gibt. Fällt er aus,
-- bleibt der Beitrag unsichtbar, und das sieht genauso aus wie „nie
-- geschrieben". Ein Vergleich in der Regel kann nicht ausfallen.
--
-- ══ WARUM `not null default now()` UND NICHT `null` FÜR „SOFORT" ═══════════
-- Ein `null` müsste in jedem der Prädikate unten als „sofort" gelesen werden,
-- je mit `coalesce` oder `is null or`. Vergisst eine Stelle das, ist der
-- Beitrag entweder unsichtbar oder zu früh sichtbar.
--
-- Die Fehlerrichtung ist dabei die SCHLECHTERE, und das gehört gesagt: mit
-- `null` = „sofort" versagt eine vergessene Stelle fail-closed (`null <= now()`
-- ist `null`, die Zeile fällt heraus). Mit `not null` versagt sie fail-open —
-- das unveränderte Tor zeigt den geplanten Beitrag sofort, also genau der
-- Schaden, den dieser Change verhindert. Die Entscheidung trägt nur, weil die
-- Tor-Liste gegen `pg_policies` + `pg_proc` GESCHLOSSEN gemessen wurde und
-- weil jede Zusage in `geplante_beitraege_test.sql` eine Positivkontrolle hat.
--
-- ══ BESTANDSZEILEN BEKOMMEN IHREN EIGENEN `created_at` ═════════════════════
-- Nicht `now()`: sonst trügen alle 107 Bestandszeilen denselben
-- Migrationsmoment, und der Feed sortierte den ganzen Bestand um.

alter table public.posts
  add column veroeffentlicht_ab timestamptz;

update public.posts set veroeffentlicht_ab = created_at;

alter table public.posts
  alter column veroeffentlicht_ab set not null,
  alter column veroeffentlicht_ab set default now();

comment on column public.posts.veroeffentlicht_ab is
  'Ab wann der Beitrag für andere sichtbar ist. Vor diesem Moment sieht ihn nur sein Autor. `created_at` bleibt der Schreibzeitpunkt (AGE-667).';

-- ══ DAS SPALTEN-UPDATE-RECHT ═══════════════════════════════════════════════
-- `authenticated` hält auf `posts` ein SPALTENWEISES UPDATE-Recht (AGE-582,
-- weil `like_count` sonst vom Client setzbar wäre). Ohne die neue Spalte darin
-- könnte der Verfasser den Zeitpunkt nicht mehr verschieben — genau das, was er
-- können soll. Der Golden-Snapshot in `supabase/tests/grants_test.sql` zieht
-- mit, sonst bricht der CI-Job `migrations` an einer Zeile, die die Spalte
-- nicht kennt.
grant update (veroeffentlicht_ab) on public.posts to authenticated;

-- ══ DIE SECHS TORE ═════════════════════════════════════════════════════════
-- Aus dem LEBENDEN Katalog gezählt (`pg_policies` + `pg_proc`), nicht aus den
-- Migrationsdateien — dort stehen auch alle abgelösten Fassungen. Views über
-- `posts`: keine.
--
-- Das Prädikat lautet überall gleich:
--
--     (veroeffentlicht_ab <= now() or author_id = (select auth.uid()))
--
-- ausser für `anon`, wo die zweite Hälfte entfällt: ohne Sitzung gibt es keinen
-- Autor, `auth.uid()` ist null. Sie dort mitzuschreiben wäre wirkungslos, aber
-- irreführend.
--
-- `event_feed_post_sync()` wird ABSICHTLICH NICHT angefasst: sie SCHREIBT
-- Spiegelzeilen für Events und entscheidet über keine Sichtbarkeit. Ein
-- Zeitfilter dort wäre eine Regel an einer Stelle, die keine Regel ist.
--
-- `comments`, `post_likes` und `post_saves` erben: ihre Policies prüfen den
-- Beitrag über eine Unterabfrage auf `public.posts`, die unter DEREN RLS läuft.
-- Gemessen, nicht angenommen — die Zusagen dazu stehen in
-- `supabase/tests/geplante_beitraege_test.sql` und waren vor dieser Migration
-- rot. `feed_tag_counts` und `feed_top_authors` sind `security invoker` und
-- erben ebenso.

-- ── Tor 1: die RLS für Angemeldete ──────────────────────────────────────────
alter policy posts_select_by_visibility on public.posts
  using (
    is_activated()
    and ( visibility = 'public'
          or visibility = 'members'
          or author_id = (select auth.uid()) )
    and ( veroeffentlicht_ab <= now()
          or author_id = (select auth.uid()) )
  );

-- ── Tor 2: die RLS ohne Sitzung ─────────────────────────────────────────────
alter policy posts_select_public_anon on public.posts
  using ( visibility = 'public' and veroeffentlicht_ab <= now() );

-- ── Tor 3: das Bild ─────────────────────────────────────────────────────────
-- Der gefährlichste Posten. Diese Funktion entscheidet, ob ein Objekt in
-- `post-media` signiert werden darf. Käme der Zeitpunkt nur in die RLS, wäre
-- der Beitrag unsichtbar und sein Bild abrufbar — dieselbe Bauart wie
-- `profiles_public`: ein neues Tor braucht JEDE Stelle, an der das Prädikat
-- abgeschrieben ist.
create or replace function public.post_media_lesbar(objektname text)
 returns boolean
 language sql
 stable security definer
 set search_path to ''
as $function$
  select exists (
    select 1
      from public.post_media m
      join public.posts p on p.id = m.post_id
     where m.storage_path = objektname
       and case
             -- Ohne Session: nur oeffentliche Beitraege. Spiegelt
             -- posts_select_public_anon (20260612082726). UNVERAENDERT durch
             -- AGE-601 — ausgeloggt aendert sich nichts. AGE-667 haengt den
             -- Zeitpunkt an; eine Autoren-Ausnahme gibt es ohne Session nicht.
             when (select auth.uid()) is null
               then p.visibility = 'public' and p.veroeffentlicht_ab <= now()
             -- Mit Session: posts_select_by_visibility (AGE-601, AGE-667).
             else public.is_activated()
                  and ( p.visibility = 'public'
                        or p.visibility = 'members'
                        or p.author_id = (select auth.uid()) )
                  and ( p.veroeffentlicht_ab <= now()
                        or p.author_id = (select auth.uid()) )
           end
  );
$function$;

-- ── Tor 4: die Zahl ─────────────────────────────────────────────────────────
-- Eine Zahl für eine unsichtbare Zeile verrät, DASS es die Zeile gibt.
create or replace function public.post_engagement_counts(p_post_ids uuid[])
 returns table(post_id uuid, like_count bigint, comment_count bigint)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select
    p.id,
    (select count(*) from public.post_likes pl where pl.post_id = p.id),
    (select count(*) from public.comments  c  where c.post_id  = p.id)
  from public.posts p
  where cardinality(p_post_ids) <= 200
    and p.id = any (p_post_ids)
    -- AGE-495: fuer ANGEMELDETE gilt das Gate, fuer den ausgeloggten Besucher
    -- nicht. Die Funktion ist an `anon` vergeben, und `is_activated()` liefert
    -- ohne Sitzung false — ein unbedingter Konjunkt liesse das Schaufenster still
    -- auf 0 laufen, ohne Fehler und ohne Signal.
    and ((select auth.uid()) is null or public.is_activated())
    and (
      p.visibility = 'public'
      -- AGE-601: kein has_level(4) mehr. Der anon-Fall bleibt trotzdem auf
      -- `public` beschraenkt — er scheitert eine Zeile hoeher an is_activated(),
      -- sobald eine Sitzung besteht, und ohne Sitzung greift dieser Zweig gar
      -- nicht, weil `members` fuer anon nie erreichbar war.
      or ( p.visibility = 'members' and public.is_activated() )
      or p.author_id = (select auth.uid())
    )
    -- AGE-667: ohne Sitzung ist `auth.uid()` null, die zweite Haelfte also
    -- false — der Besucher bekommt fuer einen geplanten Beitrag keine Zahl.
    and ( p.veroeffentlicht_ab <= now() or p.author_id = (select auth.uid()) );
$function$;

-- ── Tor 5: ausgeschiedene Mitglieder ────────────────────────────────────────
create or replace function public.former_member_entries(p_post_ids uuid[] default '{}'::uuid[], p_comment_ids uuid[] default '{}'::uuid[])
 returns table(kind text, entry_id uuid, former boolean)
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
declare
  v_grenze constant int := 200;
  v_anzahl int := coalesce(cardinality(p_post_ids), 0)
                + coalesce(cardinality(p_comment_ids), 0);
begin
  if array_ndims(p_post_ids) > 1 or array_ndims(p_comment_ids) > 1 then
    raise exception 'mehrdimensionale Arrays werden nicht angenommen'
      using errcode = '22023';
  end if;

  if v_anzahl > v_grenze then
    raise exception 'zu viele Eintraege: % (hoechstens %)', v_anzahl, v_grenze
      using errcode = '22023';
  end if;

  return query
    -- Die sichtbaren Beitraege — die der Aufrufer gefragt hat UND die, unter
    -- denen die gefragten Kommentare haengen. Beides in EINER Menge, damit das
    -- abgeschriebene Praedikat auch nur einmal dasteht.
    with sichtbar as (
      select p.id, p.author_id
        from public.posts p
       where public.is_activated()
         and ( p.visibility = 'public'
               or p.visibility = 'members'          -- AGE-601: kein has_level(4)
               or p.author_id = (select auth.uid()) )
         -- AGE-667: der Zeitpunkt, dieselbe Regel wie in der RLS.
         and ( p.veroeffentlicht_ab <= now()
               or p.author_id = (select auth.uid()) )
         and ( p.id = any(p_post_ids)
               or exists (select 1
                            from public.comments c
                           where c.id = any(p_comment_ids)
                             and c.post_id = p.id) )
    )
    select 'post'::text, s.id,
           -- NICHT `not is_activated_profile(...)`: das waere auch fuer ein nie
           -- bestaetigtes Konto wahr, und das wurde nicht entfernt, es ist nur
           -- nie angekommen.
           (pr.disabled_at is not null or pr.deleted_at is not null)
      from sichtbar s
      join public.profiles pr on pr.id = s.author_id
     where s.id = any(p_post_ids)
    union all
    select 'comment'::text, c.id,
           (pr.disabled_at is not null or pr.deleted_at is not null)
      from public.comments c
      join sichtbar s on s.id = c.post_id
      join public.profiles pr on pr.id = c.author_id
     where c.id = any(p_comment_ids);
end $function$;

-- ══ DAS SIEBENTE TOR — DAS SCHREIBENDE ═════════════════════════════════════
-- Die Liste oben zählt die LESENDEN Tore. Es gibt ein siebentes, und der
-- Entwurf hatte es übersehen, bis die Plan-Review vom 29.08. darauf zeigte:
--
--   trg_hinweis_neuer_beitrag  AFTER INSERT ON posts
--     → hinweis_neuer_beitrag() → hinweis_rundruf('post_created', …)
--
-- `hinweis_rundruf` schreibt je AKTIVIERTEM Mitglied eine Zeile in
-- `notifications`, mit `autor_name` im Payload. `notifications` hängt an
-- Realtime (Glocke) und seit dem 28.08. am Push-Webhook (AGE-641).
--
-- Ohne diesen Abschnitt hätte ein geplanter Beitrag also IM MOMENT DES PLANENS
-- die Glocke und das Telefon jedes Mitglieds erreicht — für etwas, das niemand
-- sehen darf. Autorenname und Existenz wären sofort preisgegeben, und der Tap
-- führte auf einen Deeplink mit null Zeilen.
--
-- ══ WARUM DIE ANKÜNDIGUNG EINEN LAUF BEKOMMT UND DIE SICHTBARKEIT NICHT ════
-- Donald hat am 29.08. entschieden: ein geplanter Beitrag SOLL beim Live-Gehen
-- ankündigen, wie jeder andere. Damit zerfällt der Change in zwei Hälften mit
-- verschiedenen Fehlerprofilen — und der Unterschied ist der ganze Grund:
--
--   Sichtbarkeit  gerechnet (veroeffentlicht_ab <= now())  → kann nicht ausfallen
--   Ankündigung   Lauf zum Zeitpunkt                       → Beitrag erscheint
--                                                            trotzdem, nur
--                                                            unangekündigt
--
-- Der Lauf verbirgt keinen INHALT. Genau deshalb lehnt Entscheidung 1 einen
-- Lauf für die Sichtbarkeit ab und lässt hier einen zu.

alter table public.posts
  add column angekuendigt_am timestamptz;

comment on column public.posts.angekuendigt_am is
  'Wann für diesen Beitrag der Rundruf lief. Verhindert die doppelte Ankündigung; null heisst „noch nicht angekündigt" (AGE-667).';

-- ══ DER BESTAND WIRD ALS ANGEKÜNDIGT MARKIERT ══════════════════════════════
-- OHNE DIESE ZEILE IST DIE MIGRATION EIN MASSENVERSAND. Jeder vorhandene
-- Beitrag trägt `veroeffentlicht_ab <= now()` und hätte `angekuendigt_am is
-- null` — der erste Lauf kündigte damit den GESAMTEN Bestand an, an jedes
-- Mitglied, per Glocke und Push. `created_at` und nicht `now()`, aus demselben
-- Grund wie oben: der Wert soll sagen, wann es geschah, nicht wann migriert
-- wurde.
update public.posts set angekuendigt_am = created_at;

-- ── Das zweite frühe `return null` ──────────────────────────────────────────
-- Die Stelle war vorgezeichnet: die Funktion trägt schon eines für
-- `kind <> 'member'`.
create or replace function public.hinweis_neuer_beitrag()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_name text;
begin
  -- NUR Mitgliedsbeitraege. Ein Event mit Host wird von `trg_event_feed_post`
  -- als `kind='event'`-Zeile gespiegelt; ohne diese Zeile kuendigte jedes Event
  -- zweimal an, an denselben Empfaengerkreis.
  if new.kind is distinct from 'member' then
    return null;
  end if;

  -- AGE-667: ein GEPLANTER Beitrag kuendigt nicht beim Einfuegen an, sondern
  -- beim Live-Gehen. `public.beitrag_ankuendigen()` holt ihn dann ab.
  if new.veroeffentlicht_ab > now() then
    return null;
  end if;

  select p.name into v_name from public.profiles p where p.id = new.author_id;

  -- Kennungen plus Anzeigename, KEIN Beitragstext: eine Hinweiszeile
  -- unterliegt nach dem Schreiben nicht mehr der Sichtbarkeit ihres
  -- Gegenstands, Text darin ueberlebte eine spaetere Verschaerfung.
  perform public.hinweis_rundruf(
    'post_created',
    new.author_id,
    jsonb_build_object('post_id', new.id, 'autor_id', new.author_id, 'autor_name', v_name)
  );

  -- AGE-667: stempeln, sonst kuendigte der Lauf denselben Beitrag ein zweites
  -- Mal an. Das erneute Feuern von `trg_posts_video_url` ist folgenlos — die
  -- Funktion rechnet `video_url` aus `body` und ist damit idempotent.
  update public.posts set angekuendigt_am = now() where id = new.id;

  return null;
end;
$function$;

-- ── Der Lauf, der nachträglich ankündigt ────────────────────────────────────
-- ══ WARUM DIE FUNKTION HIER STEHT UND DER ZEITPLAN NICHT ═══════════════════
-- GEMESSEN am 29.08.: der lokale Stack hat `pg_cron` NICHT installiert
-- (`pg_net, pg_stat_statements, pgcrypto, plpgsql, supabase_vault,
-- uuid-ossp`), und die frische CI-Abbildung ebenso wenig. Ein
-- `cron.schedule(...)` in dieser Datei bräche also den CI-Job `migrations`.
--
-- Deshalb der Schnitt, den `push_wiederholung` (AGE-641 A5b) noch nicht machen
-- konnte: die FUNKTION liegt in der Migration — sie enthält kein Geheimnis,
-- ruft kein `net.http_post`, und pgTAP kann sie damit direkt aufrufen und
-- messen. Nur die ZEITPLANUNG wird von Hand gesetzt, auf DEV und PROD, und ist
-- in `docs/secrets.md` beschrieben:
--
--   select cron.schedule('beitrag-ankuendigen', '* * * * *',
--                        'select public.beitrag_ankuendigen()');
--
-- Der Objekt-Drift-Scan fragt das Schema `cron` nicht ab (`db-drift-scan.
-- logic.ts:74-77`) — eine abbestellte Zeitplanung fällt ihm also NICHT auf.
-- Die Funktion selbst steht in einer Migration und gehört deshalb NICHT in
-- `ERWARTET_OHNE_MIGRATION`: die Liste wirkt in beide Richtungen, ein Name
-- ohne Migration wäre dort richtig, ein Name MIT Migration wäre dort falsch.
--
-- ══ EIN TAKT VON EINER MINUTE ══════════════════════════════════════════════
-- Feiner kann pg_cron nicht, und gröber verschöbe es den gewählten Zeitpunkt
-- sichtbar: wer „Freitag 18:00" wählt, akzeptiert eine Minute Verzug, aber
-- keine fünf. Der Beitrag ist zum Zeitpunkt ohnehin SICHTBAR — verspätet ist
-- allenfalls die Ankündigung.
create or replace function public.beitrag_ankuendigen()
 returns integer
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_anzahl int := 0;
  r record;
begin
  for r in
    select p.id, p.author_id, pr.name
      from public.posts p
      join public.profiles pr on pr.id = p.author_id
     where p.kind = 'member'
       and p.veroeffentlicht_ab <= now()
       and p.angekuendigt_am is null
     order by p.veroeffentlicht_ab
     limit 200
       for update of p skip locked
  loop
    perform public.hinweis_rundruf(
      'post_created',
      r.author_id,
      jsonb_build_object('post_id', r.id, 'autor_id', r.author_id, 'autor_name', r.name)
    );
    update public.posts set angekuendigt_am = now() where id = r.id;
    v_anzahl := v_anzahl + 1;
  end loop;
  return v_anzahl;
end $function$;

-- Rechte AUSGESPROCHEN, nicht geerbt: bei Funktionen ist `alter default
-- privileges … revoke` ein No-op, und `public` hält auf jeder neuen Funktion
-- von Haus aus EXECUTE.
revoke execute on function public.beitrag_ankuendigen() from public, anon, authenticated;

-- ══ DER SCHREIBWEG ═════════════════════════════════════════════════════════
-- `create_post_with_media` hat heute SECHS Parameter. Ein siebter mit
-- Vorgabewert erzeugt in Postgres eine ÜBERLADUNG, keine Ersetzung: zwei
-- Funktionen, zwei Grants, zwei Zeilen in den Rechteproben — und der alte Weg
-- bliebe offen, also ein zweiter Schreibweg, der von `veroeffentlicht_ab`
-- nichts weiss. Deshalb wird die alte Signatur GELÖSCHT.
--
-- Der neue Parameter trägt AUS DEMSELBEN GRUND keinen Vorgabewert: der brächte
-- die Überladung durch die Hintertür zurück, sobald jemand mit sechs
-- Argumenten ruft. Der Client übergibt `null` für „sofort".
drop function if exists public.create_post_with_media(uuid,text,text,text[],text[],jsonb);

create function public.create_post_with_media(
  p_post_id uuid,
  p_body text,
  p_visibility text,
  p_hashtags text[],
  p_tags text[],
  p_media jsonb,
  p_veroeffentlicht_ab timestamptz
)
 returns uuid
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_autor uuid := (select auth.uid());
  v_tags  text[];
begin
  if v_autor is null or not public.is_activated() then
    raise exception 'Kein bestätigter Zugang' using errcode = 'insufficient_privilege';
  end if;

  -- Der Pfad muss dem Aufrufer gehören.
  --
  -- Das ist KEIN Widerspruch zu `post_media_lesbar`, die den Pfad ausdrücklich
  -- nie zerlegt: dort würde aus dem Pfad eine SICHTBARKEIT abgeleitet, und die
  -- gehört der Zeile, nicht der Zeichenkette. Hier wird dieselbe Prüfung
  -- gespiegelt, die die INSERT-Policy des Buckets ohnehin macht
  -- (`(storage.foldername(name))[1] = auth.uid()`) — nur zu dem Zeitpunkt, an
  -- dem die ZEILE entsteht. Ohne sie prüft niemand den Pfad an dieser Stelle:
  -- die Funktion ist SECURITY DEFINER, umgeht also `post_media_insert_own`, und
  -- selbst diese Policy prüft nur den Beitrag.
  --
  -- Der Weg, den das offenließe (aus dem Diff-Review): ein Mitglied liest ab
  -- Rang 4 den `storage_path` eines fremden `members`-Beitrags, wartet auf
  -- dessen Löschung — die Zeile fällt per Kaskade, das Objekt bleibt liegen —
  -- und hängt den verwaisten Pfad an seinen eigenen `public`-Beitrag. Danach
  -- signiert `anon` ein Bild, das nie öffentlich war. `unique (storage_path)`
  -- hält das nur auf, solange die alte Zeile lebt.
  if exists (
    select 1
      from jsonb_array_elements(coalesce(p_media, '[]'::jsonb)) m
     where split_part(m->>'storage_path', '/', 1) is distinct from v_autor::text
  ) then
    raise exception 'Bildpfad gehört nicht zum Aufrufer'
      using errcode = 'insufficient_privilege';
  end if;

  -- Tags werden VEREINIGT, nicht ersetzt: getippte (aus parseHashtags) und
  -- geklickte (aus `tags`) fallen über dieselbe Kleinschreibung zusammen,
  -- Reihenfolge der getippten zuerst. Ohne das steht derselbe Tag zweimal in
  -- `hashtags`, wenn jemand ihn tippt UND anklickt — genau der doppelte Chip,
  -- gegen den dieser Change antritt.
  select array_agg(t order by rn) into v_tags
    from (
      select lower(u.wert) as t, min(u.rn) as rn
        from unnest(coalesce(p_hashtags, '{}') || coalesce(p_tags, '{}'))
             with ordinality as u(wert, rn)
       where btrim(u.wert) <> ''
       group by lower(u.wert)
    ) s;

  -- AGE-667: ein Zeitpunkt in der VERGANGENHEIT wird auf `now()` gehoben.
  -- Sonst erschiene ein Beitrag rückdatiert — oder, schlimmer, unter älteren
  -- begraben, wo ihn niemand sucht. Die Anhebung gilt NUR HIER, beim Anlegen:
  -- `updatePost` schreibt die Spalte über das Spalten-UPDATE-Recht direkt, und
  -- eine Invariante zu behaupten, die der zweite Schreibweg nicht hält, wäre
  -- schlimmer als keine.
  insert into public.posts (id, author_id, body, hashtags, visibility, veroeffentlicht_ab)
  values (p_post_id, v_autor, p_body, v_tags, p_visibility,
          greatest(coalesce(p_veroeffentlicht_ab, now()), now()));

  insert into public.post_media (post_id, storage_path, sort, width, height)
  select p_post_id,
         m->>'storage_path',
         (m->>'sort')::int,
         (m->>'width')::int,
         (m->>'height')::int
    from jsonb_array_elements(coalesce(p_media, '[]'::jsonb)) m;

  return p_post_id;
end $function$;

-- Rechte AUSGESPROCHEN, nicht geerbt: `alter default privileges … revoke`
-- wirkt auf Funktionen nicht, und `public` hält auf jeder neuen Funktion von
-- Haus aus EXECUTE.
revoke execute on function public.create_post_with_media(uuid,text,text,text[],text[],jsonb,timestamptz) from public, anon;
grant  execute on function public.create_post_with_media(uuid,text,text,text[],text[],jsonb,timestamptz) to authenticated;

-- ══ DIE INDIZES ════════════════════════════════════════════════════════════
-- GEMESSEN, NICHT ANGENOMMEN. Das Repo trägt ein Gegenbeispiel: in
-- `20260826170000_lesestand_und_ungelesen_zaehler.sql:69-83` forderten zwei
-- Plan-Reviewer einen zusammengesetzten Index, und der Planer wählte ihn an
-- 20 000 Zeilen NIE. Ein Index, den niemand wählt, ist nicht neutral — er
-- kostet bei jedem Insert.
--
-- Aufbau: 20 000 Beiträge im lokalen Stack, `created_at` und
-- `veroeffentlicht_ab` ABSICHTLICH auseinanderlaufend (Versatz je Zeile, sonst
-- wäre jede Aussage über die eine auch eine über die andere), abgefragt als
-- `authenticated` MIT Claims, also unter voller RLS.
--
--   Form                  | ohne Index                     | mit Index
--   --------------------- | ------------------------------ | ----------------------
--   Neueste, erste Seite  | Seq Scan + Sort (top-N)        | Index Scan, KEIN Sort
--                         | 20 692 Puffer, 58,5 ms         | 43 Puffer, 0,17 ms
--   Neueste, Cursor tief  | Seq Scan + Sort (top-N)        | Index Scan, KEIN Sort
--                         | 12 803 Puffer, 36,4 ms         | 7 961 Puffer, 1,57 ms
--   Beliebteste, 1. Seite | Incremental Sort über den      | Index Scan, KEIN Sort
--                         | alten Index, 1 517 P., 2,15 ms | 44 Puffer, 0,13 ms
--
-- Der Sortierschritt verschwindet aus dem Plan; das ist der Unterschied. Die
-- Zeiten sind Beiwerk. Bei der tiefen Cursor-Seite bleiben die Puffer hoch,
-- weil das RLS-Prädikat dort 7 880 Zeilen verwirft — der Cursor liegt tief,
-- und daran ändert kein Index etwas.
--
-- ══ UND DIE ALTEN GEHEN, STATT DANEBEN LIEGENZUBLEIBEN ═════════════════════
-- `posts_created_at_id_idx`, `posts_like_count_created_at_id_idx` und
-- `posts_video_url_idx` trugen alle drei die Ordnung `(created_at desc, id
-- desc)`. Ihr einziger Leser war der Feed, und der ordnet ab hier nach
-- `veroeffentlicht_ab`. Sie liegenzulassen hiesse Schreiblast ohne Lesenutzen.
--
-- Anders als bei AGE-660, wo ein redundanter Index BLIEB: dort stand er in
-- einer Migration mit CONCURRENTLY, also OHNE Transaktion, und ein halb
-- angewendeter `drop` wäre der schlechtere Zustand gewesen. Diese Datei trägt
-- kein CONCURRENTLY und läuft deshalb ganz oder gar nicht.
--
-- `posts_visibility_created_at_idx` bleibt UNANGETASTET: er trägt
-- `(visibility, created_at)`, dient keiner der drei Feed-Ordnungen und wurde
-- hier nicht gemessen. Ihn mitzunehmen wäre eine Entscheidung ohne Messung —
-- als Rest benannt, nicht getroffen.

create index posts_veroeffentlicht_ab_id_idx
  on public.posts (veroeffentlicht_ab desc, id desc);

create index posts_like_count_veroeffentlicht_ab_id_idx
  on public.posts (like_count desc, veroeffentlicht_ab desc, id desc);

create index posts_video_veroeffentlicht_ab_idx
  on public.posts (veroeffentlicht_ab desc, id desc)
  where video_url is not null;

drop index if exists public.posts_created_at_id_idx;
drop index if exists public.posts_like_count_created_at_id_idx;
drop index if exists public.posts_video_url_idx;

-- ══ DAS ACHTE TOR — GEFUNDEN VON DER DIFF-REVIEW ═══════════════════════════
-- Die Tor-Liste oben war NICHT geschlossen, und der Entwurf wusste es: er
-- führte `recompute_potential_score` als „bekannten Rest" und verschob die
-- Entscheidung auf den nächsten Vorgang, der den Score ohnehin anfasst.
--
-- Die Diff-Review (opencode, 29.08.) hat gezeigt, warum das nicht trägt: die
-- Funktion zählt `count(*) from public.posts where author_id = …` ohne
-- Zeitfilter, mit Gewicht 20 % und Sättigung 10
-- (`20260613230000_potential_score.sql:58`). Ein einziger geplanter Beitrag
-- hebt den Score also um rund zwei Punkte — und der Score steht Fremden über
-- `profiles_public` als Impact-Marke auf der Profilseite. Ein Beobachter sieht
-- die Zahl springen, BEVOR es den Beitrag gibt.
--
-- Das ist exakt die Fehlerklasse, die Tor 4 für `post_engagement_counts`
-- schliesst: „eine Zahl für eine unsichtbare Zeile verrät, DASS es die Zeile
-- gibt." Sie hier offen zu lassen hiesse, die zentrale Zusage dieses Changes
-- mit einer benannten Ausnahme zu versehen, die niemand liest.
--
-- Der Rumpf unten ist der aus dem lebenden Katalog gelesene, UNVERÄNDERT bis
-- auf die eine Zeile mit dem Zeitfilter.
CREATE OR REPLACE FUNCTION public.recompute_potential_score(p_profile_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_caller uuid := (select auth.uid());

  -- Saturation constants: the count at which a component reaches 100 %.
  c_activity_saturation  constant numeric := 10;
  c_recommend_saturation constant numeric := 5;

  v_completion      int;
  v_compass_themes  int;
  v_activity_count  int;
  v_recommend_count int;
  v_feedback_count  int;
  v_feedback_avg    numeric;

  r_completion numeric;
  r_compass    numeric;
  r_activity   numeric;
  r_recommend  numeric;
  r_feedback   numeric;

  v_score       int;
  v_theme       text;
  v_compass_avg numeric;
  v_signal_count int;
  v_theme_score numeric;
  v_breakdown   jsonb;
begin
  -- AuthZ: a member may only (re)compute their OWN score. service_role / migration
  -- context (auth.uid() is null) is allowed for seeds and admin recomputes.
  if v_caller is not null and v_caller <> p_profile_id then
    raise exception 'recompute_potential_score: not allowed for another profile'
      using errcode = '42501';
  end if;

  -- AGE-495 (Review 8.7, R1): und er muss seinen Zugang bestaetigt haben.
  -- Der Zweig oben ist `id = auth.uid()` — genau das, was der Kopf von
  -- 20260806080100 als „die Luecke" benennt: der Angreifer meldet sich MIT DEM
  -- VERTEILTEN PASSWORT als das Mitglied an, fuer die Datenbank IST er das
  -- Mitglied. Ohne diese Zeile berichtet die Funktion ihm Zaehlungen ueber
  -- Beitraege, Angebote, Anmeldungen und Empfehlungen des Bestohlenen und
  -- SCHREIBT `profiles.potential_score` und `profile_theme_scores` — beides an
  -- gegateten Write-Policies vorbei.
  --
  -- `v_caller is not null` bleibt noetig: Seeds und service_role laufen mit
  -- auth.uid() = null, und is_activated() waere dort false.
  if v_caller is not null and not public.is_activated() then
    raise exception 'recompute_potential_score: not activated'
      using errcode = '42501';
  end if;

  -- ── 1. Component inputs (real data) ────────────────────────────────────────
  select coalesce(profile_completion, 0) into v_completion
  from public.profiles where id = p_profile_id;
  if not found then
    raise exception 'recompute_potential_score: profile % not found', p_profile_id
      using errcode = 'P0002';
  end if;

  -- Compass: distinct themes answered with at least one numeric answer.
  select count(distinct cr.theme) into v_compass_themes
  from public.compass_responses cr
  where cr.profile_id = p_profile_id
    and cr.theme is not null
    and exists (
      select 1 from jsonb_each(coalesce(cr.answers, '{}'::jsonb)) e
      where jsonb_typeof(e.value) = 'number'
    );

  -- Aktivität: own engagement across the activity-producing tables.
  select
      -- AGE-667: NUR veroeffentlichte Beitraege. Ohne den Zeitpunkt hoebe ein
    -- geplanter Beitrag den Score seines Verfassers sofort um rund zwei Punkte
    -- (Gewicht 20 %, Saettigung 10), und der Score steht Fremden ueber
    -- `profiles_public` als Impact-Marke auf der Profilseite. Ein Beobachter
    -- saehe die Zahl springen, BEVOR es den Beitrag gibt — dieselbe
    -- Fehlerklasse, die Tor 4 fuer `post_engagement_counts` schliesst.
      (select count(*) from public.posts               where author_id  = p_profile_id
                                                         and veroeffentlicht_ab <= now())
    + (select count(*) from public.comments            where author_id  = p_profile_id)
    + (select count(*) from public.offers              where profile_id = p_profile_id)
    + (select count(*) from public.needs               where profile_id = p_profile_id)
    + (select count(*) from public.event_registrations where profile_id = p_profile_id)
  into v_activity_count;

  -- Empfehlungen: accepted incoming contact requests + awarded certifications.
  select
      (select count(*) from public.contact_requests
        where to_id = p_profile_id and status = 'accepted')
    + (select count(*) from public.profile_badges where profile_id = p_profile_id)
  into v_recommend_count;

  -- Feedback: avg rating tied to the profile (prototype proxy).
  -- AGE-300: NUR aktionsgebundenes Feedback (ref_type gesetzt). Plattform-Feedback
  -- (§3.5) ist eine Meinung ÜBER die Plattform, kein Signal über das Mitglied —
  -- ohne diesen Filter verstellte ein Gast mit seiner eigenen Bewertung seinen
  -- eigenen Score. Der Kommentar dieser Funktion sagt seit AGE-242, was gemeint
  -- war: „feedback RECEIVED is modelled later (Ebene 2)" — Feedback ÜBER das
  -- Mitglied, nicht VOM Mitglied. Bis Ebene 2 ist ref_type die beste Näherung.
  select count(*), avg(rating)
  into v_feedback_count, v_feedback_avg
  from public.feedback
  where profile_id = p_profile_id
    and rating is not null
    and ref_type is not null;

  -- ── 2. Normalize to 0..1 ───────────────────────────────────────────────────
  r_completion := least(greatest(v_completion, 0) / 100.0, 1);
  r_compass    := least(v_compass_themes / 4.0, 1);
  r_activity   := least(v_activity_count / c_activity_saturation, 1);
  r_recommend  := least(v_recommend_count / c_recommend_saturation, 1);
  r_feedback   := case
                    when coalesce(v_feedback_count, 0) = 0 then 0
                    else least(greatest((v_feedback_avg - 1) / 4.0, 0), 1)
                  end;

  -- ── 3. Weighted sum → 0..100 ───────────────────────────────────────────────
  v_score := round(100 * (
      0.30 * r_completion
    + 0.25 * r_compass
    + 0.20 * r_activity
    + 0.15 * r_recommend
    + 0.10 * r_feedback
  ))::int;

  update public.profiles set potential_score = v_score where id = p_profile_id;

  -- ── 4. Erfolgsradar: theme scores (compass primary, activity fallback) ─────
  foreach v_theme in array array['sein', 'tun', 'haben', 'wirken'] loop
    select avg((e.value #>> '{}')::numeric) into v_compass_avg
    from public.compass_responses cr
    cross join lateral jsonb_each(coalesce(cr.answers, '{}'::jsonb)) e
    where cr.profile_id = p_profile_id
      and cr.theme = v_theme
      and jsonb_typeof(e.value) = 'number';

    if v_compass_avg is not null then
      v_theme_score := least(greatest(v_compass_avg, 0), 10);
    else
      select
          (select count(*) from public.offers
            where profile_id = p_profile_id and theme = v_theme)
        + (select count(*) from public.needs
            where profile_id = p_profile_id and theme = v_theme)
        + (select count(*) from public.profile_interests
            where profile_id = p_profile_id and theme = v_theme)
      into v_signal_count;
      v_theme_score := least(v_signal_count * 2.0, 10);
    end if;

    insert into public.profile_theme_scores (profile_id, theme, score)
    values (p_profile_id, v_theme, round(v_theme_score, 1))
    on conflict (profile_id, theme) do update set score = excluded.score;
  end loop;

  -- ── 5. Transparent breakdown (points = weight × ratio) ─────────────────────
  v_breakdown := jsonb_build_object(
    'score', v_score,
    'components', jsonb_build_array(
      jsonb_build_object(
        'key', 'completion', 'label', 'Profilvollständigkeit', 'weight', 30,
        'points', round(30 * r_completion, 1),
        'detail', v_completion || ' % ausgefüllt'),
      jsonb_build_object(
        'key', 'compass', 'label', 'Kompass', 'weight', 25,
        'points', round(25 * r_compass, 1),
        'detail', v_compass_themes || '/4 Themen beantwortet'),
      jsonb_build_object(
        'key', 'activity', 'label', 'Aktivität', 'weight', 20,
        'points', round(20 * r_activity, 1),
        'detail', v_activity_count || ' Aktivitäten'),
      jsonb_build_object(
        'key', 'recommendations', 'label', 'Empfehlungen', 'weight', 15,
        'points', round(15 * r_recommend, 1),
        'detail', v_recommend_count || ' Empfehlungen'),
      jsonb_build_object(
        'key', 'feedback', 'label', 'Feedback', 'weight', 10,
        'points', round(10 * r_feedback, 1),
        'detail', case
                    when coalesce(v_feedback_count, 0) = 0 then 'Noch kein Feedback'
                    else round(v_feedback_avg, 1) || ' ★ Ø (' || v_feedback_count || ')'
                  end)
    )
  );

  return v_breakdown;
end;
$function$;
