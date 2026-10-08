-- Rechte als Konfiguration und die Matrix aus SPEC 01 V5 FINAL (AGE-1000).
-- Change: openspec/changes/rechte-v5-final/.
--
-- Echtes pgTAP mit plan()/finish() — nur solche Dateien stehen im CI-Lauf.
-- Diese Datei ist in ci.yml eingetragen.
--
-- ══ WAS HIER GEMESSEN WIRD ═════════════════════════════════════════════════
--   1. **Die Konfiguration.** Zehn Rechte, vier auf Rang 5, sechs auf Rang 6,
--      und KEINES auf Rang 4 — die Clubschwelle ist eine Tuer und kein Recht.
--      Der Check-Constraint wird aktiv geprueft, nicht nur sein Vorhandensein.
--   2. **`darf()` je Rang.** Rang 3 (ausserhalb des Clubs), 4, 5, 6, plus ein
--      nicht aktiviertes Rang-6-Konto. Letzteres ist der Fall, der ohne
--      `is_activated()` im Praedikat durchrutschen wuerde.
--   3. **`meine_rechte()`** als Menge, nicht als Stichprobe: ein Rang liefert
--      GENAU seine Schluessel.
--   4. **Die vier Schwellen, die wirklich wandern**: Events anlegen (6),
--      offers/needs lesen und anlegen (5), matches lesen (5), Verzeichnis
--      suchen (6).
--   5. **Dass Pflegen bleibt, wo Anlegen faellt.** Ein abgestiegener Host sagt
--      seinen Termin ab; ein abgestiegenes Konto loescht sein Angebot. Ohne
--      diese vier Zusagen waere die Rechtegrenze eine Datensperre.
--   6. **Dass die Clubschwelle NICHT mitgewandert ist.** Ein Rang-4-Konto liest
--      weiter ein fremdes Vollprofil und meldet sich weiter zu einem Event an.
--      Das ist Entscheidung E4 des Go-live-Plans, und sie ist leicht
--      versehentlich mitzureissen.
--   7. **Der Restbefund ist geschlossen (AGE-1001).** Bis dahin stand hier:
--      „ein Rang-4-Konto liest `profiles` und `profiles_public` ohne Filter und
--      bekommt Zeilen" — der HEUTIGE Zustand, festgehalten als Zusage, damit
--      der Verschluss diesen Test umdrehen MUSS und nicht vergisst.
--      Er hat es getan. Die drei Zusagen unten lauten jetzt umgekehrt, und die
--      ausfuehrliche Fassung steht in `verzeichnis_dicht_test.sql`.
--      **Sie bleiben hier stehen, statt dorthin zu wandern:** sie sind der
--      Beleg, dass die Rechtematrix aus AGE-1000 am Rohzugriff ankommt, und
--      genau das war die Luecke. Ein Test, der eine Luecke beschrieb, wird zum
--      Test, der ihren Verschluss bewacht.
--
-- ══ FALLEN, DIE DIESES PROJEKT SCHON GESTELLT HAT ══════════════════════════
--   * **Am RANG pruefen, nie am Schluesselnamen.** `discover` bedeutete vor
--     AGE-903 Rang 3 und bedeutet jetzt Rang 4. Jede Zusage hier setzt die
--     Stufe ueber `membership_tiers.level_rank`, nie ueber ein Literal.
--   * In pgTAP heisst es `alike()`, nicht `like()`.
--   * Der lokale Stack ist geseedet und mit anderen Sitzungen GETEILT — jede
--     Mengenaussage ist auf die Fixture-Kennungen eingeschraenkt, nie
--     `count(*)` der ganzen Tabelle.
--   * Der Fehlerzweig der Helfer gibt NULL bzw. 'FEHLER:…' zurueck statt die
--     Transaktion zu reissen. Solange die Funktionen noch fehlen (RED), stuerben
--     sonst alle folgenden Zusagen an „current transaction is aborted" und der
--     erste echte Fehler laege unter Dutzenden Folgefehlern begraben.
--   * Ein `alike(…, 'FEHLER:%')` allein waere gruen, sobald IRGENDETWAS
--     schiefgeht. Deshalb traegt die Rueckgabe den SQLSTATE, und die
--     Ablehnungen werden auf `FEHLER:42501%` geprueft.
--   * **Und `try_as` = 'OK' belegt bei UPDATE/DELETE NICHT, dass etwas
--     geschehen ist.** Ein UPDATE, das unter RLS null Zeilen trifft, ist kein
--     Fehler — es tut nur nichts. Jede Pflege-Zusage unten prueft deshalb
--     danach die WIRKUNG: den geaenderten Wert, oder das Fehlen der Zeile.
--     Und zwar als Eigentuemer der Transaktion, also an der RLS vorbei:
--     „ich sehe sie nicht mehr" ist nicht dasselbe wie „sie ist weg".
--     Befund des Diff-Reviews (codex, MEDIUM) — ohne diese Nachmessung waeren
--     vier Zusagen gruen gewesen, auch wenn die Pflege unmoeglich geworden
--     waere.
--   * Die Trigger auf `events` (`event_feed_post_sync`, `hinweis_neues_event`)
--     sind SECURITY DEFINER — gemessen, nicht angenommen. Waeren sie INVOKER,
--     scheiterte jeder Insert hier an der fehlenden INSERT-Berechtigung auf
--     `posts`, und das sahe wie eine Rechtegrenze aus.

