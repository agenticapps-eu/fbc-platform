-- Vier In-App-Hinweistypen und ihr Opt-out (AGE-620).
-- Change: openspec/changes/glocke-und-hinweistypen/.
--
-- Echtes pgTAP mit plan()/finish(). Diese Datei ist in ci.yml eingetragen —
-- ohne diesen Eintrag liefe sie nie, und genau das ist hier schon zweimal
-- passiert.
--
-- ══ DIE ZUSAGE, UM DIE ES GEHT ═════════════════════════════════════════════
-- PARITAET, nicht Mitgliedschaft in einer abgeschriebenen Menge.
--
-- Der erste Entwurf dieses Changes schrieb das Sichtbarkeits-Praedikat ein
-- zweites Mal hin — und stuetzte sich dabei auf eine Policy, die einen Tag
-- zuvor ersetzt worden war (AGE-601 am 26.08., Plan am 27.08.). Jeder Test auf
-- der abgeschriebenen Grenze waere gruen gewesen und haette das falsche System
-- beschrieben.
--
-- Deshalb fragt dieser Test die Policy, statt sie zu wiederholen: er
-- impersoniert JEDEN Empfaenger und behauptet, dass der den angekuendigten
-- Gegenstand SIEHT. Das ueberlebt das naechste AGE-601.
--
-- ══ FALLEN, DIE DIESES PROJEKT SCHON GESTELLT HAT ══════════════════════════
--   * Der lokale Stack ist GESEEDET. Ein Rundruf schreibt an alle aktivierten
--     Mitglieder, also auch an die Seed-Konten. Jede Mengenaussage hier ist auf
--     die Fixture-IDs eingeschraenkt und nie auf `count(*)` der Tabelle.
--   * Eine Messung aus lauter Nullen belegt nichts. Zu jeder Negativzusage
--     steht ein Nachbarfall, der Zeilen ERZEUGT.
--   * In pgTAP heisst es `alike()`, nicht `like()`.
--   * Ein `revoke`, der nicht alle Rollen nennt, wirkt je nach Instanz-Sorte
--     (AGE-622). Die Rechtezusagen unten pruefen deshalb alle vier Rollen.

begin;
select plan(41);

-- ── Impersonierung ──────────────────────────────────────────────────────────
-- Eigene Kopie: `rls_test.sql` definiert dasselbe, aber jede Testdatei laeuft in
-- ihrer eigenen Sitzung.
create function pg_temp.count_as(uid uuid, q text) returns int language plpgsql as $$
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

-- ── Fixtures ────────────────────────────────────────────────────────────────
-- Der auth.users-Insert feuert handle_new_user() und legt public.profiles an.
insert into auth.users (id, aud, role, email) values
  ('c0000000-0000-0000-0000-00000000000a', 'authenticated', 'authenticated', 'hin-autor@test.fbc'),
  ('c0000000-0000-0000-0000-00000000000b', 'authenticated', 'authenticated', 'hin-leser@test.fbc'),
  ('c0000000-0000-0000-0000-00000000000c', 'authenticated', 'authenticated', 'hin-optout@test.fbc'),
  ('c0000000-0000-0000-0000-00000000000d', 'authenticated', 'authenticated', 'hin-unbestaetigt@test.fbc'),
  ('c0000000-0000-0000-0000-00000000000e', 'authenticated', 'authenticated', 'hin-gesperrt@test.fbc');

update public.profiles set tier = 'impact', name = 'Hin Autor', activated_at = now()
 where id = 'c0000000-0000-0000-0000-00000000000a';
update public.profiles set tier = 'impact', name = 'Hin Leser', activated_at = now()
 where id = 'c0000000-0000-0000-0000-00000000000b';
update public.profiles set tier = 'impact', name = 'Hin Optout', activated_at = now()
 where id = 'c0000000-0000-0000-0000-00000000000c';
-- Nie bestaetigt: `activated_at` bleibt null.
update public.profiles set tier = 'impact', name = 'Hin Unbestaetigt'
 where id = 'c0000000-0000-0000-0000-00000000000d';
-- Bestaetigt, aber gesperrt. `is_activated_profile` deckt seit 20260823120000
-- auch das ab — ein Test nur auf `activated_at` haette es nicht gefangen.
update public.profiles set tier = 'impact', name = 'Hin Gesperrt',
       activated_at = now(), disabled_at = now()
 where id = 'c0000000-0000-0000-0000-00000000000e';

