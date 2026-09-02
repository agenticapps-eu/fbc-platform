-- `admin_list_feedback(int, int)` — Blätterung, Klemmung, `profile_id` (AGE-587).
-- Change: openspec/changes/admin-und-profilflaechen/.
--
-- Echtes pgTAP mit plan()/finish() — nur solche Dateien stehen im CI-Lauf.
--
-- WARUM EINE EIGENE DATEI:
-- `rls_test.sql` prüft die Funktion als GATE (wer bekommt Zeilen, wer nicht) und
-- tut das weiter. Hier geht es um ihre Blätterung, und dafür muss der Bestand
-- exakt bekannt sein — 106 Zeilen, alle mit demselben `created_at`. In der
-- gemeinsamen Datei stünde diese Fixture-Menge zwischen 420 fremden Assertions
-- und veränderte deren Ausgangslage.
--
-- WARUM ALLE ZEILEN DENSELBEN ZEITSTEMPEL TRAGEN:
-- `order by created_at desc` allein ist bei gleichen Zeitstempeln KEINE
-- Gesamtordnung — PostgreSQL darf die Zeilen dann in beliebiger Reihenfolge
-- liefern, und dieselbe Zeile kann auf Seite 1 UND Seite 2 stehen. Genau dagegen
-- steht der zweite Ordnungsschlüssel `id desc`. Mit verschiedenen Zeitstempeln
-- wäre er unbeobachtbar und der Test grün, obwohl er fehlt.
--
-- WARUM 106 UND NICHT 7:
-- Die Klemmung nach OBEN liegt bei 100. Unter 101 Zeilen liefert ein Aufruf mit
-- `p_limit => 9999` denselben Bestand, ob geklemmt wird oder nicht — die Zusage
-- wäre nicht unterscheidbar von ihrer Abwesenheit.

begin;
select plan(19);

-- ── Fixtures ────────────────────────────────────────────────────────────────
-- auth.users-Insert feuert handle_new_user() und legt public.profiles an.
insert into auth.users (id, aud, role, email) values
  ('fb000000-0000-0000-0000-0000000000ad', 'authenticated', 'authenticated', 'fb-admin@test.fbc'),
  ('fb000000-0000-0000-0000-00000000000a', 'authenticated', 'authenticated', 'fb-anna@test.fbc'),
  ('fb000000-0000-0000-0000-00000000000b', 'authenticated', 'authenticated', 'fb-bodo@test.fbc');

insert into public.staff_roles (profile_id, role) values
  ('fb000000-0000-0000-0000-0000000000ad', 'admin');

update public.profiles set name = 'Feedback-Admin', activated_at = now()
 where id = 'fb000000-0000-0000-0000-0000000000ad';
update public.profiles set name = 'Feedback-Anna', activated_at = now()
 where id = 'fb000000-0000-0000-0000-00000000000a';
update public.profiles set name = 'Feedback-Bodo', activated_at = now()
 where id = 'fb000000-0000-0000-0000-00000000000b';

-- Der Bestand wird geleert, damit die Blätterungs-Zusagen EXAKT sind. Ohne das
-- hingen sie am Seed: „Seite 1 und Seite 2 ergeben zusammen den Bestand" ist
-- keine Aussage über die Funktion, wenn unbekannt viele fremde Zeilen
-- mitblättern. Die Datei endet auf `rollback`.
delete from public.feedback;

