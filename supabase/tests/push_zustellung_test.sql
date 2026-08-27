-- ════════════════════════════════════════════════════════════════════════════
-- AGE-641 — die Zustellung: Zuordnung, Auftraege, Quittung
-- ════════════════════════════════════════════════════════════════════════════
--
-- Change: openspec/changes/push-fundament/. Phase A, Schritte 4 und 5b.
--
-- ══ WAS HIER GEPRUEFT WIRD ═════════════════════════════════════════════════
-- Drei Dinge, die zusammen den Transport ausmachen:
--
--  1. WER ueberhaupt gepusht wird. `push_routing` ist Daten, kein `case` —
--     Abschnitt 4 des Issues ist mit Detlev noch nicht abgestimmt, und eine
--     Aenderung daran soll ein `update` sein und kein Deploy.
--  2. WAS der Transport zu sehen bekommt. Die RPC gibt eine FESTE Feldliste
--     zurueck und niemals die Nutzlast. Damit kann die Edge Function den
--     Freitext alter Kontaktanfrage-Zeilen gar nicht erst in die Hand nehmen.
--  3. DASS nichts doppelt oder gar nicht zugestellt wird. Der Schluessel
--     (notification_id, token_id) IST die Idempotenz.
--
-- ══ DIE FALLEN AUS DEN VORIGEN DATEIEN GELTEN WEITER ═══════════════════════
-- `alike()` statt `like()`. `try_as()` meldet jeden Fehler als DENIED, auch
-- einen Tippfehler — wo es auf die Wirkung ankommt, wird gezaehlt.
-- ════════════════════════════════════════════════════════════════════════════

begin;
select plan(18);

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

-- ── Fixtures ────────────────────────────────────────────────────────────────
insert into auth.users (id, aud, role, email) values
  ('e0000000-0000-0000-0000-00000000000a', 'authenticated', 'authenticated', 'pz-anna@test.fbc'),
  ('e0000000-0000-0000-0000-00000000000b', 'authenticated', 'authenticated', 'pz-bodo@test.fbc'),
  ('e0000000-0000-0000-0000-00000000000d', 'authenticated', 'authenticated', 'pz-dora@test.fbc');

update public.profiles set tier = 'impact', name = 'PZ Anna', activated_at = now()
 where id = 'e0000000-0000-0000-0000-00000000000a';
update public.profiles set tier = 'impact', name = 'PZ Bodo', activated_at = now()
 where id = 'e0000000-0000-0000-0000-00000000000b';
-- Dora ist bestaetigt und dann GESPERRT worden. Ihr Faden und ihre Token sind
-- aelter als die Sperre — genau der Fall, den eine Pruefung beim Schreiben der
-- Zeile nicht abdeckt und eine bei der Zustellung schon.
update public.profiles set tier = 'impact', name = 'PZ Dora',
       activated_at = now(), disabled_at = now()
 where id = 'e0000000-0000-0000-0000-00000000000d';

-- Bodo hat zwei Geraete, Dora eins.
insert into public.push_tokens (profile_id, token, plattform) values
  ('e0000000-0000-0000-0000-00000000000b', 'pz-bodo-telefon', 'ios'),
  ('e0000000-0000-0000-0000-00000000000b', 'pz-bodo-tablet',  'android'),
  ('e0000000-0000-0000-0000-00000000000d', 'pz-dora-telefon', 'ios');

-- ── 1. Die Zuordnung ist Daten und gehoert keinem Client ────────────────────

select is(
  (select push from public.push_routing where type = 'message'),
  true, 'Nachrichten werden gepusht — der Kernfall');

select is(
  (select push from public.push_routing where type = 'post_created'),
  false, 'ein neuer Beitrag wird nicht gepusht: bei siebzig Mitgliedern ist das Laerm');

select is(
  (select push from public.push_routing where type = 'release_note'),
  false, 'die Release-Note wird nicht gepusht — der eine Typ ohne Abschalter');

select is(
  (select count(*)::int from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'push_routing'
      and grantee in ('anon', 'authenticated')),
  0, 'keine Client-Rolle haelt ein Recht auf push_routing');

select alike(
  pg_temp.try_as('e0000000-0000-0000-0000-00000000000a',
    $$select 1 from public.push_auftraege_holen(
        '00000000-0000-0000-0000-000000000000'::uuid)$$),
  'DENIED:%', 'keine Client-Rolle kann Zustellauftraege holen');

-- ── 2. Auftraege entstehen je Geraet ────────────────────────────────────────

insert into public.notifications (id, profile_id, type, payload) values
  ('f0000000-0000-0000-0000-000000000001',
   'e0000000-0000-0000-0000-00000000000b', 'message',
   jsonb_build_object('thread_id', 't-1', 'sender_name', 'PZ Anna'));

select is(
  (select count(*)::int from public.push_auftraege_holen(
     'f0000000-0000-0000-0000-000000000001')),
  2, 'beide Geraete des Empfaengers bekommen einen Auftrag');

-- Der Kern der Idempotenz: derselbe Aufruf ein zweites Mal liefert NICHTS.
-- Ohne diese Zusage schickt ein Betriebs-Replay des Webhooks alles doppelt.
select is(
  (select count(*)::int from public.push_auftraege_holen(
     'f0000000-0000-0000-0000-000000000001')),
  0, 'ein zweiter Lauf ueber dieselbe Zeile liefert keinen Auftrag mehr');

-- ── 3. Was der Transport NICHT zu sehen bekommt ─────────────────────────────
-- Die alten contact_request-Zeilen tragen Mitglieder-Freitext. Die RPC gibt
-- eine feste Feldliste zurueck; die Nutzlast verlaesst die Datenbank nicht.

