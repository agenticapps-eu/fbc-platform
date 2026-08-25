-- Zähler an den Reitern, Blätterung im QM-Feedback (AGE-587).
-- Donald, 2026-08-25. Change: openspec/changes/admin-und-profilflaechen/.
--
-- ══ BEFUND ══════════════════════════════════════════════════════════════════
-- Drei Dinge fehlen der Verwaltung, und alle drei enden in der Datenbank:
--
--   1. Die fünf Reiter der Mitgliederliste sagen nicht, wie viele Mitglieder
--      hinter ihnen stehen. Die Liste weiß es, die Reiter nicht.
--   2. `admin_list_feedback()` ist argumentlos und liefert JEDE Feedback-Zeile
--      auf einmal. Das ist die letzte listende Fläche ohne Blätterung.
--   3. Die Feedback-Zeile trägt den NAMEN ihres Verfassers, aber nicht seine
--      Kennung — sie ist damit lesbar, aber nicht verknüpfbar.
--
-- ══ ENTSCHEIDUNG 1: EINE GETEILTE BEDINGUNG, KEINE ZWEITE ABSCHRIFT ═════════
-- Die Zahl an einem Reiter und die Zeilen dahinter müssen dasselbe meinen.
-- Der naheliegende Weg wäre, die Zustandsbedingung in der neuen Zähl-Funktion
-- noch einmal hinzuschreiben — fünf Zeilen, abgeschrieben aus
-- `20260824100000_admin_member_list_ban.sql:128-136`.
--
-- Das ist genau die Bauart, die der Plan-Review dieses Changes als nicht
-- tragfähig erwiesen hat, und dieses Repo hat die Regel am Vortag selbst
-- aufgeschrieben (Sidebar-Migration, AGE-582): eine Abschrift, die nur ein Test
-- zusammenhält, kann auf einem AUSGEWOGENEN Bestand grün bleiben, während ein
-- Zweig falsch ist. Der Test vergleicht dann zwei Zahlen, die zufällig gleich
-- sind, und belegt nichts.
--
-- `member_state_matches` ist deshalb die EINE Bedingung, die beide Funktionen
-- anwenden. Sie hat nichts, wovon sie abdriften könnte.
--
-- VERWORFEN: die Zähler in `admin_list_members` mitzuliefern (eine Funktion
-- weniger, eine Anfrage weniger). Signatur und Spaltensatz dieser Funktion sind
-- je durch eine ausdrückliche Zusage bewacht — sie zu erweitern machte aus zwei
-- Wächtern zwei Hindernisse, und die Zahlen sind global, während die Liste
-- gefiltert und geblättert ist. Zwei verschiedene Fragen, zwei Funktionen.
--
-- ══ ENTSCHEIDUNG 2: `id desc` IST KEINE KOSMETIK ═══════════════════════════
-- `order by created_at desc` allein ist bei gleichen Zeitstempeln KEINE
-- Gesamtordnung. PostgreSQL darf gleichrangige Zeilen dann in beliebiger
-- Reihenfolge liefern, und zwischen zwei Aufrufen anders — dieselbe Zeile kann
-- auf Seite 1 UND auf Seite 2 stehen, eine andere auf keiner. Ohne zweiten
-- Ordnungsschlüssel ist Offset-Blätterung ein Glücksspiel.
--
-- Der Fall ist nicht theoretisch: die Feedback-Fixtures dieses Projekts
-- entstehen alle in derselben Transaktion mit demselben `now()`, und ein
-- Formular, das mehrere Zeilen in derselben Sekunde annimmt, erzeugt ihn in
-- Produktion. `id desc` macht die Ordnung total.
--
-- ══ ENTSCHEIDUNG 3: KLEMMEN, ABER NUR DIE SEITE ════════════════════════════
-- `p_limit` wird auf 1..100 geklemmt, `null` fällt auf die Vorgabe zurück; ein
-- negativer `p_offset` wird zu 0. Dem Vorbild von `feed_top_authors` folgend:
-- eine listende Funktion hat keinen Fehlerfall, den ein Aufrufer sinnvoll
-- behandeln könnte, und ein `raise` machte aus einer Liste einen Seitenfehler.
--
-- NICHT geklemmt wird der ZUGANG. `where public.is_activated() and
-- public.is_admin()` bleibt Zeichen für Zeichen stehen: sieben bestehende
-- Zusagen beschreiben genau dieses Verhalten, und es auf ein `raise` zu drehen
-- wäre eine Änderung, die niemand bestellt hat.
--
-- Zur ZÄHL-Funktion dagegen gehört ein `raise` mit `42501`, wie
-- `admin_list_members` es tut. Der Unterschied ist gewollt: eine leere Liste
-- ist eine gültige Antwort, eine Zeile mit lauter Nullen wäre eine AUSSAGE ÜBER
-- DEN BESTAND. Wer kein Recht am Bestand hat, darf sie nicht bekommen.
--
-- ══ ENTSCHEIDUNG 4: `profile_id` GEHT MIT, OHNE HEUTIGEN AUFRUFER ══════════
-- Ein bewusster Verstoß gegen „keine Flexibilität für Aufrufer, die es nicht
-- gibt". Die Funktion wird für die Blätterung ohnehin abgerissen und neu
-- gebaut; die Spalte jetzt mitzunehmen kostet ein Wort, sie später nachzureichen
-- kostet eine zweite Migration, die dieselbe Funktion ein zweites Mal abreißt.
-- Eine Preisgabe ist sie nicht: der Admin sieht den Namen des Verfassers heute
-- schon, die Kennung fügt nichts hinzu — sie macht das Vorhandene benutzbar.
--
-- ══ WARUM `drop` UND NICHT `create or replace` (nur bei der Feedback-RPC) ══
-- Der Rückgabetyp ändert sich (`profile_id` kommt hinzu), und `create or
-- replace` kann ihn nicht ändern. Grants und Kommentar kommen deshalb unten
-- wieder mit. `admin_list_members` dagegen behält Rückgabetyp UND Signatur
-- Zeichen für Zeichen — dort genügt `create or replace`, und das ist zugleich
-- der Beleg, dass sich an ihrer Außenseite nichts geändert hat.
--
-- Keine Tabelle, keine Spalte, kein Datenzugriff — der Golden-Snapshot in
-- `grants_test.sql` bricht an neuen TABELLEN, nicht an Funktionen.
--
-- Forward-only.

