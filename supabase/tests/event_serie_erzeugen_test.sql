-- Event-Vorlagen und Serientermine (AGE-630), die Erzeugungs-RPC.
-- `supabase test db`. Aufgabe 5 aus
-- openspec/changes/events-vorlagen-und-serientermine/tasks.md.
--
-- ══ WAS HIER ZUGESAGT WIRD ══════════════════════════════════════════════════
-- `public.event_serie_erzeugen()` schreibt die Termine. Die Kalenderrechnung
-- steckt in `event_serie_slots()` und ist in `event_serie_regel_test.sql`
-- gemessen; hier geht es um das, was NUR beim Schreiben schiefgehen kann:
-- Obergrenze, Idempotenz, fremde Vorlagen, Anmeldungen.
--
-- ══ JEDE ABLEHNUNG HAT EINE POSITIVKONTROLLE ════════════════════════════════
-- Ohne sie belegte eine Ablehnung nur, dass irgendetwas kracht. Besonders bei
-- der Obergrenze: „52 geht, 53 nicht" ist die Zusage — „alles kracht" wäre
-- ebenfalls grün, wenn nur die Ablehnung geprüft würde.
--
-- ══ DIE TEUERSTE ZUSAGE IST 5.6/5.7 ═════════════════════════════════════════
-- `on conflict (vorlage_id, slot_datum) do nothing` MIT ZIEL. Ohne Spaltenliste
-- schluckte das Konstrukt auch eine Verletzung von `events_cover_path_key`, und
-- ein Cover-Konflikt sähe exakt aus wie legitime Idempotenz: der Slot fehlte
-- dauerhaft, und kein Test könnte es unterscheiden (D6).
--
-- ⚠ UND GENAU DAS BELEGT DIESE DATEI NOCH NICHT. Gemessen am 07.09. mit einer
-- Mutation: ersetzt man `on conflict (vorlage_id, slot_datum) do nothing` durch
-- das ziellose `on conflict do nothing`, bleiben alle 17 Zusagen hier GRÜN.
-- Vier andere Mutationen fallen (Obergrenze 52→53 in 3 Zusagen, `on conflict`
-- ganz entfernt, `into strict` entschärft in 1, Enddatum-Fenster 53→52 in 2) —
-- diese eine nicht.
--
-- Der Grund ist kein Testfehler, sondern die Reihenfolge des Plans: die RPC
-- schreibt bis Aufgabe 7 KEIN `cover_path`, und ohne Cover gibt es an `events`
-- keinen zweiten eindeutigen Index, gegen den das Ziel etwas ändern könnte.
-- Beide Fassungen sind heute verhaltensgleich. Die unterscheidende Zusage
-- gehört deshalb zu Aufgabe 7.3 (Cover-Pfad-Eindeutigkeit) und muss dort
-- geschrieben werden — sonst geht dieser Befund verloren.
--
-- ══ DIESE DATEI MUSS IN .github/workflows/ci.yml STEHEN ═════════════════════
-- `scripts/pgtap-dateiliste.test.ts` prüft die Liste in beide Richtungen.

begin;
select plan(17);

-- ── Fixtures ────────────────────────────────────────────────────────────────
insert into auth.users (id, aud, role, email) values
  ('c0000000-0000-0000-0000-000000000011', 'authenticated', 'authenticated', 'age630-rpc-host@test.fbc'),
  ('c0000000-0000-0000-0000-000000000012', 'authenticated', 'authenticated', 'age630-rpc-fremd@test.fbc'),
  ('c0000000-0000-0000-0000-000000000013', 'authenticated', 'authenticated', 'age630-rpc-gast@test.fbc');

update public.profiles
   set activated_at = now()
 where id in ('c0000000-0000-0000-0000-000000000011',
              'c0000000-0000-0000-0000-000000000012',
              'c0000000-0000-0000-0000-000000000013');

-- Wöchentlich, Dienstag 19:00 — dieselbe Regel wie im Regel-Test.
insert into public.event_vorlagen
  (id, host_id, title, type, capacity, visibility, wiederholung, wochentag, ortszeit, zeitzone, dauer)
values
  ('11111111-0000-0000-0000-000000000011', 'c0000000-0000-0000-0000-000000000011',
   'Stammtisch', 'presence', 10, 'members', 'woechentlich', 2, '19:00', 'Europe/Berlin', interval '2 hours'),
  ('11111111-0000-0000-0000-000000000012', 'c0000000-0000-0000-0000-000000000011',
   'Ohne Regel', 'presence', 10, 'members', null, null, '19:00', 'Europe/Berlin', null);