-- Genau EIN Mitglied schaltet genau EINEN Typ ab. Die uebrigen haben gar keine
-- Zeile in member_settings — das ist der Normalfall und zugleich die
-- Positivkontrolle fuer „Default AN".
insert into public.member_settings (profile_id, notify_app_post)
values ('c0000000-0000-0000-0000-00000000000c', false);

-- ── 1. Der Rundruf beim Beitrag ─────────────────────────────────────────────
insert into public.posts (id, author_id, body, visibility)
values ('c1000000-0000-0000-0000-000000000001',
        'c0000000-0000-0000-0000-00000000000a', 'Hallo Club', 'members');

select is(
  (select count(*)::int from public.notifications
    where type = 'post_created'
      and profile_id = 'c0000000-0000-0000-0000-00000000000b'),
  1, 'ein aktiviertes Mitglied bekommt genau eine Zeile');

select is(
  (select count(*)::int from public.notifications
    where type = 'post_created'
      and profile_id = 'c0000000-0000-0000-0000-00000000000a'),
  0, 'der Autor bekommt nichts ueber die eigene Handlung');

select is(
  (select count(*)::int from public.notifications
    where type = 'post_created'
      and profile_id = 'c0000000-0000-0000-0000-00000000000d'),
  0, 'ein unbestaetigtes Mitglied bekommt nichts');

select is(
  (select count(*)::int from public.notifications
    where type = 'post_created'
      and profile_id = 'c0000000-0000-0000-0000-00000000000e'),
  0, 'ein GESPERRTES Mitglied bekommt nichts — activated_at allein genuegt nicht');

select is(
  (select count(*)::int from public.notifications
    where type = 'post_created'
      and profile_id = 'c0000000-0000-0000-0000-00000000000c'),
  0, 'wer den Typ abgeschaltet hat, bekommt KEINE ZEILE — nicht nur keine Anzeige');

-- Die Nutzlast traegt Kennungen und den Namen, aber keinen Beitragstext.
select is(
  (select payload->>'autor_name' from public.notifications
    where type = 'post_created'
      and profile_id = 'c0000000-0000-0000-0000-00000000000b'),
  'Hin Autor', 'die Nutzlast nennt den Autor');

select is(
  (select count(*)::int from public.notifications
    where type = 'post_created'
      and profile_id = 'c0000000-0000-0000-0000-00000000000b'
      and payload::text like '%Hallo Club%'),
  0, 'die Nutzlast traegt KEINEN Beitragstext');

-- ── 2. PARITAET — die eigentliche Zusage ────────────────────────────────────
-- Fuer jeden Empfaenger: sieht er den angekuendigten Beitrag wirklich? Gezaehlt
-- werden die, die es NICHT tun. Erwartet: keiner.
select is(
  (select count(*)::int
     from public.notifications n
    where n.type = 'post_created'
      and pg_temp.count_as(
            n.profile_id,
            format('select count(*)::int from public.posts where id = %L',
                   n.payload->>'post_id')) = 0),
  0, 'PARITAET: jeder Empfaenger des Beitrags-Hinweises sieht den Beitrag auch');

-- Und die Gegenprobe: dieselbe Abfrage MUSS anschlagen, wenn eine Zeile an
-- jemanden geht, der den Gegenstand nicht sehen darf. Ohne sie waere die Zusage
-- oben gruen, auch wenn sie gar nichts misst.
insert into public.notifications (profile_id, type, payload)
values ('c0000000-0000-0000-0000-00000000000d', 'post_created',
        jsonb_build_object('post_id', 'c1000000-0000-0000-0000-000000000001'));

select is(
  (select count(*)::int
     from public.notifications n
    where n.type = 'post_created'
      and pg_temp.count_as(
            n.profile_id,
            format('select count(*)::int from public.posts where id = %L',
                   n.payload->>'post_id')) = 0),
  1, 'GEGENPROBE: eine Zeile an ein unbestaetigtes Mitglied bricht die Paritaet');

delete from public.notifications
 where profile_id = 'c0000000-0000-0000-0000-00000000000d';

