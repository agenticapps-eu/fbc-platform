-- Event-Vorlagen und Serientermine (AGE-630), die Serienänderung.
-- `supabase test db`. Aufgabe 6 aus
-- openspec/changes/events-vorlagen-und-serientermine/tasks.md.
--
-- ══ WAS HIER ZUGESAGT WIRD ══════════════════════════════════════════════════
-- D7: eine erneute Erzeugung aktualisiert Termine derselben Vorlage, die IN DER
-- ZUKUNFT liegen und KEINE ANMELDUNGEN tragen, auf die aktuellen Werte der
-- Vorlage. Termine mit Anmeldungen und alle vergangenen bleiben unangetastet.
--
-- Das ist die Erwartung des Hosts („ab jetzt eine Stunde später") ohne den
-- Preis, Mitgliedern unter der Anmeldung den Termin zu verschieben.
--
-- ══ DIE DATEN SIND RELATIV ZU `current_date` ════════════════════════════════
-- Feste Kalenderdaten waeren hier eine Zeitbombe: „vergangen" und „zukuenftig"
-- haengen an `now()`, und ein Test mit festen Daten aus 2026 waere im naechsten
-- Jahr still zur Tautologie geworden. Der Anker ist deshalb `current_date - 10`
-- mit dessen eigenem Wochentag; die vier Slots liegen dann auf −10, −3, +4 und
-- +11 Tagen — zwei vergangene, zwei zukuenftige, an jedem Tag des Jahres.
--
-- ══ ABSCHNITT 4 IST EINE FOLGE, KEINE ABSICHT ═══════════════════════════════
-- Ein verschobener, anmeldungsfreier Zukunftstermin wird von der erneuten
-- Erzeugung auf seinen Slot ZURUECKGEHOLT. Das folgt zwingend aus D7 („in der
-- Zukunft und ohne Anmeldungen") und widerspricht nicht der Zusage „ein
-- verschobener Termin kehrt nicht zurueck" — die verbietet einen ZWEITEN Termin
-- auf demselben Slot, nicht das Aktualisieren des vorhandenen. Es steht hier,
-- damit die Folge gemessen ist statt bloss abgeleitet.
--
-- ══ DIESE DATEI MUSS IN .github/workflows/ci.yml STEHEN ═════════════════════
-- `scripts/pgtap-dateiliste.test.ts` prüft die Liste in beide Richtungen.

begin;
select plan(8);

-- ── Fixtures ────────────────────────────────────────────────────────────────
insert into auth.users (id, aud, role, email) values
  ('c0000000-0000-0000-0000-000000000021', 'authenticated', 'authenticated', 'age630-aend-host@test.fbc'),
  ('c0000000-0000-0000-0000-000000000022', 'authenticated', 'authenticated', 'age630-aend-gast@test.fbc');

update public.profiles
   set activated_at = now()
 where id in ('c0000000-0000-0000-0000-000000000021',
              'c0000000-0000-0000-0000-000000000022');

insert into public.event_vorlagen
  (id, host_id, title, type, capacity, visibility, wiederholung, wochentag, ortszeit, zeitzone, dauer)
values
  ('11111111-0000-0000-0000-000000000021', 'c0000000-0000-0000-0000-000000000021',
   'Stammtisch', 'presence', 10, 'members', 'woechentlich',
   extract(isodow from current_date - 10)::smallint, '19:00', 'Europe/Berlin', interval '2 hours');

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

create function pg_temp.erzeuge() returns int
language sql as $$
  select pg_temp.zaehl_als('c0000000-0000-0000-0000-000000000021', $q$
    select count(*)::int from public.event_serie_erzeugen(
      '11111111-0000-0000-0000-000000000021', current_date - 10, p_anzahl => 4)
  $q$);
$$;

-- Vier Termine: current_date −10, −3, +4, +11.
select is(pg_temp.erzeuge(), 4, 'Ausgangslage: vier Termine, zwei vergangen, zwei zukünftig');

-- Anmeldung am ERSTEN zukünftigen Termin (current_date + 4).
insert into public.event_registrations (id, event_id, profile_id, status, checked_in)
select gen_random_uuid(), e.id, 'c0000000-0000-0000-0000-000000000022', 'registered', false
  from public.events e
 where e.vorlage_id = '11111111-0000-0000-0000-000000000021'
   and e.slot_datum = current_date + 4;

-- ── Die Änderung: 19:00 → 20:00, und ein neuer Titel ────────────────────────
update public.event_vorlagen
   set ortszeit = '20:00', title = 'Stammtisch (neu)'
 where id = '11111111-0000-0000-0000-000000000021';

select is(pg_temp.erzeuge(), 0,
  'die erneute Erzeugung legt keinen NEUEN Termin an — sie aktualisiert');

-- ── 1. Zukunft ohne Anmeldung wandert mit ───────────────────────────────────
select results_eq(
  $$select (starts_at at time zone 'Europe/Berlin')::time, title
      from public.events
     where vorlage_id = '11111111-0000-0000-0000-000000000021'
       and slot_datum = current_date + 11$$,
  $$values (time '20:00', 'Stammtisch (neu)')$$,
  'der zukünftige anmeldungsfreie Termin liegt danach auf 20:00 und trägt den neuen Titel');

-- Kein zweiter Termin derselben Woche daneben: die Aktualisierung geht auf die
-- vorhandene Zeile, sie legt keine neue an.
select is(
  (select count(*)::int from public.events
     where vorlage_id = '11111111-0000-0000-0000-000000000021'),
  4,
  'es stehen weiterhin genau vier Termine — kein 19:00-Termin neben dem 20:00-Termin');

-- ── 2. Zukunft MIT Anmeldung bleibt, wie sie ist ────────────────────────────
select results_eq(
  $$select (starts_at at time zone 'Europe/Berlin')::time, title
      from public.events
     where vorlage_id = '11111111-0000-0000-0000-000000000021'
       and slot_datum = current_date + 4$$,
  $$values (time '19:00', 'Stammtisch')$$,
  'der zukünftige Termin MIT Anmeldung bleibt auf 19:00 und behält seinen Titel');

select is(
  (select count(*)::int from public.event_registrations r
     join public.events e on e.id = r.event_id
    where e.vorlage_id = '11111111-0000-0000-0000-000000000021'),
  1,
  'seine Anmeldung ist erhalten');

-- ── 3. Vergangenes bleibt vergangen ─────────────────────────────────────────
select results_eq(
  $$select (starts_at at time zone 'Europe/Berlin')::time
      from public.events
     where vorlage_id = '11111111-0000-0000-0000-000000000021'
       and slot_datum in (current_date - 10, current_date - 3)
     order by slot_datum$$,
  $$values (time '19:00'), (time '19:00')$$,
  'beide vergangenen Termine liegen unverändert auf 19:00');

-- ── 4. Die Folge: ein verschobener Zukunftstermin wird zurückgeholt ─────────
-- Siehe Kopf. `ends_at` muss beim Verschieben mitwandern, sonst weist
-- `events_ends_after_start` schon den Umzug ab.
update public.events
   set starts_at = ((current_date + 12) + time '19:00') at time zone 'Europe/Berlin',
       ends_at   = ((current_date + 12) + time '21:00') at time zone 'Europe/Berlin'
 where vorlage_id = '11111111-0000-0000-0000-000000000021'
   and slot_datum = current_date + 11;

-- Als `do`-Block, nicht als Teilausdruck der Zusage: Postgres sichert innerhalb
-- eines Ausdrucks KEINE Auswertungsreihenfolge zu, und `erzeuge() * 0 + (…)`
-- mass in der ersten Fassung den Zustand VOR dem Aufruf.
do $$ begin perform pg_temp.erzeuge(); end $$;

select is(
  (select count(*)::int from public.events
    where vorlage_id = '11111111-0000-0000-0000-000000000021'
      and slot_datum = current_date + 11
      and starts_at = ((current_date + 11) + time '20:00') at time zone 'Europe/Berlin'),
  1,
  'ein verschobener anmeldungsfreier Zukunftstermin wird auf seinen Slot zurückgeholt — Folge aus D7, kein zweiter Termin');

select finish();
rollback;
