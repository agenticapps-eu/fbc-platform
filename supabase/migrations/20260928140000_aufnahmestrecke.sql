-- AGE-927 — Die Aufnahmestrecke: angelegt → eingeladen → bestätigt.
--
-- Der Reiter „Nicht aktiviert" wirft heute zwei Gruppen in einen Topf. Auf PROD
-- am 28.09. gemessen: 50 unbestätigte Profile, davon 15 mit einem je erzeugten
-- Zugangslink und 35 **nie eingeladen**. Detlev kann nicht erkennen, wen er noch
-- einladen muss und wen er nur erinnern muss.
--
-- ══ ENTSCHEIDUNG 1: ABGELEITET, NICHT GESPEICHERT ═══════════════════════════
-- Es entsteht keine Spalte in `profiles`, kein Flag, kein Trigger. Die Wahrheit
-- steht in `activation_tokens` und wird dort von `issue_activation_token`
-- geschrieben. Eine zweite Ablage müsste synchron gehalten werden, und jeder
-- Weg, auf dem ein Token entsteht, ohne die Kopie zu berühren, machte die Liste
-- STILL falsch. Abgeleitet kann sie nicht auseinanderlaufen.
--
-- Der Preis ist ein Blick je Zeile. Er ist bezahlbar, und zwar nachgemessen:
-- `activation_tokens_profil_zeit` steht auf `(profile_id, created_at desc)` —
-- genau die Form, die `max(created_at)` je Profil will.
--
-- ══ ENTSCHEIDUNG 2: EIN ARGUMENT, KEIN `exists` IM RUMPF ════════════════════
-- `member_state_matches` bekommt den Einladungszeitpunkt als FÜNFTES ARGUMENT
-- gereicht, statt selbst in `activation_tokens` zu sehen. Damit bleibt sie
-- `immutable`: sie entscheidet weiter allein aus ihren Argumenten, und der
-- Planer darf sie in den Filter ziehen. Läse sie selbst, wäre sie `stable` und
-- müsste je Zeile als Blackbox aufgerufen werden.
--
-- ══ ENTSCHEIDUNG 3: `offen` BLEIBT ═════════════════════════════════════════
-- `angelegt` und `eingeladen` TEILEN `offen` auf, sie ersetzen es nicht. Der
-- Wert hat nach dieser Änderung keinen Reiter mehr — das ist zu benennen und
-- nicht zu verschweigen, genau wie es `aktiviert` bisher erging. Er bleibt,
-- weil er die Frage „wer wartet noch?" beantwortet, weil Lesezeichen ihn
-- tragen, und weil die Summenzusage (`angelegt + eingeladen = offen`) ihn
-- braucht, um überhaupt prüfbar zu sein.
--
-- ══ WARUM ABWURF UND NEUANLAGE, UND IN WELCHER REIHENFOLGE ═════════════════
-- `member_state_matches` ändert ihre SIGNATUR, `admin_list_members` ihren
-- RÜCKGABETYP. `create or replace` kann beides nicht; bei der Signatur legte es
-- sogar eine ZWEITE Funktion an, und ein Aufruf mit vier Argumenten wäre danach
-- mehrdeutig.
--
-- Gemessen, nicht vermutet: `member_state_matches` ist `sql`, ihre beiden
-- Aufrufer sind `plpgsql` — deren Rümpfe sind Zeichenketten, aus denen
-- PostgreSQL keine Abhängigkeit einträgt. In `pg_depend` steht für alle drei
-- NULL Referent. Der Abwurf scheitert also nicht an einem Aufrufer; er bricht
-- ihn **still**, bis er in derselben Transaktion neu entsteht. Deshalb erst die
-- Aufrufer abwerfen, dann die Bedingung — und kein `cascade`, das Objekte
-- mitnähme, die diese Migration nicht kennt.
--
-- `admin_member_counts` wird NICHT abgeworfen: sie liefert
-- `TABLE(status text, anzahl bigint)`, also ZEILEN je Zustand und keine Spalte
-- je Zustand. Zwei zusätzliche Zustände sind zwei zusätzliche Zeilen, ihr
-- Rückgabetyp bleibt gleich, `create or replace` genügt — und behält Grants und
-- Kommentar, die ein `drop` mitnähme.
--
-- ══ WAS EIN `drop` MITNIMMT UND HIER WIEDERKOMMT ═══════════════════════════
-- Grants, Kommentar, Parameter-Vorgabewerte und der `revoke`. Der teuerste
-- Verlust wären die Vorgabewerte: ein argumentloser Aufruf meldete sonst
-- „function does not exist" statt der zugesicherten `42501`, und die Anforderung
-- sagt genau diesen Unterschied zu. `default privileges` wirken auf Funktionen
-- NICHT — der `revoke` muss ausgesprochen werden.
--
-- ══ WAS `eingeladen_am` NICHT SAGT ═════════════════════════════════════════
-- Dass eine Mail ankam. Es sagt: ein Link wurde ERZEUGT. Der Versand quittiert
-- anderswo, und ein 202 belegt nichts. Ein abgelehnter Versand entwertet das
-- Token, lässt seine Zeile aber stehen — das Mitglied steht dann in
-- „eingeladen", obwohl nichts ankam. Das ist benannt statt wegdefiniert: der
-- Bericht der Einladungsfläche nennt die Ablehnung, und eine erneute Einladung
-- ist sofort möglich, weil ein entwertetes Token das 24-Stunden-Schutzfenster
-- nicht hält.
--
-- Forward-only.