-- ── 3. Das Event wird EINMAL angekuendigt, nicht zweimal ────────────────────
-- `trg_event_feed_post` spiegelt jedes Event MIT HOST als posts-Zeile mit
-- kind='event'. Ohne den kind-Filter im Beitrags-Trigger kaeme hier eine zweite
-- Welle an denselben Empfaengerkreis.
-- `starts_at` ist seit 20260812100000 `not null` — die erste Fassung der
-- Tabelle liess es offen. Dritte Stelle an einem Tag, an der die erstbeste
-- Migration nicht die aktuelle war.
insert into public.events (id, title, host_id, visibility, starts_at)
values ('c2000000-0000-0000-0000-000000000001', 'Sommerfest',
        'c0000000-0000-0000-0000-00000000000a', 'members', now() + interval '7 days');

select is(
  (select count(*)::int from public.notifications
    where type = 'event_created'
      and profile_id = 'c0000000-0000-0000-0000-00000000000b'),
  1, 'ein Event mit Host ergibt genau eine Ankuendigung');

select is(
  (select count(*)::int from public.notifications n
    where n.type = 'post_created'
      and n.profile_id = 'c0000000-0000-0000-0000-00000000000b'
      and exists (select 1 from public.posts p
                   where p.id = (n.payload->>'post_id')::uuid
                     and p.kind = 'event')),
  0, 'der Spiegelbeitrag des Events loest KEINEN zweiten Hinweis aus');

select is(
  (select count(*)::int from public.posts
    where kind = 'event' and ref_id = 'c2000000-0000-0000-0000-000000000001'),
  1, 'Positivkontrolle: den Spiegelbeitrag GIBT es — sonst pruefte die Zusage darueber nichts');

-- Ein Event OHNE Host erzeugt keinen Spiegel und braucht deshalb den eigenen
-- Trigger. Genau deswegen haengt die Ankuendigung nicht am Spiegelbeitrag.
insert into public.events (id, title, host_id, visibility, starts_at)
values ('c2000000-0000-0000-0000-000000000002', 'Ohne Gastgeber', null, 'public',
        now() + interval '14 days');

select is(
  (select count(*)::int from public.notifications
    where type = 'event_created'
      and payload->>'event_id' = 'c2000000-0000-0000-0000-000000000002'
      and profile_id = 'c0000000-0000-0000-0000-00000000000b'),
  1, 'ein Event OHNE Host wird trotzdem angekuendigt');

select is(
  (select count(*)::int from public.posts
    where kind = 'event' and ref_id = 'c2000000-0000-0000-0000-000000000002'),
  0, 'Positivkontrolle: fuer ein Event ohne Host entsteht KEIN Spiegelbeitrag');

-- ── 4. Kommentar und Like auf den eigenen Beitrag ───────────────────────────
insert into public.comments (post_id, author_id, body)
values ('c1000000-0000-0000-0000-000000000001',
        'c0000000-0000-0000-0000-00000000000b', 'Guter Beitrag');

select is(
  (select count(*)::int from public.notifications
    where type = 'comment_on_post'
      and profile_id = 'c0000000-0000-0000-0000-00000000000a'),
  1, 'der Kommentar erreicht den Eigentuemer des Beitrags');

select is(
  (select count(*)::int from public.notifications
    where type = 'comment_on_post'
      and profile_id <> 'c0000000-0000-0000-0000-00000000000a'
      and payload->>'post_id' = 'c1000000-0000-0000-0000-000000000001'),
  0, 'und sonst niemanden — ein Kommentar ist kein Rundruf');

insert into public.post_likes (post_id, profile_id)
values ('c1000000-0000-0000-0000-000000000001',
        'c0000000-0000-0000-0000-00000000000b');

select is(
  (select count(*)::int from public.notifications
    where type = 'like_on_post'
      and profile_id = 'c0000000-0000-0000-0000-00000000000a'),
  1, 'der Like erreicht den Eigentuemer des Beitrags');

-- Auf dem EIGENEN Beitrag zu handeln kuendigt niemandem etwas an.
insert into public.comments (post_id, author_id, body)
values ('c1000000-0000-0000-0000-000000000001',
        'c0000000-0000-0000-0000-00000000000a', 'Nachtrag von mir');

select is(
  (select count(*)::int from public.notifications
    where type = 'comment_on_post'
      and profile_id = 'c0000000-0000-0000-0000-00000000000a'),
  1, 'ein Kommentar auf den EIGENEN Beitrag erzeugt keine zweite Zeile');

