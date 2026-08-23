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
select plan(420);

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
-- Die IDs stehen ausdrücklich da, weil die Admin-Assertions (Abschnitt 11/12)
-- sonst `count(*)` über die GANZE Tabelle bilden müssten. Eine einzige fremde
-- Zeile — der Demo-Seed legt lokal welche an — liess damit gemessen die Tests
-- „Admin liest fremdes Feedback" und „Admin bekommt … beide Feedback-Zeilen"
-- fallen, obwohl an den Policies nichts falsch war. Ein Test, der am Bestand
-- neben seinen Fixtures scheitert, misst den Bestand und nicht die Policy.
insert into public.feedback (id, profile_id, rating, likes, misses, idea, route) values
  ('f0000000-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111', 5, 'Der Compass', 'Nichts', 'Mehr Events', '/compass'),
  ('f0000000-0000-0000-0000-00000000000b', '66666666-6666-6666-6666-666666666666', 2, 'Das Design', 'Tempo',  'Schneller',    '/meine-chancen');

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
    'select count(*)::int from public.feedback
      where id in (''f0000000-0000-0000-0000-00000000000a'',
                   ''f0000000-0000-0000-0000-00000000000b'')'),
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
    'select count(*)::int from public.admin_list_feedback()
      where id in (''f0000000-0000-0000-0000-00000000000a'',
                   ''f0000000-0000-0000-0000-00000000000b'')'),
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

-- 13.3a Storage: die drei avatars_*-Policies auf storage.objects (20260806080100
-- §Storage) hatten bislang KEINE Assertion — der größte benannte Restbefund aus
-- dem AGE-495-Review. storage.objects hat KEINE SELECT-Policy (Kopf von
-- 20260613081627: das öffentliche Bucket liefert über die Objekt-URL aus, eine
-- SELECT-Policy würde nur das Auflisten erlauben). Für UPDATE/DELETE zieht
-- Postgres deren SELECT-Policy heran, sobald das WHERE eine Spalte referenziert
-- — gemessen: `where bucket_id = 'avatars'` liefert AUCH mit `using (true)` 0
-- Zeilen (`One-Time Filter: false`). Ein spaltenbezogenes WHERE prüfte hier
-- also nur diese vorbestehende Lücke, nie das Aktivierungs-Gate. Deshalb genau
-- EIN Objekt im Bucket zum Testzeitpunkt und blanke Anweisungen ohne WHERE.
insert into storage.objects (bucket_id, name, owner) values
  ('avatars', 'dddddddd-0000-0000-0000-00000000000d/bestehend.webp',
   'dddddddd-0000-0000-0000-00000000000d');

select alike(pg_temp.try_as('dddddddd-0000-0000-0000-00000000000d',
  'insert into storage.objects (bucket_id, name) values (''avatars'', ''dddddddd-0000-0000-0000-00000000000d/kaper.webp'')'),
  'DENIED:%row-level security policy%',
  'Storage-Gate: avatars_insert_own lehnt den Avatar-Upload eines nicht aktivierten Kontos ab');

select is(pg_temp.try_as('dddddddd-0000-0000-0000-00000000000d',
  'update storage.objects set metadata = ''{"probe":true}''::jsonb'),
  'OK', 'Storage-Gate: das UPDATE des eigenen Avatar-Objekts wirft nicht (RLS filtert still) …');
select is(
  (select metadata from storage.objects
    where name = 'dddddddd-0000-0000-0000-00000000000d/bestehend.webp'),
  null, '… ändert das Objekt aber nicht');

-- storage.protect_delete() (BEFORE-STATEMENT-Trigger, vorbestehend) blockt
-- JEDES direkte DELETE ohne diesen Guard — unabhängig von RLS. Ohne ihn testete
-- die folgende Assertion nur den Trigger, nie die avatars_delete_own-Policy.
select set_config('storage.allow_delete_query', 'true', true);
select is(pg_temp.try_as('dddddddd-0000-0000-0000-00000000000d',
  'delete from storage.objects'),
  'OK', 'Storage-Gate: das DELETE des eigenen Avatar-Objekts wirft nicht …');
