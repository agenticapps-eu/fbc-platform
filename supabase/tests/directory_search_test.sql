-- Kategorie-Filter und Kategorie-Rückgabe im Mitgliederverzeichnis (AGE-494).
-- Läuft mit `supabase test db` — echtes pgTAP mit plan()/finish(), nicht eines der
-- manuellen probe_*.sql-Skripte, denn nur pgTAP-Dateien stehen im CI-Lauf.
--
-- Geprüft wird der Vertrag aus dem Change `mvp-scope-navigation`:
--   * `p_offers` / `p_needs` sind text[]: ODER innerhalb einer Gruppe, UND zwischen
--     den Gruppen, und ein leeres Array filtert NICHT.
--   * `offer_categories` / `need_categories` kommen distinct, ohne NULL und als
--     LEERES ARRAY statt NULL — ein gefiltertes Aggregat über lauter NULL liefert
--     sonst NULL, was ein anderer Wert ist als das leere Array.
--   * Die Preisgabe wächst (was jemand sucht, nicht nur dass er sucht), die GRENZE
--     nicht: `is_public = false` bleibt unsichtbar, unterhalb von `discover` sieht
--     ein Aufrufer höchstens die eigene Zeile, und `anon` darf gar nicht ausführen.
--
-- RLS greift nur für eine Nicht-Owner-Rolle, daher laufen die Abfragen als
-- `authenticated` mit dem JWT-sub des Mitglieds (Helfer unten), während die
-- Assertions als Superuser-Testrolle laufen. Alles in der pgTAP-Transaktion.

begin;
select plan(15);