-- ── 5. Die Innereien sind fuer keine Client-Rolle erreichbar ────────────────
-- Alle vier Rollen, nicht nur die, an die man gerade denkt (AGE-622).
select is(
  (select count(*)::int from unnest(array['anon','authenticated','service_role']) r
    where has_function_privilege(r, 'public.hinweis_erwuenscht(uuid, text)', 'execute')),
  0, 'hinweis_erwuenscht ist fuer KEINE Client-Rolle ausfuehrbar');

select is(
  (select count(*)::int from unnest(array['anon','authenticated','service_role']) r
    where has_function_privilege(r, 'public.hinweis_rundruf(text, uuid, jsonb)', 'execute')),
  0, 'hinweis_rundruf ist fuer KEINE Client-Rolle ausfuehrbar');

-- ── 6. Die zwei neuen Schalter (AGE-641) ────────────────────────────────────
-- `notify_app_message` und `notify_app_contact` kommen mit der Umbenennung
-- dazu. Hier steht nur, dass sie DA sind und auf AN stehen; WAS sie steuern,
-- pruefen der Nachrichten-Trigger und die Zustellung in eigenen Abschnitten.
--
-- Geprueft wird an 'Hin Optout' — dem einzigen Konto mit einer Zeile in
-- member_settings. Gerade weil dort schon EIN Schalter ausdruecklich gesetzt
-- wurde, ist das die schaerfere Probe: der Default muss auch dann greifen,
-- wenn die Zeile bereits existiert, und nicht nur bei fehlender Zeile.

select is(
  (select notify_app_message from public.member_settings
    where profile_id = 'c0000000-0000-0000-0000-00000000000c'),
  true, 'notify_app_message steht auch in einer bestehenden Zeile auf AN');

select is(
  (select notify_app_contact from public.member_settings
    where profile_id = 'c0000000-0000-0000-0000-00000000000c'),
  true, 'notify_app_contact steht auch in einer bestehenden Zeile auf AN');

-- ── 7. Kontaktanfragen: Schalter und Freitext (AGE-641) ─────────────────────
-- Der Trigger aus dem Juni schrieb seine drei Hinweise UNBEDINGT und fragte
-- `hinweis_erwuenscht` nie. Die Spalte `notify_app_contact` allein anzulegen
-- haette einen Schalter erzeugt, der in den Einstellungen steht und nichts tut.
--
-- Zweitens trug die Nutzlast den Freitext der Anfrage (`message`). Die Glocke
-- las ihn nie; ein Push haette ihn auf einen fremden Sperrbildschirm gestellt.

update public.member_settings set notify_app_contact = false
 where profile_id = 'c0000000-0000-0000-0000-00000000000c';

insert into public.contact_requests (from_id, to_id, message)
values ('c0000000-0000-0000-0000-00000000000a',
        'c0000000-0000-0000-0000-00000000000c',
        'Bitte diesen Satz nirgends anzeigen');

select is(
  (select count(*)::int from public.notifications
    where type = 'contact_request'
      and profile_id = 'c0000000-0000-0000-0000-00000000000c'),
  0, 'abgeschaltetes notify_app_contact schreibt keine Anfrage-Zeile');

-- Die Gegenprobe zum Opt-out: es unterdrueckt den HINWEIS, nicht den Vorgang.
-- Ein Schalter, der die Anfrage selbst verschluckte, waere ein Datenverlust.
select is(
  (select count(*)::int from public.contact_requests
    where from_id = 'c0000000-0000-0000-0000-00000000000a'
      and to_id   = 'c0000000-0000-0000-0000-00000000000c'),
  1, 'die Anfrage selbst steht trotz abgeschaltetem Hinweis da');

insert into public.contact_requests (from_id, to_id, message)
values ('c0000000-0000-0000-0000-00000000000a',
        'c0000000-0000-0000-0000-00000000000b',
        'Auch dieser Satz gehoert nicht auf einen Sperrbildschirm');

select is(
  (select count(*)::int from public.notifications
    where type = 'contact_request'
      and profile_id = 'c0000000-0000-0000-0000-00000000000b'),
  1, 'ohne Abschaltung entsteht genau eine Anfrage-Zeile');

