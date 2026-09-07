-- Event-Vorlagen und Serientermine (AGE-630), Cover je Termin.
-- `supabase test db`. Aufgabe 7 aus
-- openspec/changes/events-vorlagen-und-serientermine/tasks.md.
--
-- ══ WAS HIER ZUGESAGT WIRD ══════════════════════════════════════════════════
-- Jeder erzeugte Termin zeigt auf eine EIGENE Kopie der Bilddatei. Zwei Termine
-- tragen niemals denselben Cover-Pfad — `events_cover_path_key` ist eine
-- Sicherheitszusage aus dem AGE-531-Review und fällt nicht.
--
-- ══ DIE ARBEITSTEILUNG, DIE DIE PLAN-REVIEW ERZWUNGEN HAT ═══════════════════
-- Eine SQL-Funktion kann die Bild*datei* nicht kopieren — die Bytes liegen im
-- Storage-Dienst, ein `insert` in `storage.objects` kopiert nichts. Deshalb
-- kopiert der CLIENT (`storage.copy()` je Termin) und die RPC nimmt die
-- fertigen Pfade entgegen (D5b). Sie prüft, was sie prüfen kann: Anzahl,
-- Eindeutigkeit, Präfix.
--
-- Der UUID-Teil der Zusage („Namen unvorhersagbar") liegt beim Client und ist
-- hier nicht messbar — die RPC bekommt fertige Zeichenketten. Er gehört zur
-- Oberfläche (Aufgabe 9) und steht dort.
--
-- ══ ABSCHNITT 4 SCHLIESST EINEN OFFENEN BEFUND AUS GRUPPE 5 ═════════════════
-- `event_serie_erzeugen_test.sql` konnte nicht belegen, dass
-- `on conflict (vorlage_id, slot_datum) do nothing` das ZIEL trägt: ohne Cover
-- gab es an `events` keinen zweiten eindeutigen Index, und die zielLOSE Fassung
-- war verhaltensgleich. Mit Cover-Pfaden gibt es ihn. Ein Duplikat MUSS hier
-- laut krachen; schluckte es das ziellose `on conflict`, fehlte der Slot
-- dauerhaft und niemand erführe warum (D6).
--
-- ══ DIESE DATEI MUSS IN .github/workflows/ci.yml STEHEN ═════════════════════
-- `scripts/pgtap-dateiliste.test.ts` prüft die Liste in beide Richtungen.

begin;
select plan(9);

-- ── Fixtures ────────────────────────────────────────────────────────────────
insert into auth.users (id, aud, role, email) values
  ('c0000000-0000-0000-0000-000000000031', 'authenticated', 'authenticated', 'age630-cover-host@test.fbc');

update public.profiles set activated_at = now()
 where id = 'c0000000-0000-0000-0000-000000000031';

insert into public.event_vorlagen
  (id, host_id, title, type, capacity, visibility, wiederholung, wochentag,
   ortszeit, zeitzone, cover_path)
values
  ('11111111-0000-0000-0000-000000000031', 'c0000000-0000-0000-0000-000000000031',
   'Mit Cover', 'presence', 10, 'members', 'woechentlich', 2, '19:00', 'Europe/Berlin',
   'c0000000-0000-0000-0000-000000000031/vorlage.webp'),
  ('11111111-0000-0000-0000-000000000032', 'c0000000-0000-0000-0000-000000000031',
   'Ohne Cover', 'presence', 10, 'members', 'woechentlich', 2, '19:00', 'Europe/Berlin', null);

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

-- ── 1. Vier Termine, vier Cover-Dateien ─────────────────────────────────────
select is(
  pg_temp.zaehl_als('c0000000-0000-0000-0000-000000000031', $$
    select count(*)::int from public.event_serie_erzeugen(
      '11111111-0000-0000-0000-000000000031', '2026-09-01', p_anzahl => 4,
      p_cover_pfade => array[
        'c0000000-0000-0000-0000-000000000031/a1b2c3d4-0000-4000-8000-000000000001.webp',
        'c0000000-0000-0000-0000-000000000031/a1b2c3d4-0000-4000-8000-000000000002.webp',
        'c0000000-0000-0000-0000-000000000031/a1b2c3d4-0000-4000-8000-000000000003.webp',
        'c0000000-0000-0000-0000-000000000031/a1b2c3d4-0000-4000-8000-000000000004.webp'])
  $$),
  4,
  'vier Termine entstehen mit vier übergebenen Cover-Pfaden');

select is(
  (select count(distinct cover_path)::int from public.events
    where vorlage_id = '11111111-0000-0000-0000-000000000031'),
  4,
  'die vier Termine tragen vier VERSCHIEDENE Cover-Pfade');

select is(
  (select count(*)::int from public.events
    where vorlage_id = '11111111-0000-0000-0000-000000000031'
      and split_part(cover_path, '/', 1) = 'c0000000-0000-0000-0000-000000000031'),
  4,
  'jeder Pfad liegt im {uid}/-Präfix des Hosts');

-- Das Cover der VORLAGE selbst darf an keinem Termin hängen — es ist ihre
-- private Datei, nur für den Host lesbar.
select is(
  (select count(*)::int from public.events
    where vorlage_id = '11111111-0000-0000-0000-000000000031'
      and cover_path = 'c0000000-0000-0000-0000-000000000031/vorlage.webp'),
  0,
  'kein Termin zeigt auf die Datei der Vorlage selbst');

-- ── 1b. WELCHER Pfad an WELCHEM Termin (Diff-Review, opencode) ──────────────
-- Die drei Zusagen darüber prüfen Anzahl, Verschiedenheit und Präfix — also
-- alles ausser der Zuordnung selbst. Genau die ist aber der leise Fehler, vor
-- dem der Kopf von 20260907110000 warnt: die Serie entstünde vollständig, jeder
-- Termin trüge ein Bild, und es wäre das eines anderen Datums.
--
-- Die RPC ordnet über `row_number() over (order by s.slot_datum)`. Ersetzte
-- eine Mutation das durch `order by s.starts_at`, fiele bisher KEIN Test — und
-- die beiden sind bei der Zeitumstellung nicht überall gleichbedeutend.
-- Deshalb hier die Reihenfolge ausgeschrieben, nicht bloss gezählt.
--
-- Die Client-Hälfte derselben Zusage steht in
-- `src/lib/event-vorlagen.serie.test.ts` (`slotsMitCover` sortiert selbst).
-- Beide Hälften braucht es: die eine ordnet, die andere verlässt sich darauf.
select is(
  (select string_agg(cover_path, E'\n' order by slot_datum)
     from public.events
    where vorlage_id = '11111111-0000-0000-0000-000000000031'),
  'c0000000-0000-0000-0000-000000000031/a1b2c3d4-0000-4000-8000-000000000001.webp' || E'\n' ||
  'c0000000-0000-0000-0000-000000000031/a1b2c3d4-0000-4000-8000-000000000002.webp' || E'\n' ||
  'c0000000-0000-0000-0000-000000000031/a1b2c3d4-0000-4000-8000-000000000003.webp' || E'\n' ||
  'c0000000-0000-0000-0000-000000000031/a1b2c3d4-0000-4000-8000-000000000004.webp',
  'der n-te Pfad hängt am n-ten Termin — nach slot_datum aufsteigend, nicht nur irgendwie verteilt');

-- ── 2. Ohne Cover ───────────────────────────────────────────────────────────
select is(
  pg_temp.zaehl_als('c0000000-0000-0000-0000-000000000031', $$
    select count(*)::int from public.event_serie_erzeugen(
      '11111111-0000-0000-0000-000000000032', '2026-09-01', p_anzahl => 4)
  $$),
  4,
  'eine Vorlage ohne Cover erzeugt Termine und scheitert deswegen nicht');

select is(
  (select count(*)::int from public.events
    where vorlage_id = '11111111-0000-0000-0000-000000000032'
      and cover_path is null),
  4,
  '… und diese Termine tragen kein Cover');

-- ── 3. Falsche Anzahl Pfade ─────────────────────────────────────────────────
delete from public.events where vorlage_id = '11111111-0000-0000-0000-000000000031';

select alike(
  pg_temp.als('c0000000-0000-0000-0000-000000000031', $$
    select * from public.event_serie_erzeugen(
      '11111111-0000-0000-0000-000000000031', '2026-09-01', p_anzahl => 4,
      p_cover_pfade => array['c0000000-0000-0000-0000-000000000031/nur-einer.webp'])
  $$),
  'FEHLER:22023',
  'eine Pfadliste, die nicht zur Terminzahl passt, wird abgewiesen — sonst landeten Cover an falschen Terminen');

-- ── 4. Der Beleg für das ZIEL am `on conflict` ──────────────────────────────
-- Siehe Kopf: zwei Termine auf demselben Cover-Pfad verletzen
-- `events_cover_path_key`. Mit Ziel knallt das (23505). Ohne Ziel schluckte es
-- `do nothing`, und der zweite Slot fehlte dauerhaft und lautlos.
select alike(
  pg_temp.als('c0000000-0000-0000-0000-000000000031', $$
    select * from public.event_serie_erzeugen(
      '11111111-0000-0000-0000-000000000031', '2026-09-01', p_anzahl => 2,
      p_cover_pfade => array[
        'c0000000-0000-0000-0000-000000000031/derselbe.webp',
        'c0000000-0000-0000-0000-000000000031/derselbe.webp'])
  $$),
  'FEHLER:23505',
  'zwei Termine auf DEMSELBEN Cover-Pfad krachen laut — das Ziel am on conflict deckt nur (vorlage_id, slot_datum)');

select finish();
rollback;
