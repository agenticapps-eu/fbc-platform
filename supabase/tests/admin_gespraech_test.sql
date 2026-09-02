-- Der Admin eroeffnet ein Gespraech ohne Kontaktanfrage (AGE-628, Einheit 4).
-- Change: openspec/changes/feedback-ausbauen/, Aufgaben 4.1 und 4.7–4.9.
--
-- Echtes pgTAP mit plan()/finish(). Diese Datei ist in ci.yml eingetragen —
-- ohne diesen Eintrag liefe sie nie, und genau das ist in diesem Repo schon
-- zweimal passiert.
--
-- ══ WORUM ES GEHT ══════════════════════════════════════════════════════════
-- Ein Admin muss eine Rueckfrage zu einem Feedback stellen koennen, und dafuer
-- gibt es heute keinen Weg: Chat setzt eine ANGENOMMENE Kontaktanfrage voraus,
-- und die gibt es zwischen Admin und Verfasser nicht. Die Ausnahme ist eng —
-- sie haengt am GESPRAECH (`admin_eroeffnet`), nicht an der Rolle. Damit bleibt
-- sie auf genau diesen einen Faden begrenzt und ueberlebt es, wenn der Admin
-- spaeter seine Rolle verliert.
--
-- ══ DIE KLAMMERFALLE, GEGEN DIE DIESE DATEI STEHT ══════════════════════════
-- In `messages_insert` steht die TEILNAHMEPRUEFUNG heute INNERHALB desselben
-- `exists`, das die Kontaktanfrage prueft. Wer diesen Ausdruck als Ganzes
-- klammert und `or is_admin()` daranhaengt, hebt die Teilnahmepruefung mit auf
-- — und baut einen Admin, der in JEDES fremde Gespraech schreiben darf. Das
-- genaue Gegenteil der zugesagten engen Ausnahme.
--
-- Der bestehende Test 27 in `rls_test.sql` faengt das NICHT: er handelt als
-- Mitglied in einem gewoehnlichen Faden und bleibt gruen, gleichgueltig wie
-- der Admin-Zweig geklammert ist. Gemessen am 01.09. (Aufgabe 0.4): ueber die
-- ganze CI-Liste ist er die EINZIGE Zusage, die auf die Freigabe anspricht.
-- Die Zusage in Abschnitt 4 dieser Datei ist deshalb keine Doppelung, sondern
-- die einzige Abdeckung dieser Richtung.
--
-- ══ WARUM DIE HELFER FEHLER FANGEN ═════════════════════════════════════════
-- In der RED-Stufe gibt es weder den Oeffnungs-Weg noch die Spalte
-- `admin_eroeffnet`. Ein ungefangener `42883`/`42703` risse die ganze
-- Testtransaktion mit, und die Datei scheiterte als ABBRUCH statt als Zusage.
-- SQLSTATE statt SQLERRM, damit keine Zusage an einem Wortlaut haengt.

begin;
select plan(21);

-- ── Impersonierung ──────────────────────────────────────────────────────────
-- Der Fehlertext geht MIT zurueck, nicht nur der SQLSTATE. Grund steht im
-- Kopf: `42501` heisst „permission denied" ebenso wie „row-level security
-- policy", und die erste Fassung dieser Datei hat genau daran zwei Zusagen
-- verloren — sie waren rot, weil `authenticated` die pgTAP-Hilfstabelle nicht
-- lesen darf, und nicht wegen der Policy. Eine Ablehnung wird deshalb unten
-- immer an `%row-level security policy%` verankert, nie an „es hat gekracht".
create function pg_temp.tu_als(uid uuid, q text) returns text
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

-- Gibt die Kennung des geoeffneten Gespraechs zurueck — oder `null`, solange es
-- den Weg nicht gibt. `null` und nicht der Fehlertext, damit das Ergebnis
-- unmittelbar als Fremdschluessel taugt.
create function pg_temp.oeffne_als(uid uuid, ziel uuid) returns uuid
language plpgsql as $$
declare t uuid;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    execute 'select public.admin_gespraech_oeffnen($1)' into t using ziel;
  exception when others then
    t := null;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return t;
end $$;