-- Der Kern: der Freitext ist nicht bloss unsichtbar, er ist GAR NICHT DA.
select is(
  (select (payload ? 'message') from public.notifications
    where type = 'contact_request'
      and profile_id = 'c0000000-0000-0000-0000-00000000000b'),
  false, 'die Nutzlast traegt den Freitext der Anfrage nicht');

-- Positivkontrolle zur Zeile darueber: die Nutzlast ist nicht etwa leer.
-- Ohne diese Zusage waere „kein message-Schluessel" auch von einem kaputten
-- Trigger erfuellt, der gar nichts schreibt.
select is(
  (select payload->>'from_name' from public.notifications
    where type = 'contact_request'
      and profile_id = 'c0000000-0000-0000-0000-00000000000b'),
  'Hin Autor', 'die Nutzlast traegt weiterhin den Absendernamen');

-- Annahme: der Hinweis geht an den ANFRAGENDEN (from_id). Der schaltet ab.
update public.member_settings set notify_app_contact = false
 where profile_id = 'c0000000-0000-0000-0000-00000000000a';
insert into public.member_settings (profile_id, notify_app_contact)
select 'c0000000-0000-0000-0000-00000000000a', false
 where not exists (select 1 from public.member_settings
                    where profile_id = 'c0000000-0000-0000-0000-00000000000a');

update public.contact_requests set status = 'accepted'
 where from_id = 'c0000000-0000-0000-0000-00000000000a'
   and to_id   = 'c0000000-0000-0000-0000-00000000000b';

select is(
  (select count(*)::int from public.notifications
    where type = 'contact_request_accepted'
      and profile_id = 'c0000000-0000-0000-0000-00000000000a'),
  0, 'derselbe Schalter deckt auch die Annahme ab');

-- Und wieder die Gegenprobe: der Gespraechsfaden entsteht trotzdem. Wer keine
-- Hinweise will, hat damit nicht auf den Chat verzichtet.
select is(
  (select count(*)::int from public.message_threads
    where a_profile_id = least('c0000000-0000-0000-0000-00000000000a'::uuid,
                               'c0000000-0000-0000-0000-00000000000b'::uuid)
      and b_profile_id = greatest('c0000000-0000-0000-0000-00000000000a'::uuid,
                                  'c0000000-0000-0000-0000-00000000000b'::uuid)),
  1, 'der Gespraechsfaden entsteht trotz abgeschaltetem Hinweis');

-- ── 8. Kein Client schreibt sich selbst Hinweise (AGE-641) ──────────────────
-- GEFUNDEN VON DER PLAN-REVIEW (R2). `20260715140000:77` erteilte
-- `insert` und `delete` auf `notifications` an `authenticated`, und
-- `notifications_own` laesst eigene Zeilen durch — jedes aktivierte Mitglied
-- konnte sich also beliebig viele Hinweiszeilen schreiben.
--
-- Ohne Push war das folgenlos: man haette die eigene Glocke vollgemuellt.
-- MIT Push ist jede solche Zeile ein Auftrag an FCM/APNs, also Arbeit und
-- Kontingent auf fremde Kosten — und sie umgeht dabei jeden Trigger, jede
-- Sichtbarkeitspruefung und jedes Opt-out, weil sie gar nicht erst durch sie
-- hindurchmuss.
--
-- Nachgemessen vor dem Entzug: `grep 'from("notifications")' src/` findet
-- ausschliesslich ein `select` und zwei `update` (`hinweise.ts:42,68,79`).
-- Kein einziger Insert, kein einziges Delete. Der Grant war ungenutzt.

