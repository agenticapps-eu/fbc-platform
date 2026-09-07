-- Event-Vorlagen und Serientermine (AGE-630), die Wiederholungsregel.
-- `supabase test db`. Aufgabe 4 aus
-- openspec/changes/events-vorlagen-und-serientermine/tasks.md.
--
-- ══ WAS HIER ZUGESAGT WIRD ══════════════════════════════════════════════════
-- Diese Datei ist der RED-Schritt für `public.event_serie_slots()` — die
-- Auswertung der drei Regelformen zu einer Liste aus Slot-Datum und Zeitpunkt.
-- Sie beschreibt die Funktion, bevor es sie gibt.
--
-- Die Funktion rechnet nur; sie schreibt nichts. Das Einfügen, die Obergrenze
-- 52 und `on conflict` sind Aufgabe 5 und stehen NICHT hier.
--
-- ══ WARUM DIE DATEN HIER NACHGERECHNET SIND ═════════════════════════════════
-- Jedes Datum unten wurde am lokalen Stack gemessen, nicht aus dem Plan
-- übernommen (06.09., psql):
--
--   erster Dienstag ab 09/2026 → 01.09. 06.10. 03.11. 01.12.2026
--   isodow 01.09.2026 = 2 (Dienstag) — der Monatsstart IST der gesuchte Tag
--   25.10.2026 und 28.03.2027 sind Sonntage (isodow 7) — die Umstelltage
--   monatlich am 31. ab 01/2026 → 31.01. 31.03. 31.05. 31.07. (Feb/Apr/Jun aus)
--   19:00 am 20.10. → 17:00Z, am 27.10. → 18:00Z, Abstand 169 h statt 168
--
-- ══ ABSCHNITT 7 KORRIGIERT DEN PLAN ═════════════════════════════════════════
-- design.md D4 und das Spec-Delta sagten „Herbstüberlappung: erste Lesart, das
-- Postgres-Verhalten". Beides zusammen ist FALSCH, und die Messung, auf die sie
-- sich beriefen, konnte es nicht zeigen: sie wandelte 02:30 hin und zurück und
-- bekam 02:30 — was für BEIDE Lesarten gilt und sie deshalb nicht unterscheidet.
--
-- Unterscheidend gemessen (06.09.), am Umstelltag 25.10.2026:
--
--   02:30+02 (CEST, erste Lesart)  = 00:30Z   → zurück 02:30 Ortszeit
--   02:30+01 (CET,  zweite Lesart) = 01:30Z   → zurück 02:30 Ortszeit
--   `timestamp '2026-10-25 02:30' at time zone 'Europe/Berlin'` = 01:30Z
--
-- Postgres liefert also die ZWEITE Lesart (Normalzeit). Festgehalten wird das
-- gemessene Verhalten: die tragende Zusage der Spec — GENAU EIN Termin, weder
-- zwei noch keiner — gilt unter beiden Lesarten, und die erste zu erzwingen
-- hiesse, die Mehrdeutigkeit von Hand zu erkennen und den Zeitpunkt mit festem
-- Offset zu bauen. Aufwand für einen Fall ohne praktische Folge; die Absicht
-- von D4 war ausdrücklich „das Postgres-Verhalten, aber festgelegt und
-- getestet". Das Etikett war falsch, nicht die Absicht.
--
-- ══ DIESE DATEI MUSS IN .github/workflows/ci.yml STEHEN ═════════════════════
-- `scripts/pgtap-dateiliste.test.ts` prüft die Liste in beide Richtungen.

begin;
select plan(14);

-- ── 1. Wöchentlich ──────────────────────────────────────────────────────────
select results_eq(
  $$select slot_datum from public.event_serie_slots(
      'woechentlich',
      p_wochentag => 2,
      p_ortszeit  => '19:00',
      p_zeitzone  => 'Europe/Berlin',
      p_ab        => '2026-09-01',
      p_anzahl    => 4)
    order by slot_datum$$,
  $$values (date '2026-09-01'), (date '2026-09-08'),
           (date '2026-09-15'), (date '2026-09-22')$$,
  'jeden Dienstag ab 01.09.2026 → 01./08./15./22.09.');

