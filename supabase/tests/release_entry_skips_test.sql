-- „Nicht relevant" als geteilte Markierung (AGE-636).
-- Change: openspec/changes/neuigkeiten-archiv/.
--
-- Echtes pgTAP mit plan()/finish() — nur solche Dateien stehen im CI-Lauf.
-- Diese Datei ist in ci.yml eingetragen.
--
-- ══ WAS HIER GEMESSEN WIRD ═════════════════════════════════════════════════
-- Drei Zusagen, die man im Browser NICHT widerlegen kann:
--
--   1. **Ein Nicht-Admin kommt an die Markierungen nicht heran** — weder
--      lesend noch schreibend noch loeschend. An der Oberflaeche steht
--      RequireAdmin davor, und das ist Komfort, keine Grenze.
--   2. **Ein Admin kann die Markierung keinem anderen unterschieben.** Die
--      Policy prueft nicht nur, DASS der Aufrufer Admin ist, sondern dass in
--      `skipped_by` er selbst steht. Ohne diese Bedingung waere die Spalte eine
--      Behauptung des Clients (Fremd-Review codex, MEDIUM).
--   3. **Loeschen ist erlaubt** — anders als bei `release_notes`. Eine
--      Markierung verschickt nichts; ihre Ruecknahme ist der Normalfall.
--
-- ══ FALLEN, DIE DIESES PROJEKT SCHON GESTELLT HAT ══════════════════════════
--   * In pgTAP heisst es `alike()`, nicht `like()`.
--   * `try_as()` meldet jeden Fehler als 'DENIED:'. Ein fremdes DELETE oder
--     UPDATE trifft ausserdem schlicht NULL ZEILEN und meldet gar nichts —
--     jede Schreibzusage lautet deshalb auf den BESTAND danach.
--   * **Eine Messung aus lauter Nullen belegt nichts.** Jede Verneinung hier
--     hat eine Positivkontrolle daneben, die sich bewegt.
--   * Der lokale Stack ist geseedet — jede Mengenaussage ist auf die
--     Fixture-Slugs eingeschraenkt, nie `count(*)` der ganzen Tabelle.

begin;
select plan(16);

-- ── Fixtures ────────────────────────────────────────────────────────────────
insert into auth.users (id, aud, role, email) values
  ('8c000000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', 'skip-admin1@test.fbc'),
  ('8c000000-0000-0000-0000-0000000000a2', 'authenticated', 'authenticated', 'skip-admin2@test.fbc'),
  ('8c000000-0000-0000-0000-0000000000b1', 'authenticated', 'authenticated', 'skip-mitglied@test.fbc');

update public.profiles set tier = 'impact', name = 'Skip Admin 1', activated_at = now()
 where id = '8c000000-0000-0000-0000-0000000000a1';
update public.profiles set tier = 'impact', name = 'Skip Admin 2', activated_at = now()
 where id = '8c000000-0000-0000-0000-0000000000a2';
update public.profiles set tier = 'impact', name = 'Skip Mitglied', activated_at = now()
 where id = '8c000000-0000-0000-0000-0000000000b1';

insert into public.staff_roles (profile_id, role) values
  ('8c000000-0000-0000-0000-0000000000a1', 'admin'),
  ('8c000000-0000-0000-0000-0000000000a2', 'admin');

-- ── Helfer ──────────────────────────────────────────────────────────────────
create function pg_temp.count_as(uid uuid, q text) returns int language plpgsql as $$
declare n int;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  execute q into n;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return n;
end $$;

