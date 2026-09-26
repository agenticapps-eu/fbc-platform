-- Die neue Zugangsleiter: Schluessel, Raenge, Preise (AGE-903).
-- Change: openspec/changes/stufen-v5/.
--
-- Echtes pgTAP mit plan()/finish() — nur solche Dateien stehen im CI-Lauf.
-- Diese Datei ist in ci.yml eingetragen.
--
-- ══ WAS HIER GEMESSEN WIRD ═════════════════════════════════════════════════
--   1. **Die Leiter selbst.** Sechs Schluessel, Raenge 1…6, Preise. Die drei
--      Stufen ausserhalb des Clubs tragen 0 € (Donald, 26.09.: „aktuell 0,
--      wird ja spaeter kommen").
--   2. **Kein Profil bleibt auf einem entfallenen Schluessel.** `profiles.tier`
--      ist Fremdschluessel auf `membership_tiers(key)`; bliebe `basic` oder
--      `exchange` stehen, waere der Bestand inkonsistent statt gewandert.
--   3. **Die Neuanlage landet auf Rang 1** — und zwar geprueft ueber den JOIN
--      auf `membership_tiers`, nicht gegen das Literal `'active'`. Ein Test
--      gegen das Literal prueft den Text der Funktion und nicht ihre Wirkung:
--      er waere auch gruen, wenn `active` in der Tabelle fehlte und der
--      Fremdschluessel bei der naechsten Registrierung brach.
--   4. **Die Katalog-Kommentare luegen nicht mehr.** Der Kommentar auf
--      `has_level` ist die einzige Stelle im Katalog, an der die Rangtabelle
--      ausgeschrieben steht — und genau die aendert sich.
--
-- ══ FALLEN, DIE DIESES PROJEKT SCHON GESTELLT HAT ══════════════════════════
--   * **Die Stufe am RANG pruefen, nie am Schluesselnamen.** `discover` heisst
--     vor und nach dieser Migration `discover` und bedeutet Verschiedenes
--     (Rang 3 → Rang 4). Ein `select tier from profiles` beantwortet die Frage
--     nicht. Jede Zusage hier joint auf `membership_tiers.level_rank`.
--   * In pgTAP heisst es `alike()`, nicht `like()`.
--   * Der lokale Stack ist geseedet und mit anderen Sitzungen GETEILT — jede
--     Mengenaussage ist auf die Fixture-Kennungen eingeschraenkt, nie
--     `count(*)` der ganzen Tabelle.
--   * Die Kommentar-Zusagen sind **negativ** formuliert („nennt keinen
--     entfallenen Schluessel"). Eine positive Zusage auf den genauen Wortlaut
--     waere bei der naechsten Umformulierung rot, ohne dass etwas falsch ist.

begin;
select plan(12);

-- ── 1 · Die Leiter ──────────────────────────────────────────────────────────

select results_eq(
  $$ select key, level_rank, price_year
       from public.membership_tiers
      order by level_rank $$,
  $$ values ('active'::text,   1, 0),
            ('boost'::text,    2, 0),
            ('connect'::text,  3, 0),
            ('discover'::text, 4, 300),
            ('focus'::text,    5, 600),
            ('impact'::text,   6, 1200) $$,
  'Sechs Stufen, Raenge 1…6, und die drei ausserhalb des Clubs auf 0 €');

select is(
  (select count(*)::int from public.membership_tiers),
  6,
  'Genau sechs Stufen — keine entfallene Zeile ist liegengeblieben');

select is_empty(
  $$ select key from public.membership_tiers
      where key in ('basic','exchange','explore','impuls','prime','circle','legacy') $$,
  'Kein entfallener Schluessel steht mehr in der Tabelle');

-- ── 2 · Der Bestand ist vollstaendig gewandert ──────────────────────────────

select is_empty(
  $$ select p.id from public.profiles p
      left join public.membership_tiers m on m.key = p.tier
      where m.key is null $$,
  'Jede profiles.tier loest auf genau eine bestehende Stufe auf');

select is(
  (select column_default from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'tier'),
  '''active''::text',
  'Der DEFAULT auf profiles.tier steht auf active, nicht mehr auf basic');

-- ── 3 · Die Neuanlage ───────────────────────────────────────────────────────
-- Der Trigger schreibt die Stufe selbst und verlaesst sich NICHT auf den
-- DEFAULT — deshalb wird beides getrennt gemessen.

insert into auth.users (id, aud, role, email)
values ('5a500000-0000-0000-0000-00000000000e'::uuid, 'authenticated', 'authenticated',
        'v5-neu@test.fbc');

select isnt_empty(
  $$ select p.tier from public.profiles p
      join public.membership_tiers m on m.key = p.tier
      where p.id = '5a500000-0000-0000-0000-00000000000e' $$,
  'Die Stufe der Neuanlage steht in membership_tiers — der Fremdschluessel haelt');

select is(
  (select m.level_rank from public.profiles p
     join public.membership_tiers m on m.key = p.tier
    where p.id = '5a500000-0000-0000-0000-00000000000e'),
  1,
  'Die Neuanlage landet auf Rang 1 — gemessen am Rang, nicht am Schluesselnamen');

-- ── 4 · Die Katalog-Kommentare ──────────────────────────────────────────────

select unalike(
  (select obj_description(p.oid, 'pg_proc') from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'has_level'),
  '%basic%',
  'Der has_level-Kommentar nennt basic nicht mehr — er ist die Rangtabelle des Katalogs');

select unalike(
  (select obj_description(p.oid, 'pg_proc') from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'has_level'),
  '%exchange%',
  'Der has_level-Kommentar nennt exchange nicht mehr');

select unalike(
  (select obj_description(c.oid, 'pg_class') from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'membership_tiers'),
  '%basic%',
  'Der Kommentar auf membership_tiers nennt basic nicht mehr');

select unalike(
  (select obj_description(p.oid, 'pg_proc') from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'register_for_event'),
  '%rank 3%',
  'Der register_for_event-Kommentar nennt die alte Rang-3-Schwelle nicht mehr');

select isnt(
  (select obj_description(pol.oid, 'pg_policy') from pg_policy pol
    where pol.polname = 'profiles_select_self_or_discover'),
  null,
  'Die Policy traegt wieder einen Kommentar — die Vorbild-Migration setzte einen, ein Ersatz hat ihn verloren');

select * from finish();
rollback;
