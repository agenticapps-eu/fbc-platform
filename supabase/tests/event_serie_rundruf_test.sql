-- Event-Vorlagen und Serientermine (AGE-630), Rundruf und Feed.
-- `supabase test db`. Aufgabe 8 aus
-- openspec/changes/events-vorlagen-und-serientermine/tasks.md.
--
-- ══ DER BEFUND, DEN DIESE DATEI EINRAHMT ════════════════════════════════════
-- An `events` haengen zwei `after insert … for each row`-Trigger:
-- `trg_event_feed_post` und `trg_hinweis_neues_event`. Letzterer ruft
-- `hinweis_rundruf('event_created', …)` — eine Hinweiszeile JE AKTIVIERTEM
-- MITGLIED ohne Opt-out, synchron in der auslösenden Transaktion, plus Push.
--
-- Eine Erzeugung von 52 Terminen schriebe damit 52 plattformweite Rundrufe in
-- EINER Transaktion. Die Spec-Zusage „ein erzeugter Termin verhält sich wie ein
-- einzeln angelegtes Event" ist hier die Falle selbst; die Obergrenze 52
-- begrenzt die Event-Zeilen, nicht die Fächerwirkung (D8, Befund opencode HOCH).
--
-- Entschieden: Rundruf für `vorlage_id`-Termine unterdrückt, ersetzt durch
-- GENAU EINEN je Erzeugung. Der Feed-Spiegel bleibt je Termin — Termine sind
-- listenrelevant. Das war vorher ererbt und ist jetzt eine Entscheidung.
--
-- ══ DER LOKALE STACK IST GESEEDET ═══════════════════════════════════════════
-- Ein Rundruf schreibt an ALLE aktivierten Mitglieder, also auch an
-- Seed-Konten. Jede Mengenaussage hier ist auf die Fixture-IDs eingeschränkt
-- und nie auf `count(*)` der Tabelle (dieselbe Falle wie in
-- `hinweistypen_test.sql`).
--
-- ══ DIESE DATEI MUSS IN .github/workflows/ci.yml STEHEN ═════════════════════
-- `scripts/pgtap-dateiliste.test.ts` prüft die Liste in beide Richtungen.

begin;
select plan(7);

-- ── Fixtures ────────────────────────────────────────────────────────────────
insert into auth.users (id, aud, role, email) values
  ('c0000000-0000-0000-0000-000000000041', 'authenticated', 'authenticated', 'age630-ruf-host@test.fbc'),
  ('c0000000-0000-0000-0000-000000000042', 'authenticated', 'authenticated', 'age630-ruf-a@test.fbc'),
  ('c0000000-0000-0000-0000-000000000043', 'authenticated', 'authenticated', 'age630-ruf-b@test.fbc'),
  ('c0000000-0000-0000-0000-000000000044', 'authenticated', 'authenticated', 'age630-ruf-stumm@test.fbc');

update public.profiles
   set activated_at = now()
 where id in ('c0000000-0000-0000-0000-000000000041',
              'c0000000-0000-0000-0000-000000000042',
              'c0000000-0000-0000-0000-000000000043',
              'c0000000-0000-0000-0000-000000000044');

-- Das abgemeldete Konto. Es ist der Wächter über eine Entscheidung, die man
-- der Migration sonst glauben müsste: der Serien-Hinweis behält den Typ
-- `event_created`, WEIL `hinweis_erwuenscht()` ein `case` ohne `else`-Zweig
-- benutzt und dessen Ergebnis durch `coalesce(…, true)` schickt. Ein NEUER
-- Typ lieferte dort `null` und damit `true` — der Hinweis ginge an jedes
-- Mitglied, auch an die, die Event-Hinweise abgeschaltet haben.
insert into public.member_settings (profile_id, notify_app_event)
values ('c0000000-0000-0000-0000-000000000044', false);

insert into public.event_vorlagen
  (id, host_id, title, type, capacity, visibility, wiederholung, wochentag, ortszeit, zeitzone)
values
  ('11111111-0000-0000-0000-000000000041', 'c0000000-0000-0000-0000-000000000041',
   'Wochenreihe', 'presence', 10, 'members', 'woechentlich', 2, '19:00', 'Europe/Berlin');

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

-- ── 1. Zweiundfünfzig Termine, ein Rundruf ──────────────────────────────────
select is(
  pg_temp.zaehl_als('c0000000-0000-0000-0000-000000000041', $$
    select count(*)::int from public.event_serie_erzeugen(
      '11111111-0000-0000-0000-000000000041', '2026-09-01', p_anzahl => 52)
  $$),
  52,
  'Ausgangslage: 52 Termine sind erzeugt');

select is(
  (select count(*)::int from public.notifications
    where profile_id in ('c0000000-0000-0000-0000-000000000042',
                         'c0000000-0000-0000-0000-000000000043')
      and type = 'event_created'),
  2,
  '52 Termine lösen genau EINEN Rundruf aus — je Empfänger eine Zeile, nicht 52');

-- Der Hinweis kündigt die REIHE an, nicht einen einzelnen Termin. Ohne diese
-- Zusage wäre „ein Rundruf" auch mit einem beliebig irreführenden Inhalt erfüllt.
select is(
  (select distinct payload->>'serie_anzahl' from public.notifications
    where profile_id = 'c0000000-0000-0000-0000-000000000042'
      and type = 'event_created'),
  '52',
  'der eine Hinweis nennt die Zahl der Termine der Reihe');

select is(
  (select count(*)::int from public.notifications
    where profile_id = 'c0000000-0000-0000-0000-000000000044'),
  0,
  'das abgemeldete Konto bekommt auch den SERIEN-Hinweis nicht — der Typ blieb event_created, damit notify_app_event greift');

-- ── 2. Der Feed bleibt je Termin ────────────────────────────────────────────
-- Termine sind listenrelevant. Das ist die Gegenrichtung zur Unterdrückung
-- oben: wäre der Feed mit unterdrückt worden, verschwände die Reihe aus jeder
-- Liste.
select is(
  (select count(*)::int from public.posts p
     join public.events e on e.id = p.ref_id
    where p.kind = 'event'
      and e.vorlage_id = '11111111-0000-0000-0000-000000000041'),
  52,
  'dieselbe Erzeugung schreibt 52 Feed-Beiträge — einen je Termin');

-- ── 3. Positivkontrolle gegen eine zu breite Unterdrückung ──────────────────
-- Ohne sie wäre auch „gar kein Rundruf mehr, für niemanden" grün.
select is(
  pg_temp.zaehl_als('c0000000-0000-0000-0000-000000000041', $$
    with neu as (
      insert into public.events (title, type, starts_at, host_id, visibility)
      values ('Einzelnes Event', 'presence', now() + interval '30 days',
              'c0000000-0000-0000-0000-000000000041', 'members')
      returning 1)
    select count(*)::int from neu
  $$),
  1,
  'ein einzeln angelegtes Event entsteht');

select is(
  (select count(*)::int from public.notifications
    where profile_id in ('c0000000-0000-0000-0000-000000000042',
                         'c0000000-0000-0000-0000-000000000043')
      and type = 'event_created'),
  4,
  '… und löst wie bisher genau einen Rundruf aus — zwei Zeilen mehr, nicht null');

select finish();
rollback;
