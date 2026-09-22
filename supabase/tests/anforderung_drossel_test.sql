-- ════════════════════════════════════════════════════════════════════════════
-- AGE-830 — Drossel des Anforderungseingangs
-- ════════════════════════════════════════════════════════════════════════════
--
-- Change: openspec/changes/anforderung-eingang/ (design.md, Entscheidung 5).
--
-- Zwei Funktionen, weil Prüfen und Vermerken zu verschiedenen Zeitpunkten
-- gehören: `anforderung_frei` VOR dem ersten Download, `anforderung_vermerken`
-- NUR nach einem von Linear bestätigten Issue. Gezählt wird, was entstanden
-- ist, damit weder ein Linear-Ausfall noch ein Probelauf die Quote verbraucht.
--
-- Die Positivkontrolle ist die 19: frei bei 19 und nicht frei bei 20 zeigt,
-- dass gezählt wird. Ein `anforderung_frei`, das immer true liefert, fiele an
-- der 20 auf, eines, das immer false liefert, an der 19.
-- ════════════════════════════════════════════════════════════════════════════

begin;
select plan(13);

-- ── Rechte: nur service_role ───────────────────────────────────────────────

select is(has_function_privilege('anon',
  'public.anforderung_frei(interval, integer)', 'execute'),
  false, 'anforderung_frei: anon darf nicht');
select is(has_function_privilege('authenticated',
  'public.anforderung_frei(interval, integer)', 'execute'),
  false, 'anforderung_frei: authenticated darf nicht');
select is(has_function_privilege('service_role',
  'public.anforderung_frei(interval, integer)', 'execute'),
  true, 'anforderung_frei: service_role darf (der Weg von anforderung-eingang)');

select is(has_function_privilege('anon',
  'public.anforderung_vermerken(interval)', 'execute'),
  false, 'anforderung_vermerken: anon darf nicht');
select is(has_function_privilege('authenticated',
  'public.anforderung_vermerken(interval)', 'execute'),
  false, 'anforderung_vermerken: authenticated darf nicht');
select is(has_function_privilege('service_role',
  'public.anforderung_vermerken(interval)', 'execute'),
  true, 'anforderung_vermerken: service_role darf');

select is(has_table_privilege('anon', 'public.anforderung_eingaenge', 'select'),
  false, 'anforderung_eingaenge: anon hat kein SELECT');
select is(has_table_privilege('authenticated', 'public.anforderung_eingaenge', 'insert'),
  false, 'anforderung_eingaenge: authenticated hat kein INSERT');

-- ── Zählen ─────────────────────────────────────────────────────────────────

delete from public.anforderung_eingaenge;

select is(public.anforderung_frei('1 hour', 20), true,
  'leerer Eimer ist frei');

-- 19 angelegte Issues: noch frei.
select public.anforderung_vermerken('1 hour') from generate_series(1, 19);
select is(public.anforderung_frei('1 hour', 20), true,
  'bei 19 angelegten Issues ist der Eingang noch frei');

-- Das zwanzigste: ab jetzt gedrosselt.
select public.anforderung_vermerken('1 hour');
select is(public.anforderung_frei('1 hour', 20), false,
  'bei 20 angelegten Issues ist der Eingang gedrosselt');

-- `anforderung_frei` schreibt nichts: der Zähler steht nach der Prüfung noch
-- bei 20. Sonst würde jeder gedrosselte Aufruf die Sperre verlängern.
select is((select count(*)::int from public.anforderung_eingaenge), 20,
  'anforderung_frei schreibt keine Zeile');

-- ── Aufräumen ──────────────────────────────────────────────────────────────

-- Alte Einträge verschwinden beim nächsten Vermerk. Nach dem Rückdatieren
-- liegen alle 20 ausserhalb des Fensters, übrig bleibt nur die neue Zeile.
update public.anforderung_eingaenge set angelegt_um = now() - interval '2 hours';
select public.anforderung_vermerken('1 hour');
select is((select count(*)::int from public.anforderung_eingaenge), 1,
  'anforderung_vermerken räumt alles ausserhalb des Fensters weg');

select * from finish();
rollback;
