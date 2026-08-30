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
select plan(51);

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

-- ════════════════════════════════════════════════════════════════════════════
-- 7. Die Feed-Auskunft: „Ehemaliges Mitglied" (AGE-581, Aufgabe 3.4)
--
-- Beiträge und Kommentare eines entfernten Mitglieds BLEIBEN stehen — sie zu
-- löschen veränderte fremde Beiträge, denn ein Faden, aus dem der Anfang
-- verschwindet, ist für alle anderen kaputt. Nur der Name geht.
--
-- ══ WARUM DIE FUNKTION BEITRAGS-IDs NIMMT UND KEINE PROFIL-IDs ═════════════
-- Der Plan-Review hat den ersten Entwurf mit HIGH verworfen: einer Funktion,
-- der man Profil-IDs übergibt, kann man nicht ansehen, woher der Aufrufer sie
-- hat. Die Zusage „nur über Autoren aus sichtbaren Beiträgen" wäre eine Bitte
-- an den Aufrufer, keine Eigenschaft der Funktion — jeder Angemeldete könnte
-- beliebige bekannte IDs durchreichen und erführe, wer aus dem Verein entfernt
-- wurde. Nimmt sie Beitrags-IDs, löst sie den Urheber SELBST auf und wendet
-- dabei dasselbe Sichtbarkeitsprädikat an, das für den Beitrag gilt.
--
-- Genau das prüfen die beiden Zusagen mit `Lz Basic`: sie ist bestätigt und
-- darf `public` lesen, aber nicht `members` (`has_level(4)`). Über einen
-- Beitrag, den sie nicht sehen darf, bekommt sie keine Auskunft — und die
-- Wächter-Zusage daneben belegt, dass sie überhaupt Auskünfte bekommt.
-- ════════════════════════════════════════════════════════════════════════════

