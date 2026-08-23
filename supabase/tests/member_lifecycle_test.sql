-- Lebenszyklus eines Mitglieds: deaktivieren, löschen, zurückholen (AGE-581).
-- Change: openspec/changes/add-admin-member-lifecycle/.
--
-- Echtes pgTAP mit plan()/finish() — nur solche Dateien stehen im CI-Lauf; die
-- manuellen probe_*.sql tun es nicht.
--
-- ══ WARUM DIESER TEST ZWEI SEITEN PRÜFT ════════════════════════════════════
-- Der erste Entwurf prüfte nur, ob ein deaktiviertes Profil verschwindet — die
-- ZIELSEITE. Der Plan-Review hat gezeigt, dass das nicht reicht: der
-- bestehende Aktivierungs-Gate-Test arbeitet mit `activated_at = null` und
-- bliebe grün, während `disabled_at` in `is_activated()` schlicht fehlt. Nur
-- die AUFRUFERSEITE belegt, dass die neue Bedingung im Prädikat wirklich
-- greift — und mit ihr die rund vierzig Policies, die es rufen.
--
-- ══ WARUM `is_admin()` HIER VORKOMMT ═══════════════════════════════════════
-- Weil es die Lücke war, die keine Inventur findet: eine Suche nach
-- `activated_at` findet nur Stellen, die es schon nennen, nie eine, wo es
-- fehlt. `is_admin()` liest allein `staff_roles` — ein deaktivierter Admin
-- behielte jede Fähigkeit, während die gewöhnliche RLS ihm längst alles
-- verweigert.
--
-- ══ FALLEN, DIE DIESES PROJEKT SCHON GESTELLT HAT ══════════════════════════
--   * In pgTAP heisst es `alike()`, nicht `like()`.
--   * `try_as()` meldet JEDEN Fehler als `DENIED:` — ein Test auf einen
--     zugesicherten Fehlercode muss den SQLSTATE lesen. Darum `pg_temp.state_as`.
--   * Ein fremdes UPDATE ergibt NULL ZEILEN statt `42501`.
--   * Der lokale Stack ist geseedet. Jede Mengenaussage trägt einen
--     Suchbegriff, sonst ist sie eine Aussage über den Seed.

begin;
select plan(32);

