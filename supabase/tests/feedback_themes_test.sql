-- Die Themenliste des Feedbacks als Tabelle (AGE-628).
-- Change: openspec/changes/feedback-ausbauen/, Einheit 1, Aufgaben 1.1–1.3.
--
-- Echtes pgTAP mit plan()/finish(). Diese Datei ist in ci.yml eingetragen —
-- ohne diesen Eintrag liefe sie nie, und genau das ist hier schon zweimal
-- passiert. `plan()` allein ist kein Beleg dafuer, dass eine Datei laeuft.
--
-- ══ DIE ZUSAGE, UM DIE ES GEHT ═════════════════════════════════════════════
-- Die Themen sind DATEN, keine abgeschriebene Menge.
--
-- Ein `CHECK` mit Textliteralen waere fuer die Datenbank eine Menge, fuer die
-- Oberflaeche aber nichts — sie kann ihn nicht lesen. Die Liste stuende ein
-- zweites Mal in TypeScript, samt Beschriftung und Reihenfolge, und nichts
-- wuerde die Abschriften vergleichen (design.md, Entscheidung 1).
--
-- Deshalb prueft diese Datei nicht nur, DASS es die Tabelle gibt, sondern dass
-- ein Mitglied sie auch WIRKLICH LIEST — mit Beschriftung und in der
-- vorgesehenen Reihenfolge. Eine Katalogzusage allein waere gruen, waehrend die
-- Oberflaeche eine leere Liste bekommt.
--
-- ══ FALLEN, DIE DIESES PROJEKT SCHON GESTELLT HAT ══════════════════════════
--   * RLS OHNE Policy liefert der Oberflaeche eine leere Liste — ein Fehlerbild,
--     das aussieht wie „es gibt keine Themen". Zusage 12 prueft die Policy
--     ausdruecklich, nicht nur `relrowsecurity`.
--   * Neue Tabellen ERBEN hier keine Rechte. Ein `grant select` muss
--     ausgesprochen sein; Zusage 13 prueft ihn.
--   * Ein Lesefall, der keine Zeilen anfasst, tarnt sich als bestandener
--     RLS-Test. Zusage 14 zaehlt echte Zeilen unter Impersonierung.
--   * Ein Katalogtest bricht die ganze Datei ab, wenn die Tabelle fehlt.
--     Die Lesezusagen laufen deshalb ueber `pg_temp.lies_als()`, das den Fehler
--     faengt und als Text zurueckgibt — RED scheitert damit als ZUSAGE, nicht
--     als Abbruch.
--
-- ══ BEWUSST NICHT GEPRUEFT ═════════════════════════════════════════════════
-- Ob `anon` lesen darf, sagt design.md nicht. Das Vorbild `membership_tiers`
-- grantet SELECT an anon UND authenticated (Policy `tiers_read_all`), der
-- Entwurf hier nennt aber nur `authenticated` — Feedback liegt hinter der
-- Anmeldung. Diese Datei behauptet deshalb ueber `anon` NICHTS; festgelegt wird
-- es vom Golden-Snapshot in `grants_test.sql` (Aufgabe 1.4). Wer 1.2 baut,
-- entscheidet es dort bewusst und nicht nebenbei.

begin;
select plan(22);

-- ── Impersonierung ──────────────────────────────────────────────────────────
-- Eigene Kopie: jede Testdatei laeuft in ihrer eigenen Sitzung. Anders als
-- `count_as` in `hinweistypen_test.sql` FAENGT diese Fassung den Fehler ab —
-- sonst risse der RED-Lauf die Datei ab, statt eine Zusage scheitern zu lassen.
create function pg_temp.lies_als(uid uuid, q text) returns text
language plpgsql as $$
declare ergebnis text;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    execute q into ergebnis;
  exception when others then
    reset role;
    perform set_config('request.jwt.claims', '', true);
    return 'FEHLER:' || SQLERRM;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return ergebnis;
end $$;

-- ── Fixture ─────────────────────────────────────────────────────────────────
-- Der auth.users-Insert feuert handle_new_user() und legt public.profiles an.
insert into auth.users (id, aud, role, email) values
  ('fe000000-0000-0000-0000-00000000000a', 'authenticated', 'authenticated', 'thema-leser@test.fbc');

update public.profiles set tier = 'basic', name = 'Thema Leser', activated_at = now()
 where id = 'fe000000-0000-0000-0000-00000000000a';

-- ── 1. Die Tabelle und ihre Gestalt ─────────────────────────────────────────
select has_table('public', 'feedback_themes',
  'Es gibt die Tabelle public.feedback_themes');

select has_column('public', 'feedback_themes', 'key',
  'feedback_themes traegt die Spalte key');
select has_column('public', 'feedback_themes', 'label',
  'feedback_themes traegt die Spalte label');
select has_column('public', 'feedback_themes', 'sort',
  'feedback_themes traegt die Spalte sort');

select col_type_is('public', 'feedback_themes', 'key', 'text',
  'key ist text');
select col_type_is('public', 'feedback_themes', 'label', 'text',
  'label ist text');
select col_type_is('public', 'feedback_themes', 'sort', 'integer',
  'sort ist integer');

select col_is_pk('public', 'feedback_themes', 'key',
  'key ist der Primaerschluessel — der Fremdschluessel aus feedback.theme haengt daran');

select col_not_null('public', 'feedback_themes', 'label',
  'label ist not null — ein Thema ohne Beschriftung waere in der Oberflaeche leer');
