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
select plan(3);

-- ── Impersonierung ──────────────────────────────────────────────────────────
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
    return 'FEHLER:' || SQLSTATE;
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
  ('ad000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'ge-mitglied-zwei@test.fbc');

insert into public.staff_roles (profile_id, role) values
  ('ad000000-0000-0000-0000-0000000000ad', 'admin');

update public.profiles set tier = 'basic', name = 'Gespraechs-Admin', activated_at = now()
 where id = 'ad000000-0000-0000-0000-0000000000ad';
update public.profiles set tier = 'basic', name = 'Mitglied Eins', activated_at = now()
 where id = 'ad000000-0000-0000-0000-000000000001';
update public.profiles set tier = 'basic', name = 'Mitglied Zwei', activated_at = now()
 where id = 'ad000000-0000-0000-0000-000000000002';

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
select is(
  pg_temp.tu_als('ad000000-0000-0000-0000-0000000000ad',
    $q$insert into public.messages (thread_id, sender_id, body)
       select f.id, 'ad000000-0000-0000-0000-0000000000ad', 'Rueckfrage zum Feedback'
         from pg_temp.faden f$q$),
  'OK', 'Der Admin schreibt in das von ihm eroeffnete Gespraech — ohne Kontaktanfrage');

-- ── 3. Das Mitglied antwortet (Aufgabe 4.1) ────────────────────────────────
-- Die Freischaltung haengt am Gespraech, nicht an der Rolle: das Mitglied
-- gewinnt dadurch KEIN Senderecht gegenueber sonst jemandem. Genau das misst
-- Abschnitt 4.8 spaeter gegen.
select is(
  pg_temp.tu_als('ad000000-0000-0000-0000-000000000001',
    $q$insert into public.messages (thread_id, sender_id, body)
       select f.id, 'ad000000-0000-0000-0000-000000000001', 'Antwort des Mitglieds'
         from pg_temp.faden f$q$),
  'OK', 'Das Mitglied antwortet im markierten Gespraech — beide Seiten duerfen senden');

select * from finish();
rollback;
