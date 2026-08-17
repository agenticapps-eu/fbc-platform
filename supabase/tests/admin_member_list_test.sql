-- Admin-Mitgliederliste: `admin_list_members` (AGE-566).
-- Change: openspec/changes/add-admin-member-list/.
--
-- Echtes pgTAP mit plan()/finish() — nur solche Dateien stehen im CI-Lauf; die
-- manuellen probe_*.sql tun es nicht.
--
-- WARUM EINE EIGENE DATEI UND NICHT rls_test.sql:
-- Die Zusagen hier hängen an einem eng gebauten Bestand (fünf Mitglieder in
-- bestimmter Reihenfolge, davon zwei gleichnamige und eines ohne Namen). In der
-- gemeinsamen Datei stünden sie zwischen 420 fremden Assertions, und jeder
-- rot/grün-Durchlauf zöge die ganze Matrix mit.
--
-- WARUM JEDE ABFRAGE EINEN SUCHBEGRIFF TRÄGT:
-- Der lokale Stack ist geseedet (heute 73 Profile). Eine Zusage über „alle
-- Zeilen" wäre dort eine Zusage über den Seed, nicht über die Funktion — und
-- der voreingestellte `p_limit` von 50 schnitte das Sondenkonto sogar ab. Alle
-- Mengenaussagen laufen deshalb über `p_query = 'blaettern'`, das genau die
-- fünf Sondenkonten trifft (ihre Anmeldeadressen, nicht ihre Namen).
--
-- FALLEN, DIE DIESES PROJEKT SCHON GESTELLT HAT:
--   * In pgTAP heißt es `alike()`, nicht `like()`.
--   * `try_as()` meldet JEDEN Fehler als `DENIED:` — ein Test auf einen
--     zugesicherten Fehlercode muss den SQLSTATE lesen, sonst ist „falscher
--     Fehler" von „richtiger Fehler" nicht zu unterscheiden. Darum
--     `pg_temp.state_as` unten.
--   * Rechte werden nicht vererbt (AGE-312) — deshalb der Grant-Block am Ende.

begin;
select plan(24);

-- ── Fixtures ────────────────────────────────────────────────────────────────
-- auth.users-Insert feuert handle_new_user() und legt public.profiles an.
insert into auth.users (id, aud, role, email) values
  ('a0000000-0000-0000-0000-0000000000ad', 'authenticated', 'authenticated', 'liste-admin@test.fbc'),
  ('a0000000-0000-0000-0000-0000000000c0', 'authenticated', 'authenticated', 'liste-mitglied@test.fbc');

insert into public.staff_roles (profile_id, role) values
  ('a0000000-0000-0000-0000-0000000000ad', 'admin');

update public.profiles set name = 'Listen-Admin', activated_at = now()
 where id = 'a0000000-0000-0000-0000-0000000000ad';
update public.profiles set name = 'Kein Admin', activated_at = now()
 where id = 'a0000000-0000-0000-0000-0000000000c0';