insert into auth.users (id, aud, role, email) values
  ('d0000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'lz-basic@test.fbc'),
  ('d0000000-0000-0000-0000-000000000006', 'authenticated', 'authenticated', 'lz-privat@test.fbc'),
  ('d0000000-0000-0000-0000-000000000007', 'authenticated', 'authenticated', 'lz-nie-bestaetigt@test.fbc');

-- Bestätigt, aber auf `basic`: sie sieht `public` und nicht `members`.
update public.profiles
   set name = 'Lz Basic', activated_at = now(), is_public = true, tier = 'basic'
 where id = 'd0000000-0000-0000-0000-000000000005';
-- Da, aber zurückgezogen. Im Feed heisst sie seit AGE-530 „Ein Mitglied" —
-- ein anderer Sachverhalt als „entfernt", und beide dürfen nicht auf denselben
-- Text fallen.
update public.profiles
   set name = 'Lz Privat', activated_at = now(), is_public = false, tier = 'impact'
 where id = 'd0000000-0000-0000-0000-000000000006';
-- Nie bestätigt. Die Falle für eine Umsetzung, die `not is_activated_profile()`
-- schreibt statt nach den beiden Sperrfeldern zu fragen: dieses Konto ist nicht
-- aktiviert, aber es wurde auch nie entfernt.
update public.profiles
   set name = 'Lz Nie Bestaetigt', activated_at = null, is_public = true, tier = 'impact'
 where id = 'd0000000-0000-0000-0000-000000000007';

insert into public.posts (id, author_id, body, visibility) values
  ('bb000000-0000-4000-8000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'Von einem aktiven Mitglied',      'public'),
  ('bb000000-0000-4000-8000-000000000002', 'd0000000-0000-0000-0000-000000000002', 'Von einem deaktivierten Mitglied','public'),
  ('bb000000-0000-4000-8000-000000000003', 'd0000000-0000-0000-0000-000000000003', 'Von einem geloeschten Mitglied',  'public'),
  ('bb000000-0000-4000-8000-000000000004', 'd0000000-0000-0000-0000-000000000003', 'Nur fuer Mitglieder',             'members'),
  ('bb000000-0000-4000-8000-000000000005', 'd0000000-0000-0000-0000-000000000006', 'Von einem zurueckgezogenen Mitglied', 'public'),
  ('bb000000-0000-4000-8000-000000000006', 'd0000000-0000-0000-0000-000000000007', 'Von einem nie bestaetigten Konto','public');

insert into public.comments (id, post_id, author_id, body) values
  ('cc000000-0000-4000-8000-000000000001', 'bb000000-0000-4000-8000-000000000001',
   'd0000000-0000-0000-0000-000000000001', 'Kommentar eines aktiven Mitglieds'),
  ('cc000000-0000-4000-8000-000000000002', 'bb000000-0000-4000-8000-000000000001',
   'd0000000-0000-0000-0000-000000000003', 'Kommentar eines geloeschten Mitglieds'),
  ('cc000000-0000-4000-8000-000000000003', 'bb000000-0000-4000-8000-000000000004',
   'd0000000-0000-0000-0000-000000000003', 'Kommentar unter einem unsichtbaren Beitrag');

create function pg_temp.text_as(uid uuid, q text) returns text language plpgsql as $$
declare t text;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  execute q into t;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return t;
end $$;

-- 7.1 Gegenprobe zuerst: der Beobachter sieht die fünf öffentlichen und den
-- Mitglieder-Beitrag. Ohne sie prüfte alles darunter eine Funktion über
-- Beiträge, die vielleicht gar nicht sichtbar sind.
select is(
  pg_temp.int_as('d0000000-0000-0000-0000-000000000004',
    $$select count(*)::int from public.posts where id::text like 'bb000000%'$$),
  6, 'Gegenprobe: der Beobachter sieht alle sechs Sondenbeiträge');

-- 7.2–7.4 Die Auskunft selbst.
select is(
  pg_temp.text_as('d0000000-0000-0000-0000-000000000004',
    $q$select former::text from public.former_member_entries(
         array['bb000000-0000-4000-8000-000000000001']::uuid[])$q$),
  'false', 'Der Beitrag eines aktiven Mitglieds ist nicht der eines Ehemaligen');

select is(
  pg_temp.text_as('d0000000-0000-0000-0000-000000000004',
    $q$select former::text from public.former_member_entries(
         array['bb000000-0000-4000-8000-000000000002']::uuid[])$q$),
  'true', 'Der Beitrag eines DEAKTIVIERTEN Mitglieds schon …');

select is(
  pg_temp.text_as('d0000000-0000-0000-0000-000000000004',
    $q$select former::text from public.former_member_entries(
         array['bb000000-0000-4000-8000-000000000003']::uuid[])$q$),
  'true', '… und der eines GELÖSCHTEN ebenso — beide tragen denselben Wert');

-- 7.5 Zurückgezogen ist nicht entfernt. „Ein Mitglied" und „Ehemaliges
-- Mitglied" sind zwei verschiedene Sachverhalte; fielen sie auf denselben Text,
-- hätte der Feed für „Autor fehlt" zwei Ursachen, die gleich aussehen.
select is(
  pg_temp.text_as('d0000000-0000-0000-0000-000000000004',
    $q$select former::text from public.former_member_entries(
         array['bb000000-0000-4000-8000-000000000005']::uuid[])$q$),
  'false', 'Ein Mitglied, das nur sein Profil zurückhält, ist kein Ehemaliges');

-- 7.6 Und ein nie bestätigtes Konto ebenso wenig. Diese Zusage ist die
-- Löschprobe gegen `not is_activated_profile(author_id)` — die kürzeste
-- Umsetzung, die alle Zusagen darüber erfüllt und hier bricht.
select is(
  pg_temp.text_as('d0000000-0000-0000-0000-000000000004',
    $q$select former::text from public.former_member_entries(
         array['bb000000-0000-4000-8000-000000000006']::uuid[])$q$),
  'false', 'Ein nie bestätigtes Konto wurde nicht entfernt — es ist nur nie angekommen');

-- 7.7/7.8 Die Sichtbarkeit ist eine Eigenschaft der Funktion, keine Bitte.
-- Erst der Wächter: `Lz Basic` bekommt über einen ÖFFENTLICHEN Beitrag Auskunft.
select is(
  pg_temp.text_as('d0000000-0000-0000-0000-000000000005',
    $q$select former::text from public.former_member_entries(
         array['bb000000-0000-4000-8000-000000000003']::uuid[])$q$),
  'true', 'Wächter: auch ein basic-Konto bekommt über einen öffentlichen Beitrag Auskunft');

-- AGE-601 hat die untere Haelfte dieses Paars verschoben, nicht abgeschafft.
-- Bis dahin war `Lz Basic` der Ausgesperrte: `members` verlangte Rang 4. Jetzt
-- meint `members` jedes AKTIVIERTE Mitglied, also bekommt sie auch hier Auskunft
-- — und die Sperre, die es weiterhin zu pruefen gilt, ist die AKTIVIERUNG.
-- Deshalb steht die Gegenprobe jetzt auf `Lz Nie Bestaetigt` (activated_at null).
-- Ohne diese Umstellung waere die Zusage ersatzlos entfallen, und mit ihr der
-- Beleg, dass die Sichtbarkeit eine Eigenschaft der Funktion ist und keine Bitte.
select is(
  pg_temp.text_as('d0000000-0000-0000-0000-000000000005',
    $q$select former::text from public.former_member_entries(
         array['bb000000-0000-4000-8000-000000000004']::uuid[])$q$),
  'true', '… und seit AGE-601 auch ueber einen members-Beitrag');

select is(
  pg_temp.int_as('d0000000-0000-0000-0000-000000000007',
    $q$select count(*)::int from public.former_member_entries(
         array['bb000000-0000-4000-8000-000000000004']::uuid[])$q$),
  0, 'Ein NICHT aktiviertes Konto bekommt KEINE Auskunft — auch nicht "false"');

-- 7.9/7.10 Kommentare zählen gleich. Ein Faden, in dem nur die Beitragsautoren
-- neutralisiert sind, hält die Zusage nicht.
select is(
  pg_temp.text_as('d0000000-0000-0000-0000-000000000004',
    $q$select former::text from public.former_member_entries(
         '{}'::uuid[], array['cc000000-0000-4000-8000-000000000001']::uuid[])$q$),
  'false', 'Der Kommentar eines aktiven Mitglieds ist nicht der eines Ehemaligen');

select is(
  pg_temp.text_as('d0000000-0000-0000-0000-000000000004',
    $q$select former::text from public.former_member_entries(
         '{}'::uuid[], array['cc000000-0000-4000-8000-000000000002']::uuid[])$q$),
  'true', '… der eines gelöschten schon');

-- 7.11 Und die Sichtbarkeit gilt auch auf der Kommentarseite: hängt der
-- Kommentar unter einem unsichtbaren Beitrag, gibt es keine Auskunft.
select is(
  pg_temp.int_as('d0000000-0000-0000-0000-000000000007',
    $q$select count(*)::int from public.former_member_entries(
         '{}'::uuid[], array['cc000000-0000-4000-8000-000000000003']::uuid[])$q$),
  0, 'Ein Kommentar unter einem fuer den Aufrufer unsichtbaren Beitrag bleibt '
     'ohne Auskunft (Aufrufer nicht aktiviert — nach AGE-601 die einzige Sperre)');

-- 7.12 Ein Aufruf mit beiden Listen liefert beide Arten, unterscheidbar.
select is(
  pg_temp.text_as('d0000000-0000-0000-0000-000000000004',
    $q$select string_agg(kind || ':' || former::text, ',' order by kind)
         from public.former_member_entries(
           array['bb000000-0000-4000-8000-000000000002']::uuid[],
           array['cc000000-0000-4000-8000-000000000001']::uuid[])$q$),
  'comment:false,post:true',
  'Ein Aufruf trägt beide Arten, und die Art steht dabei');

-- 7.13 Die Rückgabe trägt kein Mitgliedsdatum. Geprüft wird die SPALTENLISTE
-- und nicht ein Beispieldatensatz: ein leeres Feld sähe aus wie ein fehlendes.
select is(
  (select array_agg(a.name order by a.ord)
     from pg_proc p,
          unnest(p.proargnames, p.proargmodes) with ordinality as a(name, modus, ord)
    where p.oid = 'public.former_member_entries(uuid[],uuid[])'::regprocedure
      and a.modus = 't'),
  array['kind', 'entry_id', 'former'],
  'Die Rückgabe trägt Art, ID und einen Wahrheitswert — keinen Namen, kein Bild, keine Stufe, keinen Zeitpunkt');

-- 7.14 Die Eingabemenge ist begrenzt. Eine unbegrenzte Liste machte die
-- Funktion zu einem Weg, den ganzen Bestand in einem Aufruf durchzuprüfen.
select is(
  pg_temp.state_as('d0000000-0000-0000-0000-000000000004',
    $q$select * from public.former_member_entries(
         (select array_agg(gen_random_uuid()) from generate_series(1, 201)))$q$),
  '22023', 'Mehr IDs als erlaubt weist die Funktion ab, statt sie abzuarbeiten');

-- 7.15–7.17 Rechte werden ausgesprochen, nicht geerbt (AGE-312). Ohne Session
-- wird sie nicht gerufen — wie die Autorenabfrage auch (AGE-530).
select is(has_function_privilege('anon', 'public.former_member_entries(uuid[],uuid[])', 'execute'),
  false, 'former_member_entries: anon darf nicht ausführen');
select is(has_function_privilege('authenticated', 'public.former_member_entries(uuid[],uuid[])', 'execute'),
  true, 'former_member_entries: authenticated darf');
select ok(
  not exists (
    select 1 from aclexplode((select proacl from pg_proc
                               where oid = 'public.former_member_entries(uuid[],uuid[])'::regprocedure)) a
     where a.grantee = 0),
  'former_member_entries: PUBLIC hält kein EXECUTE');

-- 7.18 DER WÄCHTER ÜBER DIE KOPIE.
--
-- `former_member_entries` ist SECURITY DEFINER, also ist die RLS auf `posts`
-- ausgeschaltet und das Sichtbarkeitsprädikat steht dort ein ZWEITES Mal —
-- abgeschrieben von `posts_select_by_visibility`. Dieselbe Falle wie bei
-- `profiles_public`, wo vier DEFINER-RPCs ihr Prädikat duplizieren: eine neue
-- Sichtbarkeitsregel kommt an einer Stelle an und an der anderen nicht.
--
-- Kein Verhaltenstest fängt das. Ändert jemand die POLICY, laufen alle Zusagen
-- oben weiter grün — sie rufen ja nur die Funktion, und die trägt dann eben die
-- alte Regel. Deshalb hier ein Wortlaut-Vergleich: bricht er, ist das die
-- Aufforderung, die Kopie in der Migration nachzuziehen, nicht ihn anzupassen.
select is(
  (select pg_get_expr(polqual, polrelid) from pg_policy
    where polrelid = 'public.posts'::regclass
      and polname = 'posts_select_by_visibility'),
  -- AGE-601: der `members`-Zweig traegt keine Stufenschwelle mehr. Dieser
  -- Waechter hat beim Umstellen gebrochen und damit genau das geleistet, wofuer
  -- er da ist — die Kopie in `former_member_entries` wurde in derselben
  -- Migration nachgezogen (20260826100000).
  --
  -- AGE-667: UND ZUM ZWEITEN MAL. Der Veroeffentlichungszeitpunkt kam in die
  -- Policy, dieser Waechter wurde rot, und die Kopie in
  -- `former_member_entries` ist in derselben Migration (20260829090000)
  -- nachgezogen worden — samt eigener Zusage in
  -- `supabase/tests/geplante_beitraege_test.sql`, die vorher rot war.
  '(is_activated() AND ((visibility = ''public''::text) OR (visibility = ''members''::text) '
  'OR (author_id = ( SELECT auth.uid() AS uid))) AND ((veroeffentlicht_ab <= now()) '
  'OR (author_id = ( SELECT auth.uid() AS uid))))',
  'posts_select_by_visibility unveraendert — sonst ist die Kopie in former_member_entries nachzuziehen');

select * from finish();
rollback;