-- ── Fixtures ────────────────────────────────────────────────────────────────
-- auth.users-Insert feuert handle_new_user() und legt public.profiles an.
insert into auth.users (id, aud, role, email) values
  ('d1000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'anna@dir.test.fbc'),
  ('d1000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'bea@dir.test.fbc'),
  ('d1000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'cem@dir.test.fbc'),
  ('d1000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'dora@dir.test.fbc'),
  ('d1000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'egon@dir.test.fbc');

update public.profiles set tier = 'impact', name = 'Anna', is_public = true
  where id = 'd1000000-0000-0000-0000-000000000001';
update public.profiles set tier = 'impact', name = 'Bea', is_public = true
  where id = 'd1000000-0000-0000-0000-000000000002';
-- Cem hat sich aus dem Verzeichnis abgemeldet — darf NIE auftauchen.
update public.profiles set tier = 'impact', name = 'Cem', is_public = false
  where id = 'd1000000-0000-0000-0000-000000000003';
-- Dora trägt ein Angebot OHNE Kategorie: has_offers ja, offer_categories leer.
update public.profiles set tier = 'impact', name = 'Dora', is_public = true
  where id = 'd1000000-0000-0000-0000-000000000004';
-- Egon steht unter `discover` (rank 3) — er ist der Sichtbarkeits-Gegenbeweis.
update public.profiles set tier = 'basic', name = 'Egon', is_public = true
  where id = 'd1000000-0000-0000-0000-000000000005';

-- Aktivierungs-Gate (AGE-495). Die Fixtures entstehen NACH dem Backfill aus
-- 20260806080000 und sind deshalb unbestätigt; `search_directory` ist SECURITY
-- INVOKER und folgt der profiles-RLS, liefert also sonst durchgehend leer.
-- Ohne diese Zeile prüfte die Datei nicht mehr die Suche, sondern nur noch das
-- Gate — und zwar an einer Stelle, an der es niemand suchen würde.
update public.profiles set activated_at = now();

insert into public.offers (profile_id, category, title) values
  ('d1000000-0000-0000-0000-000000000001', 'kapital',  'Annas Kapital'),
  ('d1000000-0000-0000-0000-000000000001', 'kontakte', 'Annas Kontakte'),
  -- Zweite Zeile derselben Kategorie: `offer_categories` muss distinct sein.
  ('d1000000-0000-0000-0000-000000000001', 'kapital',  'Annas zweites Kapitalangebot'),
  ('d1000000-0000-0000-0000-000000000002', 'kapital',  'Beas Kapital'),
  ('d1000000-0000-0000-0000-000000000003', 'kapital',  'Cems Kapital'),
  ('d1000000-0000-0000-0000-000000000004', null,       'Dora ohne Kategorie');

insert into public.needs (profile_id, category, title) values
  ('d1000000-0000-0000-0000-000000000001', 'experten',   'Anna sucht Experten'),
  ('d1000000-0000-0000-0000-000000000002', 'investoren', 'Bea sucht Investoren');

-- ── Rollen-Helfer (spiegeln supabase/tests/rls_test.sql) ─────────────────────
create function pg_temp.names_as(uid uuid, q text) returns text language plpgsql as $$
declare s text;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  execute q into s;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return coalesce(s, '(leer)');
end $$;

create function pg_temp.try_as_role(role_name text, q text) returns text language plpgsql as $$
begin
  execute format('set local role %I', role_name);
  begin
    execute q;
  exception when others then
    reset role;
    return 'DENIED:' || SQLERRM;
  end;
  reset role;
  return 'OK';
end $$;

-- Die Fixture-Namen. Alle aggregierenden Abfragen schränken darauf ein: die
-- Testtransaktion rollt zwar zurück, aber sie läuft gegen eine Datenbank, in der
-- schon Profile liegen können (lokaler Demo-Seed). Ohne diese Klammer misst der
-- Test die Umgebung mit und schlägt für den falschen Grund fehl — in der CI mit
-- frischem `db reset` fiele das nie auf.
create function pg_temp.fixtures() returns text[] language sql immutable as $$
  select array['Anna','Bea','Cem','Dora','Egon']::text[];
$$;

-- Anna (impact, rank 6) ist die Aufruferin der Sichtbarkeits-Fälle.
create function pg_temp.dir(q text) returns text language sql as $$
  select pg_temp.names_as('d1000000-0000-0000-0000-000000000001', q);
$$;

-- ── 1. ODER innerhalb einer Gruppe ──────────────────────────────────────────
select is(
  pg_temp.dir($q$
    select string_agg(name, ',' order by name) from public.search_directory(
      p_offers => array['kapital','mentoring']) where name = any(pg_temp.fixtures())
  $q$),
  'Anna,Bea',
  'p_offers verknüpft die Kategorien mit ODER');

-- ── 2. UND zwischen den Gruppen ─────────────────────────────────────────────
select is(
  pg_temp.dir($q$
    select string_agg(name, ',' order by name) from public.search_directory(
      p_offers => array['kapital'], p_needs => array['experten']) where name = any(pg_temp.fixtures())
  $q$),
  'Anna',
  'p_offers UND p_needs schneiden sich');

select is(
  pg_temp.dir($q$
    select string_agg(name, ',' order by name) from public.search_directory(
      p_offers => array['kapital'], p_needs => array['investoren']) where name = any(pg_temp.fixtures())
  $q$),
  'Bea',
  'die Schnittmenge folgt beiden Gruppen, nicht nur der ersten');

-- ── 3. Leeres Array filtert nicht ───────────────────────────────────────────
select is(
  pg_temp.dir($q$
    select string_agg(name, ',' order by name) from public.search_directory(
      p_offers => array[]::text[]) where name = any(pg_temp.fixtures())
  $q$),
  pg_temp.dir($q$
    select string_agg(name, ',' order by name) from public.search_directory()
    where name = any(pg_temp.fixtures())
  $q$),
  'ein leeres p_offers filtert nicht (gleiche Menge wie ohne Argument)');

select is(
  pg_temp.dir($q$
    select string_agg(name, ',' order by name) from public.search_directory(
      p_offers => null) where name = any(pg_temp.fixtures())
  $q$),
  pg_temp.dir($q$
    select string_agg(name, ',' order by name) from public.search_directory()
    where name = any(pg_temp.fixtures())
  $q$),
  'ein NULL-p_offers filtert ebenfalls nicht');

-- ── 4. Kategorien im Rückgabewert ───────────────────────────────────────────
select is(
  pg_temp.dir($q$
    select array_to_string(offer_categories, ',') from public.search_directory()
    where name = 'Anna'
  $q$),
  'kapital,kontakte',
  'offer_categories kommt distinct zurück (zwei kapital-Zeilen, ein Eintrag)');

select is(
  pg_temp.dir($q$
    select array_to_string(need_categories, ',') from public.search_directory()
    where name = 'Anna'
  $q$),
  'experten',
  'need_categories trägt die Gesuch-Kategorien');

-- ── 5. Leeres Array statt NULL ──────────────────────────────────────────────
select is(
  pg_temp.dir($q$
    select (has_offers::text || '/' || (offer_categories is null)::text || '/'
            || cardinality(offer_categories)::text)
    from public.search_directory() where name = 'Dora'
  $q$),
  'true/false/0',
  'eine Zeile ohne Kategorie setzt has_offers, liefert aber {} statt NULL');

select is(
  pg_temp.dir($q$
    select ((offer_categories is null)::text || '/' || (need_categories is null)::text)
    from public.search_directory() where name = 'Egon'
  $q$),
  'false/false',
  'ein Mitglied ganz ohne offers/needs bekommt zwei leere Arrays, keine NULLs');

-- ── 6. Die Grenze verschiebt sich nicht ─────────────────────────────────────
select is(
  pg_temp.dir($q$
    select coalesce(string_agg(name, ','), '(leer)') from public.search_directory(
      p_offers => array['kapital']) where name = any(pg_temp.fixtures())
  $q$),
  'Anna,Bea',
  'is_public = false bleibt auch bei gesetztem Kategoriefilter unsichtbar (Cem fehlt)');

-- Egon steht unter `discover`: die Basis-RLS gibt ihm höchstens die eigene Zeile,
-- also darf ihm auch der Kategoriefilter nichts über Fremde verraten.
select is(
  pg_temp.names_as('d1000000-0000-0000-0000-000000000005', $q$
    select coalesce(string_agg(name || ':' || array_to_string(offer_categories, '|'), ','), '(leer)')
    from public.search_directory(p_offers => array['kapital']) where name = any(pg_temp.fixtures())
  $q$),
  '(leer)',
  'unterhalb von discover verrät der Kategoriefilter weder Zeilen noch Kategorien');

-- ── 7. anon bekommt kein Ausführungsrecht auf die neue Signatur ─────────────
select is(
  pg_temp.try_as_role('anon', $q$
    select 1 from public.search_directory(p_offers => array['kapital'])
  $q$),
  'DENIED:permission denied for function search_directory',
  'anon darf die neue Signatur nicht ausführen');

-- ── 8. Chip-Zeilen sind eindeutig, reiche Zeilen nicht ──────────────────────
-- Der Potenzial-Score summiert count(*) über offers/needs
-- (20260613230000_potential_score.sql:110). Eine doppelte Chip-Zeile bliese ihn
-- still auf; mehrere reiche Einträge derselben Kategorie sind dagegen erlaubt und
-- müssen es bleiben, sonst bricht der Suche-&-Biete-Editor.
select is(
  (select case when count(*) = 1 then 'OK' else 'unerwartet' end
   from public.offers
   where profile_id = 'd1000000-0000-0000-0000-000000000002' and source = 'editor'),
  'OK',
  'Beas bestehende Zeile trägt nach der Migration source = editor');

insert into public.offers (profile_id, category, title, source)
  values ('d1000000-0000-0000-0000-000000000002', 'mentoring', 'Beas Chip', 'chip');

select throws_ok(
  $$insert into public.offers (profile_id, category, title, source)
    values ('d1000000-0000-0000-0000-000000000002', 'mentoring', 'Beas zweiter Chip', 'chip')$$,
  '23505',
  null,
  'eine zweite Chip-Zeile derselben Kategorie wird abgewiesen');

select lives_ok(
  $$insert into public.offers (profile_id, category, title, source)
    values ('d1000000-0000-0000-0000-000000000002', 'kapital', 'Beas zweites Kapitalangebot', 'editor')$$,
  'mehrere reiche Zeilen derselben Kategorie bleiben erlaubt');

select * from finish();
rollback;
