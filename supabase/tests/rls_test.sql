-- RLS-Tests der 6-Level-Rechte-Matrix (AGE-311) — `supabase test db`.
-- Prüft docs/superpowers/specs/2026-07-15-fbc-6level-upgrade.md §2 über
-- basic(1) connect(2) discover(3) exchange(4) focus(5) impact(6).
--
-- Ersetzt den P5-Test (AGE-235), der die alte Discover/Prime/Legacy-Matrix
-- kodierte: er baute u. a. einen `visibility='legacy'`-Post und prüfte rank >= 7 —
-- beides existiert nach 20260715150000_six_level_model.sql nicht mehr.
--
-- RLS greift nur für eine Nicht-Owner-Rolle, daher läuft jede sensible Operation
-- als `authenticated` mit dem JWT-sub des Mitglieds (Helfer unten), während die
-- pgTAP-Assertions selbst als (Superuser-)Testrolle laufen. Alles in der impliziten
-- pgTAP-Transaktion, nichts wird committet.

begin;
select plan(184);

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

insert into auth.users (id, aud, role, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'admin@test.fbc'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'manager@test.fbc');
update public.profiles set tier = 'impact', name = 'Admin'   where id = 'aaaaaaaa-0000-0000-0000-000000000001';
update public.profiles set tier = 'impact', name = 'Manager' where id = 'bbbbbbbb-0000-0000-0000-000000000002';

update public.profiles set tier = 'basic',    name = 'Basic'    where id = '11111111-1111-1111-1111-111111111111';
update public.profiles set tier = 'connect',  name = 'Connect'  where id = '22222222-2222-2222-2222-222222222222';
update public.profiles set tier = 'discover', name = 'Discover' where id = '33333333-3333-3333-3333-333333333333';
update public.profiles set tier = 'exchange', name = 'Exchange' where id = '44444444-4444-4444-4444-444444444444';
update public.profiles set tier = 'impact',   name = 'Impact'   where id = '66666666-6666-6666-6666-666666666666';
update public.profiles set tier = 'connect',  name = 'Neuling'  where id = '77777777-7777-7777-7777-777777777777';
update public.profiles set tier = 'impact',   name = 'OptOut'   where id = '88888888-8888-8888-8888-888888888888';
-- '9999…' behält bewusst den Default → Beleg für den Signup-Startlevel (§3.4).

-- ── Aktivierungs-Gate (AGE-495) ──────────────────────────────────────────────
-- Die Fixtures oben entstehen NACH dem Backfill aus 20260806080000 und tragen
-- deshalb alle `activated_at = null`. Ohne diese Zeile fielen nach Migration B
-- sämtliche 67 Bestands-Assertions durch — nicht weil eine Stufe falsch wäre,
-- sondern weil kein Fixture bestätigt ist. Das ist keine Testkosmetik: es ist
-- der Beleg, dass das Gate wirklich vor allem anderen steht.
update public.profiles set activated_at = now();

-- Das Sondenkonto für das Gate. Bewusst `impact` (höchste Stufe): bei
-- importierten Mitgliedern liegt hinter dem Gate KEIN Stufen-Gate mehr, das
-- einen Fehler noch auffinge. Ein `basic`-Konto sähe vieles schon wegen der
-- Stufe nicht und täuschte ein Gate vor, das gar nicht greift.
insert into auth.users (id, aud, role, email) values
  ('dddddddd-0000-0000-0000-00000000000d', 'authenticated', 'authenticated', 'nichtaktiv@test.fbc');
update public.profiles
   set tier = 'impact', name = 'Nichtaktiv', created_at = now() - interval '90 days',
       activated_at = null
 where id = 'dddddddd-0000-0000-0000-00000000000d';

-- EIGENE Zeilen für das Sondenkonto. Ohne sie wäre jede 0 im Abschnitt „eigene
-- Daten" nur der Beleg für ein leeres Konto, nicht für das Gate — genau die
-- Sorte grüner Test, die nichts prüft.
insert into public.profile_contacts (profile_id, email, phone) values
  ('dddddddd-0000-0000-0000-00000000000d', 'nichtaktiv-kontakt@test.fbc', '+49 000 1');
insert into public.goals (profile_id, category, title) values
  ('dddddddd-0000-0000-0000-00000000000d', 'persoenlich', 'Eigenes Ziel');
insert into public.notifications (profile_id, type, payload) values
  ('dddddddd-0000-0000-0000-00000000000d', 'system', '{"t":"x"}'::jsonb);
insert into public.member_settings (profile_id) values
  ('dddddddd-0000-0000-0000-00000000000d');
insert into public.compass_responses (profile_id, theme, answers) values
  ('dddddddd-0000-0000-0000-00000000000d', 'tun', '{"a":1}'::jsonb);

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
-- Erweiterte Profildaten in einer NEBEN-Tabelle: sie hing an derselben Schwelle
-- wie profiles und muss ihr folgen, sonst ist die Vollzeile gesperrt und die
-- Chips daneben trotzdem lesbar.
insert into public.profile_interests (profile_id, theme, label) values
  ('66666666-6666-6666-6666-666666666666', 'tun', 'Unternehmensaufbau');
-- Ohne diese beiden Zeilen sind `needs` und `profile_theme_scores` global leer,
-- und die Gate-Assertions darauf sind grün, ohne irgendetwas zu prüfen.
insert into public.needs (profile_id, title) values
  ('66666666-6666-6666-6666-666666666666', 'Impact need');
insert into public.profile_theme_scores (profile_id, theme, score) values
  ('66666666-6666-6666-6666-666666666666', 'tun', 8.0);
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
   'members', now() + interval '7 days'),
  -- AGE-448: öffentliches Event — jeder Eingeloggte (auch basic) darf sich anmelden.
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'Tag der offenen Tür', '66666666-6666-6666-6666-666666666666',
   'public', now() + interval '7 days');

-- Thread Basic<->Connect OHNE Kontaktanfrage: der Gegenbeleg für §8 — ein
-- bestehender Thread allein berechtigt nicht zum Schreiben.
insert into public.message_threads (a_profile_id, b_profile_id) values
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');

-- Ohne diese Zeile ist `routing_queue` leer und die list_routing_queue-Assertion
-- unten grün, ohne etwas zu prüfen.
insert into public.routing_queue (match_id, routing, status) values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'dkri', 'open');

-- Staff (server-kontrolliert, ADR-0002). Provisioniert wie in Prod: direkt, nie vom Client.
insert into public.staff_roles (profile_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'admin'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'matching_manager');

-- Feedback von zwei verschiedenen Autoren — der Admin darf beide sehen, sonst niemand.
insert into public.feedback (profile_id, rating, likes, misses, idea, route) values
  ('11111111-1111-1111-1111-111111111111', 5, 'Der Compass', 'Nichts', 'Mehr Events', '/compass'),
  ('66666666-6666-6666-6666-666666666666', 2, 'Das Design', 'Tempo',  'Schneller',    '/meine-chancen');

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

-- Rumpf einer Function OHNE Kommentare — beide Formen. `--` bis Zeilenende und
-- `/* … */` über Zeilen hinweg. Wer nur die erste entfernt, prüft eine Zusage,
-- die ein Blockkommentar vortäuschen kann; gemessen im Review zu AGE-507.
create function pg_temp.rumpf_ohne_kommentare(f regprocedure) returns text
language sql stable as $$
  select regexp_replace(
           regexp_replace(pg_get_functiondef(f), '/\*.*?\*/', '', 'g'),
           '--[^\n]*', '', 'g')
$$;

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

-- Die Neben-Tabellen der erweiterten Profildaten müssen dieselbe Schwelle tragen.
select is(
  pg_temp.count_as('22222222-2222-2222-2222-222222222222',
    'select count(*)::int from public.profile_interests where profile_id = ''66666666-6666-6666-6666-666666666666'''),
  0, 'Connect sieht fremde Interessen nicht (Neben-Tabelle folgt profiles)');

select is(
  pg_temp.count_as('33333333-3333-3333-3333-333333333333',
    'select count(*)::int from public.profile_interests where profile_id = ''66666666-6666-6666-6666-666666666666'''),
  1, 'Discover sieht fremde Interessen');

-- ── 3. offers — ab `discover` (rank 3) ───────────────────────────────────────
select is(
  pg_temp.count_as('22222222-2222-2222-2222-222222222222',
    'select count(*)::int from public.offers where profile_id = ''66666666-6666-6666-6666-666666666666'''),
  0, 'Connect sieht keine fremden Angebote');

select is(
  pg_temp.count_as('33333333-3333-3333-3333-333333333333',
    'select count(*)::int from public.offers where profile_id = ''66666666-6666-6666-6666-666666666666'''),
  1, 'Discover sieht fremde Angebote');

-- open_contact steuert, ob Level-Gate + Welpenschutz gelten (AGE-455). Die Gate-Tests
-- in Abschnitt 4–6 prüfen den GESCHLOSSENEN Modus (§2-Default); der Migrations-Seed
-- steht auf true (Sommerfest), daher hier explizit aus.
update public.platform_settings set open_contact = false;