select is(
  (select count(*)::int from storage.objects
    where name = 'dddddddd-0000-0000-0000-00000000000d/bestehend.webp'),
  1, '… löscht das Objekt aber nicht');

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
-- GEÄNDERT MIT AGE-581: aus zwei Feldern wurden drei. `blocked` sagt, ob dem
-- Konto der Zugang entzogen wurde — ohne das Feld zeigte die Oberfläche einem
-- gesperrten Konto den Aktivierungsbildschirm und lüde es ein, sich einen
-- Zugangslink schicken zu lassen, für einen Zugang, den es nicht mehr gibt.
--
-- Dass diese Zusicherung brechen MUSSTE, ist ihre Aufgabe: sie hält fest, dass
-- jedes weitere Feld eine Entscheidung ist und kein Versehen. Die Zusage selbst
-- bleibt unverändert scharf — es ist eine WÖRTLICHE Signaturprüfung, kein
-- „enthält mindestens".
--
-- `blocked` ist ein Wahrheitswert und kein Zustandswort. Ein Feld mit den
-- Werten `deaktiviert`/`geloescht` verriete dem Betroffenen, welche der beiden
-- Handlungen ein Admin vorgenommen hat.
select is(
  pg_get_function_result('public.my_activation_state()'::regprocedure),
  'TABLE(activated boolean, blocked boolean, display_name text)',
  'my_activation_state gibt genau DREI Felder zurück — jedes weitere wäre eines, '
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

-- Gegenprobe zu 13.3a: dieselben blanken Anweisungen, jetzt mit Wirkung.
select is(pg_temp.try_as('dddddddd-0000-0000-0000-00000000000d',
  'update storage.objects set metadata = ''{"probe":true}''::jsonb'),
  'OK', 'Storage-Gate: nach der Bestätigung wirft das UPDATE weiterhin nicht …');
select is(
  (select metadata from storage.objects
    where name = 'dddddddd-0000-0000-0000-00000000000d/bestehend.webp'),
  '{"probe":true}'::jsonb, '… und ändert das Objekt jetzt wirklich');

select is(pg_temp.try_as('dddddddd-0000-0000-0000-00000000000d',
  'delete from storage.objects'),
  'OK', 'Storage-Gate: nach der Bestätigung wirft das DELETE weiterhin nicht …');
select is(
  (select count(*)::int from storage.objects
    where name = 'dddddddd-0000-0000-0000-00000000000d/bestehend.webp'),
  0, '… und löscht das Objekt jetzt wirklich');

select is(pg_temp.try_as('dddddddd-0000-0000-0000-00000000000d',
  'insert into storage.objects (bucket_id, name) values (''avatars'', ''dddddddd-0000-0000-0000-00000000000d/aktiv.webp'')'),
  'OK', 'Storage-Gate: nach der Bestätigung geht der Avatar-Upload durch');
select is(
  (select count(*)::int from storage.objects
    where name = 'dddddddd-0000-0000-0000-00000000000d/aktiv.webp'),
  1, '… und die Zeile steht wirklich da');

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

-- ── 14e. Das Stundenkontingent der Token-Ausgabe (AGE-526) ──────────────────
-- Der automatische Versand nach der Selbstregistrierung macht aus jeder
-- Registrierung eine Mail. Ohne profilübergreifende Grenze ist die Plattform
-- damit ein Weiterleiter: ein Angreifer legt Konten mit fremden Adressen an und
-- jede erzeugt Post. Die Grenze greift NUR für frische Profile — sonst würde ein
-- verbranntes Kontingent echte Mitglieder aussperren, und der Missbrauch wäre
-- zur Aussperrung geworden.
--
-- Alle Token aus den vorigen Abschnitten fliegen raus: dieser Block misst
-- Zählstände, und eine geerbte Zeile verschiebt jede Schwelle um eins.
delete from public.activation_tokens;

insert into auth.users (id, aud, role, email) values
  ('a5260000-0000-0000-0000-00000000f001', 'authenticated', 'authenticated',
   'frisch-kontingent@test.fbc'),
  ('a5260000-0000-0000-0000-00000000f002', 'authenticated', 'authenticated',
   'alt-kontingent@test.fbc'),
  ('a5260000-0000-0000-0000-00000000f003', 'authenticated', 'authenticated',
   'grenze-kontingent@test.fbc'),
  ('a5260000-0000-0000-0000-00000000f004', 'authenticated', 'authenticated',
   'kante-kontingent@test.fbc'),
  ('a5260000-0000-0000-0000-00000000f005', 'authenticated', 'authenticated',
   'fueller-kontingent@test.fbc');

-- Ausgangslage: keins der fünf ist aktiviert, sonst antwortet die Function
-- `already_activated`, bevor sie irgendeine Grenze erreicht.
update public.profiles set activated_at = null
 where id::text like 'a5260000-%';
-- '…f002' ist das bestehende Mitglied, '…f003' liegt exakt auf der Kante.
update public.profiles set created_at = now() - interval '90 days'
 where id = 'a5260000-0000-0000-0000-00000000f002';
update public.profiles set created_at = now() - interval '10 minutes'
 where id = 'a5260000-0000-0000-0000-00000000f003';

-- Einhundert Ausgaben in der laufenden Stunde, alle auf einem fremden Profil:
-- die Grenze zählt über ALLE Profile, nicht die des Aufrufers. `invalidated_at`
-- ist gesetzt, weil höchstens ein OFFENES Token je Profil liegen darf — für die
-- Zählung ist das gleichgültig, jede dieser Zeilen stand für einen Versand.
insert into public.activation_tokens (token_hash, profile_id, expires_at, created_at, invalidated_at)
select 'fueller-' || g, 'a5260000-0000-0000-0000-00000000f005',
       now() + interval '72 hours', now() - interval '5 minutes', now()
  from generate_series(1, 100) g;

select is(pg_temp.count_as('a5260000-0000-0000-0000-00000000f001',
  'select count(*)::int from public.request_own_activation_token(''hash-kontingent-frisch'') '
  'where status = ''rate_limited_global'''),
  1, 'Kontingent: ein frisches Profil bekommt bei vollem Stundenkontingent '
     'keinen Link — sonst ist die offene Selbstregistrierung ein Mailverteiler');

select is((select count(*)::int from public.activation_tokens
            where profile_id = 'a5260000-0000-0000-0000-00000000f001'),
  0, 'Kontingent: die Abweisung schreibt KEIN Token — eine Zeile, die niemand '
     'versendet, verbrauchte sonst das Kontingent ein zweites Mal');

select is(pg_temp.count_as('a5260000-0000-0000-0000-00000000f002',
  'select count(*)::int from public.request_own_activation_token(''hash-kontingent-alt'') '
  'where status = ''issued'''),
  1, 'Kontingent: ein bestehendes Mitglied kommt auch bei vollem Kontingent '
     'durch — die Grenze darf aus Missbrauch keine Aussperrung machen');

select is(pg_temp.count_as('a5260000-0000-0000-0000-00000000f003',
  'select count(*)::int from public.request_own_activation_token(''hash-kontingent-grenze'') '
  'where status = ''issued'''),
  1, 'Kontingent, Randwert: exakt zehn Minuten alt ist NICHT mehr frisch — die '
     'Grenze ist `> now() - 10 minutes`, nicht `>=`');

-- Dasselbe Konto wie in der ersten Assertion, nur zehn Minuten später. Die
-- Sperre muss sich von selbst lösen, sonst ist der Zugang nicht verzögert,
-- sondern verschlossen.
update public.profiles set created_at = now() - interval '11 minutes'
 where id = 'a5260000-0000-0000-0000-00000000f001';
select is(pg_temp.count_as('a5260000-0000-0000-0000-00000000f001',
  'select count(*)::int from public.request_own_activation_token(''hash-kontingent-spaeter'') '
  'where status = ''issued'''),
  1, 'Kontingent: das abgewiesene frische Konto kommt nach zehn Minuten durch, '
     'auch wenn das Kontingent noch voll ist — die Sperre löst sich selbst');

-- Randwert der Stunde: neunundneunzig innerhalb des Fensters, eines exakt auf
-- der Kante. `now()` steht in der Transaktion still, die Gleichheit ist also
-- echt prüfbar. Zählte die Kante mit, wäre die Grenze um eins zu scharf.
delete from public.activation_tokens;
insert into public.activation_tokens (token_hash, profile_id, expires_at, created_at, invalidated_at)
select 'kante-' || g, 'a5260000-0000-0000-0000-00000000f005',
       now() + interval '72 hours', now() - interval '5 minutes', now()
  from generate_series(1, 99) g;
insert into public.activation_tokens (token_hash, profile_id, expires_at, created_at, invalidated_at)
values ('kante-exakt', 'a5260000-0000-0000-0000-00000000f005',
        now() + interval '72 hours', now() - interval '1 hour', now());
select is(pg_temp.count_as('a5260000-0000-0000-0000-00000000f004',
  'select count(*)::int from public.request_own_activation_token(''hash-kontingent-kante'') '
  'where status = ''issued'''),
  1, 'Kontingent, Randwert: was exakt eine Stunde alt ist, zählt nicht mehr '
     'mit — das Fenster ist `> now() - 1 hour`');

-- Die Grenze ist profilübergreifend, die Sperre auf der eigenen Profilzeile
-- trägt sie deshalb NICHT: zwei gleichzeitige frische Anforderungen sperren
-- verschiedene Zeilen und lesen denselben Zählstand. Nur ein Riegel, den beide
-- nehmen müssen, hält die Zusage. Der Laufzeitbeleg dafür steht in
-- scripts/probe-kontingent-wettlauf.ts — zwei Sitzungen bekommt pgTAP nicht.
select ok(
  strpos(rumpf, 'pg_advisory_xact_lock') > 0
  and strpos(rumpf, 'pg_advisory_xact_lock') < strpos(rumpf, 'interval ''1 hour'''),
  'request_own_activation_token: der Riegel steht VOR der Zählung des '
  'Stundenkontingents — ein count(*) ohne ihn ist genau im Registrierungsschwall '
  'falsch, für den die Grenze existiert (AGE-526)')
from (select pg_temp.rumpf_ohne_kommentare(
        'public.request_own_activation_token(text,interval)'::regprocedure) as rumpf) s;

-- ── 15. Hintergrundbild: Spalte, Grant, Projektion (AGE-498, C6-A) ──────────
-- Vier Zusagen: das Mitglied darf `cover_url` schreiben, der Wert erreicht die
-- FREMDE Ansicht über `profiles_public` (nicht über die Basistabelle — die ist
-- für `connect` und darunter zu), die Neudeklaration der Sicht hat ihr
-- Aktivierungs-Gate behalten, und die Vollständigkeit bleibt unberührt.

select is(
  pg_temp.try_as('66666666-6666-6666-6666-666666666666',
    'update public.profiles set cover_url = ''https://x/cover.webp''
      where id = ''66666666-6666-6666-6666-666666666666'''),
  'OK', 'Ein Mitglied schreibt sein eigenes cover_url');

select is(
  pg_temp.count_as('33333333-3333-3333-3333-333333333333',
    'select count(*)::int from public.profiles_public
      where id = ''66666666-6666-6666-6666-666666666666''
        and cover_url = ''https://x/cover.webp'''),
  1, 'cover_url erreicht die fremde Ansicht über profiles_public');

-- Gegenprobe zur Neudeklaration: das Gate der Sicht muss sie überlebt haben.
-- Ein Anhängen, das die beiden is_activated-Bedingungen beim Abschreiben
-- verliert, öffnete das Verzeichnis lautlos — und nur dieser Fall merkt es.
--
-- MIT EIGENER SONDE, nicht mit '…000d': dessen Aktivierung wird in 13.10
-- absichtlich nachgeholt (Zeile 824), 1300 Zeilen weiter oben. Ein Test, der
-- sich hier darauf verlässt, prüft den Zustand eines fremden Abschnitts.
-- `created_at` 90 Tage zurück, sonst fiele die Sonde in den Nachlauf aus
-- 20260807090000 und gälte als bestätigt.
insert into auth.users (id, aud, role, email) values
  ('c6c6c6c6-0000-0000-0000-00000000c6c6', 'authenticated', 'authenticated', 'coversonde@test.fbc');
update public.profiles
   set tier = 'impact', activated_at = null, created_at = now() - interval '90 days'
 where id = 'c6c6c6c6-0000-0000-0000-00000000c6c6';

select is(
  pg_temp.count_as('c6c6c6c6-0000-0000-0000-00000000c6c6',
    'select count(*)::int from public.profiles_public'),
  0, 'Nach dem Anhängen von cover_url gilt das Gate der Sicht unverändert');

select is(
  (select profile_completion from public.profiles
    where id = '66666666-6666-6666-6666-666666666666'),
  (select profile_completion from public.profiles
    where id = '44444444-4444-4444-4444-444444444444'),
  'cover_url geht nicht in die Vollständigkeit ein (beide Profile leer gepflegt)');

-- ── 16. Altmitgliedschaft: eigene Tabelle, für den Client unsichtbar ────────
-- (AGE-498, C6-B. Befund aus dem Fremd-Review, REVIEWS.md/codex.)
--
-- WARUM DAS NICHT VIER SPALTEN AUF `profiles` SIND: `authenticated` hält
-- Tabellen-SELECT auf profiles, und profiles_select_self_or_discover gibt
-- jedem bestätigten `discover` die VOLLE Zeile jedes anderen (siehe §2 oben,
-- Assertion „Discover liest die fremde Vollzeile"). Ein Spalten-Grant regelt
-- nur das Schreiben — `legacy_price` stünde offen. Postgres kennt kein
-- spaltenweises Leseverbot bei erteiltem Tabellen-SELECT.
--
-- Die erste Assertion unten ist deshalb der eigentliche Beleg: dieselbe
-- Identität, die in §2 die fremde Vollzeile SIEHT, kommt hier nicht durch.

insert into public.profile_legacy (profile_id, paid_until, legacy_tier, legacy_price, legacy_source_id)
values ('66666666-6666-6666-6666-666666666666', date '2027-03-31', 'Premium', 1200.00, 'wp-4711');

select is(has_table_privilege('authenticated', 'public.profile_legacy', 'SELECT'),
  false, 'profile_legacy: authenticated hält kein SELECT');

select is(has_table_privilege('authenticated', 'public.profile_legacy', 'INSERT'),
  false, 'profile_legacy: authenticated hält kein INSERT');

select alike(
  pg_temp.try_as('33333333-3333-3333-3333-333333333333',
    'select paid_until from public.profile_legacy
      where profile_id = ''66666666-6666-6666-6666-666666666666'''),
  'DENIED:%permission denied%',
  'Discover sieht die fremden Altdaten NICHT — obwohl es die Vollzeile sieht');

select alike(
  pg_temp.try_as('66666666-6666-6666-6666-666666666666',
    'select paid_until from public.profile_legacy
      where profile_id = ''66666666-6666-6666-6666-666666666666'''),
  'DENIED:%permission denied%',
  'Auch die EIGENEN Altdaten führen nicht über den Client — nur über die Admin-RPCs');

-- Wiederholbarkeit des Imports: dieselbe Quell-Kennung ein zweites Mal.
select throws_ok(
  $$insert into public.profile_legacy (profile_id, legacy_source_id)
    values ('44444444-4444-4444-4444-444444444444', 'wp-4711')$$,
  23505,
  null,
  'Eine zweite Zeile mit derselben legacy_source_id prallt am Unique-Index ab');

-- …und die Kehrseite: „keine Kennung" darf beliebig oft vorkommen. Ohne das
-- btrim() im Index kollidierten '' und '   ' nicht miteinander, aber jeweils
-- mit sich selbst — und der Import bliebe an leeren Feldern hängen.
select lives_ok(
  $$insert into public.profile_legacy (profile_id, legacy_source_id) values
      ('11111111-1111-1111-1111-111111111111', null),
      ('22222222-2222-2222-2222-222222222222', ''),
      ('33333333-3333-3333-3333-333333333333', '   ')$$,
  'Leere Kennungen (null, '''', Leerzeichen) koexistieren');

-- ── 17. Bucket `covers`: dieselbe Falltabelle wie `avatars` (AGE-498, C6-C) ─
-- Die Warnung aus 13.3a gilt hier unverändert: storage.objects hat keine
-- SELECT-Policy, deshalb blanke INSERTs und die Gegenprobe als Testrolle,
-- nicht über ein WHERE unter der Mitglieds-Identität.
--
-- Eigene Sonden statt geliehener Fixtures — die Aktivierungszustände der
-- oberen Abschnitte werden dort mehrfach umgeschaltet (Zeilen 728, 824, 900,
-- 1051, 1291), und ein Test, der sich darauf verlässt, prüft fremden Zustand.

insert into auth.users (id, aud, role, email) values
  ('c6c6c6c6-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', 'coverja@test.fbc'),
  ('c6c6c6c6-0000-0000-0000-0000000000a2', 'authenticated', 'authenticated', 'covernein@test.fbc');
update public.profiles set tier = 'impact', activated_at = now()
 where id = 'c6c6c6c6-0000-0000-0000-0000000000a1';
update public.profiles
   set tier = 'impact', activated_at = null, created_at = now() - interval '90 days'
 where id = 'c6c6c6c6-0000-0000-0000-0000000000a2';

select is(pg_temp.try_as('c6c6c6c6-0000-0000-0000-0000000000a1',
  'insert into storage.objects (bucket_id, name) values
     (''covers'', ''c6c6c6c6-0000-0000-0000-0000000000a1/eigen.webp'')'),
  'OK', 'covers_insert_own: das bestätigte Mitglied schreibt in seinen eigenen Ordner');

select is(
  (select count(*)::int from storage.objects
    where name = 'c6c6c6c6-0000-0000-0000-0000000000a1/eigen.webp'),
  1, '… und das Objekt liegt danach wirklich da');

select alike(pg_temp.try_as('c6c6c6c6-0000-0000-0000-0000000000a1',
  'insert into storage.objects (bucket_id, name) values
     (''covers'', ''66666666-6666-6666-6666-666666666666/fremd.webp'')'),
  'DENIED:%row-level security policy%',
  'covers_insert_own: der Ordner eines FREMDEN Mitglieds bleibt zu');

select alike(pg_temp.try_as('c6c6c6c6-0000-0000-0000-0000000000a2',
  'insert into storage.objects (bucket_id, name) values
     (''covers'', ''c6c6c6c6-0000-0000-0000-0000000000a2/eigen.webp'')'),
  'DENIED:%row-level security policy%',
  'covers_insert_own: ein nicht bestätigtes Konto lädt kein Hintergrundbild hoch');

-- Die serverseitige Regel, die der Grund für den eigenen Bucket war. pgTAP
-- sieht die Durchsetzung nicht (die macht die Storage-API), aber es hält fest,
-- dass sie überhaupt AUSGESPROCHEN ist — ein `do nothing` beim Anlegen über
-- einem falsch eingestellten Bestands-Bucket fiele hier auf.
select is(
  (select (public, file_size_limit, allowed_mime_types)::text
     from storage.buckets where id = 'covers'),
  '(t,2097152,{image/webp})',
  'covers: öffentlich, 2 MiB, nur WebP — serverseitig, nicht nur im Formular');

-- Die Drift-Sicherung aus dem Spec: dieselbe Regel steht jetzt an SECHS
-- Stellen. Wer sie an einem Bucket ändert, wird hier rot — auch wenn er den
-- anderen gar nicht angefasst hat.
select is(
  (select count(*)::int from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname like 'covers\_%'
      and coalesce(qual, '') || coalesce(with_check, '') like '%is_activated%'),
  3, 'covers trägt drei Schreib-Policies, alle mit dem Aktivierungs-Gate');

select is(
  (select count(*)::int from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname like 'avatars\_%'
      and coalesce(qual, '') || coalesce(with_check, '') like '%is_activated%'),
  3, '… und avatars unverändert ebenso — die Falltabelle gilt für beide');

-- ── 18. Admin-Bearbeitung: die vier Funktionen (AGE-498, C6-D) ─────────────
-- Der Anlassfall ist ein IMPORTIERTES, NICHT BESTÄTIGTES Profil: genau dieses
-- ist unter der RLS für niemanden sichtbar (profiles_select_self_or_discover
-- verlangt activated_at am ZIELPROFIL, Zeile 79 dieser Migration; die Sicht
-- ebenso). Ein Schreibweg ohne Lesepfad griffe deshalb nur an den Profilen,
-- die ihn nicht brauchen — Befund aus dem Fremd-Review (REVIEWS.md, codex).
-- Das Ziel unten ist absichtlich unbestätigt.

create function pg_temp.text_as(uid uuid, q text) returns text language plpgsql as $$
declare t text;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  execute q into t;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return t;
end $$;

insert into auth.users (id, aud, role, email) values
  ('c6c6c6c6-0000-0000-0000-0000000000b1', 'authenticated', 'authenticated', 'importiert@test.fbc');
update public.profiles
   set name = 'Importiert', company = 'Alt GmbH', activated_at = null,
       created_at = now() - interval '90 days'
 where id = 'c6c6c6c6-0000-0000-0000-0000000000b1';
-- Der Admin aus den Fixtures (staff_roles, Zeile 136) — bestätigt, damit er
-- sich nicht am eigenen Gate stößt.
update public.profiles set activated_at = now()
 where id = 'aaaaaaaa-0000-0000-0000-000000000001';

-- 18.1 Der Schreibweg am Gate vorbei, mit allen drei Zielzeilen in einem Aufruf.
select is(pg_temp.try_as('aaaaaaaa-0000-0000-0000-000000000001',
  $q$select public.admin_update_profile(
      'c6c6c6c6-0000-0000-0000-0000000000b1',
      '{"name":"Korrigiert","roles":["Vorstand","Beirat"],
        "email":"neu@test.fbc","paid_until":"2027-06-30","legacy_price":1200.00}'::jsonb)$q$),
  'OK', 'Admin ändert ein UNBESTÄTIGTES fremdes Profil');

select is((select name from public.profiles where id = 'c6c6c6c6-0000-0000-0000-0000000000b1'),
  'Korrigiert', '… die Profilzeile ist wirklich geschrieben');

select is((select roles::text from public.profiles where id = 'c6c6c6c6-0000-0000-0000-0000000000b1'),
  '{Vorstand,Beirat}', '… ein Array-Feld ist feldweise dekodiert, nicht als Text abgelegt');

select is((select email from public.profile_contacts where profile_id = 'c6c6c6c6-0000-0000-0000-0000000000b1'),
  'neu@test.fbc', '… die KONTAKTzeile ist mitgeschrieben (sonst liefen die Mails weiter ins alte Postfach)');

select is((select paid_until from public.profile_legacy where profile_id = 'c6c6c6c6-0000-0000-0000-0000000000b1'),
  date '2027-06-30', '… und die Altdatenzeile ebenso');

select is((select count(*)::int from public.admin_audit
            where target = 'c6c6c6c6-0000-0000-0000-0000000000b1'),
  1, '… und die Änderung hat eine Spur hinterlassen');

-- 18.2 Die Abwehr. Der Button im Frontend ist Komfort — DAS hier ist die Grenze.
select alike(pg_temp.try_as('c6c6c6c6-0000-0000-0000-0000000000a1',
  $q$select public.admin_update_profile('c6c6c6c6-0000-0000-0000-0000000000b1',
      '{"name":"Gekapert"}'::jsonb)$q$),
  'DENIED:%',
  'Ein normales Mitglied prallt an der RPC ab — am Formular vorbei aufgerufen');

select is((select name from public.profiles where id = 'c6c6c6c6-0000-0000-0000-0000000000b1'),
  'Korrigiert', '… und hat nichts verändert');

-- 18.3 Ein Feld außerhalb der Weißliste. `tier` ist der Nebeneingang, den dieser
-- Change gerade vermeiden will — Stufenwechsel gehen über Abrechnung und Import.
select alike(pg_temp.try_as('aaaaaaaa-0000-0000-0000-000000000001',
  $q$select public.admin_update_profile('c6c6c6c6-0000-0000-0000-0000000000b1',
      '{"company":"Neu GmbH","tier":"impact"}'::jsonb)$q$),
  'DENIED:%',
  'Ein unbekanntes Feld bricht ab');

select is((select company from public.profiles where id = 'c6c6c6c6-0000-0000-0000-0000000000b1'),
  'Alt GmbH', '… und das GÜLTIGE Feld desselben Aufrufs bleibt ebenfalls ungeschrieben');

-- 18.4 Ein ungültiger Wert. Ein nicht lesbares Datum ist ein Fehler, kein NULL.
select alike(pg_temp.try_as('aaaaaaaa-0000-0000-0000-000000000001',
  $q$select public.admin_update_profile('c6c6c6c6-0000-0000-0000-0000000000b1',
      '{"paid_until":"morgen"}'::jsonb)$q$),
  'DENIED:%', 'Ein nicht interpretierbares Datum bricht ab');

select is((select paid_until from public.profile_legacy where profile_id = 'c6c6c6c6-0000-0000-0000-0000000000b1'),
  date '2027-06-30', '… und lässt den vorherigen Wert stehen');

select alike(pg_temp.try_as('aaaaaaaa-0000-0000-0000-000000000001',
  $q$select public.admin_update_profile('c6c6c6c6-0000-0000-0000-0000000000b1', '[]'::jsonb)$q$),
  'DENIED:%', 'Ein patch, der kein JSON-Objekt ist, bricht ab');

-- 18.5 Fehlend und leer sind zweierlei — der Unterschied, den coalesce nicht kann.
select is(pg_temp.try_as('aaaaaaaa-0000-0000-0000-000000000001',
  $q$select public.admin_update_profile('c6c6c6c6-0000-0000-0000-0000000000b1',
      '{"short_bio":null}'::jsonb)$q$),
  'OK', 'JSON-null wird angenommen …');

select is((select short_bio from public.profiles where id = 'c6c6c6c6-0000-0000-0000-0000000000b1'),
  null, '… und leert das Feld');

select is((select name from public.profiles where id = 'c6c6c6c6-0000-0000-0000-0000000000b1'),
  'Korrigiert', '… während ein NICHT geschickter Schlüssel unverändert bleibt');

-- 18.5b Aus dem Review auf dem DIFF (codex): drei Zusagen, die die Funktion
-- noch nicht hielt.
--
-- Erstens gilt „JSON-null leert" auch für die Array-Felder.
-- `jsonb_array_elements_text('null'::jsonb)` wirft — die Zusage aus 18.5 war
-- also nur für Textfelder wahr.
select is(pg_temp.try_as('aaaaaaaa-0000-0000-0000-000000000001',
  $q$select public.admin_update_profile('c6c6c6c6-0000-0000-0000-0000000000b1',
      '{"roles":null}'::jsonb)$q$),
  'OK', 'JSON-null leert auch ein Array-Feld …');
select is((select roles from public.profiles where id = 'c6c6c6c6-0000-0000-0000-0000000000b1'),
  null, '… und setzt es wirklich auf NULL');

-- Zweitens: `profiles.goals` und `profiles.interests` heißen wie die
-- KIND-TABELLEN goals/profile_interests, tragen aber etwas anderes. Der Editor
-- schickt sie nie; sie trotzdem anzunehmen hieße, ein Feld offenzuhalten, das
-- beim ersten Fehlgriff die Formularform der Kind-Tabelle in die Profilspalte
-- schriebe.
select alike(pg_temp.try_as('aaaaaaaa-0000-0000-0000-000000000001',
  $q$select public.admin_update_profile('c6c6c6c6-0000-0000-0000-0000000000b1',
      '{"goals":"irgendwas"}'::jsonb)$q$),
  'DENIED:%', 'profiles.goals ist kein Admin-Feld — der Name kollidiert mit der Kind-Tabelle');
select alike(pg_temp.try_as('aaaaaaaa-0000-0000-0000-000000000001',
  $q$select public.admin_update_profile('c6c6c6c6-0000-0000-0000-0000000000b1',
      '{"interests":["x"]}'::jsonb)$q$),
  'DENIED:%', 'profiles.interests ebenso');

-- 18.6 Der Lesepfad — ohne ihn wäre der Schreibweg unerreichbar.
select is(
  pg_temp.text_as('aaaaaaaa-0000-0000-0000-000000000001',
    $q$select public.admin_get_profile('c6c6c6c6-0000-0000-0000-0000000000b1') -> 'profile' ->> 'name'$q$),
  'Korrigiert', 'admin_get_profile liest das unbestätigte Profil');

select is(
  pg_temp.text_as('aaaaaaaa-0000-0000-0000-000000000001',
    $q$select public.admin_get_profile('c6c6c6c6-0000-0000-0000-0000000000b1') ->> 'login_email'$q$),
  'importiert@test.fbc',
  '… und liefert die LOGIN-Adresse mit, damit der Editor sie neben der Kontaktadresse zeigen kann');

select alike(pg_temp.try_as('c6c6c6c6-0000-0000-0000-0000000000a1',
  $q$select public.admin_get_profile('c6c6c6c6-0000-0000-0000-0000000000b1')$q$),
  'DENIED:%', 'Ein normales Mitglied liest darüber nichts');

select is(
  pg_temp.count_as('aaaaaaaa-0000-0000-0000-000000000001',
    $q$select jsonb_array_length(public.admin_find_profile('importiert@test.fbc'))$q$),
  1, 'admin_find_profile findet es über die Login-Adresse — es gibt keine Mitgliederliste');

-- Und genau das muss auch dann gelten, wenn jemand die Suche als Blankoschein
-- benutzt: `%` ist in ILIKE ein Platzhalter, `'%%%'` käme durch die
-- Drei-Zeichen-Schwelle und lieferte JEDES Mitglied — eine Liste durch die
-- Hintertür. Aus dem Review auf dem Diff (codex).
select is(
  pg_temp.count_as('aaaaaaaa-0000-0000-0000-000000000001',
    $q$select jsonb_array_length(public.admin_find_profile('%%%'))$q$),
  0, 'Platzhalter im Suchbegriff öffnen die Suche nicht zur Mitgliederliste');

-- 18.7 Rechte und Unversehrtheit der Spur.
select is(has_function_privilege('anon', 'public.admin_update_profile(uuid,jsonb)', 'execute'),
  false, 'admin_update_profile: anon darf nicht');
select is(has_function_privilege('anon', 'public.admin_get_profile(uuid)', 'execute'),
  false, 'admin_get_profile: anon darf nicht');
select is(has_function_privilege('anon', 'public.admin_find_profile(text)', 'execute'),
  false, 'admin_find_profile: anon darf nicht');

select alike(pg_temp.try_as('aaaaaaaa-0000-0000-0000-000000000001',
  $q$insert into public.admin_audit (actor, action, target)
     values ('aaaaaaaa-0000-0000-0000-000000000001', 'erfunden',
             'c6c6c6c6-0000-0000-0000-0000000000b1')$q$),
  'DENIED:%',
  'Niemand schreibt sich einen Audit-Eintrag selbst — auch ein Admin nicht');

-- 18.8 Der Weg der Edge Function. GEFUNDEN BEI DER SICHTPROBE, nicht hier:
-- admin-change-email las zuerst `staff_roles` direkt mit service_role und lief
-- in „permission denied for table staff_roles". Der Grund ist kein Versehen,
-- sondern der Lockdown aus AGE-312: service_role hält auf KEINER Tabelle in
-- `public` ein SELECT/INSERT — alles, was es tut, geht durch SECURITY-DEFINER-
-- Funktionen (issue_activation_token, mark_activated, revoke_sessions …).
--
-- Die erste Assertion hält genau diese Voraussetzung fest. Fiele sie eines Tages
-- weg, wäre die zweite Hälfte des Musters (die beiden Funktionen unten) nur noch
-- Umweg — und das soll auffallen, statt sich anzuschleichen.
select is(has_table_privilege('service_role', 'public.staff_roles', 'SELECT'),
  false, 'service_role liest staff_roles NICHT direkt (AGE-312-Lockdown)');

select is((select public.is_admin_uid('aaaaaaaa-0000-0000-0000-000000000001')),
  true, 'is_admin_uid erkennt den Admin …');
select is((select public.is_admin_uid('c6c6c6c6-0000-0000-0000-0000000000a1')),
  false, '… und ein normales Mitglied nicht');
select is((select public.is_admin_uid('bbbbbbbb-0000-0000-0000-000000000002')),
  false, '… auch keinen Matching-Manager (QM ist nicht die Deal-Queue)');

select is(has_function_privilege('authenticated', 'public.is_admin_uid(uuid)', 'execute'),
  false, 'is_admin_uid: nur service_role — sonst wäre es ein Auskunftsweg über fremde Rollen');
select is(has_function_privilege('service_role', 'public.is_admin_uid(uuid)', 'execute'),
  true, 'is_admin_uid: service_role darf');
select is(has_function_privilege('authenticated', 'public.log_admin_action(uuid,text,uuid,jsonb)', 'execute'),
  false, 'log_admin_action: authenticated darf nicht — sonst wäre die Spur fälschbar');

-- ── 19. Beitragsbilder: `post_media`, Bucket `post-media` (AGE-528, C7) ─────
-- Die Zusage aus dem Spec-Delta: „Ein Bild ist genau so sichtbar wie sein
-- Beitrag." Sie wird an DREI Flächen gemessen, weil sie an dreien brechen kann:
-- an der Funktion (das Prädikat), an der Storage-Policy (die Wirkung auf
-- storage.objects) und an der Tabelle (wer die Pfade überhaupt erfährt).
--
-- WIE „SIGNIEREN" HIER GEMESSEN WIRD. Das Ausstellen einer signierten URL ist
-- ein HTTP-Weg und kein SQL — was die Storage-API dabei tut, ist ein SELECT auf
-- storage.objects unter der Rolle des Aufrufers. Genau das steht unten. Der
-- Ende-zu-Ende-Beleg (echte Signatur, echter Abruf, HTTP-Status) ist die Sonde
-- scripts/probe-post-media-signatur.ts; sie hat den Mechanismus vor dieser
-- Migration gemessen (EVIDENCE.md).
--
-- DIE FALLE AUS 13.3a, hier in ihrer schärferen Form: bei einem SELECT gibt es
-- keinen Fehler, den man vorzeigen könnte — verboten heißt „keine Zeile". Eine
-- 0 allein belegt deshalb nichts; sie steht genauso für „das Objekt existiert
-- nicht". Jeder verweigerte Fall unten ist darum GEPAART: dieselbe Abfrage,
-- dieselbe Identität, ein erlaubtes Objekt daneben, das 1 liefert. Erst das
-- Paar trennt „die Policy verbietet es" von „die Abfrage trifft ins Leere".
-- Zusätzlich wird das Prädikat direkt gefragt (post_media_lesbar → false), und
-- ein `false` ist eindeutig, wo eine 0 es nicht ist.

create function pg_temp.bool_as(uid uuid, q text) returns boolean language plpgsql as $$
declare b boolean;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  execute q into b;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return b;
end $$;

create function pg_temp.bool_as_anon(q text) returns boolean language plpgsql as $$
declare b boolean;
begin
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';
  execute q into b;
  reset role;
  return b;
end $$;

create function pg_temp.try_as_anon(q text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';
  begin
    execute q;
  exception when others then
    reset role;
    return 'DENIED:' || SQLERRM;
  end;
  reset role;
  return 'OK';
end $$;

-- Eigene Sonden statt geliehener Fixtures — dieselbe Begründung wie in §17.
insert into auth.users (id, aud, role, email) values
  ('c7c7c7c7-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', 'c7autor@test.fbc'),
  ('c7c7c7c7-0000-0000-0000-0000000000a2', 'authenticated', 'authenticated', 'c7basic@test.fbc'),
  ('c7c7c7c7-0000-0000-0000-0000000000a3', 'authenticated', 'authenticated', 'c7unbestaetigt@test.fbc');
update public.profiles set tier = 'impact', activated_at = now(),
       created_at = now() - interval '90 days'
 where id = 'c7c7c7c7-0000-0000-0000-0000000000a1';
-- Rang 1: unter der Schwelle 4, an der `members` aufgeht. Der Fall, den die
-- Autoren-Klausel sonst überdeckt.
update public.profiles set tier = 'basic', activated_at = now(),
       created_at = now() - interval '90 days'
 where id = 'c7c7c7c7-0000-0000-0000-0000000000a2';
update public.profiles set tier = 'impact', activated_at = null,
       created_at = now() - interval '90 days'
 where id = 'c7c7c7c7-0000-0000-0000-0000000000a3';

insert into public.posts (id, author_id, body, visibility) values
  ('c7000001-0000-4000-8000-000000000001', 'c7c7c7c7-0000-0000-0000-0000000000a1',
   'C7 öffentlich', 'public'),
  ('c7000002-0000-4000-8000-000000000002', 'c7c7c7c7-0000-0000-0000-0000000000a1',
   'C7 nur für Mitglieder', 'members'),
  -- Eigener members-Beitrag eines Rang-1-Kontos: prüft die Autoren-Klausel
  -- unabhängig von der Stufe.
  ('c7000003-0000-4000-8000-000000000003', 'c7c7c7c7-0000-0000-0000-0000000000a2',
   'C7 eigener Beitrag', 'members'),
  -- Wegwerf-Beitrag für die Struktur-Fälle (Kaskade, Sechser-Grenze).
  ('c7000004-0000-4000-8000-000000000004', 'c7c7c7c7-0000-0000-0000-0000000000a1',
   'C7 Struktur', 'members');

insert into public.post_media (post_id, storage_path, sort, width, height) values
  ('c7000001-0000-4000-8000-000000000001',
   'c7c7c7c7-0000-0000-0000-0000000000a1/c7000001-0000-4000-8000-000000000001/0.webp', 0, 1600, 1200),
  ('c7000002-0000-4000-8000-000000000002',
   'c7c7c7c7-0000-0000-0000-0000000000a1/c7000002-0000-4000-8000-000000000002/0.webp', 0, 1600, 1200),
  ('c7000003-0000-4000-8000-000000000003',
   'c7c7c7c7-0000-0000-0000-0000000000a2/c7000003-0000-4000-8000-000000000003/0.webp', 0, 1600, 1200);

-- Die Objekte dazu, plus zwei ohne Zeile: ein verwaistes und die Fälschung aus
-- 2.7a — eigenes Präfix, im weiteren Pfad die Kennung eines FREMDEN
-- members-Beitrags. Als Testrolle eingefügt, also an der RLS vorbei; geprüft
-- wird hier das Lesen, nicht das Schreiben (das steht weiter unten).
insert into storage.objects (bucket_id, name) values
  ('post-media', 'c7c7c7c7-0000-0000-0000-0000000000a1/c7000001-0000-4000-8000-000000000001/0.webp'),
  ('post-media', 'c7c7c7c7-0000-0000-0000-0000000000a1/c7000002-0000-4000-8000-000000000002/0.webp'),
  ('post-media', 'c7c7c7c7-0000-0000-0000-0000000000a2/c7000003-0000-4000-8000-000000000003/0.webp'),
  ('post-media', 'c7c7c7c7-0000-0000-0000-0000000000a1/c7000001-0000-4000-8000-000000000001/verwaist.webp'),
  ('post-media', 'c7c7c7c7-0000-0000-0000-0000000000a2/c7000002-0000-4000-8000-000000000002/nachgebaut.webp'),
  ('post-media', 'c7c7c7c7-0000-0000-0000-0000000000a2/c7000001-0000-4000-8000-000000000001/erschlichen.webp');

-- 19.1 Struktur: Kaskade, Einzellöschung, Sechser-Grenze, Eindeutigkeit.
insert into public.post_media (post_id, storage_path, sort, width, height)
select 'c7000004-0000-4000-8000-000000000004',
       'c7c7c7c7-0000-0000-0000-0000000000a1/c7000004-0000-4000-8000-000000000004/' || i || '.webp',
       i, 1600, 1200
  from generate_series(0, 5) i;

select is(
  (select count(*)::int from public.post_media
    where post_id = 'c7000004-0000-4000-8000-000000000004'),
  6, 'Sechs Bilder an einem Beitrag sind erlaubt');

select throws_ok(
  $$insert into public.post_media (post_id, storage_path, sort, width, height) values
      ('c7000004-0000-4000-8000-000000000004',
       'c7c7c7c7-0000-0000-0000-0000000000a1/c7000004-0000-4000-8000-000000000004/6.webp',
       6, 1600, 1200)$$,
  23514, null,
  'Das siebte Bild prallt am Trigger ab — eine Zählung über andere Zeilen kann '
  'keine check-Constraint ausdrücken');

select throws_ok(
  $$insert into public.post_media (post_id, storage_path, sort, width, height) values
      ('c7000004-0000-4000-8000-000000000004',
       'c7c7c7c7-0000-0000-0000-0000000000a1/c7000004-0000-4000-8000-000000000004/doppelt.webp',
       0, 1600, 1200)$$,
  23505, null,
  'Zwei Bilder auf derselben Position prallen an unique (post_id, sort) ab');

select throws_ok(
  $$insert into public.post_media (post_id, storage_path, sort, width, height) values
      ('c7000001-0000-4000-8000-000000000001',
       'c7c7c7c7-0000-0000-0000-0000000000a1/c7000004-0000-4000-8000-000000000004/0.webp',
       9, 1600, 1200)$$,
  23505, null,
  'Derselbe storage_path zweimal prallt ab — sonst wäre die Antwort der '
  'Sichtbarkeitsfunktion mehrdeutig');

delete from public.post_media
 where post_id = 'c7000004-0000-4000-8000-000000000004' and sort = 2;
select is(
  (select string_agg(sort::text, ',' order by sort) from public.post_media
    where post_id = 'c7000004-0000-4000-8000-000000000004'),
  '0,1,3,4,5', 'Ein einzelnes Bild lässt sich entfernen, die Reihenfolge der übrigen bleibt');

delete from public.posts where id = 'c7000004-0000-4000-8000-000000000004';
select is(
  (select count(*)::int from public.post_media
    where post_id = 'c7000004-0000-4000-8000-000000000004'),
  0, 'Ein gelöschter Beitrag nimmt seine Bildzeilen mit (on delete cascade)');

-- 19.2 Das Prädikat selbst. Ein boolean, kein Zeilenzähler — hier ist „false"
-- eine Aussage und keine Leerstelle.
select is(pg_temp.bool_as_anon(
  $$select public.post_media_lesbar(
      'c7c7c7c7-0000-0000-0000-0000000000a1/c7000001-0000-4000-8000-000000000001/0.webp')$$),
  true, 'anon darf das Objekt eines public-Beitrags signieren');

select is(pg_temp.bool_as_anon(
  $$select public.post_media_lesbar(
      'c7c7c7c7-0000-0000-0000-0000000000a1/c7000002-0000-4000-8000-000000000002/0.webp')$$),
  false, 'anon darf das Objekt eines members-Beitrags NICHT signieren');

select is(pg_temp.bool_as_anon(
  $$select public.post_media_lesbar(
      'c7c7c7c7-0000-0000-0000-0000000000a1/c7000001-0000-4000-8000-000000000001/verwaist.webp')$$),
  false, 'Ein verwaistes Objekt ist für anon nicht signierbar — keine Zeile, keine Erlaubnis');

select is(pg_temp.bool_as('c7c7c7c7-0000-0000-0000-0000000000a1',
  $$select public.post_media_lesbar(
      'c7c7c7c7-0000-0000-0000-0000000000a1/c7000001-0000-4000-8000-000000000001/verwaist.webp')$$),
  false, '… und auch nicht für ein bestätigtes impact-Mitglied');

-- Der Fall, für den die Funktion überhaupt die ZEILE nachschlägt statt den Pfad
-- zu zerlegen (2.7a): eigenes Präfix, im Namen die Kennung eines fremden
-- members-Beitrags. Wer hier den Pfad parste, ließe eine fremde Sichtbarkeit
-- behaupten.
select is(pg_temp.bool_as_anon(
  $$select public.post_media_lesbar(
      'c7c7c7c7-0000-0000-0000-0000000000a2/c7000002-0000-4000-8000-000000000002/nachgebaut.webp')$$),
  false, 'Ein nachgebauter Pfad erschleicht keine Signatur — die Zeile entscheidet, nicht der Name');

select is(pg_temp.bool_as('c7c7c7c7-0000-0000-0000-0000000000a2',
  $$select public.post_media_lesbar(
      'c7c7c7c7-0000-0000-0000-0000000000a2/c7000002-0000-4000-8000-000000000002/nachgebaut.webp')$$),
  false, '… auch nicht für das Mitglied, dem das Pfadpräfix gehört');

-- DIE ZWEI ASSERTIONS, DIE DEN UNTERSCHIED WIRKLICH MESSEN. Die beiden oben tun
-- es nicht: sie tragen die Kennung eines MEMBERS-Beitrags, und die wäre auch
-- einer pfad-zerlegenden Fassung verboten — sie wären grün an einer kaputten
-- Funktion. Gemessen am 2026-08-12 mit einer Mutation, die den Pfad zerlegt:
-- gefallen sind davon nur die verwaisten Fälle, diese beiden nicht.
-- tasks.md 2.7a nennt genau die untaugliche Variante; design.md beschreibt die
-- scharfe, und das ist diese: eigenes Präfix, im Namen die Kennung eines
-- fremden ÖFFENTLICHEN Beitrags. Wer den Pfad zerlegte, läse „public" und
-- signierte ein Objekt, das zu gar keinem Beitrag gehört.
select is(pg_temp.bool_as_anon(
  $$select public.post_media_lesbar(
      'c7c7c7c7-0000-0000-0000-0000000000a2/c7000001-0000-4000-8000-000000000001/erschlichen.webp')$$),
  false, 'Eine fremde PUBLIC-Kennung im eigenen Pfad erschleicht anon keine Signatur');

select is(pg_temp.bool_as('c7c7c7c7-0000-0000-0000-0000000000a2',
  $$select public.post_media_lesbar(
      'c7c7c7c7-0000-0000-0000-0000000000a2/c7000001-0000-4000-8000-000000000001/erschlichen.webp')$$),
  false, '… und dem Mitglied, das das Objekt dort abgelegt hat, ebenso wenig');

select is(pg_temp.bool_as('c7c7c7c7-0000-0000-0000-0000000000a2',
  $$select public.post_media_lesbar(
      'c7c7c7c7-0000-0000-0000-0000000000a1/c7000002-0000-4000-8000-000000000002/0.webp')$$),
  false, 'Rang 1 kommt an das Bild eines fremden members-Beitrags nicht heran');

select is(pg_temp.bool_as('c7c7c7c7-0000-0000-0000-0000000000a2',
  $$select public.post_media_lesbar(
      'c7c7c7c7-0000-0000-0000-0000000000a2/c7000003-0000-4000-8000-000000000003/0.webp')$$),
  true, '… an das Bild seines EIGENEN members-Beitrags aber schon (Autoren-Klausel)');

select is(pg_temp.bool_as('c7c7c7c7-0000-0000-0000-0000000000a1',
  $$select public.post_media_lesbar(
      'c7c7c7c7-0000-0000-0000-0000000000a2/c7000003-0000-4000-8000-000000000003/0.webp')$$),
  true, 'Ab Rang 4 geht das Bild eines fremden members-Beitrags auf');

select is(pg_temp.bool_as('c7c7c7c7-0000-0000-0000-0000000000a3',
  $$select public.post_media_lesbar(
      'c7c7c7c7-0000-0000-0000-0000000000a1/c7000001-0000-4000-8000-000000000001/0.webp')$$),
  false, 'Das Aktivierungs-Gate steht auch vor dem Bild eines ÖFFENTLICHEN Beitrags');

-- 19.3 Die Wirkung auf storage.objects — jeweils als Paar (siehe Kopf).
select is(pg_temp.count_as_anon(
  $$select count(*)::int from storage.objects where bucket_id = 'post-media'
      and name = 'c7c7c7c7-0000-0000-0000-0000000000a1/c7000001-0000-4000-8000-000000000001/0.webp'$$),
  1, 'Storage-Policy: anon sieht das Objekt des public-Beitrags …');

select is(pg_temp.count_as_anon(
  $$select count(*)::int from storage.objects where bucket_id = 'post-media'
      and name = 'c7c7c7c7-0000-0000-0000-0000000000a1/c7000002-0000-4000-8000-000000000002/0.webp'$$),
  0, '… und das des members-Beitrags nicht (die Zeile daneben belegt, dass die Abfrage trägt)');

select is(pg_temp.count_as('c7c7c7c7-0000-0000-0000-0000000000a2',
  $$select count(*)::int from storage.objects where bucket_id = 'post-media'
      and name = 'c7c7c7c7-0000-0000-0000-0000000000a2/c7000003-0000-4000-8000-000000000003/0.webp'$$),
  1, 'Storage-Policy: Rang 1 sieht sein eigenes Objekt …');

select is(pg_temp.count_as('c7c7c7c7-0000-0000-0000-0000000000a2',
  $$select count(*)::int from storage.objects where bucket_id = 'post-media'
      and name = 'c7c7c7c7-0000-0000-0000-0000000000a1/c7000002-0000-4000-8000-000000000002/0.webp'$$),
  0, '… und das eines fremden members-Beitrags nicht');

-- 19.4 Schreiben. Hier GIBT es einen Fehler, und er ist der Beleg.
select is(pg_temp.try_as('c7c7c7c7-0000-0000-0000-0000000000a1',
  $$insert into storage.objects (bucket_id, name) values
     ('post-media', 'c7c7c7c7-0000-0000-0000-0000000000a1/neu/1.webp')$$),
  'OK', 'post_media_insert_own: das bestätigte Mitglied schreibt in sein eigenes Präfix');

select alike(pg_temp.try_as('c7c7c7c7-0000-0000-0000-0000000000a1',
  $$insert into storage.objects (bucket_id, name) values
     ('post-media', 'c7c7c7c7-0000-0000-0000-0000000000a2/fremd.webp')$$),
  'DENIED:%row-level security policy%',
  'post_media_insert_own: das Präfix eines FREMDEN Mitglieds bleibt zu');

select alike(pg_temp.try_as('c7c7c7c7-0000-0000-0000-0000000000a3',
  $$insert into storage.objects (bucket_id, name) values
     ('post-media', 'c7c7c7c7-0000-0000-0000-0000000000a3/eigen.webp')$$),
  'DENIED:%row-level security policy%',
  'post_media_insert_own: ein nicht bestätigtes Konto lädt kein Bild hoch');

select alike(pg_temp.try_as_anon(
  $$insert into storage.objects (bucket_id, name) values
     ('post-media', 'ohne-session/1.webp')$$),
  'DENIED:%row-level security policy%',
  'Ohne Session wird gar nicht geschrieben — für anon gibt es keine Schreib-Policy');

-- 19.5 Bucket und Policy-Bestand. Was pgTAP nicht sieht (die Durchsetzung von
-- Größe und Typ macht die Storage-API), hält es wenigstens als AUSGESPROCHEN
-- fest — ein `do nothing` über einem falsch eingestellten Bestands-Bucket
-- fiele hier auf.
select is(
  (select (public, file_size_limit, allowed_mime_types)::text
     from storage.buckets where id = 'post-media'),
  '(f,1048576,{image/webp})',
  'post-media: PRIVAT, 1 MiB, nur WebP — serverseitig, nicht nur im Formular');

select is(
  (select count(*)::int from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname like 'post\_media\_%'),
  4, 'post-media trägt vier Policies: eine zum Lesen, drei zum Schreiben');

select is(
  (select count(*)::int from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname like 'post\_media\_%' and cmd <> 'SELECT'
      and coalesce(qual, '') || coalesce(with_check, '') like '%is_activated%'),
  3, '… und alle drei Schreib-Policies tragen das Aktivierungs-Gate, wie avatars und covers');

-- 19.6 Die Tabelle selbst: wer den Pfad überhaupt erfährt. Ohne diese Fläche
-- wäre das Gate Kulisse — der ausgeloggte Besucher braucht die Zeile, um den
-- Pfad zu kennen, und darf sie deshalb nur für public-Beiträge bekommen.
select is(pg_temp.count_as_anon(
  $$select count(*)::int from public.post_media
      where post_id = 'c7000001-0000-4000-8000-000000000001'$$),
  1, 'post_media: anon liest die Bildzeile eines public-Beitrags …');

select is(pg_temp.count_as_anon(
  $$select count(*)::int from public.post_media
      where post_id = 'c7000002-0000-4000-8000-000000000002'$$),
  0, '… und die eines members-Beitrags nicht');

select is(pg_temp.count_as('c7c7c7c7-0000-0000-0000-0000000000a2',
  $$select count(*)::int from public.post_media
      where post_id = 'c7000002-0000-4000-8000-000000000002'$$),
  0, 'post_media: Rang 1 liest die Bildzeile eines fremden members-Beitrags nicht …');

select is(pg_temp.count_as('c7c7c7c7-0000-0000-0000-0000000000a2',
  $$select count(*)::int from public.post_media
      where post_id = 'c7000003-0000-4000-8000-000000000003'$$),
  1, '… die seines eigenen aber schon');

-- 19.7 Veröffentlichen ist EIN Schritt. Der Fehlerzustand, den die RPC
-- ausschließt: ein Beitrag steht im Feed, seine Bilder fehlen.
select is(pg_temp.try_as('c7c7c7c7-0000-0000-0000-0000000000a1',
  $$select public.create_post_with_media(
      'c7000005-0000-4000-8000-000000000005',
      'Beitrag mit zwei Bildern', 'members',
      array['netzwerken', 'allgäu'], array['ki', 'netzwerken'],
      '[{"storage_path":"c7c7c7c7-0000-0000-0000-0000000000a1/c7000005-0000-4000-8000-000000000005/0.webp","sort":0,"width":1600,"height":1200},
        {"storage_path":"c7c7c7c7-0000-0000-0000-0000000000a1/c7000005-0000-4000-8000-000000000005/1.webp","sort":1,"width":800,"height":600}]'::jsonb)$$),
  'OK', 'create_post_with_media: der Autor legt Beitrag und Bilder in einem Zug an');

select is(
  (select string_agg(sort || ':' || width || 'x' || height, ',' order by sort)
     from public.post_media where post_id = 'c7000005-0000-4000-8000-000000000005'),
  '0:1600x1200,1:800x600',
  '… beide Bildzeilen stehen in Reihenfolge, mit ihren Maßen');

select is(
  (select hashtags from public.posts where id = 'c7000005-0000-4000-8000-000000000005'),
  array['netzwerken', 'allgäu', 'ki'],
  'Getippte und geklickte Tags werden vereinigt und dedupliziert, getippte zuerst');

select alike(pg_temp.try_as('c7c7c7c7-0000-0000-0000-0000000000a1',
  $$select public.create_post_with_media(
      'c7000006-0000-4000-8000-000000000006',
      'Beitrag mit sieben Bildern', 'members', array[]::text[], array[]::text[],
      (select jsonb_agg(jsonb_build_object(
          'storage_path', 'c7c7c7c7-0000-0000-0000-0000000000a1/c7000006-0000-4000-8000-000000000006/' || i || '.webp',
          'sort', i, 'width', 1600, 'height', 1200))
         from generate_series(0, 6) i))$$),
  'DENIED:%',
  'create_post_with_media: sieben Bilder werden abgelehnt');

-- Und das ist der eigentliche Beleg für die Transaktion, nicht für die Grenze:
-- die Beitragszeile war beim Fehlschlag SCHON geschrieben — der Trigger fällt
-- erst beim siebten Bild, also nach dem Insert in `posts`. Bliebe sie stehen,
-- stünde genau der Zustand im Feed, gegen den die RPC gebaut ist.
select is(
  (select count(*)::int from public.posts where id = 'c7000006-0000-4000-8000-000000000006'),
  0, '… und danach existiert KEIN Beitrag — kein halb veröffentlichter Zustand');

select alike(pg_temp.try_as('c7c7c7c7-0000-0000-0000-0000000000a3',
  $$select public.create_post_with_media(
      'c7000007-0000-4000-8000-000000000007', 'Unbestätigt', 'members',
      array[]::text[], array[]::text[], '[]'::jsonb)$$),
  'DENIED:%',
  'create_post_with_media: ein nicht bestätigtes Konto veröffentlicht nicht');

select is(has_function_privilege('anon',
  'public.create_post_with_media(uuid,text,text,text[],text[],jsonb)', 'execute'),
  false, 'create_post_with_media: ohne Session gibt es keinen Schreibweg');

-- 19.7a Der Pfad muss dem Aufrufer gehören. Aus dem Diff-Review, und es ist die
-- einzige Stelle, an der das noch geprüft werden KANN: die RPC ist
-- SECURITY DEFINER, umgeht also `post_media_insert_own` — und selbst die Policy
-- prüft nur den BEITRAG, nie den Pfad. Der Pfad-Präfix wird sonst allein beim
-- Hochladen geprüft, an einem anderen Objekt und zu einer anderen Zeit.
--
-- Der Weg, den das offenließe: ein Mitglied liest den `storage_path` eines
-- fremden `members`-Beitrags (das darf es ab Rang 4), wartet, bis der Autor den
-- Beitrag löscht — die Bildzeile fällt per Kaskade, das Objekt im Bucket bleibt
-- liegen (benannt in den Non-goals) — und hängt den nun verwaisten Pfad an
-- seinen EIGENEN öffentlichen Beitrag. `post_media_lesbar` sagt danach „public",
-- und `anon` bekommt eine Signatur auf ein fremdes, nie öffentliches Bild.
-- `unique (storage_path)` hält das nur so lange auf, wie die alte Zeile lebt.
select alike(pg_temp.try_as('c7c7c7c7-0000-0000-0000-0000000000a1',
  $$select public.create_post_with_media(
      'c7000008-0000-4000-8000-000000000008',
      'Fremder Pfad', 'public', array[]::text[], array[]::text[],
      '[{"storage_path":"c7c7c7c7-0000-0000-0000-0000000000a2/beliebig/0.webp","sort":0,"width":16,"height":16}]'::jsonb)$$),
  'DENIED:%',
  'create_post_with_media: ein Pfad unter fremdem Präfix wird abgelehnt');

select is(
  (select count(*)::int from public.posts where id = 'c7000008-0000-4000-8000-000000000008'),
  0, '… und auch hier bleibt kein halber Beitrag stehen');

-- ── 20. Kuratierte Tags: eine redaktionelle Liste (AGE-528, C7) ─────────────
-- `tags` ist kein Mitgliedsinhalt. Beide Rollen lesen, keine schreibt — und die
-- Form des Schlüssels ist durchgesetzt, nicht verabredet: weil es keine
-- Verknüpfungstabelle gibt, IST die Zeichenkette die Verbindung zwischen
-- posts.hashtags und tags.key.

select is(pg_temp.count_as_anon('select count(*)::int from public.tags'),
  15, 'tags: der ausgeloggte Besucher liest die Liste (Filterleiste ohne Session)');

select is(pg_temp.count_as('c7c7c7c7-0000-0000-0000-0000000000a1',
  'select count(*)::int from public.tags'),
  15, 'tags: das Mitglied ebenso');

select is(has_table_privilege('anon', 'public.tags', 'INSERT'),
  false, 'tags: anon hält kein INSERT');
select is(has_table_privilege('authenticated', 'public.tags', 'INSERT'),
  false, 'tags: authenticated hält kein INSERT — die Liste ist redaktionell');

select alike(pg_temp.try_as('c7c7c7c7-0000-0000-0000-0000000000a1',
  $$insert into public.tags (key, label, sort) values ('selbstgemacht', 'Selbstgemacht', 999)$$),
  'DENIED:%permission denied%',
  'tags: ein Mitglied legt keinen kuratierten Tag an');

-- Die Schlüsselform. Jeder dieser drei Schlüssel ließe sich NIE tippen —
-- parseHashtags erzeugt ihn nicht — und der Filter zerfiele still in zwei Töpfe.
select throws_ok(
  $$insert into public.tags (key, label, sort) values ('Gross', 'Gross', 900)$$,
  23514, null, 'tags: ein Großbuchstabe im Schlüssel wird abgelehnt');

select throws_ok(
  $$insert into public.tags (key, label, sort) values ('know-how', 'Know-how', 901)$$,
  23514, null, 'tags: ein Bindestrich wird abgelehnt — er beendet den Hashtag im Fließtext');

select throws_ok(
  $$insert into public.tags (key, label, sort) values ('zwei wort', 'Zwei Wort', 902)$$,
  23514, null, 'tags: ein Leerzeichen wird abgelehnt');

-- Die Gegenprobe, und sie ist der eigentliche Grund für die Zeichenklasse:
-- toLowerCase() ersetzt Umlaute NICHT, also muss der Schlüssel sie tragen
-- dürfen. Diese Assertion misst zugleich, dass [[:alnum:]] in dieser Datenbank
-- Unicode-Buchstaben umfasst — sie hängt an der Locale, nicht am SQL-Text.
select lives_ok(
  $$insert into public.tags (key, label, sort) values ('grüße', 'Grüße', 903)$$,
  'tags: ein Umlaut im Schlüssel ist erlaubt');
delete from public.tags where key = 'grüße';

select is(
  (select count(*)::int from public.tags where key <> lower(label)),
  0, 'tags: jeder Schlüssel ist das kleingeschriebene Label — sonst trifft kein getippter Tag');

-- Und dass das nicht nur für die Startbefüllung gilt, sondern DURCHGESETZT ist.
-- Befund aus dem Diff-Review: die Zeile darüber prüft 15 vorhandene Zeilen; eine
-- spätere redaktionelle Ergänzung ist ein Insert und läuft an keiner Suite
-- vorbei. Ein Label „Know-how" mit Schlüssel `knowhow` spaltete den Filter
-- still in zwei Töpfe — geklickt träfe er, getippt nie.
select throws_ok(
  $$insert into public.tags (key, label, sort) values ('knowhow', 'Know-how', 904)$$,
  23514, null, 'tags: ein Schlüssel, der nicht das kleingeschriebene Label ist, wird abgelehnt');

select is(
  (select count(*)::int from public.tags where sort < 200),
  11, 'Startbefüllung: elf Themen aus dem Mockup');

select is(
  (select count(*)::int from public.tags where sort >= 200),
  4, 'Startbefüllung: vier Formate');

-- ── 20. Event-Inhalte: Spalten, Teilnehmer-RPC, Titelbild (AGE-531, C8) ─────
-- Eigene Sonden statt geliehener Fixtures — dieselbe Begründung wie in §17/§19:
-- die Bestandskonten tragen Registrierungen und Events aus anderen Abschnitten,
-- und eine Zählung über sie prüfte am Ende die Nachbarn mit.
--
-- Drei Dinge, die dieser Abschnitt belegt und die vorher niemand geprüft hat:
--
--  1. `starts_at` ist NOT NULL und `ends_at` liegt dahinter.
--  2. `event_attendees` gibt die Teilnehmer heraus, ABER weder das
--     unbestätigte Konto noch ein Mitglied, das nicht im Verzeichnis steht —
--     geprüft an der ROHEN Antwort, nicht an einem Label im Frontend.
--  3. Ein Titelbild ist genau so sichtbar wie sein Event, UND ein fremder
--     Pfad bleibt unlesbar, auch wenn er an einem eigenen `public`-Event hängt.
--     Das dritte ist der Befund aus dem Plan-Review (codex): die Upload-Policy
--     beweist Eigentum nur beim Anlegen des OBJEKTS; wer danach die SPALTE
--     schreibt, prüfte bis hierhin niemand. C7 wehrt denselben Angriff in
--     `create_post_with_media` ab (20260812090000_post_media.sql:214–240).

insert into auth.users (id, aud, role, email) values
  ('c8c8c8c8-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', 'c8host@test.fbc'),
  ('c8c8c8c8-0000-0000-0000-0000000000a2', 'authenticated', 'authenticated', 'c8zweiterhost@test.fbc'),
  ('c8c8c8c8-0000-0000-0000-0000000000a3', 'authenticated', 'authenticated', 'c8mitglied@test.fbc'),
  ('c8c8c8c8-0000-0000-0000-0000000000a4', 'authenticated', 'authenticated', 'c8optout@test.fbc'),
  ('c8c8c8c8-0000-0000-0000-0000000000a5', 'authenticated', 'authenticated', 'c8unbestaetigt@test.fbc'),
  ('c8c8c8c8-0000-0000-0000-0000000000a6', 'authenticated', 'authenticated', 'c8warteliste@test.fbc'),
  ('c8c8c8c8-0000-0000-0000-0000000000a7', 'authenticated', 'authenticated', 'c8abgemeldet@test.fbc');

update public.profiles set tier = 'impact', activated_at = now()
 where id::text like 'c8c8c8c8-%';
-- Das unbestätigte Konto: bewusst `impact`, damit hinter dem Gate kein
-- Stufen-Gate mehr steht, das einen Fehler noch auffinge (wie in §13).
update public.profiles set activated_at = null
 where id = 'c8c8c8c8-0000-0000-0000-0000000000a5';
-- Das Opt-out-Konto: bestätigt, aber nicht im Verzeichnis. Genau der Fall, den
-- der Plan-Review getroffen hat — es geht nicht darum, wie es angezeigt wird,
-- sondern darum, dass seine UUID gar nicht erst herausgegeben wird.
update public.profiles set is_public = false
 where id = 'c8c8c8c8-0000-0000-0000-0000000000a4';

insert into public.events (id, title, host_id, visibility, starts_at, cover_path) values
  ('c8000001-0000-4000-8000-000000000001', 'C8 Mitglieder-Event',
   'c8c8c8c8-0000-0000-0000-0000000000a1', 'members', now() + interval '7 days',
   'c8c8c8c8-0000-0000-0000-0000000000a1/members.webp'),
  ('c8000002-0000-4000-8000-000000000002', 'C8 Öffentliches Event',
   'c8c8c8c8-0000-0000-0000-0000000000a1', 'public', now() + interval '8 days',
   'c8c8c8c8-0000-0000-0000-0000000000a1/public.webp'),
  -- Der Diebstahl, absichtlich AN DER POLICY VORBEI eingesetzt (Superuser).
  -- Die Frage dieses Abschnitts ist nicht, ob das Schreiben scheitert — das
  -- prüft 20.2 —, sondern ob das LESEN auch dann noch hält, wenn die Zeile
  -- trotzdem existiert. Nur so deckt der Test auch Bestand ab.
  ('c8000003-0000-4000-8000-000000000003', 'C8 Geklautes Titelbild',
   'c8c8c8c8-0000-0000-0000-0000000000a2', 'public', now() + interval '9 days',
   'c8c8c8c8-0000-0000-0000-0000000000a1/geklaut.webp');

insert into public.event_registrations (event_id, profile_id, status) values
  ('c8000001-0000-4000-8000-000000000001', 'c8c8c8c8-0000-0000-0000-0000000000a2', 'registered'),
  ('c8000001-0000-4000-8000-000000000001', 'c8c8c8c8-0000-0000-0000-0000000000a3', 'registered'),
  ('c8000001-0000-4000-8000-000000000001', 'c8c8c8c8-0000-0000-0000-0000000000a4', 'registered'),
  ('c8000001-0000-4000-8000-000000000001', 'c8c8c8c8-0000-0000-0000-0000000000a6', 'waitlist'),
  ('c8000001-0000-4000-8000-000000000001', 'c8c8c8c8-0000-0000-0000-0000000000a7', 'cancelled');

insert into storage.objects (bucket_id, name) values
  ('event-covers', 'c8c8c8c8-0000-0000-0000-0000000000a1/members.webp'),
  ('event-covers', 'c8c8c8c8-0000-0000-0000-0000000000a1/public.webp'),
  ('event-covers', 'c8c8c8c8-0000-0000-0000-0000000000a1/geklaut.webp'),
  ('event-covers', 'c8c8c8c8-0000-0000-0000-0000000000a1/verwaist.webp');

-- 20.1 Die vier Spalten und ihre Bedingungen.
select throws_ok(
  $$insert into public.events (title, host_id, visibility)
    values ('Ohne Termin', 'c8c8c8c8-0000-0000-0000-0000000000a1', 'public')$$,
  23502, null, 'events.starts_at: ein Event ohne Termin wird abgelehnt');

select throws_ok(
  $$insert into public.events (title, host_id, visibility, starts_at, ends_at)
    values ('Endet vorher', 'c8c8c8c8-0000-0000-0000-0000000000a1', 'public',
            now() + interval '7 days', now() + interval '6 days')$$,
  23514, null, 'events_ends_after_start: ein Ende vor dem Beginn wird abgelehnt');

select lives_ok(
  $$insert into public.events (title, host_id, visibility, starts_at, ends_at)
    values ('Offenes Ende', 'c8c8c8c8-0000-0000-0000-0000000000a1', 'public',
            now() + interval '7 days', null)$$,
  'events.ends_at bleibt optional — ein offenes Ende ist erlaubt');

select throws_ok(
  $$insert into public.events (title, host_id, visibility, starts_at, cover_path)
    values ('Derselbe Pfad', 'c8c8c8c8-0000-0000-0000-0000000000a1', 'public',
            now() + interval '7 days',
            'c8c8c8c8-0000-0000-0000-0000000000a1/members.webp')$$,
  23505, null, 'events.cover_path ist unique — zwei Events auf einem Pfad wären mehrdeutig');

-- 20.2 Die Pfadbindung beim SCHREIBEN (Befund codex, HIGH — schreibende Hälfte).
select is(pg_temp.try_as('c8c8c8c8-0000-0000-0000-0000000000a1',
  $$update public.events
       set cover_path = 'c8c8c8c8-0000-0000-0000-0000000000a1/neu.webp'
     where id = 'c8000002-0000-4000-8000-000000000002'$$),
  'OK', 'events_write_host: der Host setzt einen Pfad in seinem EIGENEN Präfix');

select alike(pg_temp.try_as('c8c8c8c8-0000-0000-0000-0000000000a2',
  $$update public.events
       set cover_path = 'c8c8c8c8-0000-0000-0000-0000000000a1/fremd.webp'
     where id = 'c8000003-0000-4000-8000-000000000003'$$),
  'DENIED:%row-level security%',
  'events_write_host: ein FREMDES Pfadpräfix wird abgelehnt — der Kern des Befunds');

select is(pg_temp.try_as('c8c8c8c8-0000-0000-0000-0000000000a2',
  $$update public.events set cover_path = null
     where id = 'c8000003-0000-4000-8000-000000000003'$$),
  'OK', 'events_write_host: das Titelbild entfernen bleibt erlaubt (cover_path = null)');

-- Aufräumen: 20.2 hat die Sonde verändert; die Signatur-Fälle unten brauchen
-- den geklauten Pfad zurück. Als Superuser, an der Policy vorbei — siehe oben.
update public.events
   set cover_path = 'c8c8c8c8-0000-0000-0000-0000000000a1/geklaut.webp'
 where id = 'c8000003-0000-4000-8000-000000000003';
update public.events
   set cover_path = 'c8c8c8c8-0000-0000-0000-0000000000a1/public.webp'
 where id = 'c8000002-0000-4000-8000-000000000002';

-- 20.3 event_attendees — wer sieht, wer kommt.
select is(pg_temp.count_as('c8c8c8c8-0000-0000-0000-0000000000a3',
  $$select count(*)::int from public.event_attendees('c8000001-0000-4000-8000-000000000001')$$),
  2, 'event_attendees: das aktivierte Mitglied sieht die beiden angemeldeten Verzeichnis-Profile');

-- Die Zeile daneben belegt, dass die Abfrage überhaupt trägt: derselbe Aufruf
-- als Host liefert VIER — er gewinnt Warteliste und Abmeldung dazu.
--
-- Vier und nicht fünf, weil das Opt-out AUCH vor dem Host steht. Das ist
-- Absicht und keine Lücke: der Host sieht die fünfte Zeile ohnehin, über die
-- unveränderte `regs_select_self_or_host` und mit Status und Check-in (das ist
-- sein Werkzeug). Diese Funktion ist die Avatarreihe im Frontend, und dort hat
-- ein Mitglied ohne Verzeichnis-Eintrag nichts verloren — auch nicht auf der
-- Seite des Veranstalters.
select is(pg_temp.count_as('c8c8c8c8-0000-0000-0000-0000000000a1',
  $$select count(*)::int from public.event_attendees('c8000001-0000-4000-8000-000000000001')$$),
  4, '… der Host dagegen vier: er gewinnt Warteliste und Abmeldung, verliert das Opt-out');

-- Und dass dieser Zugewinn wirklich die Status-Dimension ist und nicht zufällig
-- dieselbe Zahl: der Host sieht die Wartelisten-Zeile namentlich.
select is(pg_temp.count_as('c8c8c8c8-0000-0000-0000-0000000000a1',
  $$select count(*)::int from public.event_attendees('c8000001-0000-4000-8000-000000000001')
     where profile_id = 'c8c8c8c8-0000-0000-0000-0000000000a6' and status = 'waitlist'$$),
  1, '… und zwar genau die Wartelisten-Zeile, die dem Nicht-Host fehlt');

select is(pg_temp.count_as('c8c8c8c8-0000-0000-0000-0000000000a5',
  $$select count(*)::int from public.event_attendees('c8000001-0000-4000-8000-000000000001')$$),
  0, 'event_attendees: das eingeloggte, NICHT bestätigte Konto sieht niemanden');

-- Der Befund aus dem Plan-Review, an der rohen Antwort geprüft: die UUID des
-- Opt-out-Mitglieds darf gar nicht erst auf der Leitung stehen. Ein Test gegen
-- ein Label im Frontend hätte das nie gefunden.
select is(pg_temp.count_as('c8c8c8c8-0000-0000-0000-0000000000a3',
  $$select count(*)::int from public.event_attendees('c8000001-0000-4000-8000-000000000001')
     where profile_id = 'c8c8c8c8-0000-0000-0000-0000000000a4'$$),
  0, 'event_attendees: wer nicht im Verzeichnis steht, dessen UUID wird nicht herausgegeben');

select is(pg_temp.count_as('c8c8c8c8-0000-0000-0000-0000000000a3',
  $$select count(*)::int from public.event_attendees('c8000001-0000-4000-8000-000000000001')
     where status <> 'registered'$$),
  0, 'event_attendees: Warteliste und Abmeldung bleiben vor Nicht-Hosts verborgen');

select alike(pg_temp.try_as_anon(
  $$select * from public.event_attendees('c8000002-0000-4000-8000-000000000002')$$),
  'DENIED:%permission denied%',
  'event_attendees: ohne Session gibt es keine Teilnehmer, auch nicht beim öffentlichen Event');

-- 20.4 Die Regression, die den Kern der Entscheidung sichert: die Tabelle
-- selbst bleibt zu. Wäre `regs_select_self_or_host` mit umgebaut worden, wären
-- `rating` und `checked_in` fremder Zeilen mit herausgefallen.
select is(pg_temp.count_as('c8c8c8c8-0000-0000-0000-0000000000a3',
  $$select count(*)::int from public.event_registrations
     where event_id = 'c8000001-0000-4000-8000-000000000001'$$),
  1, 'regs_select_self_or_host UNVERÄNDERT: direkt an der Tabelle sieht man nur die eigene Zeile');

-- 20.5 event_cover_lesbar — das Titelbild ist so sichtbar wie sein Event.
select is(pg_temp.bool_as_anon(
  $$select public.event_cover_lesbar('c8c8c8c8-0000-0000-0000-0000000000a1/public.webp')$$),
  true, 'event_cover_lesbar: ohne Session geht das Bild des ÖFFENTLICHEN Events auf …');

select is(pg_temp.bool_as_anon(
  $$select public.event_cover_lesbar('c8c8c8c8-0000-0000-0000-0000000000a1/members.webp')$$),
  false, '… und das des Mitglieder-Events nicht (die Zeile darüber belegt, dass die Abfrage trägt)');

select is(pg_temp.bool_as('c8c8c8c8-0000-0000-0000-0000000000a3',
  $$select public.event_cover_lesbar('c8c8c8c8-0000-0000-0000-0000000000a1/members.webp')$$),
  true, 'event_cover_lesbar: das aktivierte Mitglied kommt an das Mitglieder-Bild');

select is(pg_temp.bool_as('c8c8c8c8-0000-0000-0000-0000000000a5',
  $$select public.event_cover_lesbar('c8c8c8c8-0000-0000-0000-0000000000a1/public.webp')$$),
  false, 'event_cover_lesbar: das Gate steht auch vor dem Bild eines ÖFFENTLICHEN Events');

select is(pg_temp.bool_as_anon(
  $$select public.event_cover_lesbar('c8c8c8c8-0000-0000-0000-0000000000a1/verwaist.webp')$$),
  false, 'event_cover_lesbar: ein Objekt ohne Event-Zeile ist für niemanden lesbar');

-- 20.6 Der Diebstahl (Befund codex, HIGH — lesende Hälfte). Das Event ist
-- `public` und gehört a2; der Pfad trägt das Präfix von a1. Ohne die
-- Präfix-Prüfung im Lesepfad signierte `anon` hier ein Bild, das nie
-- öffentlich war.
select is(pg_temp.bool_as_anon(
  $$select public.event_cover_lesbar('c8c8c8c8-0000-0000-0000-0000000000a1/geklaut.webp')$$),
  false, 'event_cover_lesbar: ein fremder Pfad an einem eigenen public-Event bleibt zu (anon)');

select is(pg_temp.bool_as('c8c8c8c8-0000-0000-0000-0000000000a2',
  $$select public.event_cover_lesbar('c8c8c8c8-0000-0000-0000-0000000000a1/geklaut.webp')$$),
  false, '… auch für den Dieb selbst, der das Event ja hostet');

-- 20.7 Die Wirkung auf storage.objects — jeweils als Paar (siehe §19).
select is(pg_temp.count_as_anon(
  $$select count(*)::int from storage.objects where bucket_id = 'event-covers'
      and name = 'c8c8c8c8-0000-0000-0000-0000000000a1/public.webp'$$),
  1, 'Storage-Policy: anon sieht das Objekt des öffentlichen Events …');

select is(pg_temp.count_as_anon(
  $$select count(*)::int from storage.objects where bucket_id = 'event-covers'
      and name = 'c8c8c8c8-0000-0000-0000-0000000000a1/members.webp'$$),
  0, '… und das des Mitglieder-Events nicht');

-- 20.8 Schreiben in den Bucket. Hier GIBT es einen Fehler, und er ist der Beleg.
select is(pg_temp.try_as('c8c8c8c8-0000-0000-0000-0000000000a1',
  $$insert into storage.objects (bucket_id, name) values
     ('event-covers', 'c8c8c8c8-0000-0000-0000-0000000000a1/neu.webp')$$),
  'OK', 'event_cover_insert_own: das bestätigte Mitglied schreibt in sein eigenes Präfix');

select alike(pg_temp.try_as('c8c8c8c8-0000-0000-0000-0000000000a2',
  $$insert into storage.objects (bucket_id, name) values
     ('event-covers', 'c8c8c8c8-0000-0000-0000-0000000000a1/kaper.webp')$$),
  'DENIED:%row-level security%',
  'event_cover_insert_own: das Präfix eines FREMDEN Mitglieds bleibt zu');

select alike(pg_temp.try_as('c8c8c8c8-0000-0000-0000-0000000000a5',
  $$insert into storage.objects (bucket_id, name) values
     ('event-covers', 'c8c8c8c8-0000-0000-0000-0000000000a5/eigen.webp')$$),
  'DENIED:%row-level security%',
  'event_cover_insert_own: ein nicht bestätigtes Konto lädt kein Titelbild hoch');

-- 20.9 Die Bucket-Einstellungen selbst (Befund codex, MEDIUM). Größe und Typ
-- stehen SERVERSEITIG am Bucket, nicht nur im Formular. Dass ein zu großer
-- oder nicht-WebP-Upload tatsächlich abgewiesen wird, kann pgTAP nicht
-- messen — die Grenzen sitzen im Storage-Dienst; das belegt die Sonde.
select is(
  (select public::text || '/' || file_size_limit::text || '/' ||
          array_to_string(allowed_mime_types, ',')
     from storage.buckets where id = 'event-covers'),
  'false/2097152/image/webp',
  'event-covers: PRIVAT, 2 MiB, nur WebP — anders als covers, das öffentlich ist');

-- 20.10 Die Drift-Sicherung: dieselbe Regel steht jetzt an ACHT Stellen. Jede
-- Bucket-Sektion zählt ihre eigene (vgl. §17 für covers/avatars, §19 für
-- post_media) — ohne diese Zeile zählte die Sicherung ab jetzt einen Bucket
-- zu wenig, ohne dabei rot zu werden.
select is(
  (select count(*)::int from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname like 'event\_cover\_%'
      and cmd <> 'SELECT'
      and coalesce(qual, '') || coalesce(with_check, '') like '%is_activated%'),
  3, 'event-covers trägt drei Schreib-Policies, alle mit dem Aktivierungs-Gate');

-- 20.11 Rechte an den beiden neuen Funktionen. Eine Funktion ist per
-- Voreinstellung für PUBLIC ausführbar; ohne `revoke` wäre das eine stille
-- Rechteausweitung (Befund codex, LOW).
select is(
  has_function_privilege('anon', 'public.event_attendees(uuid)', 'execute'),
  false, 'event_attendees: anon darf sie NICHT aufrufen — ausgeloggt gibt es keine Teilnehmer');

select is(
  has_function_privilege('authenticated', 'public.event_attendees(uuid)', 'execute'),
  true, '… authenticated schon');

select is(
  has_function_privilege('anon', 'public.event_cover_lesbar(text)', 'execute'),
  true, 'event_cover_lesbar: anon MUSS sie aufrufen dürfen, sonst trägt die SELECT-Policy nicht');

-- ── 21. Academy aus geteilten Videos: `posts.video_url` (AGE-533, C9) ───────
-- Die Spalte trägt die Academy: sie ist der Filter („Beiträge mit Video") und
-- über den partiellen Index zugleich die Sortierung.
--
-- Was dieser Abschnitt belegt, und warum jede Zeile davon nötig ist:
--
--  1. Der Wert wird in der DATENBANK abgeleitet, nicht im Client. Der erste
--     Entwurf ließ den Client rechnen und versprach, `video_url` und das
--     gerenderte Embed könnten deshalb nicht auseinanderlaufen. Die Zusage war
--     nicht durchsetzbar (Plan-Review codex, HIGH): `posts_write_own` erlaubt
--     `authenticated` INSERT und UPDATE direkt auf `posts`. 21.9–21.12 prüfen
--     genau das — ein selbst gesetzter Wert überlebt den Trigger nicht.
--  2. `erste_video_url` akzeptiert GENAU, was `parseVideoUrl` akzeptiert
--     (src/lib/feed.ts). Zwei Fehler des Entwurfs hat der Review hier gefunden:
--     `~` ist case-sensitive, während der TS-Parser den Host kleinschreibt
--     (21.7) — und die Host-Grenze muss verankert sein, sonst kommt
--     `youtube.com.boese.example` durch (21.8).
--  3. `youtube-nocookie` steht bewusst NICHT in der Liste: `parseVideoUrl`
--     kennt den Host nicht. Ihn nur in SQL zu ergänzen wäre genau die Drift,
--     gegen die der ganze Abschnitt antritt.

insert into auth.users (id, aud, role, email) values
  ('c9c9c9c9-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', 'c9autor@test.fbc');

update public.profiles set tier = 'impact', activated_at = now()
 where id = 'c9c9c9c9-0000-0000-0000-0000000000a1';

-- 21.1/21.2 Spalte und Index. Der Index ist PARTIELL und über
-- (created_at desc, id desc) — er trägt Filter und Sortierung in einem; ein
-- Index auf `video_url` allein trüge die Sortierung nicht.
select has_column('public', 'posts', 'video_url',
  'posts trägt video_url');

select is(
  (select count(*)::int from pg_indexes
    where schemaname = 'public' and indexname = 'posts_video_url_idx'
      -- `indexdef` gibt Schlüsselwörter GROSS zurück, und `like` ist
      -- case-sensitiv. Beides zusammen hat diese Behauptung erst rot gemeldet,
      -- obwohl der Index richtig stand.
      and indexdef like '%WHERE (video_url IS NOT NULL)%'
      and indexdef like '%(created_at DESC, id DESC)%'),
  1, 'posts_video_url_idx besteht, ist partiell und trägt die Sortierung');

-- 21.3–21.6 Die akzeptierten Formen, je eine Familie.
select is(
  public.erste_video_url('Schau mal https://www.youtube.com/watch?v=Ks-_Mh1QhMc an'),
  'https://www.youtube.com/watch?v=Ks-_Mh1QhMc',
  'erste_video_url: youtube.com/watch mit www.');

select is(
  public.erste_video_url('https://m.youtube.com/watch?feature=x&v=AiOz1vDMjr0&list=RD'),
  'https://m.youtube.com/watch?feature=x&v=AiOz1vDMjr0&list=RD',
  '… m.youtube.com, v hinter einem anderen Parameter, weitere Parameter dahinter');

select is(
  public.erste_video_url('http://youtu.be/abc_123-x?t=30'),
  'http://youtu.be/abc_123-x?t=30',
  '… youtu.be mit http und Query — new URL() hält den Query aus dem Pfad heraus');

select is(
  public.erste_video_url('https://player.vimeo.com/video/76979871 und https://vimeo.com/1'),
  'https://player.vimeo.com/video/76979871',
  '… player.vimeo.com, und bei zwei Videos gewinnt das erste');

-- 21.7 Der Fehler des Entwurfs: `~` statt `~*`. `parseVideoUrl` schreibt den
-- Host klein (feed.ts:165), akzeptiert diese URL also — eine case-sensitive
-- Prüfung hätte sie abgelehnt und den Beitrag aus der Academy gehalten.
select is(
  public.erste_video_url('https://WWW.YouTube.com/watch?v=Ks-_Mh1QhMc'),
  'https://WWW.YouTube.com/watch?v=Ks-_Mh1QhMc',
  'erste_video_url: Großschreibung im Host wird akzeptiert (~*, nicht ~)');

-- 21.8 Der Präfix-Angriff. Ein `like 'https://youtube.com%'` ließe ihn durch,
-- und in `video_url` stünde ein Wert, den VideoEmbed nicht einbettet.
select is(
  public.erste_video_url('https://youtube.com.boese.example/watch?v=x'),
  null,
  'erste_video_url: erlaubtes Präfix, fremder Host — abgelehnt');

select is(
  public.erste_video_url('https://vimeo.com/keinezahl'),
  null,
  'erste_video_url: vimeo verlangt eine Zahl');

select is(
  public.erste_video_url('Ein Satz ganz ohne Link.'),
  null,
  'erste_video_url: kein Link, kein Wert');

-- Satzzeichen am Linkende gehören zum Satz, nicht zur URL — dieselbe Regel wie
-- in tokenizePostBody (TRAILING_PUNCT).
select is(
  public.erste_video_url('Sehenswert: https://youtu.be/abc123.'),
  'https://youtu.be/abc123',
  'erste_video_url: nachgestellter Punkt gehört nicht zur URL');

-- 21.9–21.12 Der Trigger. Das ist der Kern: die Ableitung ist nicht fälschbar.
insert into public.posts (id, author_id, body, video_url) values
  ('c9000001-0000-4000-8000-000000000001',
   'c9c9c9c9-0000-0000-0000-0000000000a1',
   'Dieser Beitrag hat gar keinen Link.',
   'https://youtu.be/GEFAELSCHT');

select is(
  (select video_url from public.posts where id = 'c9000001-0000-4000-8000-000000000001'),
  null,
  'Trigger: ein von Hand gesetzter Wert überlebt den INSERT nicht');

insert into public.posts (id, author_id, body) values
  ('c9000002-0000-4000-8000-000000000002',
   'c9c9c9c9-0000-0000-0000-0000000000a1',
   'Mein Vortrag: https://vimeo.com/76979871');

select is(
  (select video_url from public.posts where id = 'c9000002-0000-4000-8000-000000000002'),
  'https://vimeo.com/76979871',
  'Trigger: aus dem Body abgeleitet, ohne dass der Client etwas mitschickt');

update public.posts set body = 'Doch lieber https://youtu.be/neuervideo'
 where id = 'c9000002-0000-4000-8000-000000000002';

select is(
  (select video_url from public.posts where id = 'c9000002-0000-4000-8000-000000000002'),
  'https://youtu.be/neuervideo',
  'Trigger: ein geänderter Body rechnet neu');

-- Der Grund, warum der Trigger auf JEDEM Update sitzt und nicht auf
-- `update of body`: sonst käme genau dieser Schreibzugriff an ihm vorbei.
update public.posts set video_url = 'https://youtu.be/GEFAELSCHT'
 where id = 'c9000002-0000-4000-8000-000000000002';

select is(
  (select video_url from public.posts where id = 'c9000002-0000-4000-8000-000000000002'),
  'https://youtu.be/neuervideo',
  'Trigger: ein UPDATE nur auf video_url wird überschrieben (kein `update of body`)');

-- 21.13/21.14 Rechte. Eine neue Funktion ist per Voreinstellung für PUBLIC
-- ausführbar; ohne `revoke` wäre das eine stille Rechteausweitung (Befund
-- codex, MEDIUM). Der Trigger ruft sie als Definer, niemand sonst braucht sie.
select is(
  has_function_privilege('anon', 'public.erste_video_url(text)', 'execute'),
  false, 'erste_video_url: anon darf sie nicht aufrufen');

select is(
  has_function_privilege('authenticated', 'public.erste_video_url(text)', 'execute'),
  false, '… authenticated auch nicht — sie ist Innerei des Triggers, keine API');

-- ── 22. Events weben sich in den Feed: `posts.kind`/`ref_id` (AGE-533, C9) ──
-- Ein Event kündigt sich selbst im Feed an. Der Beitrag speichert dabei KEINEN
-- Event-Inhalt — kein Titel, kein Datum, kein Bild —, sondern nur `kind`,
-- `ref_id` und einen leeren Body; die Darstellung joint zur Laufzeit.
--
-- Drei Dinge, die dieser Abschnitt belegt und die der Plan-Review erzwungen hat:
--
--  1. **Event-Beiträge sind systemverwaltet** (codex, SEVERITY HIGH). Der Host
--     IST der Autor seines Event-Beitrags, und `posts_write_own` galt `for all`
--     auf `author_id = auth.uid()`. Er konnte den Beitrag also löschen, auf
--     `kind='member'` umschreiben oder die vom Trigger gesetzte Sichtbarkeit
--     danach wieder ändern — Eindeutigkeit und Spiegelung galten nur zufällig.
--     22.10–22.13 prüfen jede dieser vier Umgehungen einzeln.
--  2. **Der Lebenszyklus von `host_id`**, nicht nur `visibility` (codex MEDIUM
--     und opencode HIGH, unabhängig voneinander). Vier Übergänge, vier Fälle:
--     22.6–22.9.
--  3. **Das Aktivierungs-Gate greift auch hier** (C3/AGE-495), und der
--     gespiegelte Beitrag ist STRENGER als sein Event: `events` sieht jedes
--     bestätigte Konto, `members`-Posts erst ab Rang 4. 22.16 hält beides fest,
--     damit eine spätere Änderung eine Entscheidung ist und kein Unfall.

insert into auth.users (id, aud, role, email) values
  ('c9c9c9c9-0000-0000-0000-0000000000b1', 'authenticated', 'authenticated', 'c9host1@test.fbc'),
  ('c9c9c9c9-0000-0000-0000-0000000000b2', 'authenticated', 'authenticated', 'c9host2@test.fbc'),
  ('c9c9c9c9-0000-0000-0000-0000000000b3', 'authenticated', 'authenticated', 'c9rang1@test.fbc'),
  ('c9c9c9c9-0000-0000-0000-0000000000b4', 'authenticated', 'authenticated', 'c9unbest@test.fbc');

update public.profiles set tier = 'impact', activated_at = now()
 where id::text like 'c9c9c9c9-0000-0000-0000-0000000000b%';
-- Rang 1: sieht `members`-EVENTS, aber keine `members`-POSTS. Genau die
-- Asymmetrie, die 22.16 festhält.
update public.profiles set tier = 'basic'
 where id = 'c9c9c9c9-0000-0000-0000-0000000000b3';
-- Bestätigt-Flag weg, Stufe bewusst `impact`: dahinter steht kein Stufen-Gate
-- mehr, das einen Fehler noch auffinge (wie in §13/§20).
update public.profiles set activated_at = null
 where id = 'c9c9c9c9-0000-0000-0000-0000000000b4';

-- 22.1/22.2 Die zwei Spalten.
select has_column('public', 'posts', 'kind', 'posts trägt kind');
select has_column('public', 'posts', 'ref_id', 'posts trägt ref_id');

-- 22.3 Der Fremdschlüssel trägt den AUSGESCHRIEBENEN Namen: der Client nennt
-- ihn in der PostgREST-Einbettung, ein generierter Name wäre eine stille
-- Kopplung (offene Annahme aus dem Plan-Review).
select is(
  (select count(*)::int from pg_constraint
    where conname = 'posts_ref_id_fkey'
      and conrelid = 'public.posts'::regclass
      and confdeltype = 'c'),
  1, 'posts_ref_id_fkey heißt so und kaskadiert beim Löschen');

-- 22.4 Anlegen erzeugt GENAU EINEN Beitrag, ohne Event-Inhalt.
insert into public.events (id, title, host_id, visibility, starts_at) values
  ('c9e00001-0000-4000-8000-000000000001', 'C9 Öffentliches Event',
   'c9c9c9c9-0000-0000-0000-0000000000b1', 'public', now() + interval '7 days');

select results_eq(
  $$select kind, body, visibility, author_id::text
      from public.posts where ref_id = 'c9e00001-0000-4000-8000-000000000001'$$,
  $$values ('event', '', 'public', 'c9c9c9c9-0000-0000-0000-0000000000b1')$$,
  'Ein neues Event erzeugt einen Beitrag: kind=event, LEERER Body, Sichtbarkeit und Host übernommen');

-- 22.5 Sichtbarkeit zieht nach.
update public.events set visibility = 'members'
 where id = 'c9e00001-0000-4000-8000-000000000001';

select is(
  (select visibility from public.posts where ref_id = 'c9e00001-0000-4000-8000-000000000001'),
  'members', 'Eine spätere Sichtbarkeitsänderung zieht den Beitrag nach');

-- 22.6–22.9 Der Lebenszyklus von host_id, alle vier Übergänge.
insert into public.events (id, title, host_id, visibility, starts_at) values
  ('c9e00002-0000-4000-8000-000000000002', 'C9 Event ohne Host',
   null, 'public', now() + interval '8 days');

select is(
  (select count(*)::int from public.posts where ref_id = 'c9e00002-0000-4000-8000-000000000002'),
  0, 'Ein Event OHNE Host legt an und erzeugt keinen Beitrag (posts.author_id ist not null)');

update public.events set host_id = 'c9c9c9c9-0000-0000-0000-0000000000b1'
 where id = 'c9e00002-0000-4000-8000-000000000002';

select is(
  (select author_id::text from public.posts where ref_id = 'c9e00002-0000-4000-8000-000000000002'),
  'c9c9c9c9-0000-0000-0000-0000000000b1',
  'null→Host: der fehlende Beitrag entsteht jetzt');

update public.events set host_id = 'c9c9c9c9-0000-0000-0000-0000000000b2'
 where id = 'c9e00002-0000-4000-8000-000000000002';

select is(
  (select author_id::text from public.posts where ref_id = 'c9e00002-0000-4000-8000-000000000002'),
  'c9c9c9c9-0000-0000-0000-0000000000b2',
  'Host→Host: author_id zieht nach');

update public.events set host_id = null
 where id = 'c9e00002-0000-4000-8000-000000000002';

select is(
  (select count(*)::int from public.posts where ref_id = 'c9e00002-0000-4000-8000-000000000002'),
  0, 'Host→null: der Beitrag wird entfernt — es gäbe niemanden, dem er gehört');

-- 22.10 Die Kaskade beim Löschen des Events.
insert into public.events (id, title, host_id, visibility, starts_at) values
  ('c9e00003-0000-4000-8000-000000000003', 'C9 Wegwerf-Event',
   'c9c9c9c9-0000-0000-0000-0000000000b1', 'public', now() + interval '9 days');
delete from public.events where id = 'c9e00003-0000-4000-8000-000000000003';

select is(
  (select count(*)::int from public.posts where ref_id = 'c9e00003-0000-4000-8000-000000000003'),
  0, 'Ein gelöschtes Event nimmt seinen Beitrag mit (on delete cascade)');

-- 22.11 Zwei Beiträge zu EINEM Event sind unmöglich — sonst stünde derselbe
-- Eintrag doppelt im Feed, sobald ein Trigger zweimal liefe.
select alike(
  pg_temp.try_as('c9c9c9c9-0000-0000-0000-0000000000b1',
    $$insert into public.posts (author_id, body, visibility, kind, ref_id)
      values ('c9c9c9c9-0000-0000-0000-0000000000b1', '', 'public', 'event',
              'c9e00001-0000-4000-8000-000000000001')$$),
  'DENIED:%', 'Ein zweiter Beitrag zu demselben Event wird abgelehnt');

-- 22.12 Die zwei Spalten müssen zusammenpassen.
select alike(
  pg_temp.try_as('c9c9c9c9-0000-0000-0000-0000000000b1',
    $$insert into public.posts (author_id, body, kind, ref_id)
      values ('c9c9c9c9-0000-0000-0000-0000000000b1', 'x', 'member',
              'c9e00001-0000-4000-8000-000000000001')$$),
  'DENIED:%', 'kind=member mit ref_id wird abgelehnt');

-- ── Die vier Umgehungen (codex, HIGH) ──────────────────────────────────────
-- 22.13 Ein Mitglied legt keinen Event-Beitrag an.
select alike(
  pg_temp.try_as('c9c9c9c9-0000-0000-0000-0000000000b3',
    $$insert into public.posts (author_id, body, visibility, kind, ref_id)
      values ('c9c9c9c9-0000-0000-0000-0000000000b3', '', 'public', 'event',
              'c9e00002-0000-4000-8000-000000000002')$$),
  'DENIED:%', 'Ein Mitglied kann keinen kind=event-Beitrag anlegen');

-- 22.14 Der HOST kann seinen eigenen Event-Beitrag nicht löschen — obwohl er
-- dessen Autor ist. Das ist der Kern des Befunds: `posts_write_own` hing allein
-- an der Autorschaft.
select is(
  pg_temp.count_as('c9c9c9c9-0000-0000-0000-0000000000b1',
    $$with weg as (
        delete from public.posts
         where ref_id = 'c9e00001-0000-4000-8000-000000000001' returning 1)
      select count(*)::int from weg$$),
  0, 'Der Host löscht seinen Event-Beitrag NICHT (die Policy lässt keine Zeile durch)');

-- 22.15 … und schreibt ihn auch nicht auf `member` um.
select is(
  pg_temp.count_as('c9c9c9c9-0000-0000-0000-0000000000b1',
    $$with u as (
        update public.posts set kind = 'member', ref_id = null
         where ref_id = 'c9e00001-0000-4000-8000-000000000001' returning 1)
      select count(*)::int from u$$),
  0, 'Der Host schreibt seinen Event-Beitrag nicht auf kind=member um');

-- 22.16 … und dreht die gespiegelte Sichtbarkeit nicht zurück.
select is(
  pg_temp.count_as('c9c9c9c9-0000-0000-0000-0000000000b1',
    $$with u as (
        update public.posts set visibility = 'public'
         where ref_id = 'c9e00001-0000-4000-8000-000000000001' returning 1)
      select count(*)::int from u$$),
  0, 'Der Host dreht die vom Trigger gesetzte Sichtbarkeit nicht zurück');

select is(
  (select visibility from public.posts where ref_id = 'c9e00001-0000-4000-8000-000000000001'),
  'members', '… die Zeile trägt danach unverändert members');

-- ── Sichtbarkeit des Event-Beitrags ────────────────────────────────────────
-- 22.17 Das Aktivierungs-Gate aus C3 greift auch auf den neuen Beiträgen.
select is(
  pg_temp.count_as('c9c9c9c9-0000-0000-0000-0000000000b4',
    $$select count(*)::int from public.posts where kind = 'event'$$),
  0, 'Eingeloggt, aber NICHT aktiviert: kein einziger Event-Beitrag');

-- 22.18 Ausgeloggt: der Beitrag eines members-Events kommt nicht zurück.
select is(
  pg_temp.count_as_anon(
    $$select count(*)::int from public.posts
       where ref_id = 'c9e00001-0000-4000-8000-000000000001'$$),
  0, 'Ausgeloggt ist der Beitrag eines members-Events unsichtbar');

-- 22.19 Die benannte Asymmetrie, in einem Paar gemessen: Rang 1 sieht das
-- EVENT, aber nicht seinen Feed-Beitrag. Die Richtung ist die ungefährliche
-- (strenger, nicht undichter) — unbenannt wäre sie ein Rätsel.
select is(
  pg_temp.count_as('c9c9c9c9-0000-0000-0000-0000000000b3',
    $$select count(*)::int from public.events
       where id = 'c9e00001-0000-4000-8000-000000000001'$$),
  1, 'Rang 1 sieht das members-EVENT …');

select is(
  pg_temp.count_as('c9c9c9c9-0000-0000-0000-0000000000b3',
    $$select count(*)::int from public.posts
       where ref_id = 'c9e00001-0000-4000-8000-000000000001'$$),
  0, '… aber NICHT seinen Feed-Beitrag (members-Posts erst ab Rang 4)');

-- 22.20 Die asymmetrische Kaskade, gepint statt nur beschrieben (opencode, LOW):
-- ein gelöschtes Host-Profil nimmt den BEITRAG mit, das EVENT bleibt.
insert into auth.users (id, aud, role, email) values
  ('c9c9c9c9-0000-0000-0000-0000000000b5', 'authenticated', 'authenticated', 'c9weg@test.fbc');
update public.profiles set tier = 'impact', activated_at = now()
 where id = 'c9c9c9c9-0000-0000-0000-0000000000b5';
insert into public.events (id, title, host_id, visibility, starts_at) values
  ('c9e00004-0000-4000-8000-000000000004', 'C9 Event eines verschwundenen Hosts',
   'c9c9c9c9-0000-0000-0000-0000000000b5', 'public', now() + interval '10 days');
delete from auth.users where id = 'c9c9c9c9-0000-0000-0000-0000000000b5';

select is(
  (select count(*)::int from public.posts where ref_id = 'c9e00004-0000-4000-8000-000000000004'),
  0, 'Host-Profil gelöscht: sein Event-Beitrag fällt über posts.author_id …');

select is(
  (select count(*)::int from public.events where id = 'c9e00004-0000-4000-8000-000000000004'),
  1, '… das Event bleibt (events.host_id ist on delete set null). Hingenommen, nicht übersehen');

-- 22.21 Der Host haengt seinem Event-Beitrag KEINE Bilder an.
--
-- Befund aus dem Diff-Review (opencode, MEDIUM). Das Engerfassen von
-- `posts_write_own` reichte dafuer NICHT: `post_media_insert_own` ist eine
-- eigene Policy und haengt allein an der Autorschaft — und der Host ist der
-- Autor. Die Zusage „ein Event-Beitrag traegt niemals post_media" stand in der
-- Migration, bevor sie wahr war.
select alike(
  pg_temp.try_as('c9c9c9c9-0000-0000-0000-0000000000b1',
    $$insert into public.post_media (post_id, storage_path, sort, width, height)
      select id, 'c9c9c9c9-0000-0000-0000-0000000000b1/x.webp', 0, 100, 100
        from public.posts where ref_id = 'c9e00001-0000-4000-8000-000000000001'$$),
  'DENIED:%', 'Der Host haengt seinem Event-Beitrag kein Bild an');

-- Gegenprobe: an seinem eigenen MITGLIEDS-Beitrag geht es weiterhin. Ohne sie
-- waere die Behauptung darueber auch dann gruen, wenn die Policy alles ablehnt.
insert into public.posts (id, author_id, body, visibility, kind)
values ('c9000010-0000-4000-8000-000000000010',
        'c9c9c9c9-0000-0000-0000-0000000000b1', 'Mit Bild', 'public', 'member');

select is(
  pg_temp.try_as('c9c9c9c9-0000-0000-0000-0000000000b1',
    $$insert into public.post_media (post_id, storage_path, sort, width, height)
      values ('c9000010-0000-4000-8000-000000000010',
              'c9c9c9c9-0000-0000-0000-0000000000b1/y.webp', 0, 100, 100)$$),
  'OK', '… an seinem eigenen Mitglieds-Beitrag aber schon');

-- 22.22 Ausgeloggt: ein OEFFENTLICHES Event ist im Feed sichtbar — Beitrag UND
-- Event. 22.18 deckt nur den members-Fall ab; ohne diesen hier waere unbemerkt,
-- ob die Einbettung fuer anon ueberhaupt etwas liefert (Frage aus dem
-- Diff-Review, opencode).
insert into public.events (id, title, host_id, visibility, starts_at) values
  ('c9e00005-0000-4000-8000-000000000005', 'C9 Oeffentlich fuer anon',
   'c9c9c9c9-0000-0000-0000-0000000000b1', 'public', now() + interval '11 days');

select is(
  pg_temp.count_as_anon(
    $$select count(*)::int from public.posts
       where ref_id = 'c9e00005-0000-4000-8000-000000000005'$$),
  1, 'Ausgeloggt ist der Beitrag eines public-Events sichtbar …');

select is(
  pg_temp.count_as_anon(
    $$select count(*)::int from public.events
       where id = 'c9e00005-0000-4000-8000-000000000005'$$),
  1, '… und das Event dazu, sonst haette die Karte nichts zu joinen');

-- 22.23 Rechte an der Trigger-Funktion. Wie in §21: ohne `revoke` wäre eine
-- neue Funktion für PUBLIC ausführbar.
select is(
  has_function_privilege('anon', 'public.event_feed_post_sync()', 'execute'),
  false, 'event_feed_post_sync: anon darf sie nicht aufrufen');

select is(
  has_function_privilege('authenticated', 'public.event_feed_post_sync()', 'execute'),
  false, '… authenticated auch nicht — sie ist Innerei der Trigger');

-- ── 23. Anschrift: dieselbe Freigabe wie E-Mail und Telefon (AGE-537, C6a) ──
-- Die Abnahme verlangt den Beleg ausdrücklich hier und nicht im UI: „Ohne
-- angenommene Kontaktanfrage liefert die Adresse nichts — per pgTAP belegt".
--
-- Kein neuer Sichtbarkeitsbegriff: die fünf Spalten liegen auf
-- `profile_contacts` und werden von `contacts_select_self_or_released`
-- gedeckt. Der Test prüft deshalb nicht die Policy neu, sondern DASS die
-- Anschrift unter ihr liegt — und zwar auch, wenn nur die Adressspalten
-- ausgewählt werden.

-- 23.1 Der EIGENE Schreibweg. `3333` (discover) hat noch keine Kontaktzeile,
-- der erste Upsert geht also durch den INSERT-Zweig.
select is(pg_temp.try_as('33333333-3333-3333-3333-333333333333',
  $q$insert into public.profile_contacts
       (profile_id, email, phone, street, postal_code, city, state, country)
     values ('33333333-3333-3333-3333-333333333333', 'discover@test.fbc', '+49 711 1',
             'Hauptstr. 1', '70173', 'Stuttgart', 'Baden-Württemberg', 'DE')
     on conflict (profile_id) do update set
       street = excluded.street, postal_code = excluded.postal_code,
       city = excluded.city, state = excluded.state, country = excluded.country$q$),
  'OK', 'Ein Mitglied legt seine eigene Kontaktzeile samt Anschrift an');

select is((select count(*)::int from public.profile_contacts
            where profile_id = '33333333-3333-3333-3333-333333333333'),
  1, '… genau eine Zeile');

select is((select street from public.profile_contacts
            where profile_id = '33333333-3333-3333-3333-333333333333'),
  'Hauptstr. 1', '… mit der eingetragenen Straße');

-- 23.2 DERSELBE Aufruf ein zweites Mal. Erst hier läuft `on conflict do update`
-- — und der Zweig braucht LESErecht auf die Konfliktzeile, das der
-- Eigentümer-Zweig der SELECT-Policy hält. Ein einmaliger Upsert prüft nur
-- INSERT und belegt gerade nicht, was der Editor tatsächlich tut (Fremd-Review
-- zum Change, codex, MEDIUM).
select is(pg_temp.try_as('33333333-3333-3333-3333-333333333333',
  $q$insert into public.profile_contacts
       (profile_id, email, phone, street, postal_code, city, state, country)
     values ('33333333-3333-3333-3333-333333333333', 'discover@test.fbc', '+49 711 1',
             'Hauptstr. 1', '71634', 'Ludwigsburg', 'Baden-Württemberg', 'DE')
     on conflict (profile_id) do update set
       street = excluded.street, postal_code = excluded.postal_code,
       city = excluded.city, state = excluded.state, country = excluded.country$q$),
  'OK', 'Derselbe Weg ein zweites Mal — jetzt durch ON CONFLICT DO UPDATE');

select is((select count(*)::int from public.profile_contacts
            where profile_id = '33333333-3333-3333-3333-333333333333'),
  1, '… weiterhin genau eine Zeile, keine zweite angelegt');

select is((select city from public.profile_contacts
            where profile_id = '33333333-3333-3333-3333-333333333333'),
  'Ludwigsburg', '… und der geänderte Wert steht drin');

-- 23.2b Die Abwehr auf DEMSELBEN Weg. Der Befund aus dem Review auf dem Diff
-- (codex, MEDIUM): geprüft war nur der Umweg über `admin_update_profile`, nicht
-- der neue direkte. Ein Schreibweg, dessen Grenze niemand misst, ist eine
-- Behauptung — und dieser hier ist der erste, den ein MITGLIED benutzt.
select alike(pg_temp.try_as('33333333-3333-3333-3333-333333333333',
  $q$insert into public.profile_contacts (profile_id, street)
     values ('66666666-6666-6666-6666-666666666666', 'Fremdstr. 9')
     on conflict (profile_id) do update set street = excluded.street$q$),
  'DENIED:%', 'Ein Mitglied schreibt keine FREMDE Kontaktzeile');

select is((select street from public.profile_contacts
            where profile_id = '66666666-6666-6666-6666-666666666666'),
  null, '… und die fremde Zeile ist unverändert');

-- Ein FRISCHES unbestätigtes Konto, eigens für diesen Fall. Das Sondenkonto
-- 'dddd…' aus den Fixtures taugt hier nicht mehr: die Aktivierungstests in §14
-- lösen es unterwegs ein, es ist an dieser Stelle der Datei längst bestätigt.
-- Der erste Anlauf prüfte genau das und war grün, ohne die Grenze zu berühren.
insert into auth.users (id, aud, role, email) values
  ('c6a0c6a0-0000-0000-0000-00000000000f', 'authenticated', 'authenticated', 'unbestaetigt-c6a@test.fbc');
update public.profiles
   set activated_at = null, created_at = now() - interval '90 days'
 where id = 'c6a0c6a0-0000-0000-0000-00000000000f';
insert into public.profile_contacts (profile_id, email) values
  ('c6a0c6a0-0000-0000-0000-00000000000f', 'unbestaetigt-c6a@test.fbc');

-- GEZÄHLT, nicht auf eine Ausnahme geprüft: ein UPDATE, dessen Zeile die
-- USING-Klausel wegfiltert, trifft NULL Zeilen und wirft nichts. `try_as`
-- meldete hier folgerichtig 'OK' — die erste Fassung dieses Tests hätte einen
-- funktionierenden Schutz als Lücke gemeldet. Dieselbe Falle wie bei
-- storage.objects in AGE-438.
select is(pg_temp.count_as('c6a0c6a0-0000-0000-0000-00000000000f',
  $q$with u as (
       update public.profile_contacts set street = 'Eigenstr. 1'
        where profile_id = 'c6a0c6a0-0000-0000-0000-00000000000f'
        returning 1)
     select count(*)::int from u$q$),
  0, 'Ein UNBESTÄTIGTES Konto schreibt nicht einmal die eigene Anschrift — null Zeilen');

select is((select street from public.profile_contacts
            where profile_id = 'c6a0c6a0-0000-0000-0000-00000000000f'),
  null, '… auch hier ist nichts geschrieben');

-- 23.3 Die Freigabe. `6666` (impact) trägt eine Anschrift; `4444` hat eine
-- ANGENOMMENE Anfrage mit ihm (Zeile 335), `3333` nur eine offene, `1111` gar
-- keine.
update public.profile_contacts
   set street = 'Impactweg 7', postal_code = '10115', city = 'Berlin',
       state = 'Berlin', country = 'DE'
 where profile_id = '66666666-6666-6666-6666-666666666666';

select is(pg_temp.count_as('44444444-4444-4444-4444-444444444444',
  $q$select count(*)::int from public.profile_contacts
      where profile_id = '66666666-6666-6666-6666-666666666666' and street is not null$q$),
  1, 'Nach angenommener Anfrage ist die Anschrift lesbar');

select is(pg_temp.count_as('33333333-3333-3333-3333-333333333333',
  $q$select count(*)::int from public.profile_contacts
      where profile_id = '66666666-6666-6666-6666-666666666666' and street is not null$q$),
  0, '… bei offener Anfrage liefert sie NICHTS');

select is(pg_temp.count_as('11111111-1111-1111-1111-111111111111',
  $q$select count(*)::int from public.profile_contacts
      where profile_id = '66666666-6666-6666-6666-666666666666' and street is not null$q$),
  0, '… und ohne jede Anfrage erst recht nicht');

-- Die Spaltenauswahl ist kein Umweg: die Policy wirkt auf die ZEILE. Ein
-- `select street` statt `select *` bekommt deshalb ebenso null Zeilen — das
-- ist die Form, die eine Oberfläche tatsächlich schickt.
select is(pg_temp.count_as('11111111-1111-1111-1111-111111111111',
  $q$select count(*)::int from (
       select street, postal_code, city from public.profile_contacts
        where profile_id = '66666666-6666-6666-6666-666666666666') t$q$),
  0, '… auch wenn nur die Adressspalten ausgewählt werden');

-- 23.4 Der Admin-Weg. Ohne ihn bräche C10 genau dort ab, wo nachgearbeitet
-- wird: an importierten Datensätzen. Ziel ist das UNBESTÄTIGTE Profil aus §18.
create temp table pg_temp_audit_vorher as
  select count(*)::int as n from public.admin_audit;

select is(pg_temp.try_as('aaaaaaaa-0000-0000-0000-000000000001',
  $q$select public.admin_update_profile(
      'c6c6c6c6-0000-0000-0000-0000000000b1',
      '{"street":"Altstr. 3","postal_code":"80331","city":"München",
        "state":"Bayern","country":"DE"}'::jsonb)$q$),
  'OK', 'Ein Admin trägt eine Anschrift nach');

select is((select street || ' / ' || postal_code || ' ' || city || ' / ' || state || ' / ' || country
             from public.profile_contacts where profile_id = 'c6c6c6c6-0000-0000-0000-0000000000b1'),
  'Altstr. 3 / 80331 München / Bayern / DE',
  '… alle fünf Felder stehen in der Kontaktzeile');

-- Fehlend und leer bleiben zweierlei — die Zusage aus C6 gilt für die neuen
-- Felder genauso, sonst löschte jeder Teil-Patch die halbe Anschrift.
select is(pg_temp.try_as('aaaaaaaa-0000-0000-0000-000000000001',
  $q$select public.admin_update_profile('c6c6c6c6-0000-0000-0000-0000000000b1',
      '{"city":null}'::jsonb)$q$),
  'OK', 'Ein Patch mit JSON-null auf einem Adressfeld geht durch');

select is((select city from public.profile_contacts
            where profile_id = 'c6c6c6c6-0000-0000-0000-0000000000b1'),
  null, '… und leert genau dieses Feld');

select is((select street from public.profile_contacts
            where profile_id = 'c6c6c6c6-0000-0000-0000-0000000000b1'),
  'Altstr. 3', '… während das nicht geschickte Feld unverändert bleibt');

-- 23.5 Die Abwehr gilt auch für die neuen Felder. Ein Mitglied darf die eigene
-- Anschrift pflegen — die eines FREMDEN nicht, auch nicht über die RPC.
select alike(pg_temp.try_as('33333333-3333-3333-3333-333333333333',
  $q$select public.admin_update_profile('c6c6c6c6-0000-0000-0000-0000000000b1',
      '{"street":"Gekapert 1"}'::jsonb)$q$),
  'DENIED:%', 'Ein normales Mitglied prallt auch mit Adressfeldern ab');

select is((select street from public.profile_contacts
            where profile_id = 'c6c6c6c6-0000-0000-0000-0000000000b1'),
  'Altstr. 3', '… und hat nichts verändert');

-- 23.6 Der Lesepfad zählt keine Spalten auf (`to_jsonb(c)`), aber genau das ist
-- eine Behauptung, solange es niemand nachsieht.
select is(pg_temp.text_as('aaaaaaaa-0000-0000-0000-000000000001',
  $q$select public.admin_get_profile('c6c6c6c6-0000-0000-0000-0000000000b1')
       -> 'contact' ->> 'postal_code'$q$),
  '80331', 'admin_get_profile liefert die Adressfelder mit');

select is(
  (select count(*)::int from public.admin_audit) - (select n from pg_temp_audit_vorher),
  2, 'Beide erfolgreichen Admin-Aufrufe haben je eine Spur hinterlassen');

-- ── 24. member_settings.onboarded_at — der Onboarding-Merker (AGE-538) ───────
-- Der Merker liegt in member_settings und NICHT in profiles, weil
-- `profiles_select_self_or_discover` (`id = auth.uid() or has_level(3)`) ab
-- `discover` fremde VOLLZEILEN freigibt. Was hier geprüft wird, ist deshalb
-- nicht „ein Flag lässt sich setzen", sondern die Kapselung dahinter.
--
-- Die entscheidende Feinheit steht in 24.4/24.5: ein fremdes UPDATE wirft
-- NICHT. `member_settings_own` filtert die fremde Zeile über `USING` heraus,
-- PostgreSQL führt das Statement erfolgreich aus und ändert null Zeilen.
-- `42501` käme aus fehlenden RECHTEN — die hat `authenticated` hier aber.
-- Der Beleg ist deshalb der nachgelesene, unveränderte Fremdwert; ohne die
-- Nachlese belegte „läuft durch" gar nichts.

-- SQLSTATE statt SQLERRM: try_as_anon liefert nur den Meldungstext, und die
-- Zusage in 24.6 lautet ausdrücklich auf den Code 42501.
create function pg_temp.state_as_anon(q text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';
  begin
    execute q;
  exception when others then
    reset role;
    return SQLSTATE;
  end;
  reset role;
  return 'KEIN FEHLER';
end $$;

-- 24.1 Ausgangslage. Die Zeile für '1111…' entsteht in §12 (Theme); ohne diese
-- Zusicherung wäre jedes „ist gesetzt" unten auch dann grün, wenn schon vorher
-- ein Wert dort stünde.
select is(
  (select onboarded_at from public.member_settings
    where profile_id = '11111111-1111-1111-1111-111111111111'),
  null, 'Merker: eine bestehende Einstellungszeile trägt ihn zunächst nicht');

-- 24.2/24.3 Der Eigentümer schreibt. Ein fester Wert statt now(), damit 24.5
-- den Fremdwert exakt vergleichen kann.
select is(
  pg_temp.try_as('11111111-1111-1111-1111-111111111111',
    'update public.member_settings set onboarded_at = ''2026-01-01T00:00:00Z''
       where profile_id = ''11111111-1111-1111-1111-111111111111'''),
  'OK', 'Merker: das eigene Konto darf ihn setzen');

select is(
  (select onboarded_at from public.member_settings
    where profile_id = '11111111-1111-1111-1111-111111111111'),
  '2026-01-01T00:00:00Z'::timestamptz,
  '… und der Wert steht auch wirklich in der Zeile');

-- 24.4/24.5 Der fremde Schreibversuch. Erwartet wird OK mit null geänderten
-- Zeilen — nicht 42501.
select is(
  pg_temp.try_as('88888888-8888-8888-8888-888888888888',
    'update public.member_settings set onboarded_at = ''2030-01-01T00:00:00Z''
       where profile_id = ''11111111-1111-1111-1111-111111111111'''),
  'OK', 'Merker: das fremde UPDATE läuft fehlerfrei durch …');

select is(
  (select onboarded_at from public.member_settings
    where profile_id = '11111111-1111-1111-1111-111111111111'),
  '2026-01-01T00:00:00Z'::timestamptz,
  '… ändert die fremde Zeile aber nicht (RLS filtert sie heraus)');

-- 24.6 Erst hier ist 42501 richtig: `anon` hält auf member_settings gar kein
-- Recht, das Statement scheitert also vor jeder Policy.
select is(
  pg_temp.state_as_anon(
    'update public.member_settings set onboarded_at = now()
       where profile_id = ''11111111-1111-1111-1111-111111111111'''),
  '42501', 'Merker: ausgeloggt fehlt schon das Tabellenrecht (42501)');

-- 24.7-24.9 Der Schreibweg muss ein UPSERT sein. Die Einstellungszeile entsteht
-- bei der Registrierung NICHT: '2222…' hat keine. Ein UPDATE änderte dort null
-- Zeilen und meldete dabei keinen Fehler — der Merker wäre stumm nicht gesetzt.
select is(
  (select count(*)::int from public.member_settings
    where profile_id = '22222222-2222-2222-2222-222222222222'),
  0, 'Merker: das Sondenkonto hat vorher KEINE Einstellungszeile');

select is(
  pg_temp.try_as('22222222-2222-2222-2222-222222222222',
    'insert into public.member_settings (profile_id, onboarded_at)
       values (''22222222-2222-2222-2222-222222222222'', ''2026-01-02T00:00:00Z'')
       on conflict (profile_id) do update set onboarded_at = excluded.onboarded_at'),
  'OK', 'Merker: ein Konto ohne Einstellungszeile darf ihn per Upsert anlegen');

select is(
  (select onboarded_at from public.member_settings
    where profile_id = '22222222-2222-2222-2222-222222222222'),
  '2026-01-02T00:00:00Z'::timestamptz,
  '… und die Zeile existiert danach samt Merker');

select * from finish();
rollback;