create function pg_temp.als(uid uuid, q text) returns text
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    execute q;
  exception when others then
    reset role;
    perform set_config('request.jwt.claims', '', true);
    return 'FEHLER:' || SQLSTATE;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return 'OK';
end $$;

create function pg_temp.zaehl_als(uid uuid, q text) returns int
language plpgsql as $$
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

-- ── 1. Anzahl oder Enddatum — genau eines von beidem ────────────────────────
select alike(
  pg_temp.als('c0000000-0000-0000-0000-000000000011', $$
    select * from public.event_serie_erzeugen(
      '11111111-0000-0000-0000-000000000011', '2026-09-01')
  $$),
  'FEHLER:22023',
  'ohne Anzahl und ohne Enddatum wird der Aufruf abgewiesen — sonst wäre eine wöchentliche Regel unendlich');

select alike(
  pg_temp.als('c0000000-0000-0000-0000-000000000011', $$
    select * from public.event_serie_erzeugen(
      '11111111-0000-0000-0000-000000000011', '2026-09-01',
      p_anzahl => 4, p_bis_datum => '2026-09-22')
  $$),
  'FEHLER:22023',
  'Anzahl UND Enddatum zugleich wird abgewiesen — die Spec sagt entweder/oder');

-- ── 2. Die Obergrenze, an der Kandidatenliste vor dem Einfügen ──────────────
select alike(
  pg_temp.als('c0000000-0000-0000-0000-000000000011', $$
    select * from public.event_serie_erzeugen(
      '11111111-0000-0000-0000-000000000011', '2026-09-01', p_anzahl => 53)
  $$),
  'FEHLER:22023',
  'eine Anzahl von 53 wird abgewiesen');

select is(
  (select count(*)::int from public.events
     where vorlage_id = '11111111-0000-0000-0000-000000000011'),
  0,
  'nach der abgewiesenen 53 existiert KEIN Termin — auch kein Teilergebnis von 52');

-- Enddatum jenseits des 52. Vorkommnisses. Ab 01.09.2026 liegt der 52.
-- Dienstag auf dem 24.08.2027, der 53. auf dem 31.08.2027.
select alike(
  pg_temp.als('c0000000-0000-0000-0000-000000000011', $$
    select * from public.event_serie_erzeugen(
      '11111111-0000-0000-0000-000000000011', '2026-09-01', p_bis_datum => '2027-08-31')
  $$),
  'FEHLER:22023',
  'ein Enddatum, das mehr als 52 Vorkommnisse einschliesst, wird abgewiesen');

-- Positivkontrolle: genau 52 geht durch. Ohne sie belegte die Zeile darüber
-- nur, dass die Enddatum-Form überhaupt kracht.
select is(
  pg_temp.zaehl_als('c0000000-0000-0000-0000-000000000011', $$
    select count(*)::int from public.event_serie_erzeugen(
      '11111111-0000-0000-0000-000000000011', '2026-09-01', p_bis_datum => '2027-08-24')
  $$),
  52,
  'ein Enddatum auf genau dem 52. Vorkommnis geht durch und liefert 52 Termine');

delete from public.events where vorlage_id = '11111111-0000-0000-0000-000000000011';

-- ── 3. Die regellose Vorlage ────────────────────────────────────────────────
select alike(
  pg_temp.als('c0000000-0000-0000-0000-000000000011', $$
    select * from public.event_serie_erzeugen(
      '11111111-0000-0000-0000-000000000012', '2026-09-01', p_anzahl => 4)
  $$),
  'FEHLER:22023',
  'eine regellose Vorlage mit einer Anzahl wird abgewiesen — ohne Regel ist undefiniert, was vervielfältigt würde');

select is(
  pg_temp.zaehl_als('c0000000-0000-0000-0000-000000000011', $$
    select count(*)::int from public.event_serie_erzeugen(
      '11111111-0000-0000-0000-000000000012', '2026-09-01')
  $$),
  1,
  'dieselbe Vorlage mit einem EINZELNEN DATUM erzeugt genau einen Termin');

