-- Abgestufte Namensauflösung (AGE-291). Läuft mit `supabase test db`.
--
-- WAS HIER GEPRÜFT WIRD UND WARUM ES ANDERS AUSSIEHT ALS ERWARTET
--
-- Die Schwelle ist die AKTIVIERUNG (Donald, 26.08.2026), nicht mehr `has_level(4)`.
-- Damit ist die Bedingung des Resolvers — `is_activated()` — zeichengleich mit dem
-- ERSTEN KONJUNKT der profiles-RLS:
--
--   profiles_select_self_or_discover:
--     is_activated() and activated_at is not null and ... and (id = auth.uid() or has_level(3))
--
-- Wer den Resolver maskieren lassen könnte, bekommt über jede heutige Fläche
-- ohnehin NULL ZEILEN. Der Maskierungs-Zweig ist also über Verzeichnis, Feed,
-- Events, Matching und Profil NICHT erreichbar — gemessen am PROD-Katalog,
-- 26.08.2026, alle zwölf namenstragenden Funktionen und die eine View.
--
-- Ein Test, der „ein nicht aktivierter Aufrufer sieht 'Mitglied'" über
-- `search_directory` behauptete, wäre deshalb GRÜN, ohne den Resolver zu prüfen:
-- er misst `(leer)` und damit das Gate. Das ist die Vakuum-Falle, und sie ist hier
-- besonders verführerisch, weil die Zusage richtig KLINGT.
--
-- Der Resolver ist Tiefenverteidigung: er trägt, wenn eine KÜNFTIGE Fläche das
-- Gate vergisst. Also wird genau das geprüft — an einer Wegwerf-View ohne Gate
-- und mit `security_invoker=off`, die die RLS umgeht, wie `profiles_public` es tut.
-- Dieselbe Bauart wie grants_test.sql Abschnitt 9: die REGEL, nicht der Zustand.
--
-- Abschnitt 4 prüft strukturell, dass die drei Flächen den Resolver auch WIRKLICH
-- rufen statt der rohen Spalte. Ohne ihn belegte Abschnitt 3 nur, dass es die
-- Funktion gibt — nicht, dass irgendwer sie benutzt.

begin;
select plan(14);