-- ── 4. Kontaktanfragen — ab `exchange` (rank 4) ──────────────────────────────
select alike(
  pg_temp.try_as('33333333-3333-3333-3333-333333333333',
    'insert into public.contact_requests (from_id, to_id) values (''33333333-3333-3333-3333-333333333333'', ''66666666-6666-6666-6666-666666666666'')'),
  'DENIED:%', 'Discover kann keine Kontaktanfrage senden (rank < exchange)');

select is(
  pg_temp.try_as('44444444-4444-4444-4444-444444444444',
    'insert into public.contact_requests (from_id, to_id) values (''44444444-4444-4444-4444-444444444444'', ''66666666-6666-6666-6666-666666666666'')'),
  'OK', 'Exchange kann eine Kontaktanfrage senden');

-- ── 5. Welpenschutz (§2) — an neue Mitglieder nur über ein Match ─────────────
select alike(
  pg_temp.try_as('44444444-4444-4444-4444-444444444444',
    'insert into public.contact_requests (from_id, to_id) values (''44444444-4444-4444-4444-444444444444'', ''77777777-7777-7777-7777-777777777777'')'),
  'DENIED:%', 'Ein neues Mitglied ist in den ersten 30 Tagen nicht KALT kontaktierbar');

select is(
  pg_temp.try_as('44444444-4444-4444-4444-444444444444',
    'insert into public.contact_requests (from_id, to_id, match_id) values (''44444444-4444-4444-4444-444444444444'', ''77777777-7777-7777-7777-777777777777'', ''cccccccc-cccc-cccc-cccc-cccccccccccc'')'),
  'OK', 'Über ein Match ist dasselbe neue Mitglied erreichbar');

-- ── 6. Opt-out des Empfängers (member_settings) ──────────────────────────────
select alike(
  pg_temp.try_as('44444444-4444-4444-4444-444444444444',
    'insert into public.contact_requests (from_id, to_id) values (''44444444-4444-4444-4444-444444444444'', ''88888888-8888-8888-8888-888888888888'')'),
  'DENIED:%', 'Wer Kontaktanfragen abgeschaltet hat, bekommt keine (Opt-out wird erzwungen)');

-- ── 6b. open_contact öffnet BEIDE Gates (AGE-455) ───────────────────────────
-- Mit dem Flag darf jedes eingeloggte Mitglied jeden anschreiben — Level-Gate und
-- Welpenschutz offen. Das Empfänger-Opt-out bleibt in JEDEM Modus erzwungen.
update public.platform_settings set open_contact = true;

-- Basic (rank 1) an ein FRISCHES Mitglied (7777) OHNE Match: geschlossen doppelt
-- verboten (Level + Welpenschutz), offen erlaubt → belegt, dass beide Gates fallen.
select is(
  pg_temp.try_as('11111111-1111-1111-1111-111111111111',
    'insert into public.contact_requests (from_id, to_id) values (''11111111-1111-1111-1111-111111111111'', ''77777777-7777-7777-7777-777777777777'')'),
  'OK', 'open_contact: Basic darf ein neues Mitglied kalt anschreiben (Level + Welpenschutz offen)');

-- Das Opt-out (8888) bleibt auch im offenen Modus geschützt.
select alike(
  pg_temp.try_as('11111111-1111-1111-1111-111111111111',
    'insert into public.contact_requests (from_id, to_id) values (''11111111-1111-1111-1111-111111111111'', ''88888888-8888-8888-8888-888888888888'')'),
  'DENIED:%', 'open_contact: das Empfänger-Opt-out bleibt erzwungen');

-- ── 6c. platform_settings ist admin-schaltbar (AGE-455) ─────────────────────
update public.platform_settings set open_contact = false;  -- Ausgangswert (Superuser)

-- Nicht-Admin: das UPDATE läuft (Spalten-Grant) und wirft nicht, trifft unter RLS
-- aber 0 Zeilen (using = is_admin() = false) und ändert deshalb nichts.
select is(
  pg_temp.try_as('11111111-1111-1111-1111-111111111111',
    'update public.platform_settings set open_contact = true where id'),
  'OK', 'Nicht-Admin-UPDATE wirft nicht (RLS filtert die Zeile weg)');
select is(
  (select open_contact from public.platform_settings where id),
  false, '… ändert den Flag aber nicht');

-- Admin darf schreiben.
select is(
  pg_temp.try_as('aaaaaaaa-0000-0000-0000-000000000001',
    'update public.platform_settings set open_contact = true where id'),
  'OK', 'Admin darf platform_settings schreiben');
select is(
  (select open_contact from public.platform_settings where id),
  true, 'Admin schaltet open_contact frei');

-- ── 7. Nachrichten — nur an bereits akzeptierte Kontakte (§2) ────────────────
-- Diese Policies hängen an KEINER Stufe: sie verlangen eine angenommene
-- Kontaktanfrage, sonst nichts. Genau das meint §2 mit „Nachrichten auf basic nur
-- an bereits akzeptierte Kontakte" — nicht der Rang öffnet den Chat, sondern das
-- Einverständnis des Gegenübers. Deshalb steht der Abschnitt hier und nicht bei
-- den Rang-Gates: er prüft die Zustimmung, und die ist die Grenze.
--
-- Ausgangspunkt ist die Anfrage Exchange→Impact aus Abschnitt 4, die noch auf
-- 'pending' liegt.

select alike(
  pg_temp.try_as('44444444-4444-4444-4444-444444444444',
    'insert into public.message_threads (a_profile_id, b_profile_id) values (''44444444-4444-4444-4444-444444444444'', ''66666666-6666-6666-6666-666666666666'')'),
  'DENIED:%', 'Kein Thread, solange die Kontaktanfrage nur pending ist');

select is(
  pg_temp.try_as('66666666-6666-6666-6666-666666666666',
    'update public.contact_requests set status = ''accepted'' where from_id = ''44444444-4444-4444-4444-444444444444'' and to_id = ''66666666-6666-6666-6666-666666666666'''),
  'OK', 'Der Empfänger (Impact) nimmt die Kontaktanfrage an');

-- Den Thread legt der Client nicht an: handle_contact_request_change() öffnet ihn
-- beim Annehmen (normalisiert über least/greatest, on conflict do nothing). Ein
-- manuelles Insert könnte hier nur den Unique-Constraint treffen — geprüft wird
-- deshalb, was gelten muss: der Thread existiert und Exchange sieht ihn.
select is(
  pg_temp.count_as('44444444-4444-4444-4444-444444444444',
    'select count(*)::int from public.message_threads where a_profile_id = ''44444444-4444-4444-4444-444444444444'' and b_profile_id = ''66666666-6666-6666-6666-666666666666'''),
  1, 'Das Annehmen öffnet einen Thread, den Exchange sieht');

-- Gegenbeleg am Fixture-Thread Basic<->Connect: er existiert, aber ohne Anfrage.
select alike(
  pg_temp.try_as('11111111-1111-1111-1111-111111111111',
    'insert into public.messages (thread_id, sender_id, body) select id, ''11111111-1111-1111-1111-111111111111'', ''hallo'' from public.message_threads where a_profile_id = ''11111111-1111-1111-1111-111111111111'' and b_profile_id = ''22222222-2222-2222-2222-222222222222'''),
  'DENIED:%', 'Ein bestehender Thread allein reicht nicht — ohne angenommene Anfrage keine Nachricht');

select is(
  pg_temp.try_as('44444444-4444-4444-4444-444444444444',
    'insert into public.messages (thread_id, sender_id, body) select id, ''44444444-4444-4444-4444-444444444444'', ''hallo'' from public.message_threads where a_profile_id = ''44444444-4444-4444-4444-444444444444'' and b_profile_id = ''66666666-6666-6666-6666-666666666666'''),
  'OK', 'Nach dem Annehmen geht die Nachricht durch');

-- ── 8. posts — „Aktivität" ab `exchange` (rank 4) ────────────────────────────
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

-- ── 9. Kommentare erben die Sichtbarkeit des Eltern-Posts ────────────────────
select is(
  pg_temp.count_as('33333333-3333-3333-3333-333333333333',
    'select count(*)::int from public.comments where post_id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'''),
  0, 'Kommentar auf gesperrtem Post ist für Discover unsichtbar (kein Gate-Loch)');

select is(
  pg_temp.count_as('44444444-4444-4444-4444-444444444444',
    'select count(*)::int from public.comments where post_id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'''),
  1, 'Exchange sieht den Kommentar');

-- ── 10. Events — sichtbar für alle; Teilnahme sichtbarkeitsabhängig (AGE-448) ─
-- public: jeder Eingeloggte (auch basic). members: ab `discover` (rank 3) oder Host.
select is(
  pg_temp.count_as('11111111-1111-1111-1111-111111111111',
    'select count(*)::int from public.events where id = ''eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'''),
  1, 'Basic SIEHT das Event (bewusst anders als die Aktivität)');

-- members-Event: connect (rank 2) bleibt draußen, discover (rank 3) kommt rein.
select alike(
  pg_temp.try_as('22222222-2222-2222-2222-222222222222',
    'select public.register_for_event(''eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'')'),
  'DENIED:%', 'Connect kann sich NICHT zum Mitglieder-Event anmelden (unter discover)');