select col_not_null('public', 'feedback_themes', 'sort',
  'sort ist not null — ohne ihn ist die Reihenfolge dem Zufall ueberlassen');

-- ── 2. Die Sicherheitsgrenze ────────────────────────────────────────────────
-- Nicht ueber ::regclass gehen: der Cast bricht die Datei ab, solange die
-- Tabelle fehlt. Ueber die Katalognamen liefert er null und die Zusage faellt.
select is(
  (select c.relrowsecurity from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'feedback_themes'),
  true, 'RLS ist auf feedback_themes eingeschaltet');

select is(
  (select count(*)::int from pg_policies
    where schemaname = 'public' and tablename = 'feedback_themes'
      and cmd = 'SELECT' and 'authenticated' = any(roles)),
  1, 'Es gibt genau eine SELECT-Policy fuer authenticated — RLS ohne Policy sieht aus wie „keine Themen"');

select is(
  (select count(*)::int from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'feedback_themes'
      and grantee = 'authenticated' and privilege_type = 'SELECT'),
  1, 'select ist an authenticated ausdruecklich gegrantet — neue Tabellen erben hier nichts');

-- ── 3. Was ein Mitglied wirklich sieht ──────────────────────────────────────
-- Die eigentliche Zusage. Alles darueber kann gruen sein, waehrend die
-- Oberflaeche eine leere Liste bekommt.
select is(
  pg_temp.lies_als('fe000000-0000-0000-0000-00000000000a',
    'select count(*)::text from public.feedback_themes'),
  '5', 'Ein Mitglied liest genau fuenf Themen');

select is(
  pg_temp.lies_als('fe000000-0000-0000-0000-00000000000a',
    'select string_agg(key, '','' order by sort) from public.feedback_themes'),
  'generell,fehler,bedienung,inhalte,idee',
  'Die fuenf Schluessel stehen in der vorgesehenen Reihenfolge');

select is(
  pg_temp.lies_als('fe000000-0000-0000-0000-00000000000a',
    'select string_agg(label, '' | '' order by sort) from public.feedback_themes'),
  'Generell | Fehler / etwas geht nicht | Bedienung / Verständlichkeit | Inhalte / Texte | Idee / Wunsch',
  'Die Beschriftungen stehen in der Datenbank, nicht in TypeScript');

-- ── 4. Die Spalte feedback.theme (Aufgaben 1.5–1.6) ─────────────────────────
-- Die eigentliche Zusage ist die letzte, und sie ist der Grund, warum der
-- Vorgabewert DAUERHAFT bleiben muss: bis die neue Oberflaeche ausgeliefert
-- ist, nennt KEIN Schreibzugriff die Spalte. Ohne `default 'generell'` braeche
-- in diesem Fenster jedes Absenden von Feedback.
select has_column('public', 'feedback', 'theme',
  'feedback traegt die Spalte theme');

select col_type_is('public', 'feedback', 'theme', 'text',
  'feedback.theme ist text');

select is(
  pg_temp.lies_als('fe000000-0000-0000-0000-00000000000a',
    $q$ with neu as (
          insert into public.feedback (profile_id, rating, likes)
          values ('fe000000-0000-0000-0000-00000000000a', 4, 'ohne Thema abgeschickt')
          returning theme
        )
        select theme from neu $q$),
  'generell',
  'Ein Absenden OHNE Thema traegt „Generell" — der Vorgabewert haelt die alte Oberflaeche am Leben');

-- ── 5. Die Grenzen der Spalte (Aufgabe 1.7) ─────────────────────────────────
-- „Keine Zeile traegt null" wird hier STRUKTURELL zugesagt und nicht gezaehlt:
-- eine Zaehlung ueber die ganze Tabelle waere in CI vakuum-gruen (nach
-- `db reset` ist `feedback` leer) und lokal vom geteilten Stack abhaengig.
-- Die Bedingung, die wirklich traegt, ist das `not null` selbst.
select col_not_null('public', 'feedback', 'theme',
  'feedback.theme ist not null — keine Zeile kann ohne Thema existieren');

-- Negativ- und Positivfall als PAAR. Der Negativfall allein waere auch dann
-- gruen, wenn das Schreiben aus einem voellig anderen Grund scheiterte —
-- deshalb ist das Muster auf den Fremdschluessel festgenagelt, und der
-- Nachbarfall erzeugt eine Zeile.
select alike(
  pg_temp.lies_als('fe000000-0000-0000-0000-00000000000a',
    $q$ with neu as (
          insert into public.feedback (profile_id, rating, likes, theme)
          values ('fe000000-0000-0000-0000-00000000000a', 4, 'erfundenes Thema', 'quatsch')
          returning theme
        )
        select theme from neu $q$),
  'FEHLER:%feedback_theme_fkey%',
  'Ein Thema ausserhalb der Liste wird abgewiesen, und zwar vom Fremdschluessel');

select is(
  pg_temp.lies_als('fe000000-0000-0000-0000-00000000000a',
    $q$ with neu as (
          insert into public.feedback (profile_id, rating, likes, theme)
          values ('fe000000-0000-0000-0000-00000000000a', 4, 'echtes Thema', 'idee')
          returning theme
        )
        select theme from neu $q$),
  'idee',
  'Positivkontrolle: ein Thema AUS der Liste geht durch — sonst belegt der Fall darueber nichts');

select * from finish();
rollback;