select is(
  (select count(*)::int from public.event_serie_slots(
      'woechentlich',
      p_wochentag => 2,
      p_ortszeit  => '19:00',
      p_zeitzone  => 'Europe/Berlin',
      p_ab        => '2026-09-01',
      p_anzahl    => 4)
    where extract(isodow from slot_datum) = 2),
  4,
  'alle vier Termine sind Dienstage');

-- ── 2. Monatlich am n-ten Wochentag ─────────────────────────────────────────
-- Form 3 MUSS als Position-plus-Wochentag ausgewertet werden. Eine feste
-- Tagesdifferenz träfe schon den zweiten Termin nicht mehr.
select results_eq(
  $$select slot_datum from public.event_serie_slots(
      'monatlich_n_ter_wochentag',
      p_wochentag          => 2,
      p_wochentag_position => 1,
      p_ortszeit           => '19:00',
      p_zeitzone           => 'Europe/Berlin',
      p_ab                 => '2026-09-01',
      p_anzahl             => 4)
    order by slot_datum$$,
  $$values (date '2026-09-01'), (date '2026-10-06'),
           (date '2026-11-03'), (date '2026-12-01')$$,
  'erster Dienstag ab 09/2026 → 01.09., 06.10., 03.11., 01.12.2026');

-- Die Gegenprobe zur Zeile darüber: wären die Abstände gleich, hätte eine
-- feste Tagesdifferenz dasselbe geliefert und der Test belegte nichts.
select is(
  (select count(distinct d)::int from (
     select slot_datum - lag(slot_datum) over (order by slot_datum) as d
       from public.event_serie_slots(
         'monatlich_n_ter_wochentag',
         p_wochentag          => 2,
         p_wochentag_position => 1,
         p_ortszeit           => '19:00',
         p_zeitzone           => 'Europe/Berlin',
         p_ab                 => '2026-09-01',
         p_anzahl             => 4)) s
   where d is not null),
  2,
  'die Abstände sind ungleich (35 und 28 Tage) — eine feste Differenz ist ausgeschlossen');

-- ── 3. Der Monatsstart ist selbst der gesuchte Wochentag ────────────────────
-- 01.09.2026 IST ein Dienstag. Der erste Dienstag ist dann der 1., nicht der 8.
select results_eq(
  $$select slot_datum from public.event_serie_slots(
      'monatlich_n_ter_wochentag',
      p_wochentag          => 2,
      p_wochentag_position => 1,
      p_ortszeit           => '19:00',
      p_zeitzone           => 'Europe/Berlin',
      p_ab                 => '2026-09-01',
      p_anzahl             => 1)$$,
  $$values (date '2026-09-01')$$,
  'ist der Monatsstart selbst der gesuchte Wochentag, ist er der Termin — nicht der darauffolgende');

-- ── 4. Monatlich am 31. — übersprungene Monate zählen nicht ─────────────────
select results_eq(
  $$select slot_datum from public.event_serie_slots(
      'monatlich_tag',
      p_tag_im_monat => 31,
      p_ortszeit     => '19:00',
      p_zeitzone     => 'Europe/Berlin',
      p_ab           => '2026-01-01',
      p_anzahl       => 4)
    order by slot_datum$$,
  $$values (date '2026-01-31'), (date '2026-03-31'),
           (date '2026-05-31'), (date '2026-07-31')$$,
  'monatlich am 31. ab 01/2026 → vier Termine, Februar/April/Juni übersprungen');

-- `anzahl` zählt ERZEUGTE Termine, nicht durchlaufene Monate (D6).
select is(
  (select count(*)::int from public.event_serie_slots(
      'monatlich_tag',
      p_tag_im_monat => 31,
      p_ortszeit     => '19:00',
      p_zeitzone     => 'Europe/Berlin',
      p_ab           => '2026-01-01',
      p_anzahl       => 4)
    where extract(month from slot_datum) in (2, 4, 6)),
  0,
  'kein Termin in einem Monat ohne 31. — die übersprungenen Monate zählen nicht in anzahl');

