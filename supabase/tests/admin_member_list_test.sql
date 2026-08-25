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
select plan(74);

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

-- Diese beiden Zusagen MUSSTEN mit AGE-581 brechen, und das ist ihre Aufgabe:
-- die Admin-Liste bekommt neue Verwaltungsspalten, und eine Zusage, die neue
-- Spalten stillschweigend hinnähme, wäre keine. Die Namen stehen deshalb
-- weiterhin einzeln da — wer eine hinzufügt, kommt hier wieder vorbei.
--
-- Und genau das ist am 24.08. passiert: `gebannt` kam dazu (Diff-Prüfung), die
-- Zusage brach, und dieser Kommentar wurde zum zweiten Mal umgeschrieben. Sie
-- tut also, wozu sie da ist.

select is(
  (select array_agg(s order by s) from (
     select unnest(pg_temp.rueckgabespalten('public.admin_list_members(text,text,int,int)'::regprocedure))
     except
     select unnest(pg_temp.rueckgabespalten(
       'public.search_directory(text,text,text,text,text,text,text[],text[])'::regprocedure))) x(s)),
  array['bestaetigt', 'deaktiviert_seit', 'gebannt', 'geloescht_seit', 'login_email',
        'member_since', 'paid_until', 'payment_type'],
  'Die Admin-Liste hat genau die acht Verwaltungsspalten zusätzlich — jede weitere steht hier namentlich');

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
    $q$select (to_jsonb(t) - 'login_email' - 'bestaetigt' - 'member_since'
                         - 'deaktiviert_seit' - 'geloescht_seit'
                         - 'paid_until' - 'payment_type' - 'gebannt')::text
         from public.admin_list_members(null, null, 1000) t
        where t.id = 'b1000000-0000-0000-0000-000000000005'$q$),
  pg_temp.text_as('a0000000-0000-0000-0000-0000000000c0',
    $q$select to_jsonb(t)::text
         from public.search_directory() t
        where t.id = 'b1000000-0000-0000-0000-000000000005'$q$),
  'Für ein bestätigtes Mitglied liefern beide Funktionen dieselben Werte in den Verzeichnisspalten');

-- ── 10. `admin_activate_member`: die Spur entsteht MIT der Fähigkeit ───────
-- Das ist keine Zutat dieses Changes, sondern die Erfüllung einer BESTEHENDEN
-- Anforderung: „Privilegierte Änderungen hinterlassen eine Spur"
-- (openspec/specs/admin/spec.md:360) verlangt für jede Admin-Änderung an einem
-- fremden Konto eine Zeile in `public.admin_audit`, ausdrücklich „mit der
-- Fähigkeit zusammen" und „SHALL NOT nachgereicht". Der Plan-Review hat den
-- Verstoß gefunden, bevor eine Zeile Code stand.
--
-- Hier wiegt sie besonders schwer: die Änderung macht die Angaben eines
-- Menschen für andere sichtbar, und die Anwendung kennt keinen Weg zurück.