-- ── Fixture: drei Konten, KEINE Kontaktanfrage ──────────────────────────────
-- Der auth.users-Insert feuert handle_new_user() und legt public.profiles an.
-- Dass zwischen den dreien keine `contact_requests`-Zeile steht, ist die
-- Voraussetzung des ganzen Falls und keine Nachlaessigkeit: mit einer
-- angenommenen Anfrage waere jede Zusage unten auch ohne die neue Ausnahme
-- gruen.
insert into auth.users (id, aud, role, email) values
  ('ad000000-0000-0000-0000-0000000000ad', 'authenticated', 'authenticated', 'ge-admin@test.fbc'),
  ('ad000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'ge-mitglied-eins@test.fbc'),
  ('ad000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'ge-mitglied-zwei@test.fbc'),
  ('ad000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'ge-mitglied-drei@test.fbc'),
  ('ad000000-0000-0000-0000-00000000000d', 'authenticated', 'authenticated', 'ge-admin-deaktiviert@test.fbc');

insert into public.staff_roles (profile_id, role) values
  ('ad000000-0000-0000-0000-0000000000ad', 'admin'),
  ('ad000000-0000-0000-0000-00000000000d', 'admin');

update public.profiles set tier = 'basic', name = 'Gespraechs-Admin', activated_at = now()
 where id = 'ad000000-0000-0000-0000-0000000000ad';
update public.profiles set tier = 'basic', name = 'Mitglied Eins', activated_at = now()
 where id = 'ad000000-0000-0000-0000-000000000001';
update public.profiles set tier = 'basic', name = 'Mitglied Zwei', activated_at = now()
 where id = 'ad000000-0000-0000-0000-000000000002';
update public.profiles set tier = 'basic', name = 'Mitglied Drei', activated_at = now()
 where id = 'ad000000-0000-0000-0000-000000000003';
-- Bewusst OHNE activated_at: der Fall aus 4.8. Die Staff-Zeile hat er
-- trotzdem, und `is_admin()` gibt fuer ihn seit AGE-581 dennoch false zurueck —
-- die Rolle ueberlebt den Zugangsentzug nicht.
update public.profiles set tier = 'basic', name = 'Admin ohne Bestaetigung'
 where id = 'ad000000-0000-0000-0000-00000000000d';

-- Ein FREMDER Faden zwischen Eins und Zwei, ohne Kontaktanfrage und ohne
-- Marke. Er traegt zwei Zusagen: der Admin darf dort NICHT schreiben (die
-- Klammerfalle), und Eins darf es ebenso wenig (keine Freischaltung ausserhalb
-- des markierten Fadens). Als Eigentuemer eingefuegt — die Policy ist hier
-- nicht der Gegenstand, sondern die Ausgangslage.
insert into public.message_threads (id, a_profile_id, b_profile_id) values
  ('adfadfad-0000-0000-0000-00000000f001',
   'ad000000-0000-0000-0000-000000000001',
   'ad000000-0000-0000-0000-000000000002');

-- Drei hat eine ANGENOMMENE Kontaktanfrage an den Admin. Der Faden entsteht
-- dadurch auf dem gewoehnlichen Weg (handle_contact_request_change), ist
-- normalisiert und traegt KEINE Marke. Er misst spaeter, dass der
-- Oeffnungs-Weg ihn FINDET statt zu verdoppeln — und ihn nicht nachtraeglich
-- freischaltet.
--
-- Erst `pending`, dann `accepted`: die Thread-Anlage haengt im Trigger am
-- Statuswechsel eines UPDATE, ein direktes Einfuegen mit `accepted` legte
-- keinen Faden an.
insert into public.contact_requests (from_id, to_id, status) values
  ('ad000000-0000-0000-0000-000000000003',
   'ad000000-0000-0000-0000-0000000000ad', 'pending');
update public.contact_requests set status = 'accepted'
 where from_id = 'ad000000-0000-0000-0000-000000000003'
   and to_id   = 'ad000000-0000-0000-0000-0000000000ad';

-- Der Oeffnungs-Weg wird EINMAL gerufen; sein Ergebnis traegt die drei Zusagen.
create table pg_temp.faden (id uuid);
insert into pg_temp.faden values (
  pg_temp.oeffne_als('ad000000-0000-0000-0000-0000000000ad',
                     'ad000000-0000-0000-0000-000000000001'));

-- ── 1. Der Oeffnungs-Weg legt EIN markiertes Gespraech an (Aufgabe 4.1) ─────
-- Die Zusage nennt beides in einem Wort: dass es den Faden gibt UND dass er
-- markiert ist. Ein Faden ohne Markierung waere schlimmer als keiner — er saehe
-- aus wie ein offener Weg und braeche erst, wenn das Mitglied antwortet.
create function pg_temp.fadenzustand() returns text language plpgsql as $$
declare z text;
begin
  begin
    select case when f.id is null            then 'KEIN FADEN'
                when t.id  is null            then 'FADEN OHNE ZEILE'
                when t.admin_eroeffnet        then 'markiert'
                else                               'nicht markiert' end
      into z
      from pg_temp.faden f
      left join public.message_threads t on t.id = f.id;
  exception when others then
    return 'FEHLER:' || SQLSTATE;
  end;
  return z;
end $$;

select is(pg_temp.fadenzustand(), 'markiert',
  'Der Oeffnungs-Weg legt das Gespraech an und markiert es als vom Admin eroeffnet');

-- ── 2. Der Admin schreibt hinein (Aufgabe 4.1) ─────────────────────────────
-- Die Kennung wird per `format` als LITERAL eingesetzt und nicht im
-- impersonierten Ausdruck aus `pg_temp.faden` gelesen: `authenticated` haelt
-- an einer temporaeren Tabelle keine Rechte, und der daraus folgende
-- „permission denied" traegt denselben SQLSTATE 42501 wie eine
-- RLS-Ablehnung. Die erste Fassung dieser Datei ist genau darauf
-- hereingefallen. `format` laeuft hier oben als Eigentuemer, vor der
-- Impersonierung.
select is(
  pg_temp.tu_als('ad000000-0000-0000-0000-0000000000ad',
    format($q$insert into public.messages (thread_id, sender_id, body)
              values (%L, %L, 'Rueckfrage zum Feedback')$q$,
           (select id from pg_temp.faden),
           'ad000000-0000-0000-0000-0000000000ad')),
  'OK', 'Der Admin schreibt in das von ihm eroeffnete Gespraech — ohne Kontaktanfrage');

-- ── 3. Das Mitglied antwortet (Aufgabe 4.1) ────────────────────────────────
-- Die Freischaltung haengt am Gespraech, nicht an der Rolle: das Mitglied
-- gewinnt dadurch KEIN Senderecht gegenueber sonst jemandem. Genau das misst
-- Abschnitt 4.8 spaeter gegen.
select is(
  pg_temp.tu_als('ad000000-0000-0000-0000-000000000001',
    format($q$insert into public.messages (thread_id, sender_id, body)
              values (%L, %L, 'Antwort des Mitglieds')$q$,
           (select id from pg_temp.faden),
           'ad000000-0000-0000-0000-000000000001')),
  'OK', 'Das Mitglied antwortet im markierten Gespraech — beide Seiten duerfen senden');

-- ── 4. Und ein Nicht-Admin darf nichts davon (Aufgabe 4.7) ─────────────────
-- Die Gegenrichtung zu 1–3. Ohne sie sagten die drei oben nur „es geht", nicht
-- „es geht NUR so".
select alike(
  pg_temp.tu_als('ad000000-0000-0000-0000-000000000001',
    $q$select public.admin_gespraech_oeffnen('ad000000-0000-0000-0000-000000000002')$q$),
  'FEHLER:42501 forbidden%',
  'Ein gewoehnliches Mitglied bekommt den Oeffnungs-Weg nicht — 42501, keine leere Kennung');

select alike(
  pg_temp.tu_als('ad000000-0000-0000-0000-000000000001',
    $q$insert into public.message_threads (a_profile_id, b_profile_id)
       values ('ad000000-0000-0000-0000-000000000001',
               'ad000000-0000-0000-0000-000000000002')$q$),
  'FEHLER:42501 %row-level security policy%',
  'Und es legt auch von Hand kein Gespraech ohne angenommene Kontaktanfrage an');

-- Der Admin darf es ueber die Policy sehr wohl — die Ausnahme steht in BEIDEN
-- Policies, nicht nur in einer. Ein Admin, der anlegen, aber nicht schreiben
-- kann, saehe aus wie ein funktionierender Weg und braeche erst beim Absenden.
select is(
  pg_temp.tu_als('ad000000-0000-0000-0000-0000000000ad',
    $q$insert into public.message_threads (a_profile_id, b_profile_id)
       values ('ad000000-0000-0000-0000-000000000002',
               'ad000000-0000-0000-0000-0000000000ad')$q$),
  'OK', 'Der Admin legt auch ueber threads_insert an — die Ausnahme steht in BEIDEN Policies');

-- ══ DER FADEN AUS `threads_insert` IST NUR EIN HALBER WEG ══════════════════
-- Die zwei Zusagen hier sind aus einer GEGENPROBE entstanden, nicht aus dem
-- Entwurf. Am 02.09. gemessen: `or public.is_admin()` aus der Freigabe von
-- `messages_insert` herausgenommen — und ueber alle 26 Dateien und 1109
-- Zusagen fiel **keine einzige**. Der Zweig war unbelegt.
--
-- Belegt wird er von genau diesem Fall: einem Faden, den der Admin ueber
-- `threads_insert` angelegt hat. Der traegt KEINE Marke — die setzt nur
-- `admin_gespraech_oeffnen`. Also schreibt dort der Admin (ueber `is_admin`),
-- und das Gegenueber schreibt dort NICHT.
--
-- Das ist kein Fehler, sondern die Grenze, und sie steht hier, damit sie
-- niemand fuer einen haelt: der GANZE Weg ist `admin_gespraech_oeffnen`.
-- Wer ein Gespraech von Hand anlegt, bekommt eine Einbahnstrasse.
select is(
  pg_temp.tu_als('ad000000-0000-0000-0000-0000000000ad',
    format($q$insert into public.messages (thread_id, sender_id, body)
              values (%L, %L, 'Von Hand angelegt')$q$,
           (select t.id from public.message_threads t
             where least(a_profile_id, b_profile_id) = 'ad000000-0000-0000-0000-000000000002'
               and greatest(a_profile_id, b_profile_id) = 'ad000000-0000-0000-0000-0000000000ad'),
           'ad000000-0000-0000-0000-0000000000ad')),
  'OK',
  'Der Admin schreibt auch im UNMARKIERTEN eigenen Faden — das belegt `or is_admin()` in messages_insert');

select alike(
  pg_temp.tu_als('ad000000-0000-0000-0000-000000000002',
    format($q$insert into public.messages (thread_id, sender_id, body)
              values (%L, %L, 'Darf ich antworten?')$q$,
           (select t.id from public.message_threads t
             where least(a_profile_id, b_profile_id) = 'ad000000-0000-0000-0000-000000000002'
               and greatest(a_profile_id, b_profile_id) = 'ad000000-0000-0000-0000-0000000000ad'),
           'ad000000-0000-0000-0000-000000000002')),
  'FEHLER:42501 %row-level security policy%',
  '… sein Gegenueber aber nicht: ohne Marke bleibt der Faden eine Einbahnstrasse');

-- ── 5. Die Grenzen (Aufgabe 4.8) ───────────────────────────────────────────
-- 5.1 Kein Gespraech zwischen zwei Fremden. Die Teilnahmepruefung in
-- `threads_insert` gilt fuer den Admin genauso — die Ausnahme haengt an der
-- FREIGABE, nicht an der Teilnahme.
select alike(
  pg_temp.tu_als('ad000000-0000-0000-0000-0000000000ad',
    $q$insert into public.message_threads (a_profile_id, b_profile_id)
       values ('ad000000-0000-0000-0000-000000000001',
               'ad000000-0000-0000-0000-000000000002')$q$),
  'FEHLER:42501 %row-level security policy%',
  'Auch der Admin legt kein Gespraech zwischen zwei ANDEREN an');

-- 5.2 Ein Mitglied setzt die Marke nicht selbst. Die angenommene
-- Kontaktanfrage von Drei ist hier die Voraussetzung: ohne sie praellte das
-- Einfuegen schon an der Freigabe ab, und die Zusage maesse nicht die Marke.
-- Der Faden zwischen Drei und dem Admin existiert bereits, deshalb geht es
-- gegen den Unique-Index — also nimmt die Zusage ein Paar, das es noch nicht
-- gibt, und die Positivkontrolle daneben belegt, dass genau die Marke stoert.
insert into public.contact_requests (from_id, to_id, status) values
  ('ad000000-0000-0000-0000-000000000003',
   'ad000000-0000-0000-0000-000000000002', 'pending');
update public.contact_requests set status = 'accepted'
 where from_id = 'ad000000-0000-0000-0000-000000000003'
   and to_id   = 'ad000000-0000-0000-0000-000000000002';
delete from public.message_threads
 where a_profile_id = 'ad000000-0000-0000-0000-000000000002'
   and b_profile_id = 'ad000000-0000-0000-0000-000000000003';

select alike(
  pg_temp.tu_als('ad000000-0000-0000-0000-000000000003',
    $q$insert into public.message_threads (a_profile_id, b_profile_id, admin_eroeffnet)
       values ('ad000000-0000-0000-0000-000000000002',
               'ad000000-0000-0000-0000-000000000003', true)$q$),
  'FEHLER:42501 %row-level security policy%',
  'Ein Mitglied kann `admin_eroeffnet` nicht selbst setzen — sonst schriebe sich jeder den Freifahrtschein');

select is(
  pg_temp.tu_als('ad000000-0000-0000-0000-000000000003',
    $q$insert into public.message_threads (a_profile_id, b_profile_id)
       values ('ad000000-0000-0000-0000-000000000002',
               'ad000000-0000-0000-0000-000000000003')$q$),
  'OK',
  'Positivkontrolle: dasselbe Einfuegen OHNE die Marke geht durch — es ist die Marke, die stoert');

-- 5.3 Kein fremder `sender_id`. Der Faden ist markiert und das Mitglied darf
-- darin schreiben — aber unter SEINEM Namen.
select alike(
  pg_temp.tu_als('ad000000-0000-0000-0000-000000000001',
    format($q$insert into public.messages (thread_id, sender_id, body)
              values (%L, %L, 'Im Namen des Admins')$q$,
           (select id from pg_temp.faden),
           'ad000000-0000-0000-0000-0000000000ad')),
  'FEHLER:42501 %row-level security policy%',
  'Auch im markierten Gespraech schreibt niemand unter fremdem sender_id');

-- 5.4 DIE KLAMMER-ZUSAGE, und sie ist die einzige ihrer Art im ganzen Bestand.
-- Handelnder ist ein ADMIN, der Faden ist fremd und NICHT markiert. Wer die
-- Teilnahmepruefung mit in die Ausnahme-Klammer zieht, laesst genau das zu.
-- Test 27 in `rls_test.sql` handelt als MITGLIED in einem gewoehnlichen Faden
-- und bliebe dabei gruen — gemessen am 01.09. ueber die ganze CI-Liste.
select alike(
  pg_temp.tu_als('ad000000-0000-0000-0000-0000000000ad',
    $q$insert into public.messages (thread_id, sender_id, body)
       values ('adfadfad-0000-0000-0000-00000000f001',
               'ad000000-0000-0000-0000-0000000000ad', 'Ich lese hier mit')$q$),
  'FEHLER:42501 %row-level security policy%',
  'Ein Admin schreibt NICHT in einen fremden Faden — die Teilnahmepruefung steht ausserhalb der Ausnahme');

-- 5.5 Keine Freischaltung ausserhalb des markierten Fadens. Dasselbe Mitglied,
-- das oben antworten durfte, darf es hier nicht: die Freischaltung haengt am
-- Gespraech, nicht an der Rolle des Gegenuebers und nicht an der Person.
select alike(
  pg_temp.tu_als('ad000000-0000-0000-0000-000000000001',
    $q$insert into public.messages (thread_id, sender_id, body)
       values ('adfadfad-0000-0000-0000-00000000f001',
               'ad000000-0000-0000-0000-000000000001', 'Und hier auch?')$q$),
  'FEHLER:42501 %row-level security policy%',
  'Das freigeschaltete Mitglied gewinnt KEIN Senderecht in seinen uebrigen Gespraechen');

-- 5.6 Der deaktivierte Admin. Positivkontrolle zuerst: die Staff-Zeile liegt.
select is(
  (select count(*)::int from public.staff_roles
    where profile_id = 'ad000000-0000-0000-0000-00000000000d' and role = 'admin'),
  1, 'Das deaktivierte Konto traegt die Admin-Zeile in staff_roles wirklich');

select alike(
  pg_temp.tu_als('ad000000-0000-0000-0000-00000000000d',
    $q$select public.admin_gespraech_oeffnen('ad000000-0000-0000-0000-000000000001')$q$),
  'FEHLER:42501 forbidden%',
  '… und bekommt den Oeffnungs-Weg trotzdem nicht');

select alike(
  pg_temp.tu_als('ad000000-0000-0000-0000-00000000000d',
    format($q$insert into public.messages (thread_id, sender_id, body)
              values (%L, %L, 'Trotzdem')$q$,
           (select id from pg_temp.faden),
           'ad000000-0000-0000-0000-00000000000d')),
  'FEHLER:42501 %row-level security policy%',
  '… und schreibt auch in kein markiertes Gespraech');

-- ── 6. Ein Paar, ein Gespraech (Aufgabe 4.9) ───────────────────────────────
-- Echte Nebenlaeufigkeit laesst sich in einer pgTAP-Sitzung nicht herstellen.
-- Was hier steht, ist die Zusage, die den Wettlauf ueberhaupt erst harmlos
-- macht: der Weg ist IDEMPOTENT, und er findet auch den Faden, den ein anderer
-- Weg angelegt hat. Gegen das verbleibende Zeitfenster steht `on conflict do
-- nothing` plus der Nachschlag unter READ COMMITTED — begruendet im
-- Migrationskopf.
select is(
  pg_temp.oeffne_als('ad000000-0000-0000-0000-0000000000ad',
                     'ad000000-0000-0000-0000-000000000001'),
  (select id from pg_temp.faden),
  'Ein zweiter Aufruf liefert DIESELBE Kennung — kein zweites Gespraech');

select is(
  (select count(*)::int from public.message_threads
    where least(a_profile_id, b_profile_id) = 'ad000000-0000-0000-0000-000000000001'
      and greatest(a_profile_id, b_profile_id) = 'ad000000-0000-0000-0000-0000000000ad'),
  1, '… und fuer das Paar steht genau EIN Faden in der Tabelle');

-- Der Faden von Drei ist auf dem gewoehnlichen Weg entstanden. Der
-- Oeffnungs-Weg muss ihn FINDEN — und ihn nicht nachtraeglich freischalten.
-- Beides in einer Zusage, weil ein gefundener, aber markierter Faden der
-- gefaehrlichere Fehler waere: er oeffnete ein Gespraech, das zwei Mitglieder
-- unter ihren eigenen Bedingungen fuehren.
select is(
  (select coalesce(t.id::text, 'KEIN FADEN') || case when t.admin_eroeffnet then ' markiert' else ' unmarkiert' end
     from public.message_threads t
    where t.id = pg_temp.oeffne_als('ad000000-0000-0000-0000-0000000000ad',
                                    'ad000000-0000-0000-0000-000000000003')),
  (select t.id::text || ' unmarkiert' from public.message_threads t
    where least(a_profile_id, b_profile_id) = 'ad000000-0000-0000-0000-000000000003'
      and greatest(a_profile_id, b_profile_id) = 'ad000000-0000-0000-0000-0000000000ad'),
  'Ein bestehendes, gewoehnliches Gespraech wird gefunden und NICHT nachtraeglich markiert');

-- Und das Selbstgespraech.
select alike(
  pg_temp.tu_als('ad000000-0000-0000-0000-0000000000ad',
    $q$select public.admin_gespraech_oeffnen('ad000000-0000-0000-0000-0000000000ad')$q$),
  'FEHLER:22023 %Selbstgespraech%',
  'Ein Selbstgespraech wird abgewiesen — mit 22023, nicht mit einer stillen Kennung');

select * from finish();
rollback;