-- ── Fixtures ────────────────────────────────────────────────────────────────
-- Der auth.users-Insert feuert handle_new_user() und legt public.profiles an.
insert into auth.users (id, aud, role, email) values
  ('d0000000-0000-0000-0000-0000000000ad', 'authenticated', 'authenticated', 'lz-admin@test.fbc'),
  ('d0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'lz-aktiv@test.fbc'),
  ('d0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'lz-deaktiviert@test.fbc'),
  ('d0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'lz-geloescht@test.fbc'),
  ('d0000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'lz-beobachter@test.fbc');

insert into public.staff_roles (profile_id, role) values
  ('d0000000-0000-0000-0000-0000000000ad', 'admin');

-- Alle bestätigt, alle öffentlich, alle auf einer Stufe, die das Verzeichnis
-- sehen darf. Damit ist der EINZIGE Unterschied zwischen ihnen der, den dieser
-- Test misst.
update public.profiles
   set name = 'Lebenszyklus Admin', activated_at = now(), is_public = true, tier = 'impact'
 where id = 'd0000000-0000-0000-0000-0000000000ad';
update public.profiles
   set name = 'Lz Aktiv', activated_at = now(), is_public = true, tier = 'impact'
 where id = 'd0000000-0000-0000-0000-000000000001';
update public.profiles
   set name = 'Lz Deaktiviert', activated_at = now(), is_public = true, tier = 'impact'
 where id = 'd0000000-0000-0000-0000-000000000002';
update public.profiles
   set name = 'Lz Geloescht', activated_at = now(), is_public = true, tier = 'impact'
 where id = 'd0000000-0000-0000-0000-000000000003';
update public.profiles
   set name = 'Lz Beobachter', activated_at = now(), is_public = true, tier = 'impact'
 where id = 'd0000000-0000-0000-0000-000000000004';

-- ── Helfer ──────────────────────────────────────────────────────────────────
create function pg_temp.state_as(uid uuid, q text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    execute q;
  exception when others then
    reset role;
    perform set_config('request.jwt.claims', '', true);
    return SQLSTATE;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return 'KEIN FEHLER';
end $$;

create function pg_temp.int_as(uid uuid, q text) returns int language plpgsql as $$
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

create function pg_temp.bool_as(uid uuid, q text) returns boolean language plpgsql as $$
declare b boolean;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  execute q into b;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return b;
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 1. Die Spalten bestehen überhaupt
-- ════════════════════════════════════════════════════════════════════════════
select has_column('public', 'profiles', 'disabled_at', 'profiles.disabled_at besteht');
select has_column('public', 'profiles', 'deleted_at',  'profiles.deleted_at besteht');
select has_column('public', 'profile_legacy', 'payment_type', 'profile_legacy.payment_type besteht');

-- Kein Schreibrecht für Client-Rollen: sonst setzt ein Mitglied seinen eigenen
-- Zustand. Geprüft wird die ABWESENHEIT des Grants, nicht ein fehlgeschlagenes
-- UPDATE — ein fremdes UPDATE ergibt in diesem Projekt null Zeilen statt eines
-- Fehlers, und „null Zeilen" sähe aus wie Erfolg.
select is_empty(
  $$select 1 from information_schema.column_privileges
     where table_schema='public' and table_name='profiles'
       and column_name in ('disabled_at','deleted_at')
       and grantee in ('authenticated','anon') and privilege_type='UPDATE'$$,
  'Client-Rollen halten kein UPDATE auf disabled_at/deleted_at');

-- ════════════════════════════════════════════════════════════════════════════
-- 2. ZIELSEITE — ein entferntes Profil verschwindet aus JEDEM Lesepfad
--
-- Alle drei werden einzeln geprüft. `profiles_public` läuft mit den Rechten
-- ihres Eigentümers und wertet die Policy der Basistabelle gar nicht aus; wer
-- nur die Policy prüft, hat die View nicht geprüft.
-- ════════════════════════════════════════════════════════════════════════════
update public.profiles set disabled_at = now() where id = 'd0000000-0000-0000-0000-000000000002';
update public.profiles set deleted_at  = now() where id = 'd0000000-0000-0000-0000-000000000003';

-- Gegenprobe zuerst: das aktive Profil IST sichtbar. Ohne sie bewiese ein
-- „nicht sichtbar" nur, dass die Abfrage nichts findet.
select is(
  pg_temp.int_as('d0000000-0000-0000-0000-000000000004',
    $$select count(*)::int from public.profiles where name = 'Lz Aktiv'$$),
  1, 'Gegenprobe: das aktive Profil ist über die Policy sichtbar');

select is(
  pg_temp.int_as('d0000000-0000-0000-0000-000000000004',
    $$select count(*)::int from public.profiles where name = 'Lz Deaktiviert'$$),
  0, 'Policy: ein deaktiviertes Profil ist nicht sichtbar');
select is(
  pg_temp.int_as('d0000000-0000-0000-0000-000000000004',
    $$select count(*)::int from public.profiles where name = 'Lz Geloescht'$$),
  0, 'Policy: ein geloeschtes Profil ist nicht sichtbar');

select is(
  pg_temp.int_as('d0000000-0000-0000-0000-000000000004',
    $$select count(*)::int from public.profiles_public where name = 'Lz Aktiv'$$),
  1, 'Gegenprobe: das aktive Profil steht in profiles_public');
select is(
  pg_temp.int_as('d0000000-0000-0000-0000-000000000004',
    $$select count(*)::int from public.profiles_public where name = 'Lz Deaktiviert'$$),
  0, 'profiles_public: ein deaktiviertes Profil steht nicht drin');
select is(
  pg_temp.int_as('d0000000-0000-0000-0000-000000000004',
    $$select count(*)::int from public.profiles_public where name = 'Lz Geloescht'$$),
  0, 'profiles_public: ein geloeschtes Profil steht nicht drin');

select is(
  pg_temp.int_as('d0000000-0000-0000-0000-000000000004',
    $$select count(*)::int from public.search_directory('Lz Aktiv')$$),
  1, 'Gegenprobe: das aktive Profil steht im Verzeichnis');
select is(
  pg_temp.int_as('d0000000-0000-0000-0000-000000000004',
    $$select count(*)::int from public.search_directory('Lz Deaktiviert')$$),
  0, 'search_directory: ein deaktiviertes Profil steht nicht drin');
select is(
  pg_temp.int_as('d0000000-0000-0000-0000-000000000004',
    $$select count(*)::int from public.search_directory('Lz Geloescht')$$),
  0, 'search_directory: ein geloeschtes Profil steht nicht drin');

-- ════════════════════════════════════════════════════════════════════════════
-- 3. AUFRUFERSEITE — der eigentliche Beleg
--
-- Ein deaktivierter AUFRUFER mit gültiger Sitzung. Der bestehende
-- Aktivierungs-Gate-Test deckt das NICHT ab: er arbeitet mit
-- `activated_at = null` und bliebe grün, während `disabled_at` in
-- `is_activated()` fehlt.
-- ════════════════════════════════════════════════════════════════════════════
select is(
  pg_temp.bool_as('d0000000-0000-0000-0000-000000000001', $$select public.is_activated()$$),
  true, 'Gegenprobe: ein aktives Konto gilt als zugangsberechtigt');
select is(
  pg_temp.bool_as('d0000000-0000-0000-0000-000000000002', $$select public.is_activated()$$),
  false, 'is_activated(): ein deaktivierter Aufrufer ist NICHT zugangsberechtigt');
select is(
  pg_temp.bool_as('d0000000-0000-0000-0000-000000000003', $$select public.is_activated()$$),
  false, 'is_activated(): ein geloeschter Aufrufer ist NICHT zugangsberechtigt');

-- Und die Wirkung davon, an vier erbenden Flächen. Kein `is_activated()`-Aufruf
-- mehr, sondern gewöhnliche Abfragen — sonst prüfte der Test das Prädikat
-- zweimal und die Policies nie.
select is(
  pg_temp.int_as('d0000000-0000-0000-0000-000000000002',
    $$select count(*)::int from public.profiles where name = 'Lz Aktiv'$$),
  0, 'Ein deaktivierter Aufrufer sieht keine fremden Profile');
select is(
  pg_temp.int_as('d0000000-0000-0000-0000-000000000002',
    $$select count(*)::int from public.profiles_public where name = 'Lz Aktiv'$$),
  0, 'Ein deaktivierter Aufrufer sieht profiles_public nicht');
select is(
  pg_temp.int_as('d0000000-0000-0000-0000-000000000002',
    $$select count(*)::int from public.posts$$),
  0, 'Ein deaktivierter Aufrufer sieht keine Beiträge');

-- Auch die EIGENEN Daten. Wer sich mit einem weitergegebenen Passwort anmeldet,
-- ist gegenüber der Datenbank nicht ein Fremder, sondern das Mitglied — „eigene
-- Daten" sind dann die Daten des Bestohlenen.
select is(
  pg_temp.int_as('d0000000-0000-0000-0000-000000000002',
    $$select count(*)::int from public.profiles where id = 'd0000000-0000-0000-0000-000000000002'$$),
  0, 'Ein deaktivierter Aufrufer sieht auch sein EIGENES Profil nicht');

-- ════════════════════════════════════════════════════════════════════════════
-- 4. Eine Rolle überlebt den Entzug des Zugangs nicht
--
-- Die Lücke, die keine Inventur findet: `is_admin()` liest allein
-- `staff_roles`.
-- ════════════════════════════════════════════════════════════════════════════
select is(
  pg_temp.bool_as('d0000000-0000-0000-0000-0000000000ad', $$select public.is_admin()$$),
  true, 'Gegenprobe: der aktive Admin ist Admin');

update public.profiles set disabled_at = now() where id = 'd0000000-0000-0000-0000-0000000000ad';

select is(
  pg_temp.bool_as('d0000000-0000-0000-0000-0000000000ad', $$select public.is_admin()$$),
  false, 'is_admin(): ein deaktivierter Admin ist kein Admin mehr');

select is(
  pg_temp.state_as('d0000000-0000-0000-0000-0000000000ad',
    $$select * from public.admin_list_members()$$),
  '42501', 'Ein deaktivierter Admin kommt nicht an die Mitgliederliste');

select is(
  pg_temp.state_as('d0000000-0000-0000-0000-0000000000ad',
    $$select public.admin_get_profile('d0000000-0000-0000-0000-000000000001')$$),
  '42501', 'Ein deaktivierter Admin kommt nicht an ein fremdes Profil');

select is(
  pg_temp.int_as('d0000000-0000-0000-0000-0000000000ad',
    $$select count(*)::int from public.admin_audit$$),
  0, 'Ein deaktivierter Admin liest das Protokoll nicht mehr');

update public.profiles set disabled_at = null where id = 'd0000000-0000-0000-0000-0000000000ad';

-- ════════════════════════════════════════════════════════════════════════════
-- 5. Die Zustandsauskunft meldet die Sperre
--
-- Ohne das dritte Feld zeigte die Oberfläche einem gesperrten Konto den
-- Aktivierungsbildschirm und lüde es ein, sich einen Zugangslink schicken zu
-- lassen — für einen Zugang, den es nicht mehr gibt.
-- ════════════════════════════════════════════════════════════════════════════
select is(
  pg_get_function_result('public.my_activation_state()'::regprocedure),
  'TABLE(activated boolean, blocked boolean, display_name text)',
  'my_activation_state gibt DREI Felder zurueck — activated, blocked, display_name');

select is(
  pg_temp.bool_as('d0000000-0000-0000-0000-000000000001',
    $$select blocked from public.my_activation_state()$$),
  false, 'Gegenprobe: ein aktives Konto ist nicht gesperrt');
select is(
  pg_temp.bool_as('d0000000-0000-0000-0000-000000000002',
    $$select blocked from public.my_activation_state()$$),
  true, 'Ein deaktiviertes Konto meldet blocked = true');
select is(
  pg_temp.bool_as('d0000000-0000-0000-0000-000000000003',
    $$select blocked from public.my_activation_state()$$),
  true, 'Ein geloeschtes Konto meldet blocked = true — ununterscheidbar vom deaktivierten');

-- `activated` behält seine Bedeutung: „hat je bestätigt". Ein gesperrtes,
-- zuvor bestätigtes Konto trägt beide Felder wahr.
select is(
  pg_temp.bool_as('d0000000-0000-0000-0000-000000000002',
    $$select activated from public.my_activation_state()$$),
  true, 'activated bleibt wahr — es sagt "hat je bestaetigt", nicht "darf herein"');

-- ════════════════════════════════════════════════════════════════════════════
-- 6. Die Zahlungsart ist in der Datenbank eingeschränkt, nicht nur in der Maske
-- ════════════════════════════════════════════════════════════════════════════
select is(
  (select count(*)::int from (values
     ('rechnung'),('stripe'),('copecart'),('paypal'),
     ('digistore24'),('ehren'),('partner'),('offen')) as v(w)),
  8, 'acht Zahlungsarten sind vorgesehen');

select throws_ok(
  $$insert into public.profile_legacy (profile_id, payment_type)
    values ('d0000000-0000-0000-0000-000000000001', 'bitcoin')$$,
  '23514',
  null,
  'Eine unbekannte Zahlungsart weist die Datenbank ab, nicht die Oberflaeche');

select * from finish();
rollback;