select is(
  pg_temp.try_as('33333333-3333-3333-3333-333333333333',
    'select public.register_for_event(''eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'')'),
  'OK', 'Discover kann sich zum Mitglieder-Event anmelden (ab rank 3)');

select is(
  pg_temp.try_as('44444444-4444-4444-4444-444444444444',
    'select public.register_for_event(''eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'')'),
  'OK', 'Exchange kann sich anmelden');

-- public-Event: basic (rank 1) darf sich anmelden — das ist der Sommerfest-Fall.
select is(
  pg_temp.try_as('11111111-1111-1111-1111-111111111111',
    'select public.register_for_event(''ffffffff-ffff-ffff-ffff-ffffffffffff'')'),
  'OK', 'Basic kann sich zum öffentlichen Event anmelden (Gäste-Fall)');

-- ── 11. feedback — plattformweites QM (§3.5, AGE-300) ────────────────────────
-- `admin` liest alles (feedback_admin_read), alle anderen nur ihr eigenes
-- (feedback_own). Die Quelle ist staff_roles, NICHT profiles.roles — letzteres
-- ist member-writable, ein Mitglied könnte sich sonst selbst freischalten.
select is(
  pg_temp.count_as('aaaaaaaa-0000-0000-0000-000000000001',
    'select count(*)::int from public.feedback'),
  2, 'Admin liest fremdes Feedback (beide Zeilen)');

select is(
  pg_temp.count_as('11111111-1111-1111-1111-111111111111',
    'select count(*)::int from public.feedback'),
  1, 'Ein gewöhnliches Mitglied sieht nur sein eigenes Feedback');

select is(
  pg_temp.count_as('bbbbbbbb-0000-0000-0000-000000000002',
    'select count(*)::int from public.feedback'),
  0, 'Ein matching_manager sieht KEIN fremdes Feedback — QM ist nicht die Deal-Queue');

-- Der Admin liest, er verwaltet nicht: feedback_admin_read ist `for select`,
-- feedback_own greift bei fremden Zeilen nicht. Ohne diese Assertion wäre ein
-- versehentliches `for all` in der Policy unbemerkt.
select is(
  pg_temp.try_as('aaaaaaaa-0000-0000-0000-000000000001',
    'delete from public.feedback where profile_id = ''11111111-1111-1111-1111-111111111111'''),
  'OK', 'DELETE läuft ohne Fehler durch (RLS filtert stumm, statt zu werfen)');

select is(
  (select count(*)::int from public.feedback
    where profile_id = '11111111-1111-1111-1111-111111111111'),
  1, '… aber die fremde Zeile steht noch — Admin darf lesen, nicht löschen');

-- is_admin() muss wie jede Schwesterfunktion (is_matching_manager,
-- recompute_potential_score) gegen anon/public gesperrt sein (AGE-312). anon
-- ist kein try_as-Fall (der setzt eine authentifizierte Identität) — die
-- EXECUTE-Grant-ACL prüft man direkt über has_function_privilege.
select is(
  has_function_privilege('anon', 'public.is_admin()', 'execute'),
  false, 'anon darf is_admin() nicht ausführen — gesperrt wie die Geschwister');

select is(
  has_function_privilege('authenticated', 'public.is_admin()', 'execute'),
  true, 'authenticated behält sein explizites EXECUTE auf is_admin()');

-- ── 12. admin_list_feedback() — Admin-Sicht mit Autor (AGE-358) ──────────────
-- SECURITY DEFINER: joint feedback+profiles an der profiles-RLS vorbei, damit der
-- Admin den Autor-Namen auch bei nicht-öffentlichen Profilen sieht. Gibt aber nur
-- Zeilen zurück, wenn public.is_admin() — ein Nicht-Admin (auch matching_manager)
-- bekommt leer. Die feedback-Fixtures oben stammen von '1111…' (Basic) und
-- '6666…' (Impact); genau deren Namen müssen im author_name auftauchen.
select is(
  pg_temp.count_as('aaaaaaaa-0000-0000-0000-000000000001',
    'select count(*)::int from public.admin_list_feedback()'),
  2, 'Admin bekommt aus admin_list_feedback() beide Feedback-Zeilen');

select is(
  pg_temp.count_as('aaaaaaaa-0000-0000-0000-000000000001',
    'select count(*)::int from public.admin_list_feedback() where author_name in (''Basic'', ''Impact'')'),
  2, 'Der Autor-Name ist aufgelöst — der Join greift hinter der profiles-RLS');

select is(
  pg_temp.count_as('bbbbbbbb-0000-0000-0000-000000000002',
    'select count(*)::int from public.admin_list_feedback()'),
  0, 'Ein matching_manager bekommt aus admin_list_feedback() nichts — QM ist nicht die Deal-Queue');

select is(
  pg_temp.count_as('11111111-1111-1111-1111-111111111111',
    'select count(*)::int from public.admin_list_feedback()'),
  0, 'Ein gewöhnliches Mitglied bekommt aus admin_list_feedback() nichts');

select is(
  has_function_privilege('anon', 'public.admin_list_feedback()', 'execute'),
  false, 'anon darf admin_list_feedback() nicht ausführen — gesperrt wie die Geschwister');

select is(
  has_function_privilege('authenticated', 'public.admin_list_feedback()', 'execute'),
  true, 'authenticated darf admin_list_feedback() ausführen (der RPC-Aufruf der Sicht)');

-- ── apply_upgrade: nur-Upgrade, idempotent, service-role-only (§3.3/§3.4) ─────
-- Läuft am Ende, weil es Fixture-Tiers mutiert; frühere Assertions sind durch.
select is(public.apply_upgrade('11111111-1111-1111-1111-111111111111', 'discover'),
  'discover', 'apply_upgrade Basic→Discover gibt den neuen Tier zurück');
