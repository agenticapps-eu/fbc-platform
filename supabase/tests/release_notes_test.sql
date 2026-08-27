-- Release-Notes an alle Mitglieder (AGE-631).
-- Change: openspec/changes/release-notes-an-alle/.
--
-- Echtes pgTAP mit plan()/finish() — nur solche Dateien stehen im CI-Lauf.
-- Diese Datei ist in ci.yml eingetragen.
--
-- ══ WAS HIER GEMESSEN WIRD ═════════════════════════════════════════════════
-- Drei Zusagen, die man im Browser NICHT widerlegen kann:
--
--   1. **Zweimal zustellen erzeugt nichts.** Ein Fan-out ist die einzige
--      Schreiblast dieser Anwendung, die mit der Mitgliederzahl multipliziert.
--      Ein zweiter Klick ist der Normalfall, und `notifications` traegt keinen
--      Schluessel, an dem die Dopplung auffiele — im Browser saehe man nur
--      „hat geklappt", zweimal.
--   2. **Ein Nicht-Admin stellt nichts zu.** Die Funktion ist DEFINER; ob ihr
--      Gate haelt, sieht man an der Oberflaeche nie, weil dort schon
--      RequireAdmin davorsteht — und das ist Komfort, keine Grenze.
--   3. **Die vier Opt-out-Schalter aus AGE-620 greifen NICHT.** Das ist eine
--      Absicht, keine Nachlaessigkeit, und eine Absicht gehoert festgehalten:
--      sonst „repariert" sie jemand.
--
-- ══ FALLEN, DIE DIESES PROJEKT SCHON GESTELLT HAT ══════════════════════════
--   * In pgTAP heisst es `alike()`, nicht `like()`.
--   * `try_as()` meldet jeden Fehler als 'DENIED:'. Jede Schreibzusage lautet
--     deshalb auf den BESTAND danach, nicht auf einen Fehlercode.
--   * **Eine Messung aus lauter Nullen belegt nichts.** „Der zweite Aufruf
--     erzeugt nichts" ist wertlos ohne „der erste erzeugt sehr wohl etwas".
--   * Der lokale Stack ist geseedet — jede Mengenaussage ist auf die
--     Fixture-Kennungen eingeschraenkt, nie `count(*)` der ganzen Tabelle.

begin;
select plan(20);

-- ── Fixtures ────────────────────────────────────────────────────────────────
insert into auth.users (id, aud, role, email) values
  ('8a000000-0000-0000-0000-0000000000ad', 'authenticated', 'authenticated', 'rn-admin@test.fbc'),
  ('8a000000-0000-0000-0000-00000000000a', 'authenticated', 'authenticated', 'rn-a@test.fbc'),
  ('8a000000-0000-0000-0000-00000000000b', 'authenticated', 'authenticated', 'rn-b@test.fbc'),
  ('8a000000-0000-0000-0000-00000000000c', 'authenticated', 'authenticated', 'rn-unbestaetigt@test.fbc');

update public.profiles set tier = 'impact', name = 'RN Admin', activated_at = now()
 where id = '8a000000-0000-0000-0000-0000000000ad';
update public.profiles set tier = 'impact', name = 'RN A', activated_at = now()
 where id = '8a000000-0000-0000-0000-00000000000a';
update public.profiles set tier = 'impact', name = 'RN B', activated_at = now()
 where id = '8a000000-0000-0000-0000-00000000000b';
-- Nie bestaetigt: `activated_at` bleibt bewusst null.
update public.profiles set tier = 'impact', name = 'RN Unbestaetigt'
 where id = '8a000000-0000-0000-0000-00000000000c';

insert into public.staff_roles (profile_id, role)
values ('8a000000-0000-0000-0000-0000000000ad', 'admin');

-- B hat ALLE VIER In-App-Schalter abgeschaltet. Er ist die Zusage, dass das
-- Opt-out aus AGE-620 auf diesen Typ nicht wirkt.
insert into public.member_settings (profile_id, notify_inapp_post, notify_inapp_event,
                                    notify_inapp_comment, notify_inapp_like)