insert into public.notifications (id, profile_id, type, payload) values
  ('f0000000-0000-0000-0000-000000000002',
   'e0000000-0000-0000-0000-00000000000b', 'contact_request',
   jsonb_build_object('request_id', 'r-1', 'from_name', 'PZ Anna',
                      'message', 'Streng vertraulicher Altbestand'));

-- EIN Aufruf, zwei Zusagen darauf. Zweimal zu rufen ginge nicht: der zweite
-- Lauf liefert nichts mehr, und eine Zusage auf ein leeres Ergebnis waere von
-- einer kaputten RPC nicht zu unterscheiden.
create temp table pz_auftraege on commit drop as
  select * from public.push_auftraege_holen('f0000000-0000-0000-0000-000000000002');

select is(
  (select count(*)::int from pz_auftraege a
    where a::text like '%Streng vertraulicher Altbestand%'),
  0, 'der Freitext einer ALTEN Zeile verlaesst die Datenbank nicht');

-- Die Positivkontrolle dazu, und sie ist hier unverzichtbar: „kein Freitext"
-- waere sonst auch von einer RPC erfuellt, die gar nichts zurueckgibt.
select is(
  (select count(*)::int from pz_auftraege),
  2, 'Positivkontrolle: es kamen sehr wohl zwei Auftraege zurueck');

-- ── 4. Wer gar nichts bekommt ───────────────────────────────────────────────

insert into public.notifications (id, profile_id, type, payload) values
  ('f0000000-0000-0000-0000-000000000003',
   'e0000000-0000-0000-0000-00000000000b', 'post_created',
   jsonb_build_object('post_id', 'p-1'));

select is(
  (select count(*)::int from public.push_auftraege_holen(
     'f0000000-0000-0000-0000-000000000003')),
  0, 'ein Typ mit push = false erzeugt keinen Auftrag');

insert into public.notifications (id, profile_id, type, payload) values
  ('f0000000-0000-0000-0000-000000000004',
   'e0000000-0000-0000-0000-00000000000b', 'gibt_es_nicht',
   '{}'::jsonb);

-- Eine fehlende Zeile ist KEINE Erlaubnis. Ein neuer Typ soll nicht dadurch
-- auf den Geraeten landen, dass niemand an ihn gedacht hat.
select is(
  (select count(*)::int from public.push_auftraege_holen(
     'f0000000-0000-0000-0000-000000000004')),
  0, 'ein Typ ohne Zeile in der Zuordnung erzeugt keinen Auftrag');

insert into public.notifications (id, profile_id, type, payload) values
  ('f0000000-0000-0000-0000-000000000005',
   'e0000000-0000-0000-0000-00000000000d', 'message',
   jsonb_build_object('thread_id', 't-2', 'sender_name', 'PZ Anna'));

select is(
  (select count(*)::int from public.push_auftraege_holen(
     'f0000000-0000-0000-0000-000000000005')),
  0, 'ein gesperrtes Konto bekommt nichts, obwohl sein Token dasteht');

update public.member_settings set notify_app_message = false
 where profile_id = 'e0000000-0000-0000-0000-00000000000b';
insert into public.member_settings (profile_id, notify_app_message)
select 'e0000000-0000-0000-0000-00000000000b', false
 where not exists (select 1 from public.member_settings
                    where profile_id = 'e0000000-0000-0000-0000-00000000000b');

insert into public.notifications (id, profile_id, type, payload) values
  ('f0000000-0000-0000-0000-000000000006',
   'e0000000-0000-0000-0000-00000000000b', 'message',
   jsonb_build_object('thread_id', 't-3', 'sender_name', 'PZ Anna'));

select is(
  (select count(*)::int from public.push_auftraege_holen(
     'f0000000-0000-0000-0000-000000000006')),
  0, 'derselbe Schalter wie in der Glocke haelt auch die Zustellung an');

-- ── 5. Die Quittung ─────────────────────────────────────────────────────────

select is(
  (select zustand from public.push_zustellungen
    where notification_id = 'f0000000-0000-0000-0000-000000000001'
      and token_id = (select id from public.push_tokens where token = 'pz-bodo-telefon')),
  'laeuft', 'ein geholter Auftrag steht auf laeuft, nicht mehr auf offen');

select public.push_zustellung_quittieren(
  'f0000000-0000-0000-0000-000000000001',
  (select id from public.push_tokens where token = 'pz-bodo-telefon'),
  'vorlaeufig', '503 vom Anbieter');

select is(
  (select versuche from public.push_zustellungen
    where notification_id = 'f0000000-0000-0000-0000-000000000001'
      and token_id = (select id from public.push_tokens where token = 'pz-bodo-telefon')),
  1, 'ein vorlaeufiger Fehler zaehlt den Versuch hoch statt aufzugeben');

select is(
  (select count(*)::int from public.push_tokens where token = 'pz-bodo-telefon'),
  1, 'und er laesst das Token stehen');

-- Dauerhaft abgelehnt heisst: das Geraet gibt es nicht mehr.
select public.push_zustellung_quittieren(
  'f0000000-0000-0000-0000-000000000001',
  (select id from public.push_tokens where token = 'pz-bodo-tablet'),
  'dauerhaft', 'Unregistered');

select is(
  (select count(*)::int from public.push_tokens where token = 'pz-bodo-tablet'),
  0, 'ein dauerhaft abgelehntes Token wird entfernt');

select is(
  (select count(*)::int from public.push_zustellungen
    where notification_id = 'f0000000-0000-0000-0000-000000000001'),
  1, 'und seine Zustellzeile verschwindet mit ihm');

select * from finish();
rollback;