-- ── 1. Die Aufrufer abwerfen, dann die Bedingung ───────────────────────────
drop function if exists public.admin_list_members(text, text, int, int);
drop function if exists public.member_state_matches(text, timestamptz, timestamptz, timestamptz);

-- ── 2. Die geteilte Zustandsbedingung, jetzt mit fünftem Argument ───────────
create function public.member_state_matches(
  p_status        text,
  p_activated_at  timestamptz,
  p_disabled_at   timestamptz,
  p_deleted_at    timestamptz,
  p_eingeladen_am timestamptz
) returns boolean
language sql
immutable
set search_path = ''
as $$
  select case p_status
           when 'deaktiviert' then p_disabled_at is not null and p_deleted_at is null
           when 'geloescht'   then p_deleted_at is not null
           when 'aktiviert'   then p_activated_at is not null
                               and p_disabled_at is null and p_deleted_at is null
           when 'offen'       then p_activated_at is null
                               and p_disabled_at is null and p_deleted_at is null
           -- Die beiden neuen teilen `offen` an genau einer Stelle: ob je ein
           -- Token erzeugt wurde. Alles andere ist wörtlich die Bedingung von
           -- `offen` — auseinanderlaufen können sie deshalb nicht.
           when 'angelegt'    then p_activated_at is null and p_eingeladen_am is null
                               and p_disabled_at is null and p_deleted_at is null
           when 'eingeladen'  then p_activated_at is null and p_eingeladen_am is not null
                               and p_disabled_at is null and p_deleted_at is null
           else                    p_disabled_at is null and p_deleted_at is null
         end;
$$;

-- Rechte werden ausgesprochen, nicht geerbt (AGE-312), und ein `drop` nimmt sie
-- mit. Hier wird NUR entzogen: die Funktion ist keine Fläche, sondern eine
-- Bedingung. Beide Aufrufer sind SECURITY DEFINER mit Eigentümer `postgres`,
-- und dort prüft PostgreSQL das Ausführungsrecht gegen den EIGENTÜMER.
revoke execute on function
  public.member_state_matches(text, timestamptz, timestamptz, timestamptz, timestamptz)
  from public, anon;

comment on function
  public.member_state_matches(text, timestamptz, timestamptz, timestamptz, timestamptz) is
  'Die EINE Zustandsbedingung der Mitgliederverwaltung (AGE-587, erweitert '
  'AGE-927). Beantwortet „gehoert eine Zeile mit diesen Zeitstempeln in den '
  'Zustand p_status?" fuer alle|aktiviert|offen|angelegt|eingeladen|'
  'deaktiviert|geloescht; p_status = null verhaelt sich wie alle. `angelegt` '
  'und `eingeladen` TEILEN `offen` auf und ersetzen es nicht — ihre Summe ist '
  'es. Das fuenfte Argument ist der Zeitpunkt der juengsten Token-Ausgabe; die '
  'Funktion LIEST ihn nicht selbst, damit sie immutable bleibt. Angewendet von '
  'admin_list_members UND admin_member_counts — GETEILT und nicht '
  'abgeschrieben, damit die Zahl an einem Reiter und die Zeilen dahinter nicht '
  'auseinanderlaufen koennen. Prueft KEINE Rechte: das tut jeder Aufrufer selbst.';