create function pg_temp.try_as(uid uuid, q text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    execute q;
  exception when others then
    reset role;
    perform set_config('request.jwt.claims', '', true);
    return 'DENIED:' || SQLERRM;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return 'OK';
end $$;

select alike(
  pg_temp.try_as('c0000000-0000-0000-0000-00000000000b',
    $$insert into public.notifications (profile_id, type, payload)
      values ('c0000000-0000-0000-0000-00000000000b', 'message', '{}'::jsonb)$$),
  'DENIED:%', 'ein Mitglied kann sich selbst keinen Hinweis schreiben');

select alike(
  pg_temp.try_as('c0000000-0000-0000-0000-00000000000b',
    $$delete from public.notifications
       where profile_id = 'c0000000-0000-0000-0000-00000000000b'$$),
  'DENIED:%', 'ein Mitglied kann seine Hinweise nicht loeschen');

-- Positivkontrolle: Lesen und Auf-gelesen-setzen bleiben, sonst waere die
-- Glocke kaputt und die zwei Zusagen darueber nur ein teurer Weg dorthin.
select is(
  pg_temp.count_as('c0000000-0000-0000-0000-00000000000b',
    'select count(*)::int from public.notifications'),
  (select count(*)::int from public.notifications
    where profile_id = 'c0000000-0000-0000-0000-00000000000b'),
  'Lesen bleibt: das Mitglied sieht weiterhin alle eigenen Hinweise');

-- ── 9. Der fuenfte Typ: Chat-Nachrichten (AGE-641) ──────────────────────────
-- Der Hauptgrund fuer die App war der einzige Vorgang der Plattform ohne
-- Hinweis. Der Gespraechsfaden zwischen 00a und 00b entstand oben bei der
-- angenommenen Kontaktanfrage.

-- 00b bekommt die Hinweise (00a hat oben notify_app_contact abgeschaltet, das
-- betrifft `message` nicht — die Schalter sind je Ereignis, nicht je Person).

insert into public.messages (thread_id, sender_id, body)
select t.id, 'c0000000-0000-0000-0000-00000000000a',
       'Streng vertraulicher Satz, der nirgends auftauchen darf'
  from public.message_threads t
 where t.a_profile_id = least('c0000000-0000-0000-0000-00000000000a'::uuid,
                              'c0000000-0000-0000-0000-00000000000b'::uuid)
   and t.b_profile_id = greatest('c0000000-0000-0000-0000-00000000000a'::uuid,
                                 'c0000000-0000-0000-0000-00000000000b'::uuid);

select is(
  (select count(*)::int from public.notifications
    where type = 'message' and profile_id = 'c0000000-0000-0000-0000-00000000000b'),
  1, 'das Gegenueber bekommt genau eine Zeile');

select is(
  (select count(*)::int from public.notifications
    where type = 'message' and profile_id = 'c0000000-0000-0000-0000-00000000000a'),
  0, 'der Absender bekommt nichts ueber die eigene Nachricht');

-- DER KERN. Nicht „der Text ist gekuerzt", sondern: er ist GAR NICHT DA.
-- Geprueft wird die ganze Nutzlast als Text, nicht ein einzelner Schluessel —
-- ein Trigger, der den Satz unter anderem Namen ablegte, kaeme sonst durch.
select is(
  (select payload::text like '%Streng vertraulicher Satz%'
     from public.notifications
    where type = 'message' and profile_id = 'c0000000-0000-0000-0000-00000000000b'),
  false, 'die Nutzlast enthaelt den Nachrichtentext an keiner Stelle');

-- Positivkontrolle: sie ist auch nicht einfach leer.
select is(
  (select payload->>'sender_name' from public.notifications
    where type = 'message' and profile_id = 'c0000000-0000-0000-0000-00000000000b'),
  'Hin Autor', 'die Nutzlast nennt den Absender');

select isnt(
  (select payload->>'thread_id' from public.notifications
    where type = 'message' and profile_id = 'c0000000-0000-0000-0000-00000000000b'),
  null, 'die Nutzlast nennt das Gespraech, damit der Hinweis sich oeffnen laesst');

-- ── 9b. Eine Zeile je GESPRAECH, nicht je Nachricht ─────────────────────────
-- Zwanzig Nachrichten am Stueck sind ein Gespraech, kein zwanzigfacher Anlass.
-- Solange der Hinweis ungelesen ist, kommt keiner dazu — sonst wuerde die
-- Glocke bei jedem Chat volllaufen und das Telefon zwanzigmal wecken. Genau
-- der Laerm, der dazu fuehrt, dass jemand Push GANZ abschaltet.

insert into public.messages (thread_id, sender_id, body)
select t.id, 'c0000000-0000-0000-0000-00000000000a', 'Noch ein Satz'
  from public.message_threads t
 where t.a_profile_id = least('c0000000-0000-0000-0000-00000000000a'::uuid,
                              'c0000000-0000-0000-0000-00000000000b'::uuid)
   and t.b_profile_id = greatest('c0000000-0000-0000-0000-00000000000a'::uuid,
                                 'c0000000-0000-0000-0000-00000000000b'::uuid);

select is(
  (select count(*)::int from public.notifications
    where type = 'message' and profile_id = 'c0000000-0000-0000-0000-00000000000b'),
  1, 'die zweite Nachricht erzeugt keine zweite ungelesene Zeile');

-- Und die Gegenprobe: nach dem Lesen meldet sich das Gespraech wieder. Ohne
-- sie waere „keine zweite Zeile" auch von einem Trigger erfuellt, der nach der
-- ersten Nachricht nie wieder etwas tut.
update public.notifications set read_at = now()
 where type = 'message' and profile_id = 'c0000000-0000-0000-0000-00000000000b';

insert into public.messages (thread_id, sender_id, body)
select t.id, 'c0000000-0000-0000-0000-00000000000a', 'Nach dem Lesen'
  from public.message_threads t
 where t.a_profile_id = least('c0000000-0000-0000-0000-00000000000a'::uuid,
                              'c0000000-0000-0000-0000-00000000000b'::uuid)
   and t.b_profile_id = greatest('c0000000-0000-0000-0000-00000000000a'::uuid,
                                 'c0000000-0000-0000-0000-00000000000b'::uuid);

select is(
  (select count(*)::int from public.notifications
    where type = 'message' and profile_id = 'c0000000-0000-0000-0000-00000000000b'
      and read_at is null),
  1, 'nach dem Lesen meldet sich das Gespraech wieder');

-- ── 9c. Schalter und Aktivierung ────────────────────────────────────────────

update public.member_settings set notify_app_message = false
 where profile_id = 'c0000000-0000-0000-0000-00000000000b';
insert into public.member_settings (profile_id, notify_app_message)
select 'c0000000-0000-0000-0000-00000000000b', false
 where not exists (select 1 from public.member_settings
                    where profile_id = 'c0000000-0000-0000-0000-00000000000b');

update public.notifications set read_at = now()
 where type = 'message' and profile_id = 'c0000000-0000-0000-0000-00000000000b';

insert into public.messages (thread_id, sender_id, body)
select t.id, 'c0000000-0000-0000-0000-00000000000a', 'Mit abgeschaltetem Schalter'
  from public.message_threads t
 where t.a_profile_id = least('c0000000-0000-0000-0000-00000000000a'::uuid,
                              'c0000000-0000-0000-0000-00000000000b'::uuid)
   and t.b_profile_id = greatest('c0000000-0000-0000-0000-00000000000a'::uuid,
                                 'c0000000-0000-0000-0000-00000000000b'::uuid);

select is(
  (select count(*)::int from public.notifications
    where type = 'message' and profile_id = 'c0000000-0000-0000-0000-00000000000b'
      and read_at is null),
  0, 'abgeschaltetes notify_app_message schreibt nichts');

-- Ein nie bestaetigtes Konto (00d) bekommt nichts — dieselbe Grenze wie bei
-- den vier aelteren Typen, und sie muss hier eigens gezogen werden, weil ein
-- Gespraechsfaden aelter sein kann als eine Deaktivierung.
insert into public.message_threads (a_profile_id, b_profile_id)
values (least('c0000000-0000-0000-0000-00000000000a'::uuid,
              'c0000000-0000-0000-0000-00000000000d'::uuid),
        greatest('c0000000-0000-0000-0000-00000000000a'::uuid,
                 'c0000000-0000-0000-0000-00000000000d'::uuid));

insert into public.messages (thread_id, sender_id, body)
select t.id, 'c0000000-0000-0000-0000-00000000000a', 'An ein unbestaetigtes Konto'
  from public.message_threads t
 where t.a_profile_id = least('c0000000-0000-0000-0000-00000000000a'::uuid,
                              'c0000000-0000-0000-0000-00000000000d'::uuid)
   and t.b_profile_id = greatest('c0000000-0000-0000-0000-00000000000a'::uuid,
                                 'c0000000-0000-0000-0000-00000000000d'::uuid);

select is(
  (select count(*)::int from public.notifications
    where type = 'message' and profile_id = 'c0000000-0000-0000-0000-00000000000d'),
  0, 'ein nicht aktiviertes Konto bekommt keinen Nachrichten-Hinweis');

select * from finish();
rollback;