create function pg_temp.try_as(uid uuid, q text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    execute q;
  exception when others then
    reset role;
    perform set_config('request.jwt.claims', '', true);
    return 'DENIED:' || SQLERRM;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return 'OK';
end $$;

/** Der Bestand an Fixture-Zeilen — als `postgres`, also an der RLS vorbei.
 *  Nur so unterscheidet sich „abgewiesen" von „hat nichts getroffen". */
create function pg_temp.bestand() returns int language sql as $$
  select count(*)::int from public.release_entry_skips where slug like 'fixture-%';
$$;

-- ── 1. Gestalt ──────────────────────────────────────────────────────────────
select has_table('public', 'release_entry_skips',
  'Die Tabelle release_entry_skips existiert');

select is(
  (select relrowsecurity from pg_class where oid = 'public.release_entry_skips'::regclass),
  true, 'RLS ist auf release_entry_skips eingeschaltet');

-- Der Slug ist der Schluessel. Ohne Primaerschluessel gaebe es zu einem Eintrag
-- mehrere Markierungen, und das Zuruecknehmen loeschte nur eine davon.
select col_is_pk('public', 'release_entry_skips', 'slug',
  'slug ist der Primaerschluessel — eine Markierung je Eintrag');

-- Kein UPDATE: an einer Markierung gibt es nichts zu aendern. Wer sie loesen
-- will, loescht die Zeile — dafuer gibt es hier, anders als bei release_notes,
-- ein DELETE.
select is(
  (select count(*)::int from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'release_entry_skips'
      and grantee = 'authenticated' and privilege_type = 'UPDATE'),
  0, 'authenticated haelt KEIN UPDATE auf release_entry_skips');

-- ── 2. Der Admin darf ───────────────────────────────────────────────────────
-- Die Positivkontrolle steht bewusst VOR den Verneinungen: ohne sie waere jede
-- folgende Null von einem kaputten Aufbau nicht zu unterscheiden.
select is(
  pg_temp.try_as('8c000000-0000-0000-0000-0000000000a1',
    $q$ insert into public.release_entry_skips (slug) values ('fixture-technisch') $q$),
  'OK', 'Ein Admin legt eine Markierung an');

select is(pg_temp.bestand(), 1, 'Und die Zeile steht wirklich da');

-- `skipped_by` fuellt die DATENBANK, nicht der Client.
select is(
  (select skipped_by from public.release_entry_skips where slug = 'fixture-technisch'),
  '8c000000-0000-0000-0000-0000000000a1'::uuid,
  'skipped_by traegt den Aufrufer, ohne dass er ihn mitschickt');

select isnt(
  (select skipped_at from public.release_entry_skips where slug = 'fixture-technisch'),
  null, 'skipped_at ist gesetzt');

select is(
  pg_temp.count_as('8c000000-0000-0000-0000-0000000000a2',
    $q$ select count(*)::int from public.release_entry_skips where slug like 'fixture-%' $q$),
  1, 'Ein ZWEITER Admin sieht dieselbe Markierung — sie ist geteilt, nicht privat');

-- ── 3. Der Admin darf nicht alles ───────────────────────────────────────────
-- Ohne `skipped_by = auth.uid()` in der Policy waere die Spalte eine
-- Behauptung des Clients (Fremd-Review codex, MEDIUM).
select alike(
  pg_temp.try_as('8c000000-0000-0000-0000-0000000000a1',
    $q$ insert into public.release_entry_skips (slug, skipped_by)
        values ('fixture-untergeschoben', '8c000000-0000-0000-0000-0000000000a2') $q$),
  'DENIED:%',
  'Ein Admin kann die Markierung keinem anderen Admin unterschieben');

select is(pg_temp.bestand(), 1,
  'Und es ist dabei KEINE Zeile entstanden — gemessen am Bestand, nicht am Fehlercode');

-- ── 4. Ein Nicht-Admin kommt nicht heran ────────────────────────────────────
select is(
  pg_temp.count_as('8c000000-0000-0000-0000-0000000000b1',
    $q$ select count(*)::int from public.release_entry_skips where slug like 'fixture-%' $q$),
  0, 'Ein aktiviertes Mitglied ohne Adminrolle liest keine einzige Markierung');

select is(
  pg_temp.try_as('8c000000-0000-0000-0000-0000000000b1',
    $q$ insert into public.release_entry_skips (slug) values ('fixture-fremd') $q$)
  || '/' || pg_temp.bestand()::text,
  'DENIED:new row violates row-level security policy for table "release_entry_skips"/1',
  'Es legt auch keine an — abgewiesen, und der Bestand steht unveraendert');

-- Ein fremdes DELETE trifft schlicht null Zeilen und meldet KEINEN Fehler. Die
-- Zusage lautet deshalb auf den Bestand danach, nicht auf 'DENIED:'.
select is(
  pg_temp.try_as('8c000000-0000-0000-0000-0000000000b1',
    $q$ delete from public.release_entry_skips where slug = 'fixture-technisch' $q$)
  || '/' || pg_temp.bestand()::text,
  'OK/1',
  'Sein DELETE laeuft ins Leere: kein Fehler, aber die Zeile steht noch');

-- ── 5. Der Weg zurueck ──────────────────────────────────────────────────────
-- Die Gegenprobe zum Vorigen: dieselbe Anweisung, anderer Aufrufer. Ohne sie
-- waere „das DELETE lief ins Leere" auch mit einer Tabelle ohne DELETE-Recht
-- gruen — und dann gaebe es das Zurueckholen ueberhaupt nicht.
select is(
  pg_temp.try_as('8c000000-0000-0000-0000-0000000000a2',
    $q$ delete from public.release_entry_skips where slug = 'fixture-technisch' $q$),
  'OK', 'Ein Admin nimmt die Markierung eines ANDEREN Admins zurueck');

select is(pg_temp.bestand(), 0, 'Und die Zeile ist wirklich weg');

select finish();
rollback;