-- ── 3. `admin_list_members` mit `eingeladen_am` ────────────────────────────
create function public.admin_list_members(
  p_query  text default null,
  p_status text default null,
  p_limit  int  default 50,
  p_offset int  default 0
) returns table (
  id uuid, name text, avatar_url text, cover_url text, region text,
  company text, short_bio text, branche text, tier text, roles text[],
  competencies text[], has_offers boolean, has_needs boolean,
  offer_categories text[], need_categories text[], login_email text,
  bestaetigt boolean, eingeladen_am timestamptz, member_since date,
  deaktiviert_seit timestamptz, geloescht_seit timestamptz,
  paid_until date, payment_type text, gebannt boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  muster text;
begin
  if not public.is_admin() then
    raise exception 'forbidden: admin_list_members' using errcode = '42501';
  end if;

  if p_status is not null and p_status not in
     ('alle', 'aktiviert', 'offen', 'angelegt', 'eingeladen', 'deaktiviert', 'geloescht') then
    raise exception 'unbekannter Status: %', p_status using errcode = '22023';
  end if;

  muster := case
    when coalesce(btrim(p_query), '') = '' then null
    else '%' || replace(replace(replace(btrim(p_query), '!', '!!'), '%', '!%'), '_', '!_') || '%'
  end;

  return query
    select
      p.id, p.name, p.avatar_url, p.cover_url, p.region, p.company, p.short_bio,
      p.branche, p.tier, p.roles, p.competencies,
      exists (select 1 from public.offers o where o.profile_id = p.id) as has_offers,
      exists (select 1 from public.needs  n where n.profile_id = p.id) as has_needs,
      coalesce((select array_agg(distinct o.category order by o.category)
                  from public.offers o
                 where o.profile_id = p.id and o.category is not null), '{}'::text[]),
      coalesce((select array_agg(distinct n.category order by n.category)
                  from public.needs n
                 where n.profile_id = p.id and n.category is not null), '{}'::text[]),
      u.email::text,
      (p.activated_at is not null),
      tok.eingeladen_am,
      p.member_since,
      p.disabled_at,
      p.deleted_at,
      pl.paid_until,
      pl.payment_type,
      public.is_banned(p.id)
    from public.profiles p
    join auth.users u on u.id = p.id
    -- Kein `join`: ein Mitglied ohne Altdatenzeile fiele sonst aus der Liste.
    left join public.profile_legacy pl on pl.profile_id = p.id
    -- EIN `left join lateral`, benutzt von der Spalte UND vom Filter. Zweimal
    -- geschrieben liefe die Ableitung auseinander — und genau das ist der
    -- Fehler, den die geteilte Bedingung eine Ebene tiefer vermeidet.
    left join lateral (
      select max(t.created_at) as eingeladen_am
        from public.activation_tokens t
       where t.profile_id = p.id
    ) tok on true
    where (muster is null
           or p.name ilike muster escape '!'
           or u.email ilike muster escape '!')
      and public.member_state_matches(p_status, p.activated_at, p.disabled_at,
                                      p.deleted_at, tok.eingeladen_am)
    order by (p.activated_at is not null), p.name, p.id
    -- Ein ausdrückliches `null` wirkt sonst als „ohne Grenze", nicht als
    -- Vorgabewert (AGE-566, Befund 2).
    limit coalesce(p_limit, 50) offset coalesce(p_offset, 0);
end $$;

-- Erst ENTZIEHEN, dann geben. Ein `create function` gibt PUBLIC das
-- Ausführungsrecht mit; der Abwurf hat den alten `revoke` mitgenommen, und
-- `default privileges` wirken auf Funktionen NICHT. Ohne diese Zeile darf anon
-- die Mitgliederliste aufrufen — die Abwehr sässe dann allein im `is_admin()`
-- des Rumpfes, und die Zusage „anon haelt kein EXECUTE" wäre still gebrochen.
revoke execute on function public.admin_list_members(text, text, int, int) from public, anon;
grant  execute on function public.admin_list_members(text, text, int, int) to authenticated;

comment on function public.admin_list_members(text, text, int, int) is
  'Mitgliederliste fuer die Admin-Flaeche (AGE-566, erweitert AGE-927). '
  'Schliesst unbestaetigte, deaktivierte und geloeschte Profile ein — sie ist '
  'die einzige Flaeche, auf der ein so abgeschaltetes Mitglied noch vorkommt. '
  'Prueft is_admin() im Rumpf und bricht sonst mit 42501 ab; ein unbekannter '
  'p_status bricht mit 22023 ab, statt still wie `alle` zu wirken. '
  '`eingeladen_am` ist der Zeitpunkt der JUENGSTEN Token-Ausgabe, abgeleitet '
  'aus activation_tokens — er sagt „ein Link wurde ERZEUGT" und NICHT „eine '
  'Mail kam an". Die Tabelle bleibt dabei fuer anon und authenticated '
  'unerreichbar; der Weg fuehrt ausschliesslich ueber diese DEFINER-Funktion.';

-- ── 4. `admin_member_counts` zählt die beiden neuen mit ────────────────────
-- Kein Abwurf: der Rückgabetyp bleibt `TABLE(status, anzahl)`. Die Funktion
-- muss trotzdem neu deklariert werden, weil ihr Rumpf die alte Vier-Argument-
-- Signatur nennt, die es nicht mehr gibt.
create or replace function public.admin_member_counts()
returns table (status text, anzahl bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  -- `raise` und nicht „leer", anders als bei admin_list_feedback: eine Zeile
  -- mit lauter Nullen wäre eine Aussage über den Bestand, und wer kein Recht am
  -- Bestand hat, darf sie nicht bekommen.
  if not public.is_admin() then
    raise exception 'forbidden: admin_member_counts' using errcode = '42501';
  end if;

  return query
    select s.status,
           (select count(*)
              from public.profiles p
              left join lateral (
                select max(t.created_at) as eingeladen_am
                  from public.activation_tokens t
                 where t.profile_id = p.id
              ) tok on true
             where public.member_state_matches(
                     s.status, p.activated_at, p.disabled_at, p.deleted_at,
                     tok.eingeladen_am))
      from unnest(array['alle', 'aktiviert', 'offen', 'angelegt', 'eingeladen',
                        'deaktiviert', 'geloescht']) as s(status);
end $$;

comment on function public.admin_member_counts() is
  'Anzahl je Zustand fuer die Reiter der Admin-Mitgliederliste (AGE-587, '
  'erweitert AGE-927). Global und NICHT vom Suchbegriff eingeschraenkt: der '
  'Reiter beantwortet „wie viele gibt es", nicht „wie viele passen". Wendet '
  'dieselbe member_state_matches an wie admin_list_members — GETEILT, damit '
  'die Zahl an einem Reiter und die Zeilen dahinter nicht auseinanderlaufen. '
  'Deshalb gilt angelegt + eingeladen = offen als FOLGE und nicht als Zusage, '
  'die jemand einhalten muesste. SECURITY DEFINER aus demselben Grund wie '
  'admin_list_members — ein Nicht-Admin bekommt 42501 und keine Nullzeile.';

-- ── 5. Schlussprüfung: die Leiter der Zustände steht ───────────────────────
-- Geprüft wird, was kein Fremdschlüssel fängt: dass beide neuen Zweige
-- existieren UND dass sie `offen` wirklich aufteilen. Eine Gegenprobe mit
-- vertauschter Bedingung würde hier abbrechen.
do $$
declare
  v_angelegt   boolean;
  v_eingeladen boolean;
begin
  select public.member_state_matches('angelegt', null, null, null, null)
    into v_angelegt;
  select public.member_state_matches('eingeladen', null, null, null, now())
    into v_eingeladen;

  if not (v_angelegt and v_eingeladen) then
    raise exception
      'AGE-927: die Aufnahmestrecke steht nicht — angelegt=% eingeladen=%',
      v_angelegt, v_eingeladen;
  end if;

  -- Und die Gegenrichtung, die der Flüchtigkeitsfehler trifft: ein Profil MIT
  -- Token darf nicht `angelegt` sein, eines ohne nicht `eingeladen`.
  if public.member_state_matches('angelegt', null, null, null, now())
     or public.member_state_matches('eingeladen', null, null, null, null) then
    raise exception
      'AGE-927: angelegt und eingeladen sind vertauscht oder decken sich';
  end if;
end $$;