-- ── 1. Die geteilte Zustandsbedingung ───────────────────────────────────────
-- Wörtlich der `case p_status` aus `admin_list_members`, samt seiner
-- Begründung: `case p_status when …` und kein `or`-Gestrüpp, weil bei `null`
-- keine Verzweigung trifft (Gleichheit mit null ist null) und damit `else`
-- greift — dieselbe Bedingung wie bei `alle`. Genau das sagt die Anforderung zu.
--
-- `immutable` und nicht `stable`: die Funktion liest nichts, sie entscheidet
-- allein aus ihren vier Argumenten. Damit darf der Planer sie in den Filter
-- hineinziehen, statt sie je Zeile als Blackbox aufzurufen.
create function public.member_state_matches(
  p_status       text,
  p_activated_at timestamptz,
  p_disabled_at  timestamptz,
  p_deleted_at   timestamptz
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
           else                    p_disabled_at is null and p_deleted_at is null
         end;
$$;

-- Rechte werden ausgesprochen, nicht geerbt (AGE-312). Hier wird NUR entzogen:
-- die Funktion ist keine Fläche, sondern eine Bedingung. Beide Aufrufer sind
-- SECURITY DEFINER mit Eigentümer `postgres`, und dort prüft PostgreSQL das
-- Ausführungsrecht gegen den EIGENTÜMER, nicht gegen den Aufrufer — derselbe
-- Weg, den `is_banned` in AGE-581 ging. `authenticated` braucht also kein
-- Recht, und keines zu vergeben ist die engere Fassung.
revoke execute on function
  public.member_state_matches(text, timestamptz, timestamptz, timestamptz)
  from public, anon;

comment on function
  public.member_state_matches(text, timestamptz, timestamptz, timestamptz) is
  'Die EINE Zustandsbedingung der Mitgliederverwaltung (AGE-587). Beantwortet '
  '„gehoert eine Zeile mit diesen drei Zeitstempeln in den Zustand p_status?" '
  'fuer alle|aktiviert|offen|deaktiviert|geloescht; p_status = null verhaelt '
  'sich wie alle. Angewendet von admin_list_members UND admin_member_counts — '
  'GETEILT und nicht abgeschrieben, damit die Zahl an einem Reiter und die '
  'Zeilen dahinter nicht auseinanderlaufen koennen. Prueft KEINE Rechte: das '
  'tut jeder Aufrufer selbst.';

-- ── 2. `admin_list_members`: derselbe Rumpf, eine Bedingung weniger ─────────
-- Signatur, Rückgabetyp und Spaltensatz bleiben Zeichen für Zeichen gleich.
-- Die Abnahme dieses Schritts ist, dass `admin_member_list_test.sql`
-- UNVERÄNDERT grün bleibt — nicht angepasst, unverändert. Die fünf
-- `::regprocedure`-Casts dort benennen die Funktionsidentität; zeigte einer auf
-- eine Signatur, die es nicht mehr gibt, wäre eine Zusage ungeprüft statt rot.
create or replace function public.admin_list_members(
  p_query  text default null,
  p_status text default null,
  p_limit  int  default 50,
  p_offset int  default 0
)
returns table (
  id               uuid,
  name             text,
  avatar_url       text,
  region           text,
  company          text,
  short_bio        text,
  branche          text,
  tier             text,
  roles            text[],
  competencies     text[],
  has_offers       boolean,
  has_needs        boolean,
  offer_categories text[],
  need_categories  text[],
  login_email      text,
  bestaetigt       boolean,
  member_since     date,
  deaktiviert_seit timestamptz,
  geloescht_seit   timestamptz,
  paid_until       date,
  payment_type     text,
  gebannt          boolean
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
     ('alle', 'aktiviert', 'offen', 'deaktiviert', 'geloescht') then
    raise exception 'unbekannter Status: %', p_status using errcode = '22023';
  end if;

  muster := case
    when coalesce(btrim(p_query), '') = '' then null
    else '%' || replace(replace(replace(btrim(p_query), '!', '!!'), '%', '!%'), '_', '!_') || '%'
  end;

  return query
    select
      p.id, p.name, p.avatar_url, p.region, p.company, p.short_bio,
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
    where (muster is null
           or p.name ilike muster escape '!'
           or u.email ilike muster escape '!')
      -- Der `case`-Ausdruck, der hier stand, ist jetzt `member_state_matches`.
      -- Er ist nicht verschwunden, sondern GETEILT: `admin_member_counts`
      -- wendet dieselbe Funktion an. Sein Verhalten bei `p_status = null` ist
      -- unverändert — die Verzweigung trifft nicht, `else` greift, und das ist
      -- dieselbe Bedingung wie bei `alle`.
      and public.member_state_matches(p_status, p.activated_at, p.disabled_at, p.deleted_at)
    order by (p.activated_at is not null), p.name, p.id
    -- Ein ausdrückliches `null` wirkt sonst als „ohne Grenze", nicht als
    -- Vorgabewert (AGE-566, Befund 2).
    limit coalesce(p_limit, 50) offset coalesce(p_offset, 0);
end $$;

-- ── 3. Die Zähler ───────────────────────────────────────────────────────────
-- Eine Zeile je Zustand, EINSCHLIESSLICH der mit null. „Keine Zahl" und „die
-- Zahl null" sind zwei verschiedene Auskünfte, und ein Reiter, dessen Zeile
-- fehlt, zeigt sonst gar nichts statt einer Null (die Lehre aus AGE-582, 6.6).
-- Deshalb `unnest` über die fünf Zustände und ein `count(*) filter`, nicht ein
-- `group by` über den Bestand: ein `group by` liefert nur Zustände, die
-- vorkommen.
--
-- Die Zahlen sind GLOBAL. Es gibt bewusst kein `p_query`: der Reiter
-- beantwortet „wie viele gibt es", nicht „wie viele meiner Treffer" — und die
-- Antwort darauf ändert sich nicht dadurch, dass jemand einen Namen eintippt.
create function public.admin_member_counts()
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
             where public.member_state_matches(
                     s.status, p.activated_at, p.disabled_at, p.deleted_at))
      from unnest(array['alle', 'aktiviert', 'offen', 'deaktiviert', 'geloescht'])
             as s(status);
end $$;

revoke execute on function public.admin_member_counts() from public, anon;
grant  execute on function public.admin_member_counts() to authenticated;

comment on function public.admin_member_counts() is
  'Wie viele Mitglieder in jedem Zustand stehen (AGE-587). Eine Zeile je '
  'Zustand — alle|aktiviert|offen|deaktiviert|geloescht — EINSCHLIESSLICH der '
  'mit der Zahl null, weil ein fehlender Reiter etwas anderes aussagt als ein '
  'leerer. Wendet dieselbe member_state_matches an wie admin_list_members, '
  'damit Zahl und Zeilen nicht auseinanderlaufen. Die Zahlen sind GLOBAL und '
  'engen sich bei aktiver Suche NICHT ein: der Reiter beantwortet „wie viele '
  'gibt es". SECURITY DEFINER aus demselben Grund wie admin_list_members — ein '
  'Profil mit activated_at is null ist ueber jeden anderen Lesepfad fuer '
  'niemanden sichtbar. Bricht fuer Nicht-Admins mit 42501 ab statt Nullen zu '
  'liefern.';

-- ── 4. Feedback: Blätterung, totale Ordnung, `profile_id` ───────────────────
drop function public.admin_list_feedback();

create function public.admin_list_feedback(
  p_limit  int default 25,
  p_offset int default 0
)
returns table (id uuid, rating integer, likes text, misses text, idea text,
               route text, ref_type text, created_at timestamptz,
               author_name text, profile_id uuid)
language sql stable security definer set search_path = ''
as $$
  select f.id, f.rating, f.likes, f.misses, f.idea, f.route, f.ref_type,
         f.created_at, coalesce(p.name, '—') as author_name, f.profile_id
  from public.feedback f
  left join public.profiles p on p.id = f.profile_id
  where public.is_activated() and public.is_admin()   -- AGE-495, unveraendert
  -- `id desc` ist der zweite Ordnungsschluessel und keine Kosmetik: siehe
  -- ENTSCHEIDUNG 2 im Kopf. Ohne ihn ist die Ordnung bei gleichen Zeitstempeln
  -- nicht total, und dieselbe Zeile kann auf zwei Seiten stehen.
  order by f.created_at desc, f.id desc
  -- Geklemmt, nicht abgewiesen: 1..100, `null` faellt auf die Vorgabe zurueck.
  limit  least(greatest(coalesce(p_limit, 25), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

-- Die zwei Dinge, die der `drop` mitgenommen hat. Die Vorgabewerte stehen
-- bereits in der Signatur oben — ohne sie meldete `admin_list_feedback()` einen
-- `42883`, und fuenf bestehende Zusagen in `rls_test.sql` (479, 486, 491, 496,
-- 769) rufen die Funktion ARGUMENTLOS auf. Sie bleiben damit stehen und werden
-- dadurch zu Waechtern ueber genau diese Vorgabewerte.
revoke execute on function public.admin_list_feedback(int, int) from public, anon;
grant  execute on function public.admin_list_feedback(int, int) to authenticated;

comment on function public.admin_list_feedback(int, int) is
  'QM-Feedback fuer Admins, geblaettert (AGE-358, Blaetterung AGE-587). '
  'SECURITY DEFINER, WEIL der Join auf profiles den Autor-Namen auch bei '
  'nicht-oeffentlichen Profilen aufloesen muss. Gibt Zeilen NUR zurueck, wenn '
  'is_activated() and is_admin() — ein Nicht-Admin (auch matching_manager) '
  'bekommt eine leere Liste und KEINEN Fehler; sieben Zusagen beschreiben '
  'genau dieses Verhalten. p_limit auf 1..100 geklemmt statt abgewiesen, null '
  'faellt auf 25 zurueck; p_offset auf >= 0. Ordnung created_at desc, id desc '
  '— der zweite Schluessel macht sie TOTAL und ist die Voraussetzung dafuer, '
  'dass Offset-Blaetterung keine Zeile doppelt oder gar nicht zeigt. '
  'profile_id geht mit, damit die Zeile verknuepfbar ist und nicht nur lesbar.';