select is((select tier from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'discover', 'profiles.tier steht danach auf discover');
select is(public.apply_upgrade('11111111-1111-1111-1111-111111111111', 'discover'),
  'discover', 'Wiederholung ist idempotent — kein Fehler, gleicher Tier');
select is(public.apply_upgrade('66666666-6666-6666-6666-666666666666', 'discover'),
  'impact', 'Ein tieferes Ziel downgradet NICHT — Impact bleibt Impact');
select throws_ok(
  $$ select public.apply_upgrade('11111111-1111-1111-1111-111111111111'::uuid, 'bogus') $$,
  '22023', 'unknown level: bogus', 'Unbekanntes Level wirft 22023');
select is(has_function_privilege('anon', 'public.apply_upgrade(uuid, text)', 'execute'),
  false, 'anon darf apply_upgrade nicht ausführen');
select is(has_function_privilege('authenticated', 'public.apply_upgrade(uuid, text)', 'execute'),
  false, 'authenticated darf apply_upgrade nicht ausführen');
select is(has_function_privilege('service_role', 'public.apply_upgrade(uuid, text)', 'execute'),
  true, 'service_role darf apply_upgrade ausführen (der Webhook-Weg)');
select alike(
  pg_temp.try_as('11111111-1111-1111-1111-111111111111',
    'update public.profiles set tier = ''impact'' where id = ''11111111-1111-1111-1111-111111111111'''),
  'DENIED:%', 'authenticated kann profiles.tier NICHT selbst schreiben (Spalten-Grant)');

-- ── member_settings.theme: eigen, privat, wertgeprüft (AGE-492) ──────────────
-- Das Theme trägt keine Zugriffsbedeutung, aber es liegt in member_settings —
-- einer Tabelle, die strikt own-profile ist. Geprüft wird deshalb dreierlei:
-- der Eigner schreibt, ein Fremder erreicht die Zeile nicht, und die DB (nicht
-- der Client) lehnt einen unbekannten Wert ab.
--
-- Die Zeile für '1111…' wird hier angelegt: die Fixture oben legt nur für
-- '8888…' eine an. Ohne sie liefe jedes UPDATE unten auf null Zeilen und wäre
-- grün, ohne irgendetwas zu prüfen.
insert into public.member_settings (profile_id) values ('11111111-1111-1111-1111-111111111111');

select is(
  (select theme from public.member_settings where profile_id = '11111111-1111-1111-1111-111111111111'),
  'hell', 'theme: der Default ist hell');

select is(
  pg_temp.try_as('11111111-1111-1111-1111-111111111111',
    'update public.member_settings set theme = ''navy'' where profile_id = ''11111111-1111-1111-1111-111111111111'''),
  'OK', 'theme: das eigene Theme darf man setzen');

select is(
  (select theme from public.member_settings where profile_id = '11111111-1111-1111-1111-111111111111'),
  'navy', 'theme: der gesetzte Wert steht auch wirklich in der Zeile');

-- Fremdzugriff wirft NICHT — die Policy filtert die fremde Zeile aus dem UPDATE
-- heraus. Der Beweis ist deshalb der unveränderte Wert, nicht ein Fehler.
select is(
  pg_temp.try_as('88888888-8888-8888-8888-888888888888',
    'update public.member_settings set theme = ''hell'' where profile_id = ''11111111-1111-1111-1111-111111111111'''),
  'OK', 'theme: das fremde UPDATE läuft fehlerfrei durch …');

select is(
  (select theme from public.member_settings where profile_id = '11111111-1111-1111-1111-111111111111'),
  'navy', '… ändert die fremde Zeile aber nicht (RLS filtert sie heraus)');

select alike(
  pg_temp.try_as('11111111-1111-1111-1111-111111111111',
    'update public.member_settings set theme = ''sommerfest'' where profile_id = ''11111111-1111-1111-1111-111111111111'''),
  'DENIED:%', 'theme: ein unbekannter Wert wird von der DB abgelehnt, nicht nur vom Client');

-- ── 13. Aktivierungs-Gate (AGE-495) ──────────────────────────────────────────
-- Läuft am Ende, weil der Block Fixtures mutiert (er nimmt zwei Konten die
-- Aktivierung weg). Das Sondenkonto 'dddd…' ist `impact` und NICHT aktiviert —
-- es steht für ein importiertes Mitglied, in dessen Konto sich jemand mit dem
-- verteilten Passwort angemeldet hat.

-- Hilfsfunktion für die anon-Gegenprobe: count_as setzt eine authentifizierte
-- Identität und taugt deshalb nicht, um „der ausgeloggte Besucher sieht weiter"
-- zu belegen.
create function pg_temp.count_as_anon(q text) returns int language plpgsql as $$
declare n int;
begin
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';
  execute q into n;
  reset role;
  return n;
end $$;

-- 13.1 Fremddaten — der Kern der Zusage aus AGE-495.
select is(pg_temp.count_as('dddddddd-0000-0000-0000-00000000000d',
  'select count(*)::int from public.profiles where id <> ''dddddddd-0000-0000-0000-00000000000d'''),
  0, 'Gate: nicht aktiviert sieht KEINE fremde Profilzeile');

select is(pg_temp.count_as('dddddddd-0000-0000-0000-00000000000d',
  'select count(*)::int from public.profiles_public'),
  0, 'Gate: nicht aktiviert sieht das Verzeichnis nicht (View umgeht die Policies!)');

select is(pg_temp.count_as('dddddddd-0000-0000-0000-00000000000d',
  'select count(*)::int from public.posts'), 0, 'Gate: keine Beiträge');
select is(pg_temp.count_as('dddddddd-0000-0000-0000-00000000000d',
  'select count(*)::int from public.events'), 0, 'Gate: keine Veranstaltungen');
select is(pg_temp.count_as('dddddddd-0000-0000-0000-00000000000d',
  'select count(*)::int from public.offers'), 0, 'Gate: keine Angebote');
select is(pg_temp.count_as('dddddddd-0000-0000-0000-00000000000d',
  'select count(*)::int from public.needs'), 0, 'Gate: keine Gesuche');
select is(pg_temp.count_as('dddddddd-0000-0000-0000-00000000000d',
  'select count(*)::int from public.profile_interests'), 0, 'Gate: keine fremden Interessen');
select is(pg_temp.count_as('dddddddd-0000-0000-0000-00000000000d',
  'select count(*)::int from public.profile_theme_scores'), 0, 'Gate: kein fremder Erfolgsradar');
select is(pg_temp.count_as('dddddddd-0000-0000-0000-00000000000d',
  'select count(*)::int from public.comments'), 0, 'Gate: keine Kommentare');
select is(pg_temp.count_as('dddddddd-0000-0000-0000-00000000000d',
  'select count(*)::int from public.membership_tiers'),
  6, 'Gate: Referenzdaten (Stufen) bleiben lesbar — sie tragen keinen Personenbezug');

-- 13.2 EIGENE Daten. Der Angreifer meldet sich ALS das Mitglied an; auth.uid()
-- ist die ID des Bestohlenen. Diese fünf Assertions sind codex' blockierender
-- Befund aus Review-Runde 1 — sie fehlten in der ersten Planung vollständig.
select is(pg_temp.count_as('dddddddd-0000-0000-0000-00000000000d',
  'select count(*)::int from public.profile_contacts'),
  0, 'Gate: auch die EIGENEN Kontaktdaten bleiben zu (E-Mail + Telefon!)');
select is(pg_temp.count_as('dddddddd-0000-0000-0000-00000000000d',
  'select count(*)::int from public.goals'), 0, 'Gate: auch die eigenen Ziele');
select is(pg_temp.count_as('dddddddd-0000-0000-0000-00000000000d',
  'select count(*)::int from public.notifications'), 0, 'Gate: auch die eigenen Benachrichtigungen');
select is(pg_temp.count_as('dddddddd-0000-0000-0000-00000000000d',
  'select count(*)::int from public.member_settings'), 0, 'Gate: auch die eigenen Einstellungen');
select is(pg_temp.count_as('dddddddd-0000-0000-0000-00000000000d',
  'select count(*)::int from public.compass_responses'), 0, 'Gate: auch die eigenen Kompass-Antworten');

-- 13.3 Schreiben. Ein nicht aktiviertes Konto darf nichts veröffentlichen —
-- sonst erscheint Inhalt unter dem echten Namen eines Mitglieds.
select is(pg_temp.try_as('dddddddd-0000-0000-0000-00000000000d',
  'update public.profiles set short_bio = ''gekapert'' where id = ''dddddddd-0000-0000-0000-00000000000d'''),
  'OK', 'Gate: das UPDATE aufs eigene Profil wirft nicht (RLS filtert still) …');
select is(
  (select short_bio from public.profiles where id = 'dddddddd-0000-0000-0000-00000000000d'),
  null, '… ändert das Profil aber nicht');

select alike(pg_temp.try_as('dddddddd-0000-0000-0000-00000000000d',
  'insert into public.offers (profile_id, title) values (''dddddddd-0000-0000-0000-00000000000d'', ''Kaperangebot'')'),
  'DENIED:%', 'Gate: kein Angebot unter fremdem Namen');
select alike(pg_temp.try_as('dddddddd-0000-0000-0000-00000000000d',
  'insert into public.posts (author_id, body, visibility) values (''dddddddd-0000-0000-0000-00000000000d'', ''Kaperbeitrag'', ''public'')'),
  'DENIED:%', 'Gate: kein Beitrag unter fremdem Namen');
select alike(pg_temp.try_as('dddddddd-0000-0000-0000-00000000000d',
  'insert into public.needs (profile_id, title) values (''dddddddd-0000-0000-0000-00000000000d'', ''Kapergesuch'')'),
  'DENIED:%', 'Gate: kein Gesuch unter fremdem Namen');

-- 13.4 Zielprofil-Gate (Entscheidung 16, Donald 2026-08-06). Ein BESTÄTIGTES
-- Mitglied darf das unbestätigte Profil nicht sehen — sonst ist die Zusage im
-- Mailtext („für kein anderes Mitglied sichtbar") unwahr.
select is(pg_temp.count_as('66666666-6666-6666-6666-666666666666',
  'select count(*)::int from public.profiles_public where id = ''dddddddd-0000-0000-0000-00000000000d'''),
  0, 'Zielprofil-Gate: ein bestätigtes Mitglied sieht das unbestätigte NICHT im Verzeichnis');
select is(pg_temp.count_as('66666666-6666-6666-6666-666666666666',
  'select count(*)::int from public.profiles where id = ''dddddddd-0000-0000-0000-00000000000d'''),
  0, 'Zielprofil-Gate: … auch nicht die Vollzeile');

-- 13.5 my_activation_state — die einzige Fläche, die offen bleibt.
select is(pg_temp.count_as('dddddddd-0000-0000-0000-00000000000d',
  'select count(*)::int from public.my_activation_state() where activated = false'),
  1, 'my_activation_state meldet „nicht aktiviert"');
select is(
  pg_get_function_result('public.my_activation_state()'::regprocedure),
  'TABLE(activated boolean, display_name text)',
  'my_activation_state gibt genau ZWEI Felder zurück — jedes weitere wäre eines, '
  'das ein Angreifer mit dem verteilten Passwort abholt');
select is(has_function_privilege('anon', 'public.my_activation_state()', 'execute'),
  false, 'anon darf my_activation_state nicht ausführen');

-- 13.6 Die sieben SECURITY-DEFINER-RPCs (INVENTORY.md B1). Sie umgehen die RLS;
-- bleiben sie stehen, ist die Migration ein Loch statt eines Gates.
select alike(pg_temp.try_as('dddddddd-0000-0000-0000-00000000000d',
  'select public.register_for_event(''ffffffff-ffff-ffff-ffff-ffffffffffff'')'),
  'DENIED:%not activated%',
  'RPC-Gate: register_for_event lehnt wegen fehlender Aktivierung ab — beim '
  'ÖFFENTLICHEN Event, das sonst jedem Eingeloggten offensteht (AGE-448)');
select alike(pg_temp.try_as('dddddddd-0000-0000-0000-00000000000d',
  'select public.set_event_check_in(''00000000-0000-0000-0000-000000000000''::uuid, true)'),
  'DENIED:%not activated%',
  'RPC-Gate: set_event_check_in lehnt wegen fehlender Aktivierung ab '
  '(nicht wegen „not the host" — das täte es auch ohne Gate)');
select alike(pg_temp.try_as('dddddddd-0000-0000-0000-00000000000d',
  'select public.recompute_my_matches()'),
  'DENIED:%not activated%', 'RPC-Gate: recompute_my_matches lehnt ab');
select is(pg_temp.count_as('dddddddd-0000-0000-0000-00000000000d',
  'select count(*)::int from public.post_engagement_counts(array[''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''::uuid, ''bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb''::uuid])'),
  0, 'RPC-Gate: post_engagement_counts liefert leer (vorher gemessen: 2)');
select is(pg_temp.count_as('dddddddd-0000-0000-0000-00000000000d',
  'select count(*)::int from public.event_registration_counts(array[''eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee''::uuid, ''ffffffff-ffff-ffff-ffff-ffffffffffff''::uuid])'),
  0, 'RPC-Gate: event_registration_counts liefert leer (vorher gemessen: 2)');

-- admin_list_feedback / list_routing_queue brauchen ein STAFF-Konto, um etwas
-- zu liefern — mit einem gewöhnlichen Konto wären sie in beiden Zuständen leer
-- und bewiesen nichts. Deshalb wird hier den beiden Staff-Fixtures die
-- Aktivierung genommen. Ihre eigenen Assertions (Abschnitt 11/12) sind durch.
update public.profiles set activated_at = null
 where id in ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002');

select is(pg_temp.count_as('aaaaaaaa-0000-0000-0000-000000000001',
  'select count(*)::int from public.admin_list_feedback()'),
  0, 'RPC-Gate: ein nicht aktivierter Admin bekommt kein fremdes Feedback');
select is(pg_temp.count_as('bbbbbbbb-0000-0000-0000-000000000002',
  'select count(*)::int from public.list_routing_queue()'),
  0, 'RPC-Gate: ein nicht aktivierter Manager bekommt keine Routing-Queue');
select is(pg_temp.count_as('aaaaaaaa-0000-0000-0000-000000000001',
  'select count(*)::int from public.feedback'),
  0, 'Gate: der nicht aktivierte Admin sieht auch über die Policy nichts');

-- 13.7 Das Schaufenster bleibt offen. Ausdrücklich NICHT über count_as — das
-- setzt eine authentifizierte Identität und könnte die anon-Policies nie prüfen.
select is(pg_temp.count_as_anon(
  'select count(*)::int from public.posts where id = ''bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'''),
  1, 'anon sieht weiterhin öffentliche Beiträge (Detlevs Schaufenster)');
select is(pg_temp.count_as_anon(
  'select count(*)::int from public.events where id = ''ffffffff-ffff-ffff-ffff-ffffffffffff'''),
  1, 'anon sieht weiterhin öffentliche Veranstaltungen');

-- 13.7a Die Zahlen unter dem Schaufenster gehören dazu. Beide Zähler sind an
-- anon vergeben; ohne diese Fälle bleibt unbemerkt, wenn ein Gate im Rumpf sie
-- für den ausgeloggten Besucher leerlaufen lässt — kein Fehler, nur eine 0.
-- Genau das war zwischen dem 06. und dem 07.08. der Fall (Review 8.7, T-D).
select is(pg_temp.count_as_anon(
  'select count(*)::int from public.post_engagement_counts(
     array[''bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb''::uuid])'),
  1, 'anon bekommt weiterhin die Zahlen zum öffentlichen Beitrag');
select is(pg_temp.count_as_anon(
  'select count(*)::int from public.event_registration_counts(
     array[''ffffffff-ffff-ffff-ffff-ffffffffffff''::uuid])'),
  1, 'anon bekommt weiterhin die Zahlen zur öffentlichen Veranstaltung');

-- Und die Gegenrichtung: ein EINGELOGGTES, nicht bestätigtes Konto bekommt sie
-- nicht. Das ist der eigentliche Zweck des Gates — es darf nicht mehr sehen als
-- ein ausgeloggter Besucher, aber die Zahlen sind personenbezogene Aggregate
-- über Likes und Anmeldungen.
select is(pg_temp.count_as('dddddddd-0000-0000-0000-00000000000d',
  'select count(*)::int from public.post_engagement_counts(
     array[''bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb''::uuid])'),
  0, 'Gate: ein nicht aktiviertes Konto bekommt keine Beitragszahlen');
select is(pg_temp.count_as('dddddddd-0000-0000-0000-00000000000d',
  'select count(*)::int from public.event_registration_counts(
     array[''ffffffff-ffff-ffff-ffff-ffffffffffff''::uuid])'),
  0, 'Gate: ein nicht aktiviertes Konto bekommt keine Teilnehmerzahlen');

-- 13.7b recompute_potential_score ist SECURITY DEFINER und an `authenticated`
-- vergeben. Ihr einziger Schutz war `v_caller <> p_profile_id` — also genau der
-- `id = auth.uid()`-Zweig, den der Kopf von 20260806080100 als „die Luecke"
-- benennt. Sie berichtet Zaehlungen ueber die eigenen Beitraege, Angebote,
-- Anmeldungen und Empfehlungen und SCHREIBT dabei an zwei gegateten
-- Write-Policies vorbei (Review 8.7, R1).
select alike(pg_temp.try_as('dddddddd-0000-0000-0000-00000000000d',
  'select public.recompute_potential_score(''dddddddd-0000-0000-0000-00000000000d''::uuid)'),
  'DENIED:%not activated%',
  'RPC-Gate: recompute_potential_score lehnt ein nicht aktiviertes Konto ab');
select is(
  (select count(*)::int from public.profile_theme_scores
    where profile_id = 'dddddddd-0000-0000-0000-00000000000d'),
  0, 'und hat dabei nichts nach profile_theme_scores geschrieben');

-- 13.8 activation_tokens ist für Client-Rollen unerreichbar — kein Grant, keine
-- Policy. Geprüft wird der GRANT, weil eine fehlende Policy allein nicht
-- verhindert, dass jemand später eine hinzufügt.
-- Beide Rollen, alle vier Operationen: bis 2026-08-06 standen hier nur drei der
-- acht Assertions, ein späteres `grant update` oder `grant delete` wäre also
-- unbemerkt durchgegangen — und genau dagegen steht dieser Block.
select is(has_table_privilege('anon', 'public.activation_tokens', 'select'),
  false, 'activation_tokens: anon hat kein SELECT');
select is(has_table_privilege('anon', 'public.activation_tokens', 'insert'),
  false, 'activation_tokens: anon hat kein INSERT');
select is(has_table_privilege('anon', 'public.activation_tokens', 'update'),
  false, 'activation_tokens: anon hat kein UPDATE');
select is(has_table_privilege('anon', 'public.activation_tokens', 'delete'),
  false, 'activation_tokens: anon hat kein DELETE');
select is(has_table_privilege('authenticated', 'public.activation_tokens', 'select'),
  false, 'activation_tokens: authenticated hat kein SELECT');
select is(has_table_privilege('authenticated', 'public.activation_tokens', 'insert'),
  false, 'activation_tokens: authenticated hat kein INSERT');
select is(has_table_privilege('authenticated', 'public.activation_tokens', 'update'),
  false, 'activation_tokens: authenticated hat kein UPDATE');
select is(has_table_privilege('authenticated', 'public.activation_tokens', 'delete'),
  false, 'activation_tokens: authenticated hat kein DELETE');
select is(
  (select count(*)::int from pg_policies where tablename = 'activation_tokens'),
  0, 'activation_tokens: es gibt bewusst KEINE Policy');

-- 13.9 activated_at ist nicht vom Client schreibbar — der Mechanismus, nicht nur
-- die Zusage. Ohne das könnte sich jedes Konto selbst aktivieren.
select is(has_column_privilege('authenticated', 'public.profiles', 'activated_at', 'update'),
  false, 'profiles.activated_at: authenticated darf sie NICHT schreiben');

-- 13.10 Gegenprobe. Ohne diese Hälfte prüfen 13.1–13.6 nur, dass die Fixture
-- kaputt ist.
update public.profiles set activated_at = now()
 where id = 'dddddddd-0000-0000-0000-00000000000d';

select cmp_ok(pg_temp.count_as('dddddddd-0000-0000-0000-00000000000d',
  'select count(*)::int from public.profiles_public'),
  '>', 0, 'Nach der Bestätigung sieht dasselbe Konto das Verzeichnis');
select is(pg_temp.count_as('dddddddd-0000-0000-0000-00000000000d',
  'select count(*)::int from public.profile_contacts'),
  1, 'Nach der Bestätigung sind die eigenen Kontaktdaten wieder lesbar');
select is(pg_temp.count_as('dddddddd-0000-0000-0000-00000000000d',
  'select count(*)::int from public.goals'),
  1, 'Nach der Bestätigung sind die eigenen Ziele wieder lesbar');
select is(pg_temp.count_as('66666666-6666-6666-6666-666666666666',
  'select count(*)::int from public.profiles_public where id = ''dddddddd-0000-0000-0000-00000000000d'''),
  1, 'Nach der Bestätigung erscheint das Profil für die anderen im Verzeichnis');
select is(pg_temp.count_as('dddddddd-0000-0000-0000-00000000000d',
  'select count(*)::int from public.my_activation_state() where activated = true'),
  1, 'my_activation_state meldet danach „aktiviert"');
-- Gegenprobe zu 13.7a/13.7b: die Sperren sind Gates, keine kaputten Funktionen.
select is(pg_temp.count_as('dddddddd-0000-0000-0000-00000000000d',
  'select count(*)::int from public.post_engagement_counts(
     array[''bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb''::uuid])'),
  1, 'Nach der Bestätigung kommen die Beitragszahlen wieder');
select is(pg_temp.try_as('dddddddd-0000-0000-0000-00000000000d',
  'select public.recompute_potential_score(''dddddddd-0000-0000-0000-00000000000d''::uuid)'),
  'OK', 'Nach der Bestätigung läuft recompute_potential_score wieder durch');

-- ── 14. Die Service-Rollen-Funktionen (Teil C) ───────────────────────────────
-- Sie bauen das Gate auf und umgehen es deshalb per Definition. Genau darum
-- muss belegt sein, dass KEINE Client-Rolle sie aufrufen kann.
select is(has_function_privilege('anon',
  'public.issue_activation_token(text, text, interval)', 'execute'),
  false, 'issue_activation_token: anon darf nicht');
select is(has_function_privilege('authenticated',
  'public.issue_activation_token(text, text, interval)', 'execute'),
  false, 'issue_activation_token: authenticated darf nicht — sonst gäbe sich '
         'jedes Konto selbst einen Link');
select is(has_function_privilege('service_role',
  'public.issue_activation_token(text, text, interval)', 'execute'),
  true, 'issue_activation_token: service_role darf (der Weg der Edge Function)');
select is(has_function_privilege('authenticated',
  'public.claim_activation_token(text)', 'execute'),
  false, 'claim_activation_token: authenticated darf nicht');
select is(has_function_privilege('authenticated',
  'public.mark_activated(uuid)', 'execute'),
  false, 'mark_activated: authenticated darf nicht — sonst aktiviert sich jedes '
         'Konto selbst und der ganze Change ist wirkungslos');
select is(has_function_privilege('service_role', 'public.mark_activated(uuid)', 'execute'),
  true, 'mark_activated: service_role darf');

-- Ausgabe. '9999…' ist unaktiviert (Abschnitt 13 hat nur 'dddd…' wieder aktiviert).
update public.profiles set activated_at = null
 where id = '99999999-9999-9999-9999-999999999999';

select is((select status from public.issue_activation_token('frisch@test.fbc', 'hash-eins')),
  'issued', 'issue: der erste Link wird ausgegeben');
select is((select count(*)::int from public.activation_tokens
            where profile_id = '99999999-9999-9999-9999-999999999999'
              and used_at is null and invalidated_at is null),
  1, 'issue: genau ein ausstehendes Token');

select is((select status from public.issue_activation_token('nicht-da@test.fbc', 'hash-x')),
  'unknown', 'issue: eine unbekannte Adresse bekommt „unknown" — und die '
             'Function wirft nicht, damit die Antwort keine Adressen verrät');
-- Bis AGE-505 stand hier `already_activated` — „ein bereits aktiviertes Konto
-- bekommt keinen Link". Das war die alte Wahrheit und ist ausdrücklich ersetzt
-- worden: es war zugleich der Grund, warum ein Mitglied mit vergessenem
-- Passwort keinen Rückweg hatte. Der Aufruf gibt jetzt aus, mit eigenem Status.
-- Der ANGEMELDETE Weg lehnt weiterhin ab; das prüft der request_own-Block.
select is((select status from public.issue_activation_token('impact@test.fbc', 'hash-y')),
  'issued_reset', 'issue: ein bereits aktiviertes Konto bekommt einen '
                  'Passwort-Reset-Link statt einer Absage (AGE-505)');

-- Ratengrenze. Das eben ausgegebene Token ist Sekunden alt.
select is((select status from public.issue_activation_token('frisch@test.fbc', 'hash-zwei')),
  'rate_limited', 'issue: der zweite Versand binnen 60 s wird abgelehnt');

-- Schutzfenster (Teil D). Auch NACH der 60-s-Sperre passiert nichts, solange
-- ein gültiger Link im Postfach liegt. Ohne das entwertet ein Fremder, der bloß
-- die Login-Adresse kennt, den Link des Mitglieds — bis zu fünfmal am Tag, und
-- danach ist die Tagesquote leer. Das war der Aussperrungs-Befund aus dem
-- Audit vom 2026-08-06.
update public.activation_tokens set created_at = now() - interval '5 minutes'
 where token_hash = 'hash-eins';
select is((select status from public.issue_activation_token('frisch@test.fbc', 'hash-zwei-b')),
  'pending', 'issue: ein noch gültiger Link wird nicht entwertet');
select is((select count(*)::int from public.activation_tokens
            where profile_id = '99999999-9999-9999-9999-999999999999'
              and used_at is null and invalidated_at is null),
  1, 'issue: das Schutzfenster legt auch kein zweites Token an');

-- Entwertung: nach Ablauf des Schutzfensters gilt der alte nicht mehr — aber
-- als `superseded`, nicht als `used`. Sonst läse das Mitglied „bereits
-- aktiviert".
update public.activation_tokens set created_at = now() - interval '25 hours'
 where token_hash = 'hash-eins';
select is((select status from public.issue_activation_token('frisch@test.fbc', 'hash-drei')),
  'issued', 'issue: nach dem Schutzfenster geht ein neuer Link raus');
select is((select status from public.claim_activation_token('hash-eins')),
  'superseded', 'claim: der ÜBERHOLTE Link meldet „superseded" — nicht „used", '
                'denn das Konto ist gerade NICHT aktiviert');

-- Einlösung.
select is((select status from public.claim_activation_token('hash-drei')),
  'claimed', 'claim: der gültige Link wird beansprucht');
select is((select status from public.claim_activation_token('hash-drei')),
  'used', 'claim: derselbe Link ein zweites Mal → „used" (einmalig verwendbar). '
          'Das ist zugleich der Nebenläufigkeits-Beleg: das Beanspruchen ist '
          'EINE Anweisung, ein zweiter Aufruf findet used_at gesetzt vor');
select is((select status from public.claim_activation_token('gibt-es-nicht')),
  'not_found', 'claim: ein unbekannter Hash meldet „not_found"');

-- Ablauf.
insert into public.activation_tokens (token_hash, profile_id, expires_at) values
  ('hash-alt', '99999999-9999-9999-9999-999999999999', now() - interval '1 hour');
select is((select status from public.claim_activation_token('hash-alt')),
  'expired', 'claim: ein abgelaufener Link meldet „expired"');

-- mark_activated ist idempotent und der letzte Schritt.
select is((select public.mark_activated('99999999-9999-9999-9999-999999999999') is not null),
  true, 'mark_activated setzt den Zeitpunkt');
select is(
  (select public.mark_activated('99999999-9999-9999-9999-999999999999')),
  (select activated_at from public.profiles where id = '99999999-9999-9999-9999-999999999999'),
  'mark_activated ist idempotent — ein zweiter Aufruf überschreibt nicht');

-- Befund 8.6 aus Review 5.4. Der abgeleitete Zweck (`activated_at is not null`
-- ⇒ Reset) trägt nur, solange `activated_at` GENAU EINEN Schreiber hat. Das ist
-- die unausgesprochene Bedingung des Entwurfs „Zweck ableiten statt speichern" —
-- und sie stand nur im Kopf von `20260807200000`, also dort, wo niemand
-- nachsieht, der eine Sperrfunktion baut. Hier wird sie zur Zusicherung: die
-- Warnung hängt an der Function selbst und ist mit `\df+` zu sehen.
select alike(obj_description('public.mark_activated(uuid)'::regprocedure, 'pg_proc'),
  '%Re-Aktivierer%',
  'mark_activated: der Kommentar warnt davor, activated_at zurückzusetzen — '
  'wer das täte, machte jedes ausstehende Reset-Token zum Re-Aktivierer');

-- ── 14a-bis. Die Sperre steht VOR dem ersten Zugriff auf die Token (AGE-507) ─
-- Beide ausgebenden RPCs sperren die Profilzeile, BEVOR sie irgendetwas prüfen.
-- Ohne das entscheiden zwei gleichzeitige Anforderungen beide auf einem
-- veralteten Snapshot, und die zweite entwertet den soeben ausgegebenen
-- gültigen Link (Befund 8.8).
--
-- Diese Zeile vergleicht POSITIONEN, nicht Vorkommen — und das ist der ganze
-- Grund für ihre Bauart. Gemessen (AGE-507, Task 4.4): eine Sperre, die
-- vorhanden, aber HINTER die Prüfungen verschoben ist, richtet mehr Schaden an
-- als eine fehlende — sie gibt in einer Reihenfolge sogar zwei Token aus. Eine
-- Kontrolle, die nur zählt, ob `for update of p` vorkommt, sähe davon nichts.
--
-- Die Textbereinigung entfernt BEIDE Kommentarformen und gesucht wird
-- `for update of p;` MIT Semikolon. Beides ist nachgemessen und nicht
-- vorsorglich: eine frühere Fassung entfernte nur `--`-Kommentare und suchte
-- ohne Semikolon. Sie war grün, während die Sperre nachweislich fehlte, bei
-- `/* … for update of p … */`, bei `raise debug 'for update of p'` und bei
-- `for update of p skip locked` — letzteres nimmt die Sperre, WARTET aber
-- nicht, und ist damit genau so kaputt wie gar keine.
--
-- WAS DIESE ZEILE NICHT BELEGT, und das ist gemessen, nicht eingeräumt: sie
-- liest Text. Eine Sperre, die syntaktisch dasteht, aber nie ausgeführt wird —
-- `if false then … for update of p; … end if;` — kommt hier durch. Die Zeile
-- beweist NICHT, dass die Sperre wirkt; sie hält nur fest, dass sie nicht
-- wortlos verschwindet, verrutscht oder in einen Kommentar wandert. Das
-- Verhalten belegt allein die Sonde `scripts/probe-wettlauf-token-ausgabe.ts`,
-- einmal, zum Zeitpunkt des Baus, mit rotem Vorher und grünem Nachher — und
-- die fängt den `if false`-Fall. Dass sie NICHT in der Pipeline läuft, ist eine
-- bewusste Entscheidung (Donald, 2026-08-08, zweimal bestätigt); die Abwägung
-- steht in REVIEWS.md.
select ok(
  strpos(rumpf, 'for update of p;') > 0
  and strpos(rumpf, 'for update of p;') < strpos(rumpf, 'activation_tokens'),
  'issue_activation_token: `for update of p;` steht VOR dem ersten Zugriff auf '
  'activation_tokens — die Prüfung entscheidet auf gesperrtem, nicht auf '
  'veraltetem Stand (AGE-507)')
from (select pg_temp.rumpf_ohne_kommentare(
        'public.issue_activation_token(text,text,interval)'::regprocedure) as rumpf) s;

select ok(
  strpos(rumpf, 'for update of p;') > 0
  and strpos(rumpf, 'for update of p;') < strpos(rumpf, 'activation_tokens'),
  'request_own_activation_token: `for update of p;` steht VOR dem ersten Zugriff '
  'auf activation_tokens — sonst löst der zweite gleichzeitige Aufruf eine rohe '
  'unique_violation aus, die diese Function nicht fängt (AGE-507)')
from (select pg_temp.rumpf_ohne_kommentare(
        'public.request_own_activation_token(text,interval)'::regprocedure) as rumpf) s;

-- ── 14b. Der eigene Link über die Sitzung (Teil D) ──────────────────────────
-- Diese Funktion DARF `authenticated` aufrufen — als einzige aus Teil C/D. Der
-- Grund steht in ihrer Signatur: sie nimmt keine Adresse entgegen, das Subjekt
-- ist `auth.uid()`. Ein Konto kann damit nur sich selbst einen Link auslösen,
-- und genau deshalb ist der Aussperrungs-Angriff auf diesem Weg unmöglich.
select is(has_function_privilege('anon',
  'public.request_own_activation_token(text, interval)', 'execute'),
  false, 'request_own_activation_token: anon darf nicht');
select is(has_function_privilege('authenticated',
  'public.request_own_activation_token(text, interval)', 'execute'),
  true, 'request_own_activation_token: authenticated darf — das Subjekt ist '
        'auth.uid(), fremd anfordern ist per Signatur ausgeschlossen');
select is((select status from public.request_own_activation_token('hash-ohne-sitzung')),
  'unknown', 'request_own: ohne Sitzung kein Link — auth.uid() ist NULL');

-- Wirkung unter einer echten Identität. '9999…' wurde oben aktiviert und
-- geleert, damit dieser Block unabhängig von der Reihenfolge steht.
update public.profiles set activated_at = null
 where id = '99999999-9999-9999-9999-999999999999';
delete from public.activation_tokens
 where profile_id = '99999999-9999-9999-9999-999999999999';
select is(pg_temp.count_as('99999999-9999-9999-9999-999999999999',
  'select count(*)::int from public.request_own_activation_token(''hash-selbst'') '
  'where status = ''issued'''),
  1, 'request_own: das eingeloggte Konto bekommt seinen Link');
select is((select count(*)::int from public.activation_tokens
            where token_hash = 'hash-selbst'
              and profile_id = '99999999-9999-9999-9999-999999999999'),
  1, 'request_own: das Token hängt am Aufrufer, nicht an einer mitgegebenen Adresse');

-- ── 14b-bis. Der Fehlversand entwertet sein eigenes Token (E1 / 11.6) ───────
-- Schlägt Resend fehl, hat send-activation längst 202 geantwortet und das Token
-- liegt GÜLTIG in der Tabelle. Jeder weitere anonyme Anlauf läuft danach 24 h
-- lang ins Schutzfenster: kein Versand, kein neues Token — und /aktivierung
-- meldet dabei dasselbe Grün wie im Erfolgsfall. Wer die Mail nie bekam, wartet
-- einen Tag auf nichts. Entwertet die Function ihr eigenes Token, ist der
-- nächste Anlauf sofort wieder frei.
select is(has_function_privilege('anon',
  'public.invalidate_activation_token(text)', 'execute'),
  false, 'invalidate_activation_token: anon darf nicht');
select is(has_function_privilege('authenticated',
  'public.invalidate_activation_token(text)', 'execute'),
  false, 'invalidate_activation_token: authenticated darf nicht — sonst ist das '
         'Entwerten selbst der Aussperrungs-Weg, den das Schutzfenster zumacht');
select is(has_function_privilege('service_role',
  'public.invalidate_activation_token(text)', 'execute'),
  true, 'invalidate_activation_token: service_role darf (der Weg von send-activation)');

-- 'hash-selbst' liegt offen und ist Sekunden alt. Ohne das Altern greift die
-- 60-s-Sperre VOR dem Schutzfenster, und der Test misst die falsche Grenze.
update public.activation_tokens set created_at = now() - interval '5 minutes'
 where token_hash = 'hash-selbst';
select is((select status from public.issue_activation_token('frisch@test.fbc', 'hash-vor')),
  'pending', 'E1-Ausgangslage: mit offenem Token geht NICHTS raus');

select is((select public.invalidate_activation_token('hash-selbst')),
  true, 'invalidate: das offene Token wird entwertet');
select is((select count(*)::int from public.activation_tokens
            where token_hash = 'hash-selbst'
              and invalidated_at is not null and used_at is null),
  1, 'invalidate: entwertet, aber NICHT als eingelöst markiert — sonst läse das '
     'Mitglied beim nächsten Anlauf „bereits aktiviert"');

select is((select status from public.issue_activation_token('frisch@test.fbc', 'hash-nach')),
  'issued', 'E1 geschlossen: nach dem Entwerten ist der nächste Anlauf frei, '
            'statt 24 h zu schweigen');

select is((select public.invalidate_activation_token('hash-selbst')),
  false, 'invalidate: ein bereits entwertetes Token meldet false — der Aufruf '
         'ist folgenlos wiederholbar');
select is((select public.invalidate_activation_token('gibt-es-nicht')),
  false, 'invalidate: ein unbekannter Hash meldet false und wirft nicht — die '
         'Function läuft im Fehlerpfad, sie darf ihn nicht verbreitern');
-- ── 14b-ter. Der Rückweg für ein AKTIVIERTES Konto (AGE-505) ────────────────
-- Bisher endete genau dieser Aufruf mit `already_activated`: kein Token, keine
-- Mail — und die Oberfläche meldete trotzdem Erfolg. Nach C10 ist „aktiviert"
-- der Normalfall, also war das der Normalfall ohne Rückweg.
--
-- Der Zweig gibt jetzt aus, mit eigenem Status. Entscheidend ist dabei nicht,
-- DASS er ausgibt, sondern dass er es erst NACH den drei Grenzen tut — sonst
-- wäre der Rückweg der Weg an ihnen vorbei. Genau das prüfen die Assertions
-- unten der Reihe nach.
update public.profiles set activated_at = now() - interval '1 day'
 where id = '99999999-9999-9999-9999-999999999999';
delete from public.activation_tokens
 where profile_id = '99999999-9999-9999-9999-999999999999';

-- Non-Goal aus AGE-505, hier festgenagelt statt nur behauptet: der ANGEMELDETE
-- Weg lehnt ein aktiviertes Konto weiterhin ab. Wer angemeldet ist, hat kein
-- vergessenes Passwort — er kommt ja rein. Der Rückweg ist der anonyme.
select is(pg_temp.count_as('99999999-9999-9999-9999-999999999999',
  'select count(*)::int from public.request_own_activation_token(''hash-angemeldet'') '
  'where status = ''already_activated'''),
  1, 'request_own: ein aktiviertes Konto bekommt weiterhin KEINEN Link — '
     'already_activated lebt dort weiter, nur nicht mehr im anonymen Weg');

select is((select status from public.issue_activation_token('frisch@test.fbc', 'hash-reset')),
  'issued_reset', 'reset: ein aktiviertes Konto bekommt ein Token — und der '
                  'Status sagt, dass es ein Passwort-Reset ist, kein Aktivieren. '
                  'Derselbe Aufruf lieferte vorher „already_activated"');
select is((select count(*)::int from public.activation_tokens
            where profile_id = '99999999-9999-9999-9999-999999999999'
              and used_at is null and invalidated_at is null),
  1, 'reset: genau ein ausstehendes Token');

-- Grenze 1: die 60-s-Sperre. Das eben ausgegebene Token ist Sekunden alt.
select is((select status from public.issue_activation_token('frisch@test.fbc', 'hash-r2')),
  'rate_limited', 'reset: die 60-s-Sperre gilt auch für den Rückweg');

-- Grenze 2: das Schutzfenster. Auch nach der Sperre passiert nichts, solange ein
-- gültiger Link im Postfach liegt — sonst entwertet ein Fremder mit blosser
-- Adresskenntnis den Reset-Link des Mitglieds.
update public.activation_tokens set created_at = now() - interval '5 minutes'
 where token_hash = 'hash-reset';
select is((select status from public.issue_activation_token('frisch@test.fbc', 'hash-r3')),
  'pending', 'reset: das Schutzfenster gilt auch für den Rückweg');
select is((select count(*)::int from public.activation_tokens
            where profile_id = '99999999-9999-9999-9999-999999999999'
              and used_at is null and invalidated_at is null),
  1, 'reset: das Schutzfenster legt auch hier kein zweites Token an');

-- Das Reset-Token fährt auf dem VORHANDENEN Einlöseweg. claim_activation_token
-- bleibt unverändert — es fragt nicht, ob das Profil aktiviert ist.
select is((select status from public.claim_activation_token('hash-reset')),
  'claimed', 'reset: das Token wird auf dem vorhandenen Einlöseweg beansprucht');

-- Und das Einlösen nimmt die Aktivierung nicht zurück. Stünde hier `now()`,
-- schriebe ein Passwort-Reset die Mitgliedschaftsgeschichte um.
select is((select public.mark_activated('99999999-9999-9999-9999-999999999999')
             < now() - interval '23 hours'),
  true, 'reset: der Aktivierungszeitpunkt bleibt der alte und wird nicht '
        'überschrieben');

-- Grenze 3: das Tageskontingent. Fünf Ausgaben im Fenster, alle älter als die
-- 60-s-Sperre und keine mehr offen — damit greifen weder Sperre noch
-- Schutzfenster, und was übrig bleibt, ist die Tagesgrenze.
insert into public.activation_tokens (token_hash, profile_id, expires_at, invalidated_at, created_at)
select 'hash-tag-' || g, '99999999-9999-9999-9999-999999999999',
       now() + interval '72 hours', now(), now() - interval '10 minutes'
  from generate_series(1, 4) g;
select is((select status from public.issue_activation_token('frisch@test.fbc', 'hash-zuviel')),
  'rate_limited_day', 'reset: das Tageskontingent gilt auch für den Rückweg — '
                      'Aktivierung und Reset teilen es sich');

-- ── Ein doppelter token_hash ist KEIN Wettlauf (AGE-505, Befund 8.1) ───────
-- `activation_tokens` trägt ZWEI Unique-Constraints: den partiellen Index
-- (höchstens ein offenes Token je Profil — der Wettlauf-Wächter) und den
-- PRIMÄRSCHLÜSSEL auf `token_hash`. Beide werfen SQLSTATE 23505.
--
-- Der erste Anlauf des Fixes fing 23505 pauschal ab und hätte damit eine
-- kaputte Token-Erzeugung als „angenommen" verbucht: kein Fehler, keine Mail,
-- und im Protokoll stünde „Wettlauf verloren". Der Review meldete das als
-- Blocker. Deshalb benennt die Function den Wächter über sein Prädikat.
--
-- Der Wettlauf selbst braucht zwei Sitzungen und ist hier nicht nachstellbar
-- (kein dblink, kein pg_background). Die UNTERSCHEIDUNG ist es — und genau an
-- ihr ist der erste Anlauf gescheitert. Die PK-Kollision wird deterministisch
-- erzwungen: `hash-y` liegt seit dem Reset-Block in der Tabelle; entwertet und
-- gealtert kommt der Aufruf an allen drei Grenzen vorbei und versucht denselben
-- Hash ein zweites Mal einzufügen.
update public.activation_tokens
   set invalidated_at = now(), created_at = now() - interval '25 hours'
 where token_hash = 'hash-y';
select throws_ok(
  $$ select status from public.issue_activation_token('impact@test.fbc', 'hash-y') $$,
  '23505',
  null,
  'issue: ein doppelter token_hash WIRFT — er ist kein Wettlauf, sondern eine '
  'kaputte Token-Erzeugung, und darf nicht in der Anti-Aufzählung verschwinden');

-- Die andere Hälfte desselben Vertrags. Der Test oben prüft nur, was NICHT
-- verschluckt wird; der Wächter-Fall selbst braucht zwei Sitzungen und ist hier
-- nicht erreichbar. Was erreichbar ist: der NAME. Der Exception-Handler nennt
-- den Index wörtlich, also ist der Name Teil des Funktionsvertrags — wer ihn
-- umbenennt, macht aus dem Wächter-Fall wieder einen 502 und damit das
-- Aufzählungs-Orakel wieder auf. Ein Tippfehler im Handler bliebe vom Test
-- oben unbemerkt; diese Zeile ist die Klammer dagegen.
select has_index('public', 'activation_tokens', 'activation_tokens_offen_je_profil',
  'issue_activation_token: der Wächter-Index heißt weiterhin so, wie der '
  'Exception-Handler in 20260808150000 ihn nennt');

select is(has_function_privilege('authenticated', 'public.revoke_sessions(uuid)', 'execute'),
  false, 'revoke_sessions: authenticated darf nicht');
select is(has_function_privilege('service_role', 'public.revoke_sessions(uuid)', 'execute'),
  true, 'revoke_sessions: service_role darf (der Weg von redeem-activation)');

-- ── 14c. Drossel auf dem Einlöseweg (Task 5.6 / 12.6) ───────────────────────
-- Entscheidung Donald 2026-08-06: gezählt werden AUSSCHLIESSLICH Fehlversuche,
-- und zwar je IP. Der Aufruf steht in redeem-activation NACH dem Beanspruchen —
-- ein gültiges Token wird also nie gedrosselt. Damit fällt der NAT-Einwand aus
-- 12.6 weg: das echte Mitglied trägt immer ein gültiges Token, egal wie viele
-- Fremde hinter derselben Adresse sitzen.
--
-- Dieselbe Eigenschaft trägt gegen einen gefälschten `x-forwarded-for`: wer
-- fremde Adressen einträgt, füllt einen Eimer, der niemanden aussperrt.

select is(has_table_privilege('anon', 'public.activation_attempts', 'select'),
  false, 'activation_attempts: anon hat kein SELECT');
select is(has_table_privilege('authenticated', 'public.activation_attempts', 'insert'),
  false, 'activation_attempts: authenticated hat kein INSERT — die IP-Liste ist '
         'kein Clientdatum');
select is(has_function_privilege('authenticated',
  'public.note_failed_activation(text, interval, integer)', 'execute'),
  false, 'note_failed_activation: authenticated darf nicht');
select is(has_function_privilege('service_role',
  'public.note_failed_activation(text, interval, integer)', 'execute'),
  true, 'note_failed_activation: service_role darf (der Weg von redeem-activation)');

-- Der erste Fehlversuch zählt und sperrt nicht.
select is((select throttled from public.note_failed_activation('203.0.113.7', '1 hour', 3)),
  false, 'note_failed_activation: der erste Fehlversuch sperrt nicht');

-- Über das Limit hinaus sperrt sie. Limit 3: zwei stille Aufrufe (Versuch 2 und
-- 3), die Assertion ist dann Versuch 4.
do $$ begin
  perform public.note_failed_activation('203.0.113.7', '1 hour', 3);
  perform public.note_failed_activation('203.0.113.7', '1 hour', 3);
end $$;
select is((select throttled from public.note_failed_activation('203.0.113.7', '1 hour', 3)),
  true, 'note_failed_activation: über dem Limit sperrt sie');

-- Der Kern von „pro IP": der Nachbar ist unberührt.
select is((select throttled from public.note_failed_activation('198.51.100.4', '1 hour', 3)),
  false, 'note_failed_activation: eine andere IP ist von der Sperre unberührt');

-- Und das Fenster wandert: was älter ist als das Fenster, zählt nicht mehr.
update public.activation_attempts set attempted_at = now() - interval '2 hours'
 where ip = '203.0.113.7';
select is((select attempts from public.note_failed_activation('203.0.113.7', '1 hour', 3)),
  1, 'note_failed_activation: außerhalb des Fensters zählt nichts mehr');

select * from finish();
rollback;