-- ── 5. Über die Herbstumstellung hinweg ─────────────────────────────────────
-- Die Regel führt ORTSZEIT. 19:00 bleibt 19:00, und der UTC-Abstand weicht
-- deshalb um eine Stunde von der reinen Wochendifferenz ab.
select results_eq(
  $$select (starts_at at time zone 'Europe/Berlin')::time
      from public.event_serie_slots(
        'woechentlich',
        p_wochentag => 2,
        p_ortszeit  => '19:00',
        p_zeitzone  => 'Europe/Berlin',
        p_ab        => '2026-10-20',
        p_anzahl    => 2)
      order by slot_datum$$,
  $$values (time '19:00'), (time '19:00')$$,
  'vor und nach der Herbstumstellung liegt der Termin um 19:00 Ortszeit');

select is(
  (select extract(epoch from max(starts_at) - min(starts_at))::int / 3600
     from public.event_serie_slots(
       'woechentlich',
       p_wochentag => 2,
       p_ortszeit  => '19:00',
       p_zeitzone  => 'Europe/Berlin',
       p_ab        => '2026-10-20',
       p_anzahl    => 2)),
  169,
  'der UTC-Abstand ist 169 h, nicht 168 — der Beleg, dass Ortszeit geführt wird');

-- ── 6. Die Stunde, die es nicht gibt (Frühjahr) ─────────────────────────────
-- 28.03.2027 ist der Umstelltag; 02:30 Ortszeit existiert dort nicht.
-- Entschieden (D4): die Regel schaltet WEITER, der Termin entfällt nicht.
select is(
  (select count(*)::int from public.event_serie_slots(
      'woechentlich',
      p_wochentag => 7,
      p_ortszeit  => '02:30',
      p_zeitzone  => 'Europe/Berlin',
      p_ab        => '2027-03-28',
      p_anzahl    => 1)),
  1,
  'die Frühjahrslücke erzeugt einen Termin — kein stiller Ausfall');

select results_eq(
  $$select (starts_at at time zone 'Europe/Berlin')::time
      from public.event_serie_slots(
        'woechentlich',
        p_wochentag => 7,
        p_ortszeit  => '02:30',
        p_zeitzone  => 'Europe/Berlin',
        p_ab        => '2027-03-28',
        p_anzahl    => 1)$$,
  $$values (time '03:30')$$,
  'der Termin in der Frühjahrslücke liegt um 03:30 Ortszeit, nicht 02:30');

-- ── 7. Die Stunde, die es zweimal gibt (Herbst) ─────────────────────────────
-- Siehe Kopf: hier weicht die Messung vom Plan ab. Tragend ist „genau einer".
select is(
  (select count(*)::int from public.event_serie_slots(
      'woechentlich',
      p_wochentag => 7,
      p_ortszeit  => '02:30',
      p_zeitzone  => 'Europe/Berlin',
      p_ab        => '2026-10-25',
      p_anzahl    => 1)),
  1,
  'die Herbstüberlappung erzeugt GENAU EINEN Termin, nicht zwei');

-- Der unterscheidende Beleg. Ein Rückwandeln nach Ortszeit ergäbe für beide
-- Lesarten 02:30 und bewiese nichts — deshalb wird hier gegen UTC geprüft.
select results_eq(
  $$select starts_at from public.event_serie_slots(
      'woechentlich',
      p_wochentag => 7,
      p_ortszeit  => '02:30',
      p_zeitzone  => 'Europe/Berlin',
      p_ab        => '2026-10-25',
      p_anzahl    => 1)$$,
  $$values (timestamptz '2026-10-25 01:30+00')$$,
  'der Termin liegt auf 01:30Z — die zweite Lesart (Normalzeit), gemessen statt behauptet');

-- ── 8. Ohne Regel gibt es nichts auszuwerten ────────────────────────────────
-- Eine regellose Vorlage erzeugt Termine über ein EINZELNES DATUM (D3); das ist
-- Sache der RPC. Diese Funktion darf dafür nicht still eine leere Menge
-- liefern — ein leeres Ergebnis sähe aus wie „die Regel ergibt eben nichts".
select throws_ok(
  $$select * from public.event_serie_slots(
      null,
      p_ortszeit => '19:00',
      p_zeitzone => 'Europe/Berlin',
      p_ab       => '2026-09-01',
      p_anzahl   => 4)$$,
  '22023', null,
  'ein Aufruf ohne Wiederholungsform wird abgewiesen, statt still leer zu liefern');

select finish();
rollback;