-- ── 4. Eine fremde Vorlage ist unerreichbar ─────────────────────────────────
-- Die RPC ist SECURITY INVOKER: die RLS der Vorlagentabelle liefert dem
-- Fremden keine Zeile, und `select into strict` macht daraus P0002.
select alike(
  pg_temp.als('c0000000-0000-0000-0000-000000000012', $$
    select * from public.event_serie_erzeugen(
      '11111111-0000-0000-0000-000000000011', '2026-09-01', p_anzahl => 4)
  $$),
  'FEHLER:P0002',
  'ein fremder Host erzeugt aus meiner Vorlage nichts');

select is(
  (select count(*)::int from public.events
     where vorlage_id = '11111111-0000-0000-0000-000000000011'),
  0,
  'und es entsteht dabei kein einziger Termin');

-- ── 5. Der gewöhnliche Fall, und was er NICHT anlegt ────────────────────────
select is(
  pg_temp.zaehl_als('c0000000-0000-0000-0000-000000000011', $$
    select count(*)::int from public.event_serie_erzeugen(
      '11111111-0000-0000-0000-000000000011', '2026-09-01', p_anzahl => 4)
  $$),
  4,
  'der eigene Host erzeugt vier Termine — Positivkontrolle zu allen Ablehnungen oben');

select results_eq(
  $$select slot_datum from public.events
     where vorlage_id = '11111111-0000-0000-0000-000000000011' order by slot_datum$$,
  $$values (date '2026-09-01'), (date '2026-09-08'),
           (date '2026-09-15'), (date '2026-09-22')$$,
  'die Regel greift durch bis in die geschriebenen Zeilen');

select is(
  (select count(*)::int from public.event_registrations r
     join public.events e on e.id = r.event_id
    where e.vorlage_id = '11111111-0000-0000-0000-000000000011'),
  0,
  'das Erzeugen legt keine einzige Anmeldezeile an');

-- ── 6. Erneutes Erzeugen ist idempotent ─────────────────────────────────────
-- Eine Anmeldung am zweiten Termin, direkt als Eigentümer gesetzt: der Weg
-- über `register_for_event` ist hier nicht die Zusage, die geprüft wird.
insert into public.event_registrations (id, event_id, profile_id, status, checked_in)
select gen_random_uuid(), e.id, 'c0000000-0000-0000-0000-000000000013', 'registered', false
  from public.events e
 where e.vorlage_id = '11111111-0000-0000-0000-000000000011'
   and e.slot_datum = '2026-09-08';

select is(
  pg_temp.zaehl_als('c0000000-0000-0000-0000-000000000011', $$
    select count(*)::int from public.event_serie_erzeugen(
      '11111111-0000-0000-0000-000000000011', '2026-09-01', p_anzahl => 4)
  $$),
  0,
  'ein zweiter Lauf über dieselben Slots erzeugt nichts Neues');

select is(
  (select count(*)::int from public.event_registrations r
     join public.events e on e.id = r.event_id
    where e.vorlage_id = '11111111-0000-0000-0000-000000000011'
      and e.slot_datum = '2026-09-08'),
  1,
  'der Termin mit der Anmeldung ist unangetastet, die Anmeldung erhalten');

-- ── 7. Ein verschobener Termin kehrt nicht zurück ───────────────────────────
-- `slot_datum` bleibt beim Verschieben stehen — genau dafür gibt es die Spalte.
-- `ends_at` muss mitwandern: `events_ends_after_start` besteht seit jeher und
-- haette den Umzug sonst abgewiesen — ein Befund ueber den Bestand, nicht ueber
-- diese Aenderung.
update public.events
   set starts_at = '2026-09-17 17:00+00',
       ends_at   = '2026-09-17 19:00+00'
 where vorlage_id = '11111111-0000-0000-0000-000000000011'
   and slot_datum = '2026-09-15';

select is(
  pg_temp.zaehl_als('c0000000-0000-0000-0000-000000000011', $$
    select count(*)::int from public.event_serie_erzeugen(
      '11111111-0000-0000-0000-000000000011', '2026-09-01', p_anzahl => 4)
  $$),
  0,
  'der verschobene Termin belegt seinen Slot weiter — die Regel legt ihn nicht erneut an');

select is(
  (select count(*)::int from public.events
     where vorlage_id = '11111111-0000-0000-0000-000000000011'),
  4,
  'es stehen weiterhin vier Termine, kein fünfter neben dem verschobenen');

select finish();
rollback;