-- Die fünf Sondenkonten für Reihenfolge und Blätterung. Zwei tragen denselben
-- Namen und eines gar keinen — ohne beides wäre der `id`-Stichentscheid nicht
-- messbar, und ein Test, der ihn nicht misst, ließe ihn beim nächsten Umbau
-- stillschweigend verschwinden.
insert into auth.users (id, aud, role, email) values
  ('b1000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'blaettern1@test.fbc'),
  ('b1000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'blaettern2@test.fbc'),
  ('b1000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'blaettern3@test.fbc'),
  ('b1000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'blaettern4@test.fbc'),
  ('b1000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'blaettern5@test.fbc');

update public.profiles set name = 'Anna Blatt',  activated_at = now()  where id = 'b1000000-0000-0000-0000-000000000001';
update public.profiles set name = 'Anna Blatt',  activated_at = now()  where id = 'b1000000-0000-0000-0000-000000000002';
update public.profiles set name = null,          activated_at = null   where id = 'b1000000-0000-0000-0000-000000000003';
update public.profiles set name = 'Bodo Blatt',  activated_at = now()  where id = 'b1000000-0000-0000-0000-000000000004';
update public.profiles set name = 'Carla Blatt', activated_at = now()  where id = 'b1000000-0000-0000-0000-000000000005';

-- Zwei Konten für die Suche, bewusst über KREUZ: bei dem einen trägt nur der
-- Name den Suchbegriff, bei dem anderen nur die Anmeldeadresse. Trüge ein Konto
-- ihn in beiden Feldern, wäre ein Treffer kein Beleg dafür, welches Feld
-- durchsucht wurde — und eine Umsetzung, die nur eines von beiden ansieht,
-- bliebe grün.
insert into auth.users (id, aud, role, email) values
  ('c1000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'n-only@test.fbc'),
  ('c1000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'adressensuche@test.fbc');

update public.profiles set name = 'Nadja Namenssuche', activated_at = now()
 where id = 'c1000000-0000-0000-0000-000000000001';
update public.profiles set name = 'Malte Meier', activated_at = now()
 where id = 'c1000000-0000-0000-0000-000000000002';

-- Carla (…005) ist das Mitglied für den PARITÄTSVERGLEICH. Sie bekommt in jeder
-- Verzeichnisspalte etwas zu sehen — Text, Arrays, und je eine Zeile in offers
-- und needs mit Kategorie. Ohne das verglichen beide Funktionen lauter leere
-- Felder: der Test wäre grün und prüfte nichts, auch wenn die Aggregate
-- auseinanderliefen.
update public.profiles set
    avatar_url   = 'https://example.test/carla.png',
    region       = 'Oberbayern',
    company      = 'Blatt & Partner',
    short_bio    = 'Baut Netzwerke.',
    branche      = 'Beratung',
    tier         = 'impact',
    roles        = array['Vorstand', 'Beirat'],
    competencies = array['Finanzierung', 'Strategie'],
    member_since = date '2019-03-01'
 where id = 'b1000000-0000-0000-0000-000000000005';

insert into public.offers (profile_id, title, category, source) values
  ('b1000000-0000-0000-0000-000000000005', 'Kapital', 'kapital', 'chip');
insert into public.needs (profile_id, title, category, source) values
  ('b1000000-0000-0000-0000-000000000005', 'Vertrieb', 'vertrieb', 'chip');

-- Der Leser für `search_directory`. Die Funktion ist SECURITY INVOKER, also
-- entscheidet die RLS des AUFRUFERS — und `has_level(3)` kennt keine
-- Admin-Ausnahme: ein Admin auf `basic` bekäme ein leeres Verzeichnis und der
-- Paritätsvergleich verglich zwei Nichtse. Deshalb `impact`.
update public.profiles set tier = 'impact'
 where id = 'a0000000-0000-0000-0000-0000000000c0';

-- ── Helfer ──────────────────────────────────────────────────────────────────
-- SQLSTATE statt SQLERRM: die Zusagen lauten auf `42501` und `22023`, und ein
-- Helfer, der nur „es hat gekracht" meldet, ließe eine Funktion durchgehen, die
-- am falschen Punkt aus dem falschen Grund abbricht.
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

-- Die RÜCKGABEspalten einer Tabellenfunktion, in ihrer Reihenfolge. `proargmodes`
-- unterscheidet Eingabe ('i') von Rückgabe ('t'); ohne diese Trennung stünden
-- `p_query` und `p_status` in der Liste und jeder Vergleich mit
-- `search_directory` wäre von vornherein ungleich.
create function pg_temp.rueckgabespalten(f regprocedure) returns text[]
language sql stable as $$
  select array(
    select a.name
      from pg_proc p,
           unnest(p.proargnames, p.proargmodes) with ordinality as a(name, modus, ord)
     where p.oid = f and a.modus = 't'
     order by a.ord)
$$;

-- ── 1. Die Abwehr steht in der Funktion, nicht in der Oberfläche ────────────
-- Der argumentlose Aufruf prüft zwei Dinge auf einmal: dass die Abwehr greift,
-- UND dass alle vier Parameter einen Vorgabewert tragen. Ohne die Vorgabewerte
-- meldete Postgres „function does not exist" (42883) statt der zugesicherten
-- 42501 — der Aufrufer bekäme also einen anderen Fehler als versprochen, und
-- ein Test auf „schlägt fehl" hätte den Unterschied nie bemerkt.
select is(
  pg_temp.state_as('a0000000-0000-0000-0000-0000000000c0',
    'select * from public.admin_list_members()'),
  '42501',
  'Ein Nicht-Admin prallt mit 42501 ab — und der argumentlose Aufruf belegt zugleich die vier Vorgabewerte');

-- ── 2. Der Zweck der Funktion: unbestätigte Mitglieder sind enthalten ───────
select is(
  pg_temp.int_as('a0000000-0000-0000-0000-0000000000ad',
    $q$select count(*)::int from public.admin_list_members('blaettern3')$q$),
  1, 'Ein Profil mit activated_at is null steht in der Liste …');

select is(
  pg_temp.text_as('a0000000-0000-0000-0000-0000000000ad',
    $q$select bestaetigt::text from public.admin_list_members('blaettern3')$q$),
  'false', '… und trägt bestaetigt = false');

-- ── 3. Der Status-Filter trennt die beiden Gruppen ──────────────────────────
select is(
  pg_temp.text_as('a0000000-0000-0000-0000-0000000000ad',
    $q$select string_agg(id::text, ',' order by id)
         from public.admin_list_members('blaettern', 'offen')$q$),
  'b1000000-0000-0000-0000-000000000003',
  'p_status = offen liefert genau die unbestätigten');

select is(
  pg_temp.int_as('a0000000-0000-0000-0000-0000000000ad',
    $q$select count(*)::int from public.admin_list_members('blaettern', 'aktiviert')$q$),
  4, 'p_status = aktiviert liefert genau die bestätigten');

select is(
  pg_temp.int_as('a0000000-0000-0000-0000-0000000000ad',
    $q$select count(*)::int from public.admin_list_members('blaettern', 'alle')$q$),
  5, 'p_status = alle filtert nicht');

select is(
  pg_temp.int_as('a0000000-0000-0000-0000-0000000000ad',
    $q$select count(*)::int from public.admin_list_members('blaettern', null)$q$),
  5, 'p_status = null filtert ebenso wenig');

-- Ein vertippter Filter, der stillschweigend alles zeigt, sieht aus wie ein
-- leerer Filter — und der Admin hielte eine ungefilterte Liste für eine
-- gefilterte.
select is(
  pg_temp.state_as('a0000000-0000-0000-0000-0000000000ad',
    $q$select * from public.admin_list_members('blaettern', 'offfen')$q$),
  '22023', 'Ein unbekannter Status bricht mit 22023 ab statt still wie alle zu wirken');

-- ── 4. Die Suche greift über Name UND Anmeldeadresse ────────────────────────
select is(
  pg_temp.text_as('a0000000-0000-0000-0000-0000000000ad',
    $q$select string_agg(id::text, ',') from public.admin_list_members('NAMENSSUCHE')$q$),
  'c1000000-0000-0000-0000-000000000001',
  'Die Suche findet über den Namen, unabhängig von Groß- und Kleinschreibung');

select is(
  pg_temp.text_as('a0000000-0000-0000-0000-0000000000ad',
    $q$select string_agg(id::text, ',') from public.admin_list_members('ADRESSENSUCHE')$q$),
  'c1000000-0000-0000-0000-000000000002',
  'Die Suche findet über die Anmeldeadresse, ebenso unabhängig von der Schreibung');

select is(
  pg_temp.int_as('a0000000-0000-0000-0000-0000000000ad',
    $q$select count(*)::int from public.admin_list_members('', null, 1000)$q$),
  pg_temp.int_as('a0000000-0000-0000-0000-0000000000ad',
    $q$select count(*)::int from public.admin_list_members(null, null, 1000)$q$),
  'Ein leerer Suchbegriff filtert genauso wenig wie null');

-- ── 5. Die Anmeldeadresse ja, die Kontaktdaten nein ─────────────────────────
-- Geprüft wird die SPALTENLISTE, nicht ein Beispieldatensatz: bei einem
-- Mitglied ohne hinterlegte Telefonnummer sähe ein leeres Feld genauso aus wie
-- ein fehlendes, und der Test wäre grün, während die Spalte ausgeliefert wird.
select ok(
  'login_email' = any(pg_temp.rueckgabespalten('public.admin_list_members(text,text,int,int)'::regprocedure)),
  'Die Anmeldeadresse steht in der Rückgabe — sie identifiziert das Konto');

select is(
  (select array_agg(c.column_name order by c.column_name)
     from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = 'profile_contacts'
      and c.column_name = any(pg_temp.rueckgabespalten(
            'public.admin_list_members(text,text,int,int)'::regprocedure))),
  null,
  'Keine einzige Spalte aus profile_contacts kommt vor — weder Adresse noch Telefonnummer');

-- ── 6. Blättern: die Seiten schneiden richtig und wiederholbar ──────────────
-- Die erwartete Reihenfolge ist: unbestätigte zuerst (…003, ohne Namen), dann
-- nach Namen, und bei den zwei gleichnamigen „Anna Blatt" entscheidet die `id`.
-- Genau daran hängt die Blätterung: ohne den Stichentscheid dürfte Postgres die
-- beiden Annas zwischen zwei Aufrufen tauschen, und dann fiele eine Zeile beim
-- Umblättern aus oder erschiene doppelt.
select is(
  pg_temp.text_as('a0000000-0000-0000-0000-0000000000ad',
    $q$select string_agg(t.id::text, ',' order by t.ordinality)
         from public.admin_list_members('blaettern') with ordinality as t$q$),
  'b1000000-0000-0000-0000-000000000003,'
  'b1000000-0000-0000-0000-000000000001,'
  'b1000000-0000-0000-0000-000000000002,'
  'b1000000-0000-0000-0000-000000000004,'
  'b1000000-0000-0000-0000-000000000005',
  'Unbestätigte zuerst, dann nach Namen, und die id entscheidet bei Namensgleichheit');

select is(
  pg_temp.text_as('a0000000-0000-0000-0000-0000000000ad',
    $q$select string_agg(t.id::text, ',' order by t.ordinality)
         from public.admin_list_members('blaettern', null, 2, 2) with ordinality as t$q$),
  'b1000000-0000-0000-0000-000000000002,b1000000-0000-0000-0000-000000000004',
  'p_limit = 2, p_offset = 2 liefert die Mitglieder drei und vier');

select is(
  pg_temp.text_as('a0000000-0000-0000-0000-0000000000ad',
    $q$select string_agg(t.id::text, ',' order by t.ordinality)
         from public.admin_list_members('blaettern', null, 2, 2) with ordinality as t$q$),
  pg_temp.text_as('a0000000-0000-0000-0000-0000000000ad',
    $q$select string_agg(t.id::text, ',' order by t.ordinality)
         from public.admin_list_members('blaettern', null, 2, 2) with ordinality as t$q$),
  '… und zwei Aufrufe liefern dieselbe Seite');

-- ── 7. Jokerzeichen sind Text, kein Muster ─────────────────────────────────
-- `admin_find_profile` hat diese Falle schon einmal gestellt: `%` ist in ILIKE
-- ein Platzhalter und lieferte die gesamte Mitgliedschaft. Hier ist die Liste
-- zwar gewollt — aber ein Suchbegriff soll suchen und nicht den Filter aufheben.
select is(
  pg_temp.int_as('a0000000-0000-0000-0000-0000000000ad',
    $q$select count(*)::int from public.admin_list_members('%', null, 1000)$q$),
  0, 'Ein Suchbegriff aus Jokerzeichen liefert nicht die gesamte Mitgliedschaft');

-- ── 8. Rechte werden ausgesprochen, nicht geerbt (AGE-312) ─────────────────
select is(has_function_privilege('anon', 'public.admin_list_members(text,text,int,int)', 'execute'),
  false, 'admin_list_members: anon darf nicht ausführen');
select is(has_function_privilege('authenticated', 'public.admin_list_members(text,text,int,int)', 'execute'),
  true, 'admin_list_members: authenticated darf — die Abwehr findet IN der Funktion statt und ist damit prüfbar');
select ok(
  not exists (
    select 1 from aclexplode((select proacl from pg_proc
                               where oid = 'public.admin_list_members(text,text,int,int)'::regprocedure)) a
     where a.grantee = 0),
  'admin_list_members: PUBLIC hält kein EXECUTE');

-- ── 9. Parität mit `search_directory` — Spalten UND Inhalt ─────────────────
-- Die Verzeichnisprojektion besteht jetzt ZWEIMAL. Das ist der bewusst gezahlte
-- Preis dafür, den mitgliedersichtbaren Lesepfad nicht anzufassen — und dieselbe
-- Falle, die `profiles_public` hier schon gestellt hat, wo vier
-- DEFINER-Funktionen ihr Prädikat duplizieren.
--
-- Geprüft wird BEIDES, und zwar aus zwei verschiedenen Gründen:
--   * die Spaltenliste fängt eine neue oder umbenannte Spalte;
--   * der Zeileninhalt fängt eine Abweichung, die die Spaltennamen unberührt
--     lässt — etwa ein `array_agg` ohne `distinct` oder ein fehlendes
--     `coalesce`. Der Spaltenvergleich allein bliebe dabei grün.
--
-- Die ZAHL der Spalten steht bewusst in keiner der beiden Zusagen: sie war schon
-- einmal falsch (dreizehn statt vierzehn), und beim nächsten Feld wäre sie es
-- wieder. Der Katalogvergleich bestimmt die Projektion.

select is(
  (select array_agg(s order by s) from (
     select unnest(pg_temp.rueckgabespalten('public.admin_list_members(text,text,int,int)'::regprocedure))
     except
     select unnest(pg_temp.rueckgabespalten(
       'public.search_directory(text,text,text,text,text,text,text[],text[])'::regprocedure))) x(s)),
  array['bestaetigt', 'login_email', 'member_since'],
  'Die Admin-Liste hat genau die drei Verwaltungsspalten zusätzlich — jede weitere steht hier namentlich');

select is(
  (select array_agg(s order by s) from (
     select unnest(pg_temp.rueckgabespalten(
       'public.search_directory(text,text,text,text,text,text,text[],text[])'::regprocedure))
     except
     select unnest(pg_temp.rueckgabespalten('public.admin_list_members(text,text,int,int)'::regprocedure))) x(s)),
  null,
  '… und keine Verzeichnisspalte fehlt — der Name der fehlenden stünde hier');

-- Die Wächter-Assertion. Ohne sie wäre der Vergleich darunter auch dann grün,
-- wenn beide Funktionen für dieses Mitglied lauter NULL und leere Arrays
-- lieferten — der klassische Vakuumtest.
select is(
  pg_temp.text_as('a0000000-0000-0000-0000-0000000000ad',
    $q$select t.company || '|' || array_to_string(t.offer_categories, ',')
              || '|' || array_to_string(t.need_categories, ',')
         from public.admin_list_members('blaettern5') t$q$),
  'Blatt & Partner|kapital|vertrieb',
  'Das Vergleichsmitglied trägt wirklich Werte in den Verzeichnisspalten');

select is(
  pg_temp.text_as('a0000000-0000-0000-0000-0000000000ad',
    $q$select (to_jsonb(t) - 'login_email' - 'bestaetigt' - 'member_since')::text
         from public.admin_list_members(null, null, 1000) t
        where t.id = 'b1000000-0000-0000-0000-000000000005'$q$),
  pg_temp.text_as('a0000000-0000-0000-0000-0000000000c0',
    $q$select to_jsonb(t)::text
         from public.search_directory() t
        where t.id = 'b1000000-0000-0000-0000-000000000005'$q$),
  'Für ein bestätigtes Mitglied liefern beide Funktionen dieselben Werte in den Verzeichnisspalten');

select * from finish();
rollback;