-- ── Fixtures ────────────────────────────────────────────────────────────────
insert into auth.users (id, aud, role, email) values
  ('a2910000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'nina@name.test.fbc'),
  ('a2910000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'ove@name.test.fbc'),
  ('a2910000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'pia@name.test.fbc');

-- Nina und Ove sind aktiviert, Pia NICHT. Pia ist die einzige Aufruferin, für die
-- der Resolver maskieren darf.
update public.profiles set tier = 'impact', name = 'Nina Aktiv', is_public = true,
       activated_at = now()
  where id = 'a2910000-0000-0000-0000-000000000001';
update public.profiles set tier = 'impact', name = 'Ove Ziel', is_public = true,
       activated_at = now()
  where id = 'a2910000-0000-0000-0000-000000000002';
update public.profiles set tier = 'impact', name = 'Pia Unbestaetigt', is_public = true,
       activated_at = null
  where id = 'a2910000-0000-0000-0000-000000000003';

create function pg_temp.als(uid uuid, q text) returns text language plpgsql as $$
declare s text;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  execute q into s;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return coalesce(s, '(leer)');
end $$;

-- ── 1. Der Resolver selbst ──────────────────────────────────────────────────
-- Die einzige Stelle, an der beide Zweige beobachtbar sind.

select is(
  pg_temp.als('a2910000-0000-0000-0000-000000000001',
    $q$ select public.resolve_display_name(
          'a2910000-0000-0000-0000-000000000002', 'Ove Ziel') $q$),
  'Ove Ziel',
  'ein AKTIVIERTER Aufrufer bekommt den Klarnamen eines anderen Mitglieds');

select is(
  pg_temp.als('a2910000-0000-0000-0000-000000000003',
    $q$ select public.resolve_display_name(
          'a2910000-0000-0000-0000-000000000002', 'Ove Ziel') $q$),
  'Mitglied',
  'ein NICHT aktivierter Aufrufer bekommt die Maske statt des Klarnamens');

-- Der Selbst-Zweig. Ohne ihn hiesse die Regel „nur Aktivierte sehen Namen", und
-- ein nicht aktivierter Mensch saehe seinen EIGENEN Namen als 'Mitglied' — auf
-- der Aktivierungsstrecke, wo er ihn bestaetigen soll.
select is(
  pg_temp.als('a2910000-0000-0000-0000-000000000003',
    $q$ select public.resolve_display_name(
          'a2910000-0000-0000-0000-000000000003', 'Pia Unbestaetigt') $q$),
  'Pia Unbestaetigt',
  'der eigene Name kommt auch ohne Aktivierung durch (Selbst-Zweig)');

-- Gegenprobe zur Maske: sie ist nicht der Name, den die Zeile zufaellig traegt.
-- Ohne sie waere eine Funktion, die stumpf 'Mitglied' zurueckgibt, ebenso gruen.
select is(
  pg_temp.als('a2910000-0000-0000-0000-000000000001',
    $q$ select public.resolve_display_name(
          'a2910000-0000-0000-0000-000000000003', 'Pia Unbestaetigt') $q$),
  'Pia Unbestaetigt',
  'die Maske haengt am AUFRUFER, nicht an der Zeile');

-- ── 2. anon darf ihn gar nicht erst ausfuehren (AGE-602) ────────────────────
-- Eine neu angelegte Funktion erbt EXECUTE ueber PUBLIC. Ohne den ausdruecklichen
-- Entzug in der Migration stuende hier `true` — und die abgeschlossene Liste in
-- grants_test.sql waere um einen siebten Eintrag laenger.
select is(
  has_function_privilege('anon', 'public.resolve_display_name(uuid,text)', 'execute'),
  false,
  'anon darf resolve_display_name NICHT ausfuehren');

select is(
  has_function_privilege('authenticated', 'public.resolve_display_name(uuid,text)', 'execute'),
  true,
  'authenticated darf ihn ausfuehren — search_directory ist SECURITY INVOKER');

-- ── 3. Die REGEL: eine Flaeche OHNE Gate maskiert trotzdem ──────────────────
-- Das ist der ganze Zweck der Tiefenverteidigung. Die Wegwerf-View ist gebaut wie
-- `profiles_public` (security_invoker=off, also RLS umgangen), traegt aber KEIN
-- `is_activated()` im WHERE — genau der Fehler, gegen den der Resolver steht.
create view public.age291_ohne_gate with (security_invoker=off) as
  select id, public.resolve_display_name(id, name) as name from public.profiles;
grant select on public.age291_ohne_gate to authenticated;

select is(
  pg_temp.als('a2910000-0000-0000-0000-000000000001',
    $q$ select name from public.age291_ohne_gate
         where id = 'a2910000-0000-0000-0000-000000000002' $q$),
  'Ove Ziel',
  'ohne Gate: der aktivierte Aufrufer sieht den Klarnamen');

select is(
  pg_temp.als('a2910000-0000-0000-0000-000000000003',
    $q$ select name from public.age291_ohne_gate
         where id = 'a2910000-0000-0000-0000-000000000002' $q$),
  'Mitglied',
  'ohne Gate: der Resolver maskiert, wo die RLS es nicht mehr tut — DAS ist die Tiefe');

-- Die Gegenprobe zur Gegenprobe: dieselbe View OHNE Resolver leckt.
-- Ohne sie belegte die Zeile darueber nicht, dass die View die RLS wirklich umgeht.
create view public.age291_roh with (security_invoker=off) as
  select id, name from public.profiles;
grant select on public.age291_roh to authenticated;

select is(
  pg_temp.als('a2910000-0000-0000-0000-000000000003',
    $q$ select name from public.age291_roh
         where id = 'a2910000-0000-0000-0000-000000000002' $q$),
  'Ove Ziel',
  'dieselbe View ohne Resolver leckt den Klarnamen — die Wegwerf-View umgeht die RLS wirklich');

-- ── 4. Die drei Flaechen rufen den Resolver auch ────────────────────────────
-- Strukturell, weil verhaltensmaessig nicht messbar: ueber jede dieser Flaechen
-- bekommt ein maskierbarer Aufrufer null Zeilen. Ein Verhaltenstest waere gruen,
-- wenn der Resolver-Aufruf morgen wieder herausfiele.

select ok(
  pg_get_viewdef('public.profiles_public'::regclass, true) like '%resolve_display_name%',
  'profiles_public gibt den Namen durch den Resolver — deckt Feed, Events, '
  'Profil, Matching-Hub und feed_top_authors mit ab');

select ok(
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'search_directory'
      and pg_get_functiondef(p.oid) like '%resolve_display_name%') = 1,
  'search_directory gibt den Namen durch den Resolver');

-- Die Sortierung ist ein eigener Leckweg: maskierte Zeilen an ihrer alphabetischen
-- Position verraten den Namen, den die Spalte gerade verschweigt.
select ok(
  (select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'search_directory')
    not like '%order by p.name%',
  'search_directory sortiert NICHT mehr nach der rohen Spalte — die Position '
  'verriete den Namen, den die Ausgabe verschweigt');

-- Und die Volltextsuche ist der dritte: „Mueller" eingeben und sehen, ob eine
-- maskierte Zeile stehen bleibt, ist ein Orakel auf den Namen.
select ok(
  (select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'search_directory')
    like '%is_activated()%',
  'search_directory bindet die Volltextsuche an das Namensrecht — sonst ist '
  'sie ein Orakel auf den maskierten Namen');

select ok(
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'list_routing_queue'
      and pg_get_functiondef(p.oid) like '%resolve_display_name%') = 1,
  'list_routing_queue gibt beide Namen durch den Resolver');

select * from finish();
rollback;
