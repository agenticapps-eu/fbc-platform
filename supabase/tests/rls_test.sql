-- RLS-Tests der 6-Level-Rechte-Matrix (AGE-311) — `supabase test db`.
-- Prüft docs/superpowers/specs/2026-07-15-fbc-6level-upgrade.md §2 über
-- basic(1) connect(2) discover(3) exchange(4) focus(5) impact(6).
--
-- Ersetzt den P5-Test (AGE-235), der die alte Discover/Prime/Legacy-Matrix
-- kodierte: er baute u. a. einen `visibility='legacy'`-Post und prüfte rank >= 7 —
-- beides existiert nach 20260715120000_six_level_model.sql nicht mehr.
--
-- RLS greift nur für eine Nicht-Owner-Rolle, daher läuft jede sensible Operation
-- als `authenticated` mit dem JWT-sub des Mitglieds (Helfer unten), während die
-- pgTAP-Assertions selbst als (Superuser-)Testrolle laufen. Alles in der impliziten
-- pgTAP-Transaktion, nichts wird committet.

begin;
select plan(24);

-- ── Fixtures (als Superuser-Testrolle → an der RLS vorbei) ───────────────────
-- auth.users-Insert feuert handle_new_user() und legt die public.profiles-Zeile an.
insert into auth.users (id, aud, role, email) values
  ('11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'basic@test.fbc'),
  ('22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', 'connect@test.fbc'),
  ('33333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated', 'discover@test.fbc'),
  ('44444444-4444-4444-4444-444444444444', 'authenticated', 'authenticated', 'exchange@test.fbc'),
  ('66666666-6666-6666-6666-666666666666', 'authenticated', 'authenticated', 'impact@test.fbc'),
  ('77777777-7777-7777-7777-777777777777', 'authenticated', 'authenticated', 'neu@test.fbc'),
  ('88888888-8888-8888-8888-888888888888', 'authenticated', 'authenticated', 'optout@test.fbc'),
  ('99999999-9999-9999-9999-999999999999', 'authenticated', 'authenticated', 'frisch@test.fbc');

update public.profiles set tier = 'basic',    name = 'Basic'    where id = '11111111-1111-1111-1111-111111111111';
update public.profiles set tier = 'connect',  name = 'Connect'  where id = '22222222-2222-2222-2222-222222222222';
update public.profiles set tier = 'discover', name = 'Discover' where id = '33333333-3333-3333-3333-333333333333';
update public.profiles set tier = 'exchange', name = 'Exchange' where id = '44444444-4444-4444-4444-444444444444';
update public.profiles set tier = 'impact',   name = 'Impact'   where id = '66666666-6666-6666-6666-666666666666';
update public.profiles set tier = 'connect',  name = 'Neuling'  where id = '77777777-7777-7777-7777-777777777777';
update public.profiles set tier = 'impact',   name = 'OptOut'   where id = '88888888-8888-8888-8888-888888888888';
-- '9999…' behält bewusst den Default → Beleg für den Signup-Startlevel (§3.4).

-- Welpenschutz (§2) gilt 30 Tage ab Registrierung. Ohne Rückdatierung stünden ALLE
-- Fixtures darunter und jede Kontaktanfrage im Test wäre aus dem falschen Grund
-- verboten. '7777…' bleibt bewusst frisch — das ist der Welpenschutz-Fall.
update public.profiles set created_at = now() - interval '90 days'
  where id <> '77777777-7777-7777-7777-777777777777';

-- '8888…' hat Kontaktanfragen abgeschaltet.
insert into public.member_settings (profile_id, contactable_by_prime)
  values ('88888888-8888-8888-8888-888888888888', false);

-- Match Exchange<->Neuling: der einzige erlaubte Weg an ein neues Mitglied.
insert into public.matches (id, a_profile_id, b_profile_id, score) values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc',
   '44444444-4444-4444-4444-444444444444', '77777777-7777-7777-7777-777777777777', 80);

insert into public.offers (profile_id, title) values
  ('66666666-6666-6666-6666-666666666666', 'Impact offer');
insert into public.profile_contacts (profile_id, email) values
  ('66666666-6666-6666-6666-666666666666', 'impact-contact@test.fbc');