insert into auth.users (id, aud, role, email) values
  ('e1000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'ziel-offen@test.fbc'),
  ('e1000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'ziel-bestaetigt@test.fbc'),
  ('e1000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'ziel-transaktion@test.fbc'),
  ('e1000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'ziel-einloeseweg@test.fbc');

update public.profiles set name = 'Ziel Offen',        activated_at = null  where id = 'e1000000-0000-0000-0000-000000000001';
update public.profiles set name = 'Ziel Bestaetigt',   activated_at = now() where id = 'e1000000-0000-0000-0000-000000000002';
update public.profiles set name = 'Ziel Transaktion',  activated_at = null  where id = 'e1000000-0000-0000-0000-000000000003';
update public.profiles set name = 'Ziel Einloeseweg',  activated_at = null  where id = 'e1000000-0000-0000-0000-000000000004';

-- `mark_activated` liegt bei `service_role` (AGE-312: service_role hält keine
-- Tabellenrechte und arbeitet ausschließlich über DEFINER-Funktionen). Der
-- Regressionstest weiter unten braucht deshalb diese Rolle, nicht ein Mitglied.
create function pg_temp.state_as_service(q text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role service_role';
  begin
    execute q;
  exception when others then
    reset role;
    return SQLSTATE;
  end;
  reset role;
  return 'KEIN FEHLER';
end $$;

-- 10.1 Die Abwehr — und sie darf auch keine Spur hinterlassen. Ein Protokoll,
-- das abgewehrte Versuche als Änderungen führt, erzählt später die falsche
-- Geschichte.
select is(
  pg_temp.state_as('a0000000-0000-0000-0000-0000000000c0',
    $q$select public.admin_activate_member('e1000000-0000-0000-0000-000000000001')$q$),
  '42501', 'Ein Nicht-Admin kann nicht aktivieren (42501)');

select is(
  (select activated_at from public.profiles where id = 'e1000000-0000-0000-0000-000000000001'),
  null, '… das Zielprofil bleibt unbestätigt …');

select is(
  (select count(*)::int from public.admin_audit
    where target = 'e1000000-0000-0000-0000-000000000001'),
  0, '… und es entsteht KEINE admin_audit-Zeile');

-- 10.2 Der Erfolgsfall samt Spur.
select is(
  pg_temp.state_as('a0000000-0000-0000-0000-0000000000ad',
    $q$select public.admin_activate_member('e1000000-0000-0000-0000-000000000001')$q$),
  'KEIN FEHLER', 'Ein Admin aktiviert ein unbestätigtes Mitglied');

select isnt(
  (select activated_at from public.profiles where id = 'e1000000-0000-0000-0000-000000000001'),
  null, '… activated_at ist gesetzt …');

select is(
  (select count(*)::int from public.admin_audit
    where target = 'e1000000-0000-0000-0000-000000000001'),
  1, '… genau eine Protokollzeile ist entstanden …');

select is(
  (select actor::text || '|' || action || '|' || target::text from public.admin_audit
    where target = 'e1000000-0000-0000-0000-000000000001'),
  'a0000000-0000-0000-0000-0000000000ad|activate_member|e1000000-0000-0000-0000-000000000001',
  '… und sie nennt handelndes Konto, Art der Änderung und Zielkonto');

-- 10.3 Eine Transaktion, nicht zwei Anweisungen. Ohne diese Probe bliebe
-- unbelegt, dass eine Sichtbarkeitsänderung ohne Spur unmöglich ist — genau der
-- Zustand, den die bestehende Anforderung ausschließt. Ein Rumpf, der den
-- Protokollfehler abfinge (`exception when others then null`), käme sonst durch.
create function pg_temp.spur_verweigern() returns trigger language plpgsql as $$
begin
  raise exception 'Protokoll nicht schreibbar' using errcode = '58030';
end $$;

create trigger spur_bricht before insert on public.admin_audit
  for each row execute function pg_temp.spur_verweigern();

select isnt(
  pg_temp.state_as('a0000000-0000-0000-0000-0000000000ad',
    $q$select public.admin_activate_member('e1000000-0000-0000-0000-000000000003')$q$),
  'KEIN FEHLER', 'Schlägt das Schreiben der Spur fehl, schlägt der ganze Aufruf fehl …');

select is(
  (select activated_at from public.profiles where id = 'e1000000-0000-0000-0000-000000000003'),
  null, '… und activated_at bleibt ungesetzt — beides steht in EINER Transaktion');

drop trigger spur_bricht on public.admin_audit;

-- 10.4 Ein zweiter Aufruf ist ein Irrtum oder ein Doppelklick. Beides soll
-- nicht zu einer zweiten Protokollzeile über eine Änderung führen, die gar
-- nicht stattfand.
--
-- Das Ziel ist bewusst „…001" — dasselbe Mitglied, das 10.2 gerade über DIESE
-- Funktion aktiviert hat, mit genau einer Protokollzeile im Rücken. Ein per
-- Fixture bestätigtes Profil belegte nur „0 bleibt 0" und liesse eine Umsetzung
-- durch, die beim echten zweiten Klick nachprotokolliert.
select is(
  pg_temp.state_as('a0000000-0000-0000-0000-0000000000ad',
    $q$select public.admin_activate_member('e1000000-0000-0000-0000-000000000001')$q$),
  '22023', 'Ein zweiter Aufruf auf dasselbe Profil bricht mit 22023 ab …');

select is(
  (select count(*)::int from public.admin_audit
    where target = 'e1000000-0000-0000-0000-000000000001'),
  1, '… und es bleibt bei EINER Protokollzeile');

-- Und derselbe Abbruch für ein Profil, das auf anderem Weg bestätigt wurde —
-- etwa über den Einlöselink des Mitglieds selbst.
select is(
  pg_temp.state_as('a0000000-0000-0000-0000-0000000000ad',
    $q$select public.admin_activate_member('e1000000-0000-0000-0000-000000000002')$q$),
  '22023', 'Ein anderweitig bestätigtes Profil ebenso …');

select is(
  (select count(*)::int from public.admin_audit
    where target = 'e1000000-0000-0000-0000-000000000002'),
  0, '… und hinterlässt keine Protokollzeile');

-- 10.5 REGRESSIONSTEST (startet grün, kein RED): der Einlöseweg bleibt
-- unangetastet. `mark_activated` prüft `is_admin()` bewusst NICHT — sie wird von
-- `redeem-activation` mit `service_role` gerufen. Ihr eine Admin-Prüfung
-- hinzuzufügen bräche die Selbstaktivierung jedes Mitglieds; diese zwei
-- Assertions sind die Sicherung dagegen.
select is(
  pg_temp.state_as_service(
    $q$select public.mark_activated('e1000000-0000-0000-0000-000000000004')$q$),
  'KEIN FEHLER', 'mark_activated gelingt weiterhin OHNE Admin-Rolle (Einlöseweg)');

select isnt(
  (select activated_at from public.profiles where id = 'e1000000-0000-0000-0000-000000000004'),
  null, '… und setzt activated_at wirklich');

-- 10.6 Rechte, ausgesprochen statt geerbt (AGE-312).
select is(has_function_privilege('anon', 'public.admin_activate_member(uuid)', 'execute'),
  false, 'admin_activate_member: anon darf nicht ausführen');
select is(has_function_privilege('authenticated', 'public.admin_activate_member(uuid)', 'execute'),
  true, 'admin_activate_member: authenticated darf — die Abwehr steht IN der Funktion');
select ok(
  not exists (
    select 1 from aclexplode((select proacl from pg_proc
                               where oid = 'public.admin_activate_member(uuid)'::regprocedure)) a
     where a.grantee = 0),
  'admin_activate_member: PUBLIC hält kein EXECUTE');

-- ── 11. Die beiden Befunde aus dem Diff-Review (AGE-566, 17.08.) ───────────
-- Migration: 20260817140000_admin_member_list_fixes.sql. Beide Zusagen sind
-- ROT auf der ersten Fassung.

-- Einundfünfzig Konten, eines mehr als der Vorgabewert. Ohne diese Zeilen wäre
-- die Zusage „null wirkt wie 50" nicht messbar: bei weniger als fünfzig
-- Treffern liefern `limit 50` und `limit null` dasselbe, und der Test bliebe
-- grün, während die Grenze fehlte.
insert into auth.users (id, aud, role, email)
select ('d1000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid,
       'authenticated', 'authenticated', 'grenze' || i || '@test.fbc'
  from generate_series(1, 51) i;

-- 11.1 Ein ausdrückliches `null` ist KEIN Vorgabewert. `limit null` heißt in
-- Postgres „ohne Grenze"; `database.types.ts` erlaubt `p_limit: number | null`,
-- und damit ist die zugesicherte serverseitige Blätterung mit einem einzigen
-- `?? null` abschaltbar. Auf der ersten Fassung liefert dieser Aufruf 51.
select is(
  pg_temp.int_as('a0000000-0000-0000-0000-0000000000ad',
    $q$select count(*)::int from public.admin_list_members('grenze', null, null, null)$q$),
  50, 'p_limit = null greift auf den Vorgabewert zurück statt die Grenze aufzuheben');

-- 11.2 Und der Weg über das fehlende Argument führt auf denselben Wert. Beide
-- Wege einzeln zu prüfen ist der Punkt: die 50 steht nach der Korrektur an zwei
-- Stellen (Signatur und Rumpf), und ein Test, der nur einen Weg geht, ließe sie
-- auseinanderlaufen.
select is(
  pg_temp.int_as('a0000000-0000-0000-0000-0000000000ad',
    $q$select count(*)::int from public.admin_list_members('grenze')$q$),
  50, '… und das fehlende Argument führt auf denselben Wert');

-- 11.3 WÄCHTER, kein Verhaltenstest — und das ist hier kein Versehen.
-- Der Befund ist ein WETTLAUF: zwei gleichzeitige Aufrufe lesen beide `null`,
-- kommen beide an der 22023-Prüfung vorbei und schreiben BEIDE eine Auditzeile
-- für eine einzige Änderung. pgTAP läuft in EINER Transaktion und kann zwei
-- nebenläufige Sitzungen nicht herstellen; ein Test, der es zu behaupten
-- vorgäbe, prüfte etwas anderes als seinen Namen.
--
-- Der Beleg ist deshalb eine Messung mit zwei Verbindungen (17.08., lokaler
-- Stack, festgehalten in REVIEWS.md): vorher zwei Auditzeilen für eine
-- Aktivierung, nachher eine. Diese Assertion hält nur fest, dass die Sperre
-- nicht wieder aus dem Rumpf verschwindet — sie ist das Gedächtnis der Messung,
-- nicht ihr Ersatz.
select alike(
  pg_get_functiondef('public.admin_activate_member(uuid)'::regprocedure),
  '%for update%',
  'admin_activate_member liest die Zielzeile gesperrt (for update) — Gedächtnis der Wettlauf-Messung');

-- ── 12. Lebenszyklus in der Admin-Liste (AGE-581) ──────────────────────────
-- Fünf Sondenkonten mit eigenem Suchbegriff `zyklusliste`. Ein eigener Begriff
-- und nicht `blaettern`: die Mengenzusagen dort stehen auf genau fünf Treffern,
-- und ein sechster machte sie stillschweigend falsch.
--
-- Die fünf decken die Kreuzung ab, an der sich die Filter entscheiden:
-- aktiviert · unbestätigt · deaktiviert · gelöscht · deaktiviert UND gelöscht.
-- Das letzte ist der eigentliche Grund für diesen Block — ohne es bliebe
-- unbelegt, dass `deaktiviert` und `geloescht` nicht dieselbe Zeile zweimal
-- zeigen, und genau das ist beim Löschen der Normalfall: es bringt die Sperre
-- mit.

insert into auth.users (id, aud, role, email) values
  ('f5000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'zyklusliste1@test.fbc'),
  ('f5000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'zyklusliste2@test.fbc'),
  ('f5000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'zyklusliste3@test.fbc'),
  ('f5000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'zyklusliste4@test.fbc'),
  ('f5000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'zyklusliste5@test.fbc');

update public.profiles set name = 'Zyklus Aktiv',        activated_at = now()
 where id = 'f5000000-0000-0000-0000-000000000001';
update public.profiles set name = 'Zyklus Offen',        activated_at = null
 where id = 'f5000000-0000-0000-0000-000000000002';
update public.profiles set name = 'Zyklus Deaktiviert',  activated_at = now(),
       disabled_at = timestamptz '2026-08-01 10:00:00+00'
 where id = 'f5000000-0000-0000-0000-000000000003';
update public.profiles set name = 'Zyklus Geloescht',    activated_at = now(),
       deleted_at  = timestamptz '2026-08-02 11:00:00+00'
 where id = 'f5000000-0000-0000-0000-000000000004';
update public.profiles set name = 'Zyklus Beides',       activated_at = now(),
       disabled_at = timestamptz '2026-08-03 12:00:00+00',
       deleted_at  = timestamptz '2026-08-04 13:00:00+00'
 where id = 'f5000000-0000-0000-0000-000000000005';

-- Drei Ban-Zustände für §12.13–12.15. Sie liegen auf den BESTEHENDEN
-- Sondenkonten statt auf neuen: der Ban ist keine eigene Zeilenart, sondern die
-- zweite Hälfte eines Zustands, den `disabled_at`/`deleted_at` schon tragen.
--
--   3 (deaktiviert)         → Ban steht  ⇒ vollständig
--   5 (deaktiviert+gelöscht)→ Ban FEHLT  ⇒ der halbe Zustand
--   1 (aktiv)               → Ban ABGELAUFEN ⇒ kein Ban
update auth.users set banned_until = now() + interval '100 years'
 where id = 'f5000000-0000-0000-0000-000000000003';
update auth.users set banned_until = now() - interval '1 day'
 where id = 'f5000000-0000-0000-0000-000000000001';

-- Nur das erste Konto bekommt eine Altdatenzeile. Das zweite bleibt bewusst
-- ohne — es ist der Beleg für den `left join`.
insert into public.profile_legacy (profile_id, paid_until, payment_type) values
  ('f5000000-0000-0000-0000-000000000001', date '2027-01-31', 'copecart');

-- 12.1/12.2 Erst die beiden neuen Statuswerte überhaupt: sie sind heute
-- unbekannt und brechen mit 22023 ab. Diese zwei Zusagen stehen VOR den
-- Mengenzusagen, weil ein 22023 dort die ganze Datei abbräche und der rote Lauf
-- dann nicht mehr sagte, WORAN es liegt.
select is(
  pg_temp.state_as('a0000000-0000-0000-0000-0000000000ad',
    $q$select * from public.admin_list_members('zyklusliste', 'deaktiviert')$q$),
  'KEIN FEHLER', 'p_status = deaktiviert ist ein bekannter Wert');

select is(
  pg_temp.state_as('a0000000-0000-0000-0000-0000000000ad',
    $q$select * from public.admin_list_members('zyklusliste', 'geloescht')$q$),
  'KEIN FEHLER', 'p_status = geloescht ebenso');

-- 12.3–12.6 Die drei bestehenden Filter beantworten Fragen über die
-- MITGLIEDSCHAFT. Ein entferntes Mitglied gehört nicht dazu — es fällt aus
-- `alle`, `aktiviert` und `offen` heraus, nicht bloss aus einem davon.
select is(
  pg_temp.text_as('a0000000-0000-0000-0000-0000000000ad',
    $q$select string_agg(id::text, ',' order by id)
         from public.admin_list_members('zyklusliste', 'alle')$q$),
  'f5000000-0000-0000-0000-000000000001,f5000000-0000-0000-0000-000000000002',
  'p_status = alle zeigt weder Deaktivierte noch Gelöschte');

select is(
  pg_temp.text_as('a0000000-0000-0000-0000-0000000000ad',
    $q$select string_agg(id::text, ',' order by id)
         from public.admin_list_members('zyklusliste', null)$q$),
  'f5000000-0000-0000-0000-000000000001,f5000000-0000-0000-0000-000000000002',
  '… und der fehlende Filter ist derselbe Fall, nicht die Rohtabelle');

select is(
  pg_temp.text_as('a0000000-0000-0000-0000-0000000000ad',
    $q$select string_agg(id::text, ',' order by id)
         from public.admin_list_members('zyklusliste', 'aktiviert')$q$),
  'f5000000-0000-0000-0000-000000000001',
  'p_status = aktiviert zeigt das aktivierte, nicht die drei entfernten');

select is(
  pg_temp.text_as('a0000000-0000-0000-0000-0000000000ad',
    $q$select string_agg(id::text, ',' order by id)
         from public.admin_list_members('zyklusliste', 'offen')$q$),
  'f5000000-0000-0000-0000-000000000002',
  'p_status = offen zeigt das unbestätigte');

-- 12.7/12.8 Und die beiden neuen Reiter teilen sich die Entfernten
-- überschneidungsfrei: das doppelt getroffene Konto steht unter `geloescht`.
select is(
  pg_temp.text_as('a0000000-0000-0000-0000-0000000000ad',
    $q$select string_agg(id::text, ',' order by id)
         from public.admin_list_members('zyklusliste', 'deaktiviert')$q$),
  'f5000000-0000-0000-0000-000000000003',
  'p_status = deaktiviert zeigt NUR das rein deaktivierte — nicht das zusätzlich gelöschte');

select is(
  pg_temp.text_as('a0000000-0000-0000-0000-0000000000ad',
    $q$select string_agg(id::text, ',' order by id)
         from public.admin_list_members('zyklusliste', 'geloescht')$q$),
  'f5000000-0000-0000-0000-000000000004,f5000000-0000-0000-0000-000000000005',
  'p_status = geloescht zeigt beide gelöschten, auch das zusätzlich deaktivierte');

-- 12.9/12.10 Zeitpunkte, keine Wahrheitswerte. Verglichen wird gegen den
-- gesetzten Zeitstempel und nicht gegen seine Textfassung: die hinge an der
-- Zeitzone der Sitzung, und der Test spräche dann über die Umgebung.
select is(
  pg_temp.text_as('a0000000-0000-0000-0000-0000000000ad',
    $q$select (t.deaktiviert_seit = timestamptz '2026-08-01 10:00:00+00')::text
              || '|' || (t.geloescht_seit is null)::text
         from public.admin_list_members('zyklusliste3', 'deaktiviert') t$q$),
  'true|true',
  'deaktiviert_seit trägt den Zeitpunkt der Deaktivierung, geloescht_seit bleibt leer');

select is(
  pg_temp.text_as('a0000000-0000-0000-0000-0000000000ad',
    $q$select (t.deaktiviert_seit is null)::text || '|' || (t.geloescht_seit is null)::text
         from public.admin_list_members('zyklusliste1') t$q$),
  'true|true',
  '… und ein unversehrtes Mitglied trägt in beiden Spalten null');

-- 12.11/12.12 Die beiden Spalten für den Reiter „Mitgliedschaft" — und der
-- Beleg, dass sie über einen `left join` kommen. Ohne ihn fiele jedes Mitglied
-- ohne Altdatenzeile aus der Liste: lautlos, auf genau der Fläche, die
-- entstanden ist, weil Mitglieder anderswo lautlos fehlten.
select is(
  pg_temp.text_as('a0000000-0000-0000-0000-0000000000ad',
    $q$select t.paid_until::text || '|' || t.payment_type
         from public.admin_list_members('zyklusliste1') t$q$),
  '2027-01-31|copecart',
  'paid_until und payment_type kommen aus profile_legacy mit');

select is(
  pg_temp.text_as('a0000000-0000-0000-0000-0000000000ad',
    $q$select coalesce(t.paid_until::text, '-') || '|' || coalesce(t.payment_type, '-')
         from public.admin_list_members('zyklusliste2', 'offen') t$q$),
  '-|-',
  'Ein Mitglied ohne Altdatenzeile bleibt in der Liste und trägt in beiden Spalten null');

-- ── 12.13–12.15 `gebannt`: die zweite Hälfte des Zustands ─────────────────
-- Die Spalte existiert wegen eines WIDERSPRUCHS im Delta: „fehlt der Ban, SHALL
-- derselbe Aufruf ihn nachsetzen" gegen „‚deaktivieren' SHALL NOT an bereits
-- deaktivierten erscheinen". Ohne sie sieht der halbe Zustand in der Liste aus
-- wie jede andere deaktivierte Zeile, und der Nachsetz-Weg ist über die
-- Oberfläche unerreichbar.
--
-- Eine reine Namenszusage genügt hier NICHT. Eine Spalte, die immer `false`
-- liefert, bestünde jede Katalogprüfung und trüge trotzdem nichts bei.

select is(
  pg_temp.text_as('a0000000-0000-0000-0000-0000000000ad',
    $q$select t.gebannt::text
         from public.admin_list_members('zyklusliste3', 'deaktiviert') t$q$),
  'true',
  'gebannt ist wahr, wenn banned_until in der Zukunft liegt');

select is(
  pg_temp.text_as('a0000000-0000-0000-0000-0000000000ad',
    $q$select t.gebannt::text
         from public.admin_list_members('zyklusliste5', 'geloescht') t$q$),
  'false',
  '… und falsch, wo die Sperre fehlt — DAS ist der halbe Zustand, den die Fläche sehen muss');

-- Der Wächter gegen die naheliegende Vereinfachung `banned_until is not null`.
-- Ein abgelaufener Ban ist keiner; wer ihn mitzählt, bietet „Deaktivieren" nie
-- wieder an und macht den Nachsetz-Weg genauso unerreichbar wie vorher.
select is(
  pg_temp.text_as('a0000000-0000-0000-0000-0000000000ad',
    $q$select t.gebannt::text
         from public.admin_list_members('zyklusliste1') t$q$),
  'false',
  'Ein ABGELAUFENES banned_until zählt nicht — gebannt fragt nach der Zukunft');

-- ── 13. `admin_member_counts()` — die Zahlen an den Reitern (AGE-587) ───────
-- Change: openspec/changes/admin-und-profilflaechen/.
--
-- WARUM HIER UND NICHT IN EINER EIGENEN DATEI:
-- Die Kernzusage ist ein VERGLEICH mit `admin_list_members`. In einer eigenen
-- Datei müsste der ganze Zustands-Fixturensatz ein zweites Mal entstehen — und
-- zwei Abschriften desselben Bestands sind genau die Drift, gegen die dieser
-- Abschnitt antritt.

-- Ein matching_manager: die Zähl-RPC muss ihn abweisen wie ein gewöhnliches
-- Mitglied. `staff_roles` allein genügt nicht als Berechtigung — das ist der
-- Unterschied zwischen „Personal" und „Admin", und ohne diesen Fixture bliebe
-- er ungeprüft.
insert into auth.users (id, aud, role, email) values
  ('f6000000-0000-0000-0000-0000000000aa', 'authenticated', 'authenticated', 'zaehler-manager@test.fbc');
insert into public.staff_roles (profile_id, role) values
  ('f6000000-0000-0000-0000-0000000000aa', 'matching_manager');
update public.profiles set name = 'Zaehler Manager', activated_at = now()
 where id = 'f6000000-0000-0000-0000-0000000000aa';

-- Ein Konto, das NIE AKTIVIERT UND DANN GELÖSCHT wurde: `activated_at is
-- null`, `disabled_at is null`, `deleted_at` gesetzt. Es gehört nach
-- `geloescht` und ausdrücklich NICHT nach `offen`.
--
-- Dieses Fixture ist nicht dekorativ, sondern die Antwort auf eine LÜCKE, die
-- erst die Gegenprobe gezeigt hat. Der `offen`-Zweig der geteilten Bedingung
-- trägt drei Bedingungen; die dritte (`p_deleted_at is null`) liess sich
-- entfernen, ohne dass irgendeine der 72 Zusagen fiel — weil kein Bestand eine
-- Zeile enthielt, an der sie einen Unterschied macht. Grün war sie trotzdem.
--
-- Nebenbei macht sie die fünf Zustandsmengen paarweise verschieden gross
-- (`offen` 2, `deaktiviert` 1, `geloescht` 3), was der Plan-Review für den
-- Vergleich in 13.1 verlangt hat. Ein Fixture, zwei Gründe — und der erste ist
-- der wichtigere.
insert into auth.users (id, aud, role, email) values
  ('f5000000-0000-0000-0000-000000000007', 'authenticated', 'authenticated', 'nieaktivgeloescht@test.fbc');
update public.profiles set name = 'Nie Aktiv Geloescht', activated_at = null,
       deleted_at = timestamptz '2026-08-05 09:00:00+00'
 where id = 'f5000000-0000-0000-0000-000000000007';

select is(
  pg_temp.int_as('a0000000-0000-0000-0000-0000000000ad',
    $q$select count(*)::int from public.admin_list_members('nieaktivgeloescht', 'offen')$q$),
  0, 'Ein nie aktiviertes, aber gelöschtes Konto steht NICHT unter offen — Löschen sticht');

select is(
  pg_temp.int_as('a0000000-0000-0000-0000-0000000000ad',
    $q$select count(*)::int from public.admin_list_members('nieaktivgeloescht', 'geloescht')$q$),
  1, '… sondern unter geloescht, wie jede andere gelöschte Zeile auch');

-- 13.1 Die Kernzusage: für JEDEN Zustand stimmen Zahl und Liste überein.
-- Verglichen wird die ganze Abbildung auf einmal statt fünfmal einzeln — ein
-- roter Lauf zeigt dann, WELCHER Zustand auseinanderläuft, statt nur DASS einer
-- es tut. `p_query => null` und `p_offset => 0`, und ein Limit weit über dem
-- Bestand: die Zahl ist global, die Liste wäre es ohne beides nicht.
select is(
  pg_temp.text_as('a0000000-0000-0000-0000-0000000000ad',
    $q$select string_agg(status || '=' || anzahl, ',' order by status)
         from public.admin_member_counts()$q$),
  pg_temp.text_as('a0000000-0000-0000-0000-0000000000ad',
    $q$select string_agg(s || '=' || (select count(*)
                                        from public.admin_list_members(null, s, 1000000, 0)),
                         ',' order by s)
         from unnest(array['aktiviert','alle','deaktiviert','geloescht','offen']) s$q$),
  'Zähler und Liste stimmen für jeden Zustand überein — sie fragen dieselbe Bedingung');

-- 13.2 Eine Zeile je Zustand, und zwar genau diese fünf. Ohne diese Zusage
-- könnte die Funktion einen Zustand weglassen und 13.1 bliebe grün, weil
-- `string_agg` über eine fehlende Zeile hinwegsieht — auf beiden Seiten.
select is(
  pg_temp.text_as('a0000000-0000-0000-0000-0000000000ad',
    $q$select string_agg(status, ',' order by status) from public.admin_member_counts()$q$),
  'aktiviert,alle,deaktiviert,geloescht,offen',
  'Die Funktion liefert genau fünf Zeilen, eine je Zustand');

-- 13.3 Ein Zustand OHNE Mitglieder erscheint mit der Zahl null, nicht gar
-- nicht. Der leere Zustand wird eigens hergestellt: im vorhandenen Bestand ist
-- keiner leer, und eine Zusage über einen Fall, den die Fixtures nie erzeugen,
-- ist grün ohne etwas zu prüfen. Die Lehre aus AGE-582, 6.6 in der Datenbank:
-- „keine Zahl" und „die Zahl null" sind zwei verschiedene Auskünfte.
savepoint leerer_zustand;
update public.profiles set deleted_at = null where deleted_at is not null;
select is(
  pg_temp.int_as('a0000000-0000-0000-0000-0000000000ad',
    $q$select anzahl::int from public.admin_member_counts() where status = 'geloescht'$q$),
  0, 'Ein Zustand ohne Mitglieder trägt die Zahl null — er fehlt nicht');
rollback to savepoint leerer_zustand;

-- 13.4–13.6 Der Unterschied zu `admin_list_feedback` ist gewollt: dort ist eine
-- leere Liste eine gültige Antwort, hier wäre eine Zeile mit lauter Nullen eine
-- AUSSAGE ÜBER DEN BESTAND. Wer kein Recht am Bestand hat, darf sie nicht
-- bekommen. Deshalb `42501` und nicht „leer".
select is(
  pg_temp.state_as('a0000000-0000-0000-0000-0000000000c0',
    $q$select * from public.admin_member_counts()$q$),
  '42501', 'Ein gewöhnliches Mitglied bekommt einen Fehler, keine Zeile mit Nullen');

select is(
  pg_temp.state_as('f6000000-0000-0000-0000-0000000000aa',
    $q$select * from public.admin_member_counts()$q$),
  '42501', '… und ein matching_manager ebenso — Personal ist nicht Admin');

select is(
  pg_temp.state_as('a0000000-0000-0000-0000-0000000000ad',
    $q$select * from public.admin_member_counts()$q$),
  'KEIN FEHLER', 'Der Admin dagegen bekommt seine Zahlen — der Fehler ist das Gate, nicht die Funktion');

-- 13.7–13.12 Rechte werden ausgesprochen, nicht geerbt (AGE-312).
select is(has_function_privilege('anon', 'public.admin_member_counts()', 'execute'),
  false, 'admin_member_counts: anon darf nicht ausführen');
select is(has_function_privilege('authenticated', 'public.admin_member_counts()', 'execute'),
  true, 'admin_member_counts: authenticated darf — die Abwehr findet IN der Funktion statt');
select ok(
  not exists (
    select 1 from aclexplode((select proacl from pg_proc
                               where oid = 'public.admin_member_counts()'::regprocedure)) a
     where a.grantee = 0),
  'admin_member_counts: PUBLIC hält kein EXECUTE');

-- `member_state_matches` ist eine INTERNE Bedingung. Sie braucht für niemanden
-- ein Ausführungsrecht: beide Aufrufer sind SECURITY DEFINER mit Eigentümer
-- `postgres`, und dort wird das Recht gegen den EIGENTÜMER geprüft, nicht gegen
-- den Aufrufer — derselbe Weg, den `is_banned` in AGE-581 schon ging. Deshalb
-- ist hier auch `authenticated` false, und das ist kein Versehen.
select is(has_function_privilege('anon', 'public.member_state_matches(text,timestamptz,timestamptz,timestamptz)', 'execute'),
  false, 'member_state_matches: anon darf nicht ausführen');
select is(has_function_privilege('authenticated', 'public.member_state_matches(text,timestamptz,timestamptz,timestamptz)', 'execute'),
  false, 'member_state_matches: auch authenticated nicht — sie ist keine Fläche, sondern eine Bedingung');
select ok(
  not exists (
    select 1 from aclexplode((select proacl from pg_proc
                               where oid = 'public.member_state_matches(text,timestamptz,timestamptz,timestamptz)'::regprocedure)) a
     where a.grantee = 0),
  'member_state_matches: PUBLIC hält kein EXECUTE');

select * from finish();
rollback;