values ('8a000000-0000-0000-0000-00000000000b', false, false, false, false);

insert into public.release_notes (id, title, body, entry_slugs, status) values
  ('8b000000-0000-0000-0000-000000000001', 'Neu in der App',
   '## Glocke verdrahtet', array['2026-08-27-glocke-und-hinweistypen'], 'draft'),
  ('8b000000-0000-0000-0000-000000000002', 'Ein Entwurf, der liegen bleibt',
   'Text', array['2026-08-26-fix-mobile-overflow'], 'draft');

-- ── Helfer ──────────────────────────────────────────────────────────────────
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

/** Wieviele release_note-Hinweise gibt es zu dieser Note? */
create function pg_temp.zugestellt(p_id uuid) returns int language sql as $$
  select count(*)::int from public.notifications
   where type = 'release_note' and payload->>'release_note_id' = p_id::text;
$$;

-- ── 1. Gestalt ──────────────────────────────────────────────────────────────
select has_table('public', 'release_notes', 'Die Tabelle release_notes existiert');

select is(
  (select relrowsecurity from pg_class where oid = 'public.release_notes'::regclass),
  true, 'RLS ist auf release_notes eingeschaltet');

-- Der Zustand ist der Riegel gegen die Doppelzustellung. Ein dritter Wert
-- machte ihn wirkungslos, ohne dass es auffiele.
select is(
  (select count(*)::int from pg_constraint
    where conrelid = 'public.release_notes'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%draft%' and pg_get_constraintdef(oid) ilike '%sent%'),
  1, 'status ist auf draft/sent eingeschraenkt');

-- Kein DELETE: eine zugestellte Mitteilung soll nicht verschwinden koennen,
-- und ein Entwurf wird ueberschrieben, nicht geloescht.
select is(
  (select count(*)::int from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'release_notes'
      and grantee = 'authenticated' and privilege_type = 'DELETE'),
  0, 'authenticated haelt KEIN DELETE auf release_notes');

-- ── 2. Wer die Zustellung ausloesen darf ────────────────────────────────────
select alike(
  pg_temp.try_as('8a000000-0000-0000-0000-00000000000a',
    $q$ select public.send_release_note('8b000000-0000-0000-0000-000000000001') $q$),
  'DENIED:%',
  'Ein Mitglied ohne Admin-Rolle kommt an der Zustellfunktion nicht vorbei');

select is(
  pg_temp.zugestellt('8b000000-0000-0000-0000-000000000001'), 0,
  'Und es ist dabei KEINE Benachrichtigung entstanden — gemessen am Bestand, '
  'nicht am Fehlercode');

select is(
  (select status from public.release_notes where id = '8b000000-0000-0000-0000-000000000001'),
  'draft', 'Die Note steht nach dem abgewiesenen Versuch weiter auf draft');

-- ── 3. Die Zustellung selbst ────────────────────────────────────────────────
select is(
  pg_temp.count_as('8a000000-0000-0000-0000-0000000000ad',
    $q$ select public.send_release_note('8b000000-0000-0000-0000-000000000001') $q$),
  (select count(*)::int from public.profiles p where public.is_activated_profile(p.id)),
  'Der Rueckgabewert ist die Zahl der wirklich beschriebenen Mitglieder');

select is(
  (select count(*)::int from public.notifications
    where type = 'release_note'
      and profile_id = '8a000000-0000-0000-0000-00000000000a'), 1,
  'Das aktivierte Mitglied A hat genau EINE Zeile');

select is(
  (select count(*)::int from public.notifications
    where type = 'release_note'
      and profile_id = '8a000000-0000-0000-0000-00000000000b'), 1,
  'Mitglied B bekommt sie AUCH — die vier Opt-out-Schalter aus AGE-620 greifen '
  'auf diesen Typ nicht, und das ist Absicht');

select is(
  (select count(*)::int from public.notifications
    where type = 'release_note'
      and profile_id = '8a000000-0000-0000-0000-00000000000c'), 0,
  'Das unbestaetigte Konto bekommt nichts — es sieht die Anwendung nicht');

select is(
  (select payload->>'title' from public.notifications
    where type = 'release_note'
      and profile_id = '8a000000-0000-0000-0000-00000000000a'),
  'Neu in der App',
  'Der Hinweis traegt den Titel — ohne ihn haette die Glocke nichts zu sagen');

-- ── 4. Zweimal zustellen erzeugt nichts ─────────────────────────────────────
-- Die Positivkontrolle steht oben: der erste Lauf hat sehr wohl geschrieben.
select alike(
  pg_temp.try_as('8a000000-0000-0000-0000-0000000000ad',
    $q$ select public.send_release_note('8b000000-0000-0000-0000-000000000001') $q$),
  'DENIED:%',
  'Der zweite Aufruf bricht ab');

select is(
  pg_temp.zugestellt('8b000000-0000-0000-0000-000000000001'),
  (select count(*)::int from public.profiles p where public.is_activated_profile(p.id)),
  'Und die Zahl der Benachrichtigungen hat sich dabei NICHT bewegt');

-- ── 4b. Ein Admin kann den Riegel nicht umgehen ─────────────────────────────
-- Ohne diese Zusage waere der Zustandswechsel wertlos: ein Admin legte eine
-- Zeile gleich als `sent` an, der Rundruf liefe nie, und die Note stuende auf
-- `/neues`, ohne dass sie jemand bekommen haette.
--
-- Beide Wege WERFEN (42501), und der zweite tut es aus einem Grund, der beim
-- Schreiben dieses Tests erst gemessen wurde: bei einem UPDATE, das die
-- `using`-Bedingung passiert und erst an der `with check`-Bedingung scheitert,
-- gibt es keine stille Null-Zeilen-Antwort — die Zeile ist sichtbar, nur das
-- Ergebnis ist unzulaessig. Die bekannte Falle „UPDATE ergibt null Zeilen statt
-- 42501" gilt fuer `using`, nicht fuer `with check`. Jede Zusage steht deshalb
-- trotzdem auf dem BESTAND danach.
select alike(
  pg_temp.try_as('8a000000-0000-0000-0000-0000000000ad', $q$
    insert into public.release_notes (id, title, body, status)
    values ('8b000000-0000-0000-0000-000000000003', 'Am Riegel vorbei', 'x', 'sent') $q$),
  'DENIED:%',
  'Ein Admin kann keine Note direkt als zugestellt ANLEGEN');

select is(
  (select count(*)::int from public.release_notes
    where id = '8b000000-0000-0000-0000-000000000003'),
  0, 'Und die Zeile ist dabei auch wirklich nicht entstanden');

select alike(
  pg_temp.try_as('8a000000-0000-0000-0000-0000000000ad', $q$
    update public.release_notes set status = 'sent'
     where id = '8b000000-0000-0000-0000-000000000002' $q$),
  'DENIED:%',
  'Und er kann einen Entwurf auch nicht von Hand auf zugestellt DREHEN');

select is(
  (select status from public.release_notes where id = '8b000000-0000-0000-0000-000000000002'),
  'draft',
  'Der Entwurf steht danach unveraendert auf draft — gemessen am Bestand, denn '
  'ein 42501 sagt nur, dass etwas abgewiesen wurde, nicht dass nichts geschah');

-- ── 5. Ein Entwurf ist fuer niemanden sichtbar ──────────────────────────────
select is(
  pg_temp.count_as('8a000000-0000-0000-0000-00000000000a',
    $q$ select count(*)::int from public.release_notes
         where id = '8b000000-0000-0000-0000-000000000002' $q$),
  0, 'Ein Mitglied sieht einen Entwurf nicht');

select is(
  pg_temp.count_as('8a000000-0000-0000-0000-00000000000a',
    $q$ select count(*)::int from public.release_notes
         where id = '8b000000-0000-0000-0000-000000000001' $q$),
  1, 'Positivkontrolle: die ZUGESTELLTE Note sieht es sehr wohl — der Befund '
     'darueber misst den Zustand und nicht eine leere Tabelle');

select finish();
rollback;