-- Beiträge: der 'members'-Post gehört Impact, damit die author-Klausel den
-- exchange-Gate-Test nicht überdeckt. Der 'public'-Post prüft die untere Grenze.
insert into public.posts (id, author_id, body, visibility) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '66666666-6666-6666-6666-666666666666', 'Members-only', 'members'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '66666666-6666-6666-6666-666666666666', 'Öffentlich',   'public'),
  -- Eigener 'members'-Post eines Basic: prüft die author-Klausel unabhängig vom Rang.
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111', 'Mein Beitrag', 'members');
insert into public.comments (post_id, author_id, body) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '66666666-6666-6666-6666-666666666666', 'interner Kommentar');

insert into public.events (id, title, host_id, visibility, starts_at) values
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Sommerfest', '66666666-6666-6666-6666-666666666666',
   'members', now() + interval '7 days');

-- ── Rollen-Impersonation (Muster aus den probe_*.sql) ────────────────────────
create function pg_temp.count_as(uid uuid, q text) returns int language plpgsql as $$
declare n int;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  execute q into n;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return n;
end $$;

-- try_as: 'OK' wenn die Anweisung unter der Identität durchgeht, sonst 'DENIED:<err>'.
create function pg_temp.try_as(uid uuid, q text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
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

-- ── 1. Das Modell selbst (§1a) ───────────────────────────────────────────────
select is(
  (select count(*)::int from public.membership_tiers),
  6, 'Es gibt genau 6 Stufen');

select is(
  (select count(*)::int from public.membership_tiers
    where key in ('explore', 'impuls', 'active', 'prime', 'circle', 'legacy')),
  0, 'Kein alter Key hat die Migration überlebt');

select is(
  (select string_agg(key, ',' order by level_rank) from public.membership_tiers),
  'basic,connect,discover,exchange,focus,impact',
  'Die Ränge steigen basic=1 … impact=6');

select is(
  (select price_year from public.membership_tiers where key = 'discover'),
  150, 'Der neue `discover` kostet 150 € (Namens-Kollision aufgelöst — alt war 0 €)');

select is(
  (select tier from public.profiles where id = '99999999-9999-9999-9999-999999999999'),
  'basic', 'Ein frischer Signup startet auf `basic` (§3.4)');

-- ── 2. profiles — volles Verzeichnis ab `discover` (rank 3) ──────────────────
select is(
  pg_temp.count_as('11111111-1111-1111-1111-111111111111',
    'select count(*)::int from public.profiles_public where id = ''66666666-6666-6666-6666-666666666666'''),
  1, 'Basic sieht Impact im öffentlichen Verzeichnis (profiles_public)');

select is(
  pg_temp.count_as('22222222-2222-2222-2222-222222222222',
    'select count(*)::int from public.profiles where id = ''66666666-6666-6666-6666-666666666666'''),
  0, 'Connect liest KEINE fremde Vollzeile (erweiterte Felder)');

select is(
  pg_temp.count_as('33333333-3333-3333-3333-333333333333',
    'select count(*)::int from public.profiles where id = ''66666666-6666-6666-6666-666666666666'''),
  1, 'Discover liest die fremde Vollzeile — „vollständiges Verzeichnis" ab 150 €');

-- ── 3. offers — ab `discover` (rank 3) ───────────────────────────────────────
select is(
  pg_temp.count_as('22222222-2222-2222-2222-222222222222',
    'select count(*)::int from public.offers where profile_id = ''66666666-6666-6666-6666-666666666666'''),
  0, 'Connect sieht keine fremden Angebote');

select is(
  pg_temp.count_as('33333333-3333-3333-3333-333333333333',
    'select count(*)::int from public.offers where profile_id = ''66666666-6666-6666-6666-666666666666'''),
  1, 'Discover sieht fremde Angebote');

-- ── 4. Kontaktanfragen — ab `exchange` (rank 4) ──────────────────────────────
select like(
  pg_temp.try_as('33333333-3333-3333-3333-333333333333',
    'insert into public.contact_requests (from_id, to_id) values (''33333333-3333-3333-3333-333333333333'', ''66666666-6666-6666-6666-666666666666'')'),
  'DENIED:%', 'Discover kann keine Kontaktanfrage senden (rank < exchange)');

select is(
  pg_temp.try_as('44444444-4444-4444-4444-444444444444',
    'insert into public.contact_requests (from_id, to_id) values (''44444444-4444-4444-4444-444444444444'', ''66666666-6666-6666-6666-666666666666'')'),
  'OK', 'Exchange kann eine Kontaktanfrage senden');

-- ── 5. Welpenschutz (§2) — an neue Mitglieder nur über ein Match ─────────────
select like(
  pg_temp.try_as('44444444-4444-4444-4444-444444444444',
    'insert into public.contact_requests (from_id, to_id) values (''44444444-4444-4444-4444-444444444444'', ''77777777-7777-7777-7777-777777777777'')'),
  'DENIED:%', 'Ein neues Mitglied ist in den ersten 30 Tagen nicht KALT kontaktierbar');

select is(
  pg_temp.try_as('44444444-4444-4444-4444-444444444444',
    'insert into public.contact_requests (from_id, to_id, match_id) values (''44444444-4444-4444-4444-444444444444'', ''77777777-7777-7777-7777-777777777777'', ''cccccccc-cccc-cccc-cccc-cccccccccccc'')'),
  'OK', 'Über ein Match ist dasselbe neue Mitglied erreichbar');

-- ── 6. Opt-out des Empfängers (member_settings) ──────────────────────────────
select like(
  pg_temp.try_as('44444444-4444-4444-4444-444444444444',
    'insert into public.contact_requests (from_id, to_id) values (''44444444-4444-4444-4444-444444444444'', ''88888888-8888-8888-8888-888888888888'')'),
  'DENIED:%', 'Wer Kontaktanfragen abgeschaltet hat, bekommt keine (Opt-out wird erzwungen)');

-- ── 7. posts — „Aktivität" ab `exchange` (rank 4) ────────────────────────────
select is(
  pg_temp.count_as('33333333-3333-3333-3333-333333333333',
    'select count(*)::int from public.posts where id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'''),
  0, 'Discover sieht die Aktivität nicht (members-Post gesperrt)');

select is(
  pg_temp.count_as('44444444-4444-4444-4444-444444444444',
    'select count(*)::int from public.posts where id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'''),
  1, 'Exchange sieht die Aktivität — der „Wow"-Moment nach dem Upgrade');

select is(
  pg_temp.count_as('11111111-1111-1111-1111-111111111111',
    'select count(*)::int from public.posts where id = ''bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'''),
  1, 'Basic sieht öffentliche Beiträge');

select is(
  pg_temp.count_as('11111111-1111-1111-1111-111111111111',
    'select count(*)::int from public.posts where id = ''dddddddd-dddd-dddd-dddd-dddddddddddd'''),
  1, 'Basic sieht den EIGENEN members-Beitrag (author-Klausel, rang-unabhängig)');

-- ── 8. Kommentare erben die Sichtbarkeit des Eltern-Posts ────────────────────
select is(
  pg_temp.count_as('33333333-3333-3333-3333-333333333333',
    'select count(*)::int from public.comments where post_id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'''),
  0, 'Kommentar auf gesperrtem Post ist für Discover unsichtbar (kein Gate-Loch)');

select is(
  pg_temp.count_as('44444444-4444-4444-4444-444444444444',
    'select count(*)::int from public.comments where post_id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'''),
  1, 'Exchange sieht den Kommentar');

-- ── 9. Events — sichtbar für alle, Teilnahme ab `exchange` (Nav-Spec §4) ─────
select is(
  pg_temp.count_as('11111111-1111-1111-1111-111111111111',
    'select count(*)::int from public.events where id = ''eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'''),
  1, 'Basic SIEHT das Event (bewusst anders als die Aktivität)');

select like(
  pg_temp.try_as('33333333-3333-3333-3333-333333333333',
    'select public.register_for_event(''eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'')'),
  'DENIED:%', 'Discover kann sich nicht anmelden — auch nicht über den RPC-Seitenweg');

select is(
  pg_temp.try_as('44444444-4444-4444-4444-444444444444',
    'select public.register_for_event(''eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'')'),
  'OK', 'Exchange kann sich anmelden');

select * from finish();
rollback;
