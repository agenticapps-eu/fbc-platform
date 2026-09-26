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
select plan(35);

-- ── Fixtures ────────────────────────────────────────────────────────────────
-- auth.users-Insert feuert handle_new_user() und legt public.profiles an.
insert into auth.users (id, aud, role, email) values
  ('d1000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'anna@dir.test.fbc'),
  ('d1000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'bea@dir.test.fbc'),
  ('d1000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'cem@dir.test.fbc'),
  ('d1000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'dora@dir.test.fbc'),
  ('d1000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'egon@dir.test.fbc'),
  -- Frida und Gero kamen mit AGE-598 dazu: die Datei kannte bis dahin keine
  -- Stufe ZWISCHEN der untersten und `impact`, und genau dort liegt die Grenze,
  -- die AGE-903 auf Rang 4 hebt.
  ('d1000000-0000-0000-0000-000000000006', 'authenticated', 'authenticated', 'frida@dir.test.fbc'),
  ('d1000000-0000-0000-0000-000000000007', 'authenticated', 'authenticated', 'gero@dir.test.fbc');

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
-- Die drei Betrachter umschliessen die Grenze, und nach AGE-903 liegt sie
-- zwischen Rang 3 und Rang 4:
--
--   Egon  `active`   (Rang 1) — der unterste Rang, ausserhalb
--   Gero  `connect`  (Rang 3) — der HÖCHSTE Rang ausserhalb des Clubs, und
--                              damit der interessanteste Fall der Datei
--   Frida `discover` (Rang 4) — GENAU die unterste Clubstufe
--
-- Frida trug bis AGE-903 `discover` auf Rang 3, Gero `connect` auf Rang 2. Beide
-- behalten ihre ROLLE (die eine gerade drinnen, der andere gerade draussen) und
-- wechseln dafür den Rang — die Grenze ist gewandert, nicht die Fragestellung.
-- Anna (impact, Rang 6) belegt Fridas Fall NICHT: sie liegt zwei Ränge darüber,
-- und eine Zusage, die bei Rang 6 hält, sagt über Rang 4 nichts.
update public.profiles set tier = 'active', name = 'Egon', is_public = true
  where id = 'd1000000-0000-0000-0000-000000000005';
update public.profiles set tier = 'discover', name = 'Frida', is_public = true
  where id = 'd1000000-0000-0000-0000-000000000006';
update public.profiles set tier = 'connect', name = 'Gero', is_public = true
  where id = 'd1000000-0000-0000-0000-000000000007';

-- Annas Kompetenzen. Sie sind das erweiterte Feld, an dem sich die Rang-3-Grenze
-- MESSEN lässt: `search_directory` gibt die Spalte heraus, und die profiles-RLS
-- entscheidet, ob sie gefüllt ankommt. Ohne einen Wert hier wäre „leer bei
-- connect" auch dann grün, wenn die Grenze gefallen ist — leer ist leer.
update public.profiles set competencies = array['Bilanzanalyse']
  where id = 'd1000000-0000-0000-0000-000000000001';
-- Anna bekommt drei BASISFELDER mit unverwechselbaren Werten. Sie sind das
-- Gegenstück zu `Bilanzanalyse`: derselbe Volltext, aber ein Feld, das ein
-- `connect`-Konto sehen DARF. Ohne sie liesse sich „die Suche findet weiterhin,
-- was sichtbar ist" nicht von „die Suche ist für connect tot" unterscheiden —
-- und beides sähe in einer Zusage auf `Bilanzanalyse` gleich aus.
--
-- Keiner der Werte enthält `Ann` oder `Zzz`: Abschnitt 6 sucht danach, und ein
-- Zufallstreffer verschöbe dort die Erwartung.
update public.profiles set company = 'Nordlicht GmbH', region = 'Hamburg',
                           branche = 'Beratung'
  where id = 'd1000000-0000-0000-0000-000000000001';
-- Gero bekommt EIGENE erweiterte Daten. Ohne sie liesse sich „die eigene Zeile
-- kommt gefüllt" gar nicht messen — und ein Test, der nur die Maskierung prüft,
-- ist auch von einer Funktion erfüllt, die die Spalten für JEDEN leert.
update public.profiles set competencies = array['Eigenkompetenz']
  where id = 'd1000000-0000-0000-0000-000000000007';

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
  ('d1000000-0000-0000-0000-000000000004', null,       'Dora ohne Kategorie'),
  -- Eigene Kategorie, absichtlich in keinem bestehenden Filter: sonst
  -- verschöbe Geros Zeile die Erwartungswerte der Abschnitte 1-3.
  ('d1000000-0000-0000-0000-000000000007', 'weiterbildung', 'Geros Angebot');

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
  select array['Anna','Bea','Cem','Dora','Egon','Frida','Gero']::text[];
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

-- ── 9. Positivkontrolle an der untersten Clubstufe ──────────────────────────
-- Die Wache über die Grenze, von INNEN. Sie war schon vor AGE-903 da und stand
-- damals auf Rang 3; sie steht jetzt auf Rang 4 und fragt dasselbe.
--
-- Warum sie nötig ist: AGE-903 hebt die Schwelle, lässt also WENIGER Zeilen
-- durch. „Weniger Zeilen kommen an" ist aber auch genau das Bild, das ein
-- versehentlich zu hoch gesetztes Gate erzeugt. Ohne 9.1 sähe der teuerste
-- denkbare Fehler dieses Changes wie sein Erfolg aus.
--
-- Die Datei sagt oben „RED vor GREEN". Diese ist die Ausnahme und darf es sein:
-- sie ist eine Gegenprobe und muss grün stehen. Eine Gegenprobe, die erst rot
-- ist, misst nichts.

-- 9.1 Frida steht auf `discover` (Rang 4) und bekommt Annas Kompetenzen
-- GEFÜLLT — die unterste Clubstufe sieht das Verzeichnis vollständig.
select is(
  pg_temp.names_as('d1000000-0000-0000-0000-000000000006', $q$
    select array_to_string(competencies, ',') from public.search_directory()
     where name = 'Anna'
  $q$),
  'Bilanzanalyse',
  'Rang 4 bekommt die fremden competencies gefüllt — die unterste Clubstufe '
  'sieht das Verzeichnis vollstaendig');

-- 9.2 HAT IHRE AUFGABE ERFÜLLT UND IST DESHALB FORT.
--
-- Sie sagte zu: „Gero steht auf `connect` und sieht HEUTE nur sich selbst" —
-- der Ist-Zustand, den AGE-598 umdrehte. Sie stand grün, bis die Migration
-- 20260902150000 kam, und ist mit ihr rot geworden:
--
--     have: Anna,Bea,Dora,Egon,Frida,Gero
--     want: Gero
--
-- Genau dafür war sie da. Ohne sie wäre die Umkehrung ein stiller Nebeneffekt
-- gewesen; mit ihr ist sie ein Ereignis mit einer Zeile Beleg.
--
-- **AGE-903 dreht sie zurück**, und das ist keine Ironie, sondern die Sache:
-- die Verzeichnisliste hatte von AGE-598 bis AGE-903 eine eigene, niedrigere
-- Schwelle als ihre erweiterten Spalten. Diese Zweistufigkeit entfällt. Ihre
-- Nachfolge tritt 10.1 an — dieselbe Abfrage, und wieder „nur sich selbst".

-- ── 10. Liste und erweiterte Spalten tragen DIESELBE Schwelle (AGE-903) ─────
-- Das ist die Aufhebung der Zweistufigkeit aus AGE-598. Vorher gab es einen
-- Mittelzustand: in der Liste, aber mit maskierten Spalten. Den gibt es nicht
-- mehr — unterhalb Rang 4 bekommt ein Aufrufer die EIGENE Zeile und sonst
-- nichts.
--
-- Gero ist hier der wichtigste Betrachter der ganzen Datei: Rang 3 ist der
-- HÖCHSTE Rang ausserhalb des Clubs. Hielte die Schwelle bei ihm nicht, wäre
-- sie nirgends gehalten.

-- 10.1 Gero (Rang 3) bekommt GENAU die eigene Zeile. Cem fehlt ohnehin
-- (`is_public = false`) — das ist keine Stufenfrage und war es nie.
select is(
  pg_temp.names_as('d1000000-0000-0000-0000-000000000007', $q$
    select string_agg(name, ',' order by name) from public.search_directory()
     where name = any(pg_temp.fixtures())
  $q$),
  'Gero',
  'Rang 3 bekommt genau die eigene Zeile — der höchste Rang ausserhalb des '
  'Clubs sieht kein fremdes Profil');

-- 10.2 Die Positivkontrolle unmittelbar darüber: EIN Rang höher steht die
-- ganze Liste offen. Ohne sie wäre 10.1 auch von einem Gate erfüllt, das das
-- Verzeichnis für ALLE zumacht — und das wäre derselbe grüne Befund bei
-- entgegengesetztem Schaden.
select is(
  pg_temp.names_as('d1000000-0000-0000-0000-000000000006', $q$
    select string_agg(name, ',' order by name) from public.search_directory()
     where name = any(pg_temp.fixtures())
  $q$),
  'Anna,Bea,Dora,Egon,Frida,Gero',
  '… und Rang 4 bekommt die ganze Liste — die Grenze liegt zwischen 3 und 4 '
  'und nicht irgendwo darunter');

-- 10.3 Die eigene Zeile behält ihre erweiterten Felder. Das ist der Selbst-Zweig
-- der `profiles`-Policy, und er trägt keine Rangzahl.
--
-- Nebenbefund, der benannt sein will: damit ist die Maskierung im Rumpf von
-- `search_directory` (`coalesce(p.competencies, '{}')`) nach AGE-903
-- UNERREICHBAR. Jede Zeile, die ein Aufrufer bekommt, ist entweder seine eigene
-- — dann gefüllt — oder er steht ab Rang 4, und dann sieht er alles. Sie bleibt
-- trotzdem stehen: sie ist die Grenze, das Eintrittstor ist nur die Tür davor.
-- Sinkt das Tor je wieder, trägt sie sofort.
select is(
  pg_temp.names_as('d1000000-0000-0000-0000-000000000007', $q$
    select competencies::text || ' | ' || has_offers::text || ' | '
        || offer_categories::text
      from public.search_directory() where name = 'Gero'
  $q$),
  '{Eigenkompetenz} | true | {weiterbildung}',
  'die EIGENE Zeile bleibt auch unterhalb der Schwelle vollstaendig');

-- 10.4 `active` (Rang 1) bekommt GENAU die eigene Zeile — nicht null Zeilen.
--
-- Es ist entschieden, und zwar anderswo: `HeaderSearch.tsx` (AGE-540, Punkt 2
-- im Kopf) verlässt sich ausdrücklich darauf, dass „die Policy einem Konto
-- unterhalb der Clubstufe die EIGENE Zeile zurückgibt, und die ist ein gültiger
-- Treffer". Ein blosses `has_level(4)` als Eintrittstor gäbe null Zeilen und
-- bräche diese Zusage STILL — die Kopfzeilen-Suche eines Kontos ausserhalb des
-- Clubs fände danach nicht einmal mehr das eigene Profil.
--
-- Das Tor muss deshalb `has_level(4) or p.id = auth.uid()` lauten. Die Rangzahl
-- steht weiterhin an genau einer Stelle; der Selbst-Zweig trägt keine.
select is(
  pg_temp.names_as('d1000000-0000-0000-0000-000000000005', $q$
    select string_agg(name, ',' order by name) from public.search_directory()
     where name = any(pg_temp.fixtures())
  $q$),
  'Egon',
  'Rang 1 bekommt genau die eigene Zeile — der Selbst-Zweig aus AGE-540 bleibt');

-- ── 11. Der Volltext gibt nicht preis, was die Ausgabe maskiert ─────────────
-- Befund opencode HIGH-1 aus AGE-598. Die Gruppe verhinderte, dass die
-- Maskierung eine Kulisse wird: `competencies` wäre in der Ausgabe leer und
-- über das Suchfeld erfragbar gewesen. `search_doc` enthält competencies UND
-- interests.
--
-- **Nach AGE-903 ist die Frage anders gestellt, und zwar strenger.** Vorher
-- lautete sie „maskiert, aber nicht tot": ein Konto in der Liste durfte über
-- Basisfelder suchen, aber nicht über erweiterte. Jetzt sieht ein Konto
-- unterhalb Rang 4 überhaupt keine fremde Zeile — die Suche ist dort mit
-- Absicht tot, und die Unterscheidung „maskiert gegen tot" hat unterhalb der
-- Schwelle keinen Gegenstand mehr.
--
-- Was bleibt, ist die Frage nach OBEN: die Bindung darf die Suche für
-- Berechtigte nicht verengen. Das ist 11.3, und sie ist jetzt die Hauptzusage
-- der Gruppe.

-- 11.1 Unterhalb der Schwelle findet die Suche kein fremdes Profil — nicht über
-- ein erweitertes Feld …
select is(
  pg_temp.names_as('d1000000-0000-0000-0000-000000000007', $q$
    select coalesce(string_agg(name, ',' order by name), '(leer)')
      from public.search_directory(p_query => 'Bilanzanalyse')
     where name = any(pg_temp.fixtures())
  $q$),
  '(leer)',
  'Rang 3 findet Anna nicht über einen Begriff aus ihren competencies');

-- 11.2 … und auch nicht über ein BASISFELD. Das ist die Zusage, die sich mit
-- AGE-903 umgedreht hat: bis hierher stand hier `Anna`, weil ein Konto auf Rang
-- 2 in der Liste war und über den Firmennamen suchen durfte. Die Zweistufigkeit
-- ist weg, also ist auch dieser Weg zu.
--
-- Sie bleibt trotzdem stehen, und zwar als die schärfste Fassung von 10.1: eine
-- Suche ist ein zweiter Weg an dieselben Daten, und ein Gate, das nur die
-- Listenabfrage bewacht und die Suche offen lässt, wäre in 10.1 grün.
select is(
  pg_temp.names_as('d1000000-0000-0000-0000-000000000007', $q$
    select coalesce(string_agg(name, ',' order by name), '(leer)')
      from public.search_directory(p_query => 'Nordlicht')
     where name = any(pg_temp.fixtures())
  $q$),
  '(leer)',
  '… und auch nicht über den Firmennamen — die Suche ist kein zweiter Weg an '
  'die Liste');

-- 11.3 Ab Rang 4 bleibt der reiche Volltext. Die Positivkontrolle nach oben,
-- und nach AGE-903 die Hauptzusage dieser Gruppe: ohne sie wären 11.1 und 11.2
-- auch von einer Suche erfüllt, die für NIEMANDEN mehr etwas findet.
select is(
  pg_temp.names_as('d1000000-0000-0000-0000-000000000006', $q$
    select coalesce(string_agg(name, ',' order by name), '(leer)')
      from public.search_directory(p_query => 'Bilanzanalyse')
     where name = any(pg_temp.fixtures())
  $q$),
  'Anna',
  'Rang 4 findet den Kompetenz-Begriff weiterhin — die Bindung verengt die '
  'Suche für Berechtigte nicht');

-- ── 12. `branche` ist ein Basisfeld ─────────────────────────────────────────
-- Befund opencode HIGH-2 aus AGE-598. Die Spalte darf nicht still auf NULL
-- fallen, sonst läuft der Branchenfilter wortlos leer — ein sichtbarer Filter,
-- der nie etwas findet.
--
-- **Der Messpunkt musste mit AGE-903 wandern.** Vorher war die Zusage an einem
-- Konto UNTERHALB der Schwelle zu messen: nur dort trennte sich Basisfeld von
-- erweitertem Feld. Diese Trennung ist durch die Ausgabe von
-- `search_directory` nicht mehr beobachtbar (siehe 10.3) — gemessen wird
-- deshalb an Rang 4, und was die Zusage jetzt hält, ist die Herkunft der Spalte
-- aus `profiles_public`, nicht mehr ihre Sichtbarkeit unterhalb einer Schwelle.
--
-- Dass `profiles_public` bewusst KEINE Stufenschwelle trägt, steht als eigene
-- Anforderung in der Spec und wird in `rls_test.sql` belegt, nicht hier.

select is(
  pg_temp.names_as('d1000000-0000-0000-0000-000000000006', $q$
    select coalesce(branche, '(null)') from public.search_directory()
     where name = 'Anna'
  $q$),
  'Beratung',
  'branche kommt GEFÜLLT an — sie ist ein Basisfeld aus profiles_public');

select is(
  pg_temp.names_as('d1000000-0000-0000-0000-000000000006', $q$
    select coalesce(string_agg(name, ',' order by name), '(leer)')
      from public.search_directory(p_branche => 'Beratung')
     where name = any(pg_temp.fixtures())
  $q$),
  'Anna',
  '… und p_branche filtert für dasselbe Konto korrekt');

-- 12.3 Die Teilmengen-Regel, als Zusage statt als Kommentar.
--
-- Der Basis-Vektor MUSS eine Teilmenge von `search_doc` sein. `region` steht in
-- `profiles_public`, aber NICHT in `search_doc` — nähme man es in den
-- Basis-Vektor auf, könnte ein Konto am Selbst-Zweig nach der Region suchen und
-- ein Konto ab Rang 4 nicht. Die niedrigere Stufe bekäme eine Fähigkeit, die
-- der höheren fehlt, und das widerspräche 11.3.
--
-- Anna trägt `region = 'Hamburg'`. Beide Stufen müssen daran scheitern — nicht
-- weil Suche nach Region falsch wäre, sondern weil sie es für BEIDE zugleich
-- werden muss. Wird diese Zusage rot, weil jemand `region` durchsuchbar macht:
-- dann gehört es in BEIDE Vektoren, und dann ist Rot hier das richtige Signal.
select is(
  pg_temp.names_as('d1000000-0000-0000-0000-000000000007', $q$
    select coalesce(string_agg(name, ',' order by name), '(leer)')
      from public.search_directory(p_query => 'Hamburg')
     where name = any(pg_temp.fixtures())
  $q$) || ' / ' ||
  pg_temp.names_as('d1000000-0000-0000-0000-000000000006', $q$
    select coalesce(string_agg(name, ',' order by name), '(leer)')
      from public.search_directory(p_query => 'Hamburg')
     where name = any(pg_temp.fixtures())
  $q$),
  '(leer) / (leer)',
  'die Region ist auf BEIDEN Stufen nicht durchsuchbar — der Basis-Vektor '
  'bleibt eine Teilmenge von search_doc');

select * from finish();
rollback;