begin;
select plan(60);

-- ── Fixtures ────────────────────────────────────────────────────────────────
-- `auth.users`-Insert feuert `handle_new_user()` und legt die
-- `public.profiles`-Zeile an. Danach Stufe und Aktivierung setzen.
insert into auth.users (id, aud, role, email) values
  ('a1000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'r-connect@test.fbc'),
  ('a1000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'r-discover@test.fbc'),
  ('a1000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'r-focus@test.fbc'),
  ('a1000000-0000-0000-0000-000000000006', 'authenticated', 'authenticated', 'r-impact@test.fbc'),
  ('a1000000-0000-0000-0000-000000000009', 'authenticated', 'authenticated', 'r-impact-unbestaetigt@test.fbc'),
  ('a2000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'r-fremd@test.fbc');

update public.profiles set tier = 'connect',  name = 'Rang Drei'     where id = 'a1000000-0000-0000-0000-000000000003';
update public.profiles set tier = 'discover', name = 'Rang Vier'     where id = 'a1000000-0000-0000-0000-000000000004';
update public.profiles set tier = 'focus',    name = 'Rang Fuenf'    where id = 'a1000000-0000-0000-0000-000000000005';
update public.profiles set tier = 'impact',   name = 'Rang Sechs'    where id = 'a1000000-0000-0000-0000-000000000006';
update public.profiles set tier = 'impact',   name = 'Rang Sechs Ohne' where id = 'a1000000-0000-0000-0000-000000000009';
update public.profiles set tier = 'impact',   name = 'Fremdes Ziel'  where id = 'a2000000-0000-0000-0000-000000000001';

-- Alle bestaetigt — AUSSER `…0009`. Das ist der Beleg, dass die Aktivierung im
-- Praedikat steckt und nicht nur in den Policies davor.
update public.profiles set activated_at = now()
 where id in ('a1000000-0000-0000-0000-000000000003',
              'a1000000-0000-0000-0000-000000000004',
              'a1000000-0000-0000-0000-000000000005',
              'a1000000-0000-0000-0000-000000000006',
              'a2000000-0000-0000-0000-000000000001');

-- Ein Event mit Sichtbarkeit `members`, gehostet vom Rang-6-Konto. Es traegt
-- zwei Zusagen: die Teilnahme ab Rang 4 und das Pflegen nach einem Abstieg.
insert into public.events (id, title, starts_at, visibility, host_id) values
  ('a3000000-0000-0000-0000-000000000001', 'Bestandstermin',
   now() + interval '30 days', 'members', 'a1000000-0000-0000-0000-000000000006');

-- Je ein Angebot und ein Gesuch beim Rang-4- und beim Rang-6-Konto. Das
-- Rang-4-Paar ist der Bestand, der nach dem Change pflegbar bleiben MUSS.
insert into public.offers (id, profile_id, category, title) values
  ('a4000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000004', 'beratung', 'Angebot von Rang 4'),
  ('a4000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000006', 'beratung', 'Angebot von Rang 6');
insert into public.needs (id, profile_id, category, title) values
  ('a5000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000004', 'beratung', 'Gesuch von Rang 4'),
  ('a5000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000006', 'beratung', 'Gesuch von Rang 6');

-- Zwei Vorschlaege: einer mit dem Rang-4-Konto, einer mit dem Rang-5-Konto.
-- Der erste belegt, dass Beteiligung allein nicht mehr genuegt.
insert into public.matches (id, a_profile_id, b_profile_id, score) values
  ('a6000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000004', 'a2000000-0000-0000-0000-000000000001', 40),
  ('a6000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000005', 'a2000000-0000-0000-0000-000000000001', 41);

-- ── Helfer ──────────────────────────────────────────────────────────────────
create function pg_temp.als_bool(uid uuid, q text) returns boolean
language plpgsql as $$
declare b boolean;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    execute q into b;
  exception when others then
    b := null;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return b;
end $$;

create function pg_temp.als_text(uid uuid, q text) returns text
language plpgsql as $$
declare s text;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    execute q into s;
  exception when others then
    s := null;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return s;
end $$;

create function pg_temp.als_zahl(uid uuid, q text) returns integer
language plpgsql as $$
declare n integer;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    execute q into n;
  exception when others then
    n := -1;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return n;
end $$;

create function pg_temp.try_as(uid uuid, q text) returns text
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    execute q;
  exception when others then
    reset role;
    perform set_config('request.jwt.claims', '', true);
    return 'FEHLER:' || SQLSTATE || ' ' || SQLERRM;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return 'OK';
end $$;

-- ══ 1 · Die Konfiguration ══════════════════════════════════════════════════

select results_eq(
  $$ select schluessel, min_rank from public.berechtigungen order by min_rank, schluessel $$,
  $$ values ('organisation.verwalten'::text, 5),
            ('profil.business'::text,        5),
            ('suche_biete'::text,            5),
            ('vorschlaege'::text,            5),
            ('academy.anbieten'::text,       6),
            ('community.erstellen'::text,    6),
            ('events.erstellen'::text,       6),
            ('fbc_format.initiieren'::text,  6),
            ('projekt.erstellen'::text,     6),
            ('verzeichnis.suchen'::text,     6) $$,
  'Zehn Rechte aus SPEC 01, vier auf Rang 5 und sechs auf Rang 6');

select is_empty(
  $$ select schluessel from public.berechtigungen where min_rank <= 4 $$,
  'Kein Recht sitzt auf der Clubschwelle — die ist eine Tuer, kein Recht');

-- Als EIGENTUEMER der Transaktion und nicht unter `authenticated`, und auf den
-- SQLSTATE und nicht auf „irgendein Fehler". Die erste Fassung lief als
-- `authenticated`, dem die Migration ALLE Tabellenrechte entzogen hat: sie
-- scheiterte mit 42501, BEVOR der Constraint ausgewertet wurde, und die Zusage
-- lautete auf `alike(…, 'FEHLER:%')` — genau die Falle, die der Kopf dieser
-- Datei beschreibt. Haette man den Constraint geloescht, waere sie gruen
-- geblieben. Befund des Diff-Reviews (IMPORTANT).
select throws_ok(
  $$insert into public.berechtigungen (schluessel, min_rank, beschreibung)
    values ('test.klubschwelle', 4, 'darf nicht gehen')$$,
  '23514',
  null,
  'Ein Recht mit Mindestrang 4 laesst sich nicht anlegen — der Check-Constraint '
  'greift, nicht ein fehlendes Tabellenrecht');

-- Die Positivkontrolle dazu: dieselbe Einfuegung mit Rang 5 gelingt. Ohne sie
-- waere die Zusage darueber auch von einem Constraint erfuellt, der ALLES
-- ablehnt.
select lives_ok(
  $$insert into public.berechtigungen (schluessel, min_rank, beschreibung)
    values ('test.oberhalb', 5, 'darf gehen')$$,
  '… und mit Mindestrang 5 geht sie durch');

-- Und sofort zurueck: die Zeile wuerde sonst in `meine_rechte()` auftauchen und
-- die Mengen-Zusagen in Abschnitt 3 kippen. Gemessen, nicht vermutet — genau
-- das ist beim ersten Lauf passiert.
delete from public.berechtigungen where schluessel = 'test.oberhalb';

select is(
  (select count(*)::int from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'berechtigungen'
      and grantee in ('anon', 'authenticated', 'public')),
  0,
  'Auf `berechtigungen` hat keine Client-Rolle ein Tabellenrecht');

select is(
  (select relrowsecurity from pg_class where oid = 'public.berechtigungen'::regclass),
  true,
  'RLS ist auf `berechtigungen` eingeschaltet');

-- ══ 2 · `darf()` je Rang ═══════════════════════════════════════════════════

select is(pg_temp.als_bool('a1000000-0000-0000-0000-000000000006',
  $$select public.darf('gibt.es.nicht')$$),
  false, 'Ein unbekannter Schluessel ergibt false, nicht null und keinen Fehler');

select is(pg_temp.als_bool('a1000000-0000-0000-0000-000000000003',
  $$select public.darf('suche_biete')$$),
  false, 'Rang 3 darf kein SUCHE/BIETE — ausserhalb des Clubs gibt es kein Recht');

select is(pg_temp.als_bool('a1000000-0000-0000-0000-000000000004',
  $$select public.darf('suche_biete')$$),
  false, 'Rang 4 darf kein SUCHE/BIETE');

select is(pg_temp.als_bool('a1000000-0000-0000-0000-000000000005',
  $$select public.darf('suche_biete')$$),
  true, 'Rang 5 darf SUCHE/BIETE');

select is(pg_temp.als_bool('a1000000-0000-0000-0000-000000000005',
  $$select public.darf('verzeichnis.suchen')$$),
  false, 'Rang 5 darf NICHT gezielt suchen — das ist der Unterschied zu Rang 6');

select is(pg_temp.als_bool('a1000000-0000-0000-0000-000000000006',
  $$select public.darf('verzeichnis.suchen')$$),
  true, 'Rang 6 darf gezielt suchen');

select is(pg_temp.als_bool('a1000000-0000-0000-0000-000000000009',
  $$select public.darf('events.erstellen')$$),
  false, 'Ein nicht bestaetigtes Rang-6-Konto darf nichts — die Stufe ersetzt die Aktivierung nicht');

select is(
  (select prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'darf'),
  true, '`darf` ist SECURITY DEFINER');

select isnt_empty(
  $$ select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'darf'
        and exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%') $$,
  '`darf` hat einen gepinnten search_path');

select is(
  (select count(*)::int from information_schema.routine_privileges
    where specific_schema = 'public' and routine_name = 'darf'
      and grantee in ('anon', 'public', 'service_role')),
  0, 'EXECUTE auf `darf` ist anon, public und service_role entzogen');

select isnt_empty(
  $$ select 1 from information_schema.routine_privileges
      where specific_schema = 'public' and routine_name = 'darf'
        and grantee = 'authenticated' $$,
  'EXECUTE auf `darf` ist `authenticated` ausdruecklich erteilt');

-- ══ 3 · `meine_rechte()` als Menge ═════════════════════════════════════════

select is(pg_temp.als_text('a1000000-0000-0000-0000-000000000004',
  $$select array_to_string(public.meine_rechte(), ',')$$),
  '', 'Rang 4 traegt kein Recht — leeres Array, nicht null');

select is(pg_temp.als_text('a1000000-0000-0000-0000-000000000005',
  $$select array_to_string(public.meine_rechte(), ',')$$),
  'organisation.verwalten,profil.business,suche_biete,vorschlaege',
  'Rang 5 traegt genau die vier FOCUS-Rechte, sortiert');

select is(pg_temp.als_text('a1000000-0000-0000-0000-000000000006',
  $$select array_to_string(public.meine_rechte(), ',')$$),
  'academy.anbieten,community.erstellen,events.erstellen,fbc_format.initiieren,'
  || 'organisation.verwalten,profil.business,projekt.erstellen,suche_biete,'
  || 'verzeichnis.suchen,vorschlaege',
  'Rang 6 traegt alle zehn');

select is(pg_temp.als_text('a1000000-0000-0000-0000-000000000009',
  $$select array_to_string(public.meine_rechte(), ',')$$),
  '', 'Ohne Bestaetigung ist die Auskunft leer');

-- ══ 4 · Events: Anlegen faellt, Pflegen bleibt ═════════════════════════════

select is(
  (select pg_temp.try_as('a1000000-0000-0000-0000-000000000006',
     $$insert into public.events (id, title, starts_at, visibility, host_id)
       values ('a3000000-0000-0000-0000-000000000006', 'Von Rang 6',
               now() + interval '40 days', 'members',
               'a1000000-0000-0000-0000-000000000006')$$)),
  'OK', 'Rang 6 legt ein Event an');

select alike(
  (select pg_temp.try_as('a1000000-0000-0000-0000-000000000004',
     $$insert into public.events (id, title, starts_at, visibility, host_id)
       values ('a3000000-0000-0000-0000-000000000044', 'Von Rang 4',
               now() + interval '40 days', 'members',
               'a1000000-0000-0000-0000-000000000004')$$)),
  'FEHLER:42501%', 'Rang 4 legt kein Event an — die DATENBANK lehnt ab');

select alike(
  (select pg_temp.try_as('a1000000-0000-0000-0000-000000000005',
     $$insert into public.events (id, title, starts_at, visibility, host_id)
       values ('a3000000-0000-0000-0000-000000000055', 'Von Rang 5',
               now() + interval '40 days', 'members',
               'a1000000-0000-0000-0000-000000000005')$$)),
  'FEHLER:42501%', 'Rang 5 legt auch keines an');

-- Der Abstieg: das Host-Konto faellt auf Rang 4 und muss seinen Termin
-- weiter betreuen koennen. Ohne diese zwei Zusagen waere die Grenze eine
-- Datensperre.
update public.profiles set tier = 'discover' where id = 'a1000000-0000-0000-0000-000000000006';

select is(
  (select pg_temp.try_as('a1000000-0000-0000-0000-000000000006',
     $$update public.events set title = 'Abgesagt'
        where id = 'a3000000-0000-0000-0000-000000000001'$$)),
  'OK', 'Ein abgestiegener Host aendert seinen bestehenden Termin');

select is(
  (select title from public.events where id = 'a3000000-0000-0000-0000-000000000001'),
  'Abgesagt',
  '… und die Aenderung ist WIRKLICH angekommen — `OK` allein heisst nur, dass '
  'nichts geworfen wurde');

select is(
  (select pg_temp.try_as('a1000000-0000-0000-0000-000000000006',
     $$delete from public.events where id = 'a3000000-0000-0000-0000-000000000006'$$)),
  'OK', 'Ein abgestiegener Host loescht seinen bestehenden Termin');

select is(
  (select count(*)::int from public.events
    where id = 'a3000000-0000-0000-0000-000000000006'),
  0,
  '… und die Zeile ist WIRKLICH fort — gezaehlt als Eigentuemer, nicht unter '
  'der RLS des Hosts');

select alike(
  (select pg_temp.try_as('a1000000-0000-0000-0000-000000000006',
     $$insert into public.events (id, title, starts_at, visibility, host_id)
       values ('a3000000-0000-0000-0000-000000000066', 'Nach dem Abstieg',
               now() + interval '40 days', 'members',
               'a1000000-0000-0000-0000-000000000006')$$)),
  'FEHLER:42501%', 'Derselbe Host legt nach dem Abstieg KEIN neues Event an');

update public.profiles set tier = 'impact' where id = 'a1000000-0000-0000-0000-000000000006';

-- ══ 4b · Vorlagen folgen den Events ════════════════════════════════════════
-- Eine Vorlage ist kein eigener Gegenstand, sondern ein Geraet zum Anlegen von
-- Events: `event_serie_erzeugen` ist SECURITY INVOKER und legt die Termine als
-- Aufrufer an. Ohne dieselbe Huerde koennte ein Konto eine Vorlage anlegen und
-- daraus nichts erzeugen — eine Flaeche, die auf halbem Weg an der RLS endet.
-- Befund des Diff-Reviews (LOW, als veralteter Policy-Kommentar gemeldet; die
-- Unstimmigkeit dahinter war groesser als der Kommentar).

select is(
  (select pg_temp.try_as('a1000000-0000-0000-0000-000000000006',
     $$insert into public.event_vorlagen
         (id, host_id, title, visibility, ortszeit, zeitzone)
       values ('a7000000-0000-0000-0000-000000000006',
               'a1000000-0000-0000-0000-000000000006', 'Vorlage von Rang 6',
               'members', '19:00', 'Europe/Berlin')$$)),
  'OK', 'Rang 6 legt eine Vorlage an');

select alike(
  (select pg_temp.try_as('a1000000-0000-0000-0000-000000000004',
     $$insert into public.event_vorlagen
         (host_id, title, visibility, ortszeit, zeitzone)
       values ('a1000000-0000-0000-0000-000000000004', 'Vorlage von Rang 4',
               'members', '19:00', 'Europe/Berlin')$$)),
  'FEHLER:42501%', 'Rang 4 legt keine Vorlage an — sie folgt dem Event');

select is(
  (select pg_temp.try_as('a1000000-0000-0000-0000-000000000006',
     $$update public.event_vorlagen set title = 'Vorlage berichtigt'
        where id = 'a7000000-0000-0000-0000-000000000006'$$)),
  'OK', 'Der Host pflegt seine Vorlage weiter');

select is(
  (select title from public.event_vorlagen
    where id = 'a7000000-0000-0000-0000-000000000006'),
  'Vorlage berichtigt',
  '… und die Berichtigung ist WIRKLICH angekommen');

select is(
  pg_temp.als_zahl('a1000000-0000-0000-0000-000000000004',
    $$select count(*)::int from public.event_vorlagen
       where id = 'a7000000-0000-0000-0000-000000000006'$$),
  0, 'Eine fremde Vorlage bleibt unsichtbar — das SELECT ist unveraendert eng');

-- ══ 5 · Die Clubschwelle ist NICHT mitgewandert ════════════════════════════

select is(pg_temp.als_text('a1000000-0000-0000-0000-000000000004',
  $$select public.register_for_event('a3000000-0000-0000-0000-000000000001'::uuid)$$),
  'registered', 'Rang 4 meldet sich weiter zu einem Mitglieder-Event an (E4)');

-- Seit AGE-1001 ueber `profil_detail()` statt ueber die Tabelle: der Weg hat
-- gewechselt, die Schwelle NICHT. Genau das ist hier die Zusage — E4 sagt, die
-- Clubschwelle bleibt, wo sie war, und ein Verschluss des Rohzugriffs darf sie
-- nicht heimlich mitnehmen.
select is(pg_temp.als_zahl('a1000000-0000-0000-0000-000000000004',
  $$select count(*)::int from public.profil_detail('a2000000-0000-0000-0000-000000000001')$$),
  1, 'Rang 4 liest weiter ein fremdes Vollprofil — der Einzelabruf bleibt (E4)');

select is(pg_temp.als_bool('a1000000-0000-0000-0000-000000000004',
  $$select public.darf_kontaktanfrage_senden('a2000000-0000-0000-0000-000000000001'::uuid)$$),
  true, 'Rang 4 darf weiter eine Kontaktanfrage senden (E4)');

-- ══ 6 · offers/needs: lesen und anlegen ab Rang 5 ══════════════════════════

select is(pg_temp.als_zahl('a1000000-0000-0000-0000-000000000005',
  $$select count(*)::int from public.offers
     where id in ('a4000000-0000-0000-0000-000000000004',
                  'a4000000-0000-0000-0000-000000000006')$$),
  2, 'Rang 5 sieht fremde Angebote');

select is(pg_temp.als_zahl('a1000000-0000-0000-0000-000000000004',
  $$select count(*)::int from public.offers
     where id in ('a4000000-0000-0000-0000-000000000004',
                  'a4000000-0000-0000-0000-000000000006')$$),
  1, 'Rang 4 sieht nur das eigene Angebot');

select is(pg_temp.als_zahl('a1000000-0000-0000-0000-000000000004',
  $$select count(*)::int from public.needs
     where id in ('a5000000-0000-0000-0000-000000000004',
                  'a5000000-0000-0000-0000-000000000006')$$),
  1, 'Rang 4 sieht nur das eigene Gesuch');

select alike(
  (select pg_temp.try_as('a1000000-0000-0000-0000-000000000004',
     $$insert into public.offers (profile_id, category, title)
       values ('a1000000-0000-0000-0000-000000000004', 'beratung', 'Neu von Rang 4')$$)),
  'FEHLER:42501%', 'Rang 4 stellt kein neues Angebot ein');

select is(
  (select pg_temp.try_as('a1000000-0000-0000-0000-000000000004',
     $$update public.offers set title = 'Berichtigt'
        where id = 'a4000000-0000-0000-0000-000000000004'$$)),
  'OK', 'Rang 4 berichtigt sein bestehendes Angebot');

select is(
  (select title from public.offers where id = 'a4000000-0000-0000-0000-000000000004'),
  'Berichtigt',
  '… und die Berichtigung steht WIRKLICH in der Zeile');

select is(
  (select pg_temp.try_as('a1000000-0000-0000-0000-000000000004',
     $$delete from public.needs where id = 'a5000000-0000-0000-0000-000000000004'$$)),
  'OK', 'Rang 4 nimmt sein bestehendes Gesuch zurueck');

select is(
  (select count(*)::int from public.needs
    where id = 'a5000000-0000-0000-0000-000000000004'),
  0,
  '… und das Gesuch ist WIRKLICH fort');

select is(
  (select pg_temp.try_as('a1000000-0000-0000-0000-000000000005',
     $$insert into public.offers (profile_id, category, title)
       values ('a1000000-0000-0000-0000-000000000005', 'beratung', 'Neu von Rang 5')$$)),
  'OK', 'Rang 5 stellt ein neues Angebot ein');

select is(
  (select count(*)::int from public.offers
    where profile_id = 'a1000000-0000-0000-0000-000000000005'
      and title = 'Neu von Rang 5'),
  1,
  '… und die neue Zeile existiert WIRKLICH');

-- ══ 7 · matches: Beteiligung UND Recht ═════════════════════════════════════

select is(pg_temp.als_zahl('a1000000-0000-0000-0000-000000000005',
  $$select count(*)::int from public.matches
     where id = 'a6000000-0000-0000-0000-000000000002'$$),
  1, 'Rang 5 liest seinen Vorschlag');

select is(pg_temp.als_zahl('a1000000-0000-0000-0000-000000000004',
  $$select count(*)::int from public.matches
     where id = 'a6000000-0000-0000-0000-000000000001'$$),
  0, 'Rang 4 liest seinen eigenen Vorschlag NICHT — Beteiligung allein reicht nicht');

select is(pg_temp.als_zahl('a1000000-0000-0000-0000-000000000006',
  $$select count(*)::int from public.matches
     where id = 'a6000000-0000-0000-0000-000000000002'$$),
  0, 'Rang 6 liest ein fremdes Paar nicht — das Recht oeffnet keine fremden Zeilen');

-- ══ 8 · Das Verzeichnis ab Rang 6 ══════════════════════════════════════════

select cmp_ok(
  pg_temp.als_zahl('a1000000-0000-0000-0000-000000000006',
    $$select count(*)::int from public.search_directory()$$),
  '>', 1, 'Rang 6 bekommt mehr als die eigene Zeile aus dem Verzeichnis');

-- `is(…, 1)` und nicht `cmp_ok(…, '<=', 1)`: `als_zahl` gibt im Fehlerfall -1
-- zurueck, und -1 ist kleiner als 1 — eine Ausnahme haette sich als bestanden
-- gelesen. Beide Konten sind `is_public` und bestaetigt, finden sich also ueber
-- den Selbst-Zweig und sehen GENAU eine Zeile. Befund des Diff-Reviews (LOW).
select is(
  pg_temp.als_zahl('a1000000-0000-0000-0000-000000000005',
    $$select count(*)::int from public.search_directory()$$),
  1, 'Rang 5 bekommt genau die eigene Zeile');

select is(
  pg_temp.als_zahl('a1000000-0000-0000-0000-000000000004',
    $$select count(*)::int from public.search_directory()$$),
  1, 'Rang 4 bekommt genau die eigene Zeile');

select isnt_empty(
  $$ select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'search_directory'
        and p.prosrc like '%darf(''verzeichnis.suchen'')%' $$,
  'Das Eintrittstor des Verzeichnisses ruft das Recht');

select is_empty(
  $$ select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'search_directory'
        and p.prosrc like '%has_level%' $$,
  'Im Rumpf von `search_directory` steht keine Rangzahl mehr');

-- ══ 9 · Die Clubschwelle steht weiter als Zahl, wo sie hingehoert ══════════
-- Ein Waechter, kein Selbstzweck: faellt eine dieser Policies versehentlich
-- auf `darf()`, waere die Tuer ploetzlich konfigurierbar — und ein Recht mit
-- Mindestrang 4 ist durch den Check-Constraint oben gar nicht anlegbar, also
-- wuerde sie zufallen.

select is(
  (select string_agg(q.p, ',' order by q.p)
     from (select policyname::text as p from pg_policies
            where schemaname = 'public'
              and (coalesce(qual,'') like '%has_level(4)%'
                or coalesce(with_check,'') like '%has_level(4)%')) q),
  'interests_select,profile_badges_select,profiles_select_self_or_discover,'
  || 'regs_write_own,theme_scores_select',
  'Genau fuenf Policies tragen die Clubschwelle als Zahl — und zwar diese fuenf');

-- ══ 10 · Der Restbefund ist geschlossen (AGE-1001) ═════════════════════════
-- Diese Zusagen hielten bis AGE-1001 den OFFENEN Zustand fest. Sie lauten jetzt
-- umgekehrt — und zwar ueber `try_as` statt ueber eine Zahl: ein NULL aus
-- `als_zahl` hiesse nur „irgendetwas ging schief", waehrend `FEHLER:42501`
-- genau „fehlendes Recht" heisst. Die ausfuehrliche Fassung samt den fuenf
-- Ersatzfunktionen steht in `verzeichnis_dicht_test.sql`.

select alike(
  pg_temp.try_as('a1000000-0000-0000-0000-000000000004',
    $$select count(*) from public.profiles$$),
  'FEHLER:42501%',
  'Rang 4 liest `profiles` NICHT mehr — Verschluss durch `verzeichnis-dicht`');

select alike(
  pg_temp.try_as('a1000000-0000-0000-0000-000000000004',
    $$select count(*) from public.profiles_public$$),
  'FEHLER:42501%',
  'Rang 4 liest `profiles_public` NICHT mehr — derselbe Verschluss');

-- Und die weitere Haelfte desselben Befunds, die bisher nicht festgenagelt war:
-- `profiles_public` traegt GAR KEINE Rangpruefung, nur `is_activated()` des
-- Aufrufers. Ein Konto AUSSERHALB des Clubs liest die Sicht also ebenso. Die
-- Anforderung im `directory-search`-Delta sagt das („ohne Rücksicht auf seine
-- Stufe"), ihr Szenario nannte aber Rang 4 — gemeldet im Diff-Review (LOW).
select alike(
  pg_temp.try_as('a1000000-0000-0000-0000-000000000003',
    $$select count(*) from public.profiles_public$$),
  'FEHLER:42501%',
  'auch Rang 3 kommt an die Sicht nicht mehr heran — der Entzug gilt fuer '
  'jeden Rang, nicht erst ab einer Schwelle');

-- Diese Gegenprobe hielt den UNTERSCHIED zwischen den beiden Relationen fest:
-- `profiles` trug die Clubschwelle, `profiles_public` gar keine. Der
-- Verschluss musste beide getrennt behandeln — und hat es getan. Danach sind
-- sie gleich zu, und die Zusage sagt genau das.
select alike(
  pg_temp.try_as('a1000000-0000-0000-0000-000000000003',
    $$select count(*) from public.profiles$$),
  'FEHLER:42501%',
  'Rang 3 bekommt aus `profiles` auch die EIGENE Zeile nicht mehr — sie '
  'kommt jetzt aus `mein_profil()`, und die beiden Relationen unterscheiden '
  'sich nach dem Entzug nicht mehr');

select * from finish();
rollback;