-- 105 Zeilen von Anna, eine von Bodo. Alle mit DEMSELBEN Zeitstempel; die
-- Ordnung entscheidet damit allein `id desc`.
--
-- Die Kennungen werden GESETZT und nicht gewürfelt. Mit `gen_random_uuid()`
-- hinge es am Zufall, ob Bodos Zeile in die erste Seite fällt — bei 105
-- Mitbewerbern meistens ja, und ein Test, der meistens grün ist, ist kein
-- Wächter. So steht Bodo (`fbfb…`) sicher an erster Stelle und Annas Zeilen
-- folgen absteigend.
insert into public.feedback (id, profile_id, rating, likes, misses, idea, route, created_at)
select ('a0000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid,
       'fb000000-0000-0000-0000-00000000000a', 3, 'gut ' || i, 'fehlt ' || i, 'idee ' || i,
       '/seite/' || i, timestamptz '2026-08-01 12:00:00+00'
  from generate_series(1, 105) i;

insert into public.feedback (id, profile_id, rating, likes, route, created_at) values
  ('fbfbfbfb-0000-0000-0000-00000000000b', 'fb000000-0000-0000-0000-00000000000b',
   5, 'Bodos Lob', '/bodo', timestamptz '2026-08-01 12:00:00+00');

-- Themen und Bewertungen fuer die Filter-Zusagen (AGE-628, Aufgaben 3.1/3.8).
-- Alles andere traegt den Vorgabewert `generell` und die Bewertung 3.
--
-- Die drei markierten Zeilen liegen BEWUSST ganz hinten: `a…001` und `a…002`
-- sind bei `id desc` die Plaetze 106 und 105, also Seite 5. Eine Marke auf
-- einer Zeile der ersten Seite waere als Zusage wertlos — sie stuende dort
-- auch ohne Filter, und „der Filter greift vor der Seitengrenze" liesse sich
-- daran nicht von „der Filter greift gar nicht" unterscheiden.
update public.feedback set theme = 'fehler', rating = 1
 where id = 'a0000000-0000-0000-0000-000000000001';
update public.feedback set theme = 'fehler'
 where id = 'a0000000-0000-0000-0000-000000000002';
update public.feedback set theme = 'idee'
 where id = 'a0000000-0000-0000-0000-000000000003';

-- ── Helfer ──────────────────────────────────────────────────────────────────
-- SQLSTATE statt SQLERRM: die Zusage in 3.2 lautet „geklemmt, NICHT abgewiesen".
-- Ein Helfer, der nur „es hat gekracht" meldet, könnte „kein Fehler" nicht von
-- „der falsche Fehler" unterscheiden.
create function pg_temp.state_as(uid uuid, q text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    execute q;
  exception when others then
    reset role;
    perform set_config('request.jwt.claims', '', true);
    return SQLSTATE;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return 'KEIN FEHLER';
end $$;

create function pg_temp.int_as(uid uuid, q text) returns int language plpgsql as $$
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

-- Die Kennungen einer Seite, IN IHRER REIHENFOLGE. Ein Mengenvergleich liesse
-- eine vertauschte Ordnung durchgehen; genau die ist hier der Fehlerfall.
create function pg_temp.ids_as(uid uuid, q text) returns uuid[] language plpgsql as $$
declare a uuid[];
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  execute q into a;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return a;
end $$;

create function pg_temp.text_as(uid uuid, q text) returns text language plpgsql as $$
declare t text;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  execute q into t;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return t;
end $$;

-- Wie `text_as`, aber FAENGT den Fehler. Nur fuer die Filter-Zusagen (AGE-628):
-- solange die Funktion die neuen Argumente nicht kennt, wirft ein Aufruf mit
-- `p_themes => …` einen `42883`, und der risse in `text_as` die ganze
-- Testtransaktion mit — die RED-Stufe scheiterte dann als ABBRUCH statt als
-- Zusage, und die 18 Zusagen darueber waeren nicht mehr messbar.
-- SQLSTATE statt SQLERRM, damit die Meldung nicht an einem Wortlaut haengt.
create function pg_temp.versuch_as(uid uuid, q text) returns text language plpgsql as $$
declare t text;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    execute q into t;
  exception when others then
    reset role;
    perform set_config('request.jwt.claims', '', true);
    return 'FEHLER:' || SQLSTATE;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return t;
end $$;

-- ── 1. Die Vorgabewerte sind da (Aufgabe 2.4) ───────────────────────────────
-- Das ist die Zusage, die die fünf argumentlosen Aufrufe in `rls_test.sql`
-- (479, 486, 491, 496, 769) überhaupt erst zu Wächtern macht: sie bleiben
-- stehen, WEIL `admin_list_feedback()` weiter gültig ist. Verschwänden die
-- Vorgabewerte, brächen dort fünf Zusagen mit `42883`.
select is(
  pg_temp.ids_as('fb000000-0000-0000-0000-0000000000ad',
    $q$select array_agg(id) from public.admin_list_feedback()$q$),
  pg_temp.ids_as('fb000000-0000-0000-0000-0000000000ad',
    $q$select array_agg(id) from public.admin_list_feedback(25, 0)$q$),
  'Ein argumentloser Aufruf liefert dieselbe erste Seite wie (25, 0)');

select is(
  pg_temp.int_as('fb000000-0000-0000-0000-0000000000ad',
    $q$select count(*)::int from public.admin_list_feedback()$q$),
  25, 'Die Vorgabe-Seitengrösse ist 25');

-- ── 2. Blätterung: keine Überschneidung, keine Lücke (Aufgabe 3.1) ──────────
-- Die Zusage gilt für UNVERÄNDERTEN Bestand. Gegen gleichzeitige Zugänge hilft
-- Offset-Blätterung grundsätzlich nicht — das ist keine Lücke dieser Umsetzung,
-- sondern die Bauart, und deshalb steht es hier statt in einem Szenario.
select is(
  pg_temp.int_as('fb000000-0000-0000-0000-0000000000ad',
    $q$select cardinality(array(
         select unnest(array(select id from public.admin_list_feedback(25, 0)))
         intersect
         select unnest(array(select id from public.admin_list_feedback(25, 25)))))$q$),
  0, 'Seite 2 überschneidet sich nicht mit Seite 1');

select is(
  pg_temp.ids_as('fb000000-0000-0000-0000-0000000000ad',
    $q$select array(select id from public.admin_list_feedback(25, 0))
            || array(select id from public.admin_list_feedback(25, 25))
            || array(select id from public.admin_list_feedback(25, 50))
            || array(select id from public.admin_list_feedback(25, 75))$q$),
  pg_temp.ids_as('fb000000-0000-0000-0000-0000000000ad',
    $q$select array(select id from public.admin_list_feedback(100, 0))$q$),
  'Vier Seiten zu 25 ergeben Zeile für Zeile dieselbe Folge wie ein Aufruf mit 100');

-- Der zweite Ordnungsschlüssel, unmittelbar: bei gleichem `created_at` ist die
-- Folge absteigend nach `id`. Ohne `id desc` wäre die Reihenfolge unbestimmt
-- und diese Zusage fiele sporadisch — nicht immer, was sie umso wertvoller
-- macht als Wächter über eine Ordnung, die niemand sonst festhält.
select is(
  pg_temp.ids_as('fb000000-0000-0000-0000-0000000000ad',
    $q$select array(select id from public.admin_list_feedback(100, 0))$q$),
  pg_temp.ids_as('fb000000-0000-0000-0000-0000000000ad',
    $q$select array(select id from public.feedback order by created_at desc, id desc limit 100)$q$),
  'Bei gleichem Zeitstempel ordnet `id desc` — und zwar genau so');

-- ── 3. Geklemmt, nicht abgewiesen (Aufgabe 3.2) ─────────────────────────────
select is(
  pg_temp.int_as('fb000000-0000-0000-0000-0000000000ad',
    $q$select count(*)::int from public.admin_list_feedback(0, 0)$q$),
  1, 'p_limit 0 wird auf 1 geklemmt');

select is(
  pg_temp.int_as('fb000000-0000-0000-0000-0000000000ad',
    $q$select count(*)::int from public.admin_list_feedback(null, 0)$q$),
  25, 'p_limit null fällt auf die Vorgabe 25 zurück — nicht auf „ohne Grenze"');

select is(
  pg_temp.int_as('fb000000-0000-0000-0000-0000000000ad',
    $q$select count(*)::int from public.admin_list_feedback(9999, 0)$q$),
  100, 'p_limit 9999 wird auf 100 geklemmt');

select is(
  pg_temp.int_as('fb000000-0000-0000-0000-0000000000ad',
    $q$select count(*)::int from public.admin_list_feedback(25, null)$q$),
  25, 'p_offset null fällt auf 0 zurück');

select is(
  pg_temp.ids_as('fb000000-0000-0000-0000-0000000000ad',
    $q$select array(select id from public.admin_list_feedback(5, -20))$q$),
  pg_temp.ids_as('fb000000-0000-0000-0000-0000000000ad',
    $q$select array(select id from public.admin_list_feedback(5, 0))$q$),
  'Ein negativer p_offset wird auf 0 geklemmt — dieselbe Seite, kein Fehler');

-- Die Klemmung ist eine Klemmung und keine Abweisung: keiner der vier
-- Grenzfälle bricht ab. Ohne diese Zeile bliebe „liefert 1 Zeile" auch dann
-- grün, wenn die Funktion vorher mit einem anderen Weg dorthin käme.
select is(
  pg_temp.state_as('fb000000-0000-0000-0000-0000000000ad',
    $q$select 1 from public.admin_list_feedback(0, -1)
       union all select 1 from public.admin_list_feedback(9999, 0)
       union all select 1 from public.admin_list_feedback(null, null)$q$),
  'KEIN FEHLER', 'Kein Grenzfall von p_limit/p_offset wirft — sie werden geklemmt');

-- ── 4. `profile_id` zeigt auf DASSELBE Mitglied wie `author_name` (3.3) ─────
-- Nicht „die Spalte ist da": eine Spalte, die irgendeine Kennung trägt, wäre
-- schlimmer als keine. Bodos Zeile ist die einzige eines zweiten Verfassers —
-- an ihr ist eine Verwechslung sichtbar, an Annas 105 wäre sie es nicht.
select is(
  pg_temp.text_as('fb000000-0000-0000-0000-0000000000ad',
    $q$select profile_id::text from public.admin_list_feedback(100, 0)
        where id = 'fbfbfbfb-0000-0000-0000-00000000000b'$q$),
  'fb000000-0000-0000-0000-00000000000b',
  'Die Zeile trägt die profile_id ihres Verfassers');

-- Gegengeprüft wird die ZUORDNUNG, nicht ein Einzelwert: welche Kennung trägt
-- welchen Namen. Ein Vertauschen der beiden Verfasser fiele hier auf, an zwei
-- getrennten Einzelzusagen nicht.
--
-- Ausdrücklich OHNE Join auf `public.profiles`: dieser Test läuft als
-- `authenticated`, und dort entscheidet die RLS. Der Join lieferte null Zeilen
-- und die Zusage verglich zweimal nichts — genau so ist sie beim ersten Lauf
-- rot geworden. Die Auskunft, um die es geht, steht ohnehin in der RPC selbst.
select is(
  pg_temp.text_as('fb000000-0000-0000-0000-0000000000ad',
    $q$select string_agg(profile_id::text || '=' || author_name, ',' order by profile_id::text)
         from (select distinct profile_id, author_name
                 from public.admin_list_feedback(100, 0)) t$q$),
  'fb000000-0000-0000-0000-00000000000a=Feedback-Anna,'
  || 'fb000000-0000-0000-0000-00000000000b=Feedback-Bodo',
  'Jede profile_id trägt den Namen IHRES Verfassers — die beiden sind nicht vertauschbar');

-- ── 5. Das Gate bleibt, wie es war ──────────────────────────────────────────
-- Die Blätterung ändert am Zugang nichts: ein Nicht-Admin bekommt weiterhin
-- null Zeilen und KEINEN Fehler. Sieben Zusagen beschreiben genau dieses
-- Verhalten; hier steht es noch einmal mit Argumenten, weil `rls_test.sql` es
-- nur argumentlos prüft.
select is(
  pg_temp.int_as('fb000000-0000-0000-0000-00000000000a',
    $q$select count(*)::int from public.admin_list_feedback(100, 0)$q$),
  0, 'Ein gewöhnliches Mitglied bekommt auch mit Argumenten nichts');

select is(
  pg_temp.state_as('fb000000-0000-0000-0000-00000000000a',
    $q$select count(*) from public.admin_list_feedback(100, 0)$q$),
  'KEIN FEHLER', 'Und es bekommt eine leere Liste, keinen Fehler — anders als die Zähl-RPC');

-- ── 6. Rechte werden ausgesprochen, nicht geerbt (AGE-312, Aufgabe 3.7) ─────
select is(has_function_privilege('anon', 'public.admin_list_feedback(int,int)', 'execute'),
  false, 'admin_list_feedback: anon darf nicht ausführen');
select is(has_function_privilege('authenticated', 'public.admin_list_feedback(int,int)', 'execute'),
  true, 'admin_list_feedback: authenticated darf ausführen');
select ok(
  not exists (
    select 1 from aclexplode((select proacl from pg_proc
                               where oid = 'public.admin_list_feedback(int,int)'::regprocedure)) a
     where a.grantee = 0),
  'admin_list_feedback: PUBLIC hält kein EXECUTE');

-- ── 7. Der Filter nach Thema (AGE-628, Aufgabe 3.1) ─────────────────────────
-- DIE Zusage, um die es in Einheit 3 geht, und sie ist bewusst als EINE
-- geschrieben: sie sagt nicht „es kommt irgendetwas Gefiltertes", sondern
-- nennt beide Kennungen in ihrer Reihenfolge.
--
-- Was sie unterscheidbar macht: `a…002` und `a…001` sind ohne Filter die
-- Plätze 105 und 106, stehen also auf Seite 5. Käme der Filter ERST NACH
-- `limit`/`offset` zum Zug, läge hier eine leere Liste — die erste Seite trägt
-- keine einzige Zeile mit dem Thema `fehler`. Und griffe der Filter gar nicht,
-- stünden hier 25 Kennungen.
--
-- Der Aufruf nennt das Argument BEIM NAMEN. Positionell wäre er nach dem
-- `drop`/`create` aus 3.2 auch dann noch gültig, wenn die Argumente in einer
-- anderen Reihenfolge stünden.
select is(
  pg_temp.versuch_as('fb000000-0000-0000-0000-0000000000ad',
    $q$select array(select id from public.admin_list_feedback(
                      p_themes => array['fehler']))::text$q$),
  '{a0000000-0000-0000-0000-000000000002,a0000000-0000-0000-0000-000000000001}',
  'Nach Thema gefiltert steht eine Zeile von Seite 5 auf Seite 1 — der Filter greift VOR der Seitengrenze');

select * from finish();
rollback;
