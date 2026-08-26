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
select plan(24);

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

-- Cover als PFAD, nicht als URL (AGE-595). Seit AGE-580 steht in `cover_url` ein
-- relativer Pfad im Bucket `covers`; gerendert wird über `bildUrl("covers", …)`.
-- Ein Fixture mit `https://…` wäre grün, während in Produktion tote Bilder
-- erscheinen — es prüfte dann die Spalte, nicht den Vertrag. Bea bekommt
-- bewusst KEINES: ohne die Gegenprobe wäre „liefert den Wert durch" auch von
-- einer Funktion erfüllt, die stumpf denselben Pfad für jeden zurückgibt.
update public.profiles set cover_url = 'd1000000-0000-0000-0000-000000000001/1699999999.webp'
  where id = 'd1000000-0000-0000-0000-000000000001';

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
-- Bis AGE-602 stand hier ein Vergleich gegen die FEHLERMELDUNG eines Aufrufs.
-- Die war lokal grün — aber nicht, weil der Entzug wirkte, sondern weil `anon`
-- das Recht auf diesem Stack ohnehin nie hielt. In PROD hielt es `anon` sehr wohl
-- (die Default-ACL der Instanz erteilt es), und diese Zusage hat das zwei Monate
-- lang nicht gesehen. Sie prüfte eine Wirkung, nicht den Zustand, der sie erzeugt.
--
-- Deshalb steht hier jetzt das PRIVILEGIEN-BIT. Die Gegenprobe dazu — dass diese
-- Messung überhaupt in beide Richtungen ausschlägt — steht in `grants_test.sql`
-- (Abschnitt 7) an einer Wegwerf-Funktion; hier wäre sie ein zweiter Ort für
-- dieselbe Aussage.

select is(
  has_function_privilege(
    'anon',
    'public.search_directory(text,text,text,text,text,text,text[],text[])',
    'execute'),
  false,
  'anon hält KEIN Ausführungsrecht auf der neuen Signatur');

select is(
  has_function_privilege(
    'authenticated',
    'public.search_directory(text,text,text,text,text,text,text[],text[])',
    'execute'),
  true,
  'authenticated hält es weiterhin — der Entzug hat nicht zu viel mitgenommen');

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

-- ── 6. Praefixsuche: angefangene Woerter treffen (AGE-566) ──────────────────
-- „Det" fand „Detlev" nicht, weil `websearch_to_tsquery` volle Lexeme erzeugt.
-- Hier stellvertretend „Ann" fuer „Anna".
select is(
  pg_temp.dir($q$
    select string_agg(name, ',' order by name) from public.search_directory(p_query => 'Ann')
     where name = any(pg_temp.fixtures())
  $q$),
  'Anna',
  'ein angefangenes Wort findet das Mitglied (Praefixsuche)');

select is(
  pg_temp.dir($q$
    select string_agg(name, ',' order by name) from public.search_directory(p_query => 'Anna')
     where name = any(pg_temp.fixtures())
  $q$),
  'Anna',
  '… und der ausgeschriebene Name weiterhin auch');

-- Ein Fremdwort darf NICHT alles zurueckgeben: sonst waere „findet immer etwas"
-- keine Suche, sondern eine Liste.
select is(
  pg_temp.dir($q$
    select coalesce(string_agg(name, ',' order by name), '(leer)')
      from public.search_directory(p_query => 'Zzz') where name = any(pg_temp.fixtures())
  $q$),
  '(leer)',
  'ein Begriff ohne Treffer liefert nichts');

-- Sonderzeichen duerfen keinen Syntaxfehler ausloesen: `to_tsquery` bricht bei
-- einem einzelnen & ab, und ein Tippfehler im Suchfeld darf nicht als
-- Fehlermeldung ankommen.
select is(
  pg_temp.dir($q$
    select coalesce(string_agg(name, ',' order by name), '(leer)')
      from public.search_directory(p_query => '&&&') where name = any(pg_temp.fixtures())
  $q$),
  '(leer)',
  'reine Sonderzeichen ergeben eine leere Treffermenge statt eines Fehlers');

-- ── 9. Das Cover steht im Rückgabesatz (AGE-595) ───────────────────────────
-- Die Karte im Verzeichnis soll das Hintergrundbild zeigen, ohne eine zweite
-- Abfrage je Mitglied. Der Wert wird WÖRTLICH durchgereicht — die Übersetzung in
-- eine darstellbare Adresse ist Sache des Clients, und eine Funktion, die hier
-- eine URL bastelte, verteilte die Bucket-Kenntnis auf zwei Schichten.
select is(
  pg_temp.dir($q$
    select coalesce(string_agg(name || '=' || coalesce(cover_url, '(null)'), ',' order by name), '(leer)')
      from public.search_directory() where name in ('Anna', 'Bea')
  $q$),
  'Anna=d1000000-0000-0000-0000-000000000001/1699999999.webp,Bea=(null)',
  'cover_url kommt als gespeicherter Pfad zurück — gesetzt bei Anna, null bei Bea');

-- Ein Mitglied ohne Cover darf den Aufruf nicht zerlegen. Das ist nicht dieselbe
-- Zusage wie oben: dort steht `cover_url` in einer Aggregation über zwei Zeilen,
-- hier wird die Zeile allein gelesen.
select is(
  pg_temp.dir($q$
    select coalesce((select cover_url from public.search_directory() where name = 'Bea'), '(null)')
  $q$),
  '(null)',
  'ein Mitglied ohne Cover liefert null statt eines Fehlers');

-- Die Gegenprobe zu Abschnitt 7: `revoke ... from public` allein wäre grün dort
-- und nähme der Anwendung den Zugriff. Beide Richtungen gehören geprüft, sonst
-- ist ein vergessenes `grant` erst zur Laufzeit sichtbar.
select is(
  pg_temp.try_as_role('authenticated', $q$
    select 1 from public.search_directory()
  $q$),
  'OK',
  'authenticated behält das Ausführungsrecht an der neuen Signatur');

-- Der Kommentar ist kein Beiwerk: ein `drop function` nimmt ihn mit, und die
-- Vorgaengerfassung kam mit `create or replace` aus, wo er ueberlebte. Ohne
-- diese Zusage verschwindet der Grund einer Funktion beim naechsten Drop, ohne
-- dass irgendetwas rot wird.
select isnt(
  obj_description(
    'public.search_directory(text,text,text,text,text,text,text[],text[])'::regprocedure,
    'pg_proc'),
  null,
  'search_directory traegt nach dem drop/create wieder einen Kommentar');

select * from finish();
rollback;
