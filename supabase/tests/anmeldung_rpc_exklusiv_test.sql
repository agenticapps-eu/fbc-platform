-- Anmeldungen halten sich an die Kapazität, egal auf welchem Weg (AGE-605).
-- `supabase test db`. Aufgaben 4, 6 und 7 aus
-- openspec/changes/anmeldung-nicht-an-den-rpcs-vorbei/tasks.md.
--
-- ══ WAS HIER ZUGESAGT WIRD ══════════════════════════════════════════════════
-- Zwei Regeln der Event-Anmeldung standen ausschliesslich in SECURITY-DEFINER-
-- RPCs — die Kapazitätsprüfung in `register_for_event`, der Anwesenheitsstatus
-- in `set_event_check_in`. Daneben lag ein Weg, der nicht durch sie führte:
-- `regs_write_own` war `for all` auf der eigenen Zeile, und `status` wie
-- `checked_in` sind gewöhnliche Spalten. VIER Wege, am 04.09. gegen den lokalen
-- Stack belegt, bevor die Migration geschrieben wurde:
--
--   A  INSERT mit status = 'registered' an der Kapazität vorbei
--   B  UPDATE waitlist -> registered
--   C  UPDATE checked_in = true (Selbst-Einchecken)
--   D  UPDATE event_id — die eigene registered-Zeile auf ein volles Event
--      umhängen; der Status bleibt registered
--
-- Gemessen: drei Events mit `capacity` 1 trugen danach je ZWEI registrierte
-- Anmeldungen, und ein Teilnehmer stand ohne Host-Zutun als anwesend da.
--
-- ══ WARUM ABSCHNITT 4 DIE WICHTIGSTE ZUSAGE TRÄGT ═══════════════════════════
-- Die vier Wege scheitern heute schon an den SPALTENRECHTEN. Eine Datei, die
-- nur sie prüft, bliebe deshalb auch dann grün, wenn die Kapazitätsschicht
-- vollständig wirkungslos wäre — sie käme nie zum Zug. Genau das war der Fall:
-- die erste Fassung des Triggers war SECURITY INVOKER und zählte unter der RLS
-- des Schreibenden, sah also bei jedem Angreifer null belegte Plätze. Abschnitt
-- 4 stellt eine spätere Lockerung der Rechte nach und ist die einzige Zusage,
-- die SECURITY DEFINER wirklich festhält.
--
-- ══ DIESE DATEI MUSS IN .github/workflows/ci.yml STEHEN ═════════════════════
-- Eine pgTAP-Datei mit `plan()` ist kein Beleg dafür, dass sie irgendwo läuft:
-- drei Dateien standen in diesem Repo zwischen 18 und 23 Tagen herum, ohne ein
-- einziges Mal gelaufen zu sein. `scripts/pgtap-dateiliste.test.ts` prüft die
-- Liste seitdem in beide Richtungen.

begin;
select plan(25);

-- ── Fixtures ────────────────────────────────────────────────────────────────
-- Der `auth.users`-Insert feuert `handle_new_user()` und legt die
-- `public.profiles`-Zeile an; Stufe und Aktivierung kommen danach.
--
-- Jeder Weg bekommt einen EIGENEN Angreifer und ein EIGENES Event. Eine Probe,
-- die aus zwei Gründen anschlägt, belegt keinen davon.
insert into auth.users (id, aud, role, email) values
  ('a0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'age605-host@test.fbc'),
  ('a0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'age605-fueller@test.fbc'),
  ('a0000000-0000-0000-0000-00000000000a', 'authenticated', 'authenticated', 'age605-wega@test.fbc'),
  ('a0000000-0000-0000-0000-00000000000b', 'authenticated', 'authenticated', 'age605-wegb@test.fbc'),
  ('a0000000-0000-0000-0000-00000000000c', 'authenticated', 'authenticated', 'age605-wegc@test.fbc'),
  ('a0000000-0000-0000-0000-00000000000d', 'authenticated', 'authenticated', 'age605-wegd@test.fbc'),
  ('a0000000-0000-0000-0000-000000000010', 'authenticated', 'authenticated', 'age605-frei@test.fbc'),
  ('a0000000-0000-0000-0000-000000000011', 'authenticated', 'authenticated', 'age605-voll@test.fbc'),
  ('a0000000-0000-0000-0000-000000000012', 'authenticated', 'authenticated', 'age605-wieder@test.fbc'),
  ('a0000000-0000-0000-0000-000000000013', 'authenticated', 'authenticated', 'age605-warte@test.fbc'),
  ('a0000000-0000-0000-0000-000000000014', 'authenticated', 'authenticated', 'age605-bewertet@test.fbc');

-- `regs_write_own` verlangt `has_level(4)` (= exchange). Ohne diese Zeile fiele
-- jede Zusage an der Stufe durch, und keine hätte je die Kapazität gefragt.
update public.profiles set tier = 'impact', activated_at = now()
 where id::text like 'a0000000-0000-0000-0000-%';

insert into public.events (id, title, starts_at, visibility, capacity, host_id) values
  ('b0000000-0000-0000-0000-00000000000a', 'Weg A',        now() + interval '7 days', 'public', 1, 'a0000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-00000000000b', 'Weg B',        now() + interval '7 days', 'public', 1, 'a0000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-00000000000c', 'Weg C',        now() + interval '7 days', 'public', 9, 'a0000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-00000000000d', 'Weg D Ziel',   now() + interval '7 days', 'public', 1, 'a0000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-0000000000d0', 'Weg D Quelle', now() + interval '7 days', 'public', 9, 'a0000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000010', 'Freie Plaetze',now() + interval '7 days', 'public', 5, 'a0000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000011', 'Wird frei',    now() + interval '7 days', 'public', 1, 'a0000000-0000-0000-0000-000000000001');

-- Der Füller belegt den einen Platz an den drei vollen Events.
insert into public.event_registrations (event_id, profile_id, status) values
  ('b0000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-000000000002', 'registered'),
  ('b0000000-0000-0000-0000-00000000000b', 'a0000000-0000-0000-0000-000000000002', 'registered'),
  ('b0000000-0000-0000-0000-00000000000d', 'a0000000-0000-0000-0000-000000000002', 'registered'),
  ('b0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000002', 'registered');

insert into public.event_registrations (event_id, profile_id, status) values
  ('b0000000-0000-0000-0000-00000000000b', 'a0000000-0000-0000-0000-00000000000b', 'waitlist'),
  ('b0000000-0000-0000-0000-00000000000c', 'a0000000-0000-0000-0000-00000000000c', 'registered'),
  ('b0000000-0000-0000-0000-0000000000d0', 'a0000000-0000-0000-0000-00000000000d', 'registered'),
  ('b0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000013', 'waitlist'),
  ('b0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000014', 'registered'),
  ('b0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000012', 'cancelled');

-- ── Helfer ──────────────────────────────────────────────────────────────────
-- `try_as`: 'OK', wenn die Anweisung unter der Identität durchgeht, sonst
-- 'FEHLER:<sqlstate> <meldung>'. Der SQLSTATE UND der Text gehören MIT in die
-- Rückgabe: ohne sie ist ein entzogenes Spaltenrecht nicht von einer
-- Policy-Ablehnung und beides nicht von einem Tippfehler zu unterscheiden —
-- und genau diese Unterscheidung ist hier die halbe Zusage.
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

create function pg_temp.rpc_als(uid uuid, ev uuid) returns text
language plpgsql as $$
declare r text;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    execute format('select public.register_for_event(%L::uuid)', ev) into r;
  exception when others then
    r := 'FEHLER:' || SQLSTATE || ' ' || SQLERRM;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return r;
end $$;

-- ══ 1. Die vier Wege sind zu (Aufgaben 4.1, 6.1) ════════════════════════════

select is(
  pg_temp.try_as('a0000000-0000-0000-0000-00000000000a',
    $q$insert into public.event_registrations (event_id, profile_id, status)
       values ('b0000000-0000-0000-0000-00000000000a',
               'a0000000-0000-0000-0000-00000000000a', 'registered')$q$),
  'FEHLER:42501 permission denied for table event_registrations',
  'Weg A: INSERT an der Kapazitaet vorbei scheitert am fehlenden Tabellenrecht');

-- Diese Zusage pinnt NEBENBEI die Reihenfolge der beiden Trigger fest: das
-- Event ist VOLL, es käme also auch „event is at capacity" in Frage. Dass die
-- Meldung „not directly" lautet, belegt, dass `…_exklusiv` vor `…_kapazitaet`
-- feuert — und damit, dass die Meldung den Mechanismus benennt, der wirklich
-- gegriffen hat. Wer die Trigger umbenennt, macht diese Zusage rot.
select is(
  pg_temp.try_as('a0000000-0000-0000-0000-00000000000b',
    $q$update public.event_registrations set status = 'registered'
        where event_id = 'b0000000-0000-0000-0000-00000000000b'
          and profile_id = 'a0000000-0000-0000-0000-00000000000b'$q$),
  'FEHLER:42501 registration status is set by register_for_event, not directly',
  'Weg B: Aufstieg von der Warteliste wird abgewiesen, und zwar als direkter Statuswechsel');

-- Aufgabe 4.2: `checked_in` scheitert am fehlenden SPALTENRECHT, nicht an der
-- Policy. Die Unterscheidung gehört in die Zusage — eine Policy-Ablehnung sähe
-- anders aus („new row violates row-level security policy"), und ein Test, der
-- nur „irgendein Fehler" verlangt, belegte den falschen Mechanismus.
select is(
  pg_temp.try_as('a0000000-0000-0000-0000-00000000000c',
    $q$update public.event_registrations set checked_in = true
        where event_id = 'b0000000-0000-0000-0000-00000000000c'
          and profile_id = 'a0000000-0000-0000-0000-00000000000c'$q$),
  'FEHLER:42501 permission denied for table event_registrations',
  'Weg C: Selbst-Einchecken scheitert am fehlenden Spaltenrecht auf checked_in');

select is(
  pg_temp.try_as('a0000000-0000-0000-0000-00000000000d',
    $q$update public.event_registrations
          set event_id = 'b0000000-0000-0000-0000-00000000000d'
        where event_id = 'b0000000-0000-0000-0000-0000000000d0'
          and profile_id = 'a0000000-0000-0000-0000-00000000000d'$q$),
  'FEHLER:42501 permission denied for table event_registrations',
  'Weg D: Umhaengen auf ein volles Event scheitert am fehlenden Spaltenrecht auf event_id');

-- ══ 2. Die Rechte selbst (Aufgaben 4.3, 5.7) ════════════════════════════════
-- Spalte für Spalte statt nur über den Golden-Snapshot: der sagt, WAS in der
-- Liste steht, nicht, was die Rolle effektiv darf.

select ok(has_column_privilege('authenticated', 'public.event_registrations', 'status', 'UPDATE'),
  'authenticated darf status schreiben — das Absagen bleibt moeglich');
select ok(has_column_privilege('authenticated', 'public.event_registrations', 'rating', 'UPDATE'),
  'authenticated darf rating schreiben');

select ok(not has_column_privilege('authenticated', 'public.event_registrations', 'checked_in', 'UPDATE'),
  'authenticated darf checked_in NICHT schreiben — das gehoert dem Host');
select ok(not has_column_privilege('authenticated', 'public.event_registrations', 'event_id', 'UPDATE'),
  'authenticated darf event_id NICHT schreiben (Weg D)');
select ok(not has_column_privilege('authenticated', 'public.event_registrations', 'profile_id', 'UPDATE'),
  'authenticated darf profile_id NICHT schreiben');
select ok(not has_column_privilege('authenticated', 'public.event_registrations', 'id', 'UPDATE'),
  'authenticated darf id NICHT schreiben');
select ok(not has_column_privilege('authenticated', 'public.event_registrations', 'created_at', 'UPDATE'),
  'authenticated darf created_at NICHT schreiben');

select ok(not has_table_privilege('authenticated', 'public.event_registrations', 'INSERT'),
  'authenticated hat kein INSERT — Anmeldungen legt register_for_event an');
select ok(not has_table_privilege('authenticated', 'public.event_registrations', 'DELETE'),
  'authenticated hat kein DELETE — abgesagt wird per status, die Zeile traegt die Geschichte');

-- Positivkontrolle zum `revoke`: er darf nicht mehr mitgenommen haben als
-- gewollt. Ohne SELECT sähe ein Mitglied die eigene Anmeldung nicht mehr.
select ok(has_table_privilege('authenticated', 'public.event_registrations', 'SELECT'),
  'authenticated behaelt SELECT — der revoke hat nicht mehr mitgenommen als gewollt');

select is(
  (select polcmd from pg_policy
    where polname = 'regs_write_own'
      and polrelid = 'public.event_registrations'::regclass),
  'w'::"char",
  'regs_write_own ist auf UPDATE verengt, nicht mehr for all');

-- ══ 3. Positivkontrollen — der erlaubte Weg bleibt offen (Aufgabe 7) ════════
-- Ohne diesen Abschnitt ist der Change ununterscheidbar von „die Tabelle ist
-- jetzt zu". Das ist der teuerste denkbare Fehler hier.

select is(pg_temp.rpc_als('a0000000-0000-0000-0000-000000000010',
                          'b0000000-0000-0000-0000-000000000010'),
  'registered', 'RPC vergibt bei freier Kapazitaet registered (INSERT-Zweig)');

select is(pg_temp.rpc_als('a0000000-0000-0000-0000-000000000011',
                          'b0000000-0000-0000-0000-00000000000a'),
  'waitlist', 'RPC vergibt am vollen Event waitlist statt zu ueberbuchen');

-- Die Zusage, die in der ersten Fassung des Plans FEHLTE: `register_for_event`
-- ist ein Upsert, die Wiederanmeldung nach dem Absagen läuft also über den
-- UPDATE-Zweig — genau dort, wo Schicht 2 feuert. Ohne sie wäre ein gebrochener
-- Produktivweg unbemerkt geblieben, während alle Sperr-Zusagen grün bleiben.
select is(pg_temp.rpc_als('a0000000-0000-0000-0000-000000000012',
                          'b0000000-0000-0000-0000-000000000010'),
  'registered', 'RPC: cancelled -> registered, die Wiederanmeldung ueber den UPDATE-Zweig');

-- Kapazität wird frei, das wartende Mitglied rückt über die RPC nach — der
-- zweite UPDATE-Zweig.
update public.event_registrations set status = 'cancelled'
 where event_id = 'b0000000-0000-0000-0000-000000000011'
   and profile_id = 'a0000000-0000-0000-0000-000000000002';

select is(pg_temp.rpc_als('a0000000-0000-0000-0000-000000000013',
                          'b0000000-0000-0000-0000-000000000011'),
  'registered', 'RPC: waitlist -> registered bei frei gewordener Kapazitaet');

-- Der Host checkt weiterhin ein. Die Anweisung wird VOR der Impersonierung
-- gebaut: `authenticated` hat an `pg_temp` keine Rechte, und der daraus
-- folgende 42501 sähe aus wie eine abgewiesene Host-Prüfung.
select is(
  pg_temp.try_as('a0000000-0000-0000-0000-000000000001',
    format('select public.set_event_check_in(%L::uuid, true)',
      (select id from public.event_registrations
        where event_id = 'b0000000-0000-0000-0000-000000000010'
          and profile_id = 'a0000000-0000-0000-0000-000000000014'))),
  'OK', 'set_event_check_in setzt als Host weiterhin checked_in');

select ok(
  (select checked_in from public.event_registrations
    where event_id = 'b0000000-0000-0000-0000-000000000010'
      and profile_id = 'a0000000-0000-0000-0000-000000000014'),
  'checked_in steht danach wirklich auf true — nicht nur kein Fehler');

select is(
  pg_temp.try_as('a0000000-0000-0000-0000-00000000000c',
    $q$update public.event_registrations set status = 'cancelled'
        where event_id = 'b0000000-0000-0000-0000-00000000000c'
          and profile_id = 'a0000000-0000-0000-0000-00000000000c'$q$),
  'OK', 'Ein Mitglied sagt weiterhin selbst ab');

-- Aufgabe 7.7: bewerten an einer Zeile, die bereits `registered` ist UND die
-- der Host bereits eingecheckt hat. Genau dieser Fall bricht, wenn jemand die
-- Regel als `with check` über den Zeilenzustand baut statt über Spaltenrechte.
select is(
  pg_temp.try_as('a0000000-0000-0000-0000-000000000014',
    $q$update public.event_registrations set rating = 5
        where event_id = 'b0000000-0000-0000-0000-000000000010'
          and profile_id = 'a0000000-0000-0000-0000-000000000014'$q$),
  'OK', 'Ein Mitglied bewertet weiterhin — auch an einer registrierten, eingecheckten Zeile');

-- ══ 4. Schicht 1 haelt ALLEIN (die Regression, die fail-OPEN war) ═══════════
-- Hier werden die Rechte ABSICHTLICH wieder gelockert, um eine spätere
-- Änderung nachzustellen: jemand gibt INSERT und `event_id` wieder frei, oder
-- die Annahme aus Schicht 2 über Eigentümer und SECURITY DEFINER stimmt eines
-- Tages nicht mehr. Beim INSERT greift Schicht 2 ohnehin nicht — sie prüft nur
-- UPDATE. Dann steht allein die Kapazitätsschicht.
--
-- Sie stand hier schon einmal und trug nichts: als SECURITY INVOKER zählte sie
-- unter der RLS des Schreibenden. `regs_select_self_or_host` lässt ein Mitglied
-- nur die EIGENEN Anmeldezeilen sehen, also zählte sie null belegte Plätze und
-- liess die Überbuchung durch. Gemessen am 04.09. mit Positivkontrolle: am
-- selbst gehosteten Event — wo dasselbe Mitglied alle Zeilen sehen darf —
-- wies derselbe Trigger denselben INSERT ab.
--
-- Dieser Abschnitt steht ZULETZT, weil er die Rechte für alles Folgende
-- verändert.
-- Die Policy muss MIT gelockert werden, sonst ist Schicht 1 hier gar nicht
-- allein: `regs_write_own` ist auf UPDATE verengt und wiese den INSERT auch
-- dann ab, wenn die Kapazitätsschicht nichts trüge — die Zusage hiesse dann
-- „Schicht 1 allein" und prüfte in Wahrheit die Policy. Nachgemessen: mit
-- `security invoker` und dieser Policy meldet der INSERT eine RLS-Ablehnung
-- statt der Überbuchung, die er in Wirklichkeit ist.
grant insert on public.event_registrations to authenticated;
grant update (event_id) on public.event_registrations to authenticated;
drop policy if exists regs_write_own on public.event_registrations;
create policy regs_write_own on public.event_registrations
  for all to authenticated
  using ( public.is_activated() and profile_id = (select auth.uid()) )
  with check ( public.is_activated() and profile_id = (select auth.uid()) );

select is(
  pg_temp.try_as('a0000000-0000-0000-0000-00000000000a',
    $q$insert into public.event_registrations (event_id, profile_id, status)
       values ('b0000000-0000-0000-0000-00000000000a',
               'a0000000-0000-0000-0000-00000000000a', 'registered')$q$),
  'FEHLER:23514 event is at capacity',
  'Schicht 1 allein: INSERT ins volle Event wird abgewiesen, auch ohne die Spaltenrechte');

-- Weg D ohne Statuswechsel: `registered` bleibt `registered`, nur das Event
-- wechselt. Eine reine Übergangsregel sähe hier nichts.
select is(
  pg_temp.try_as('a0000000-0000-0000-0000-00000000000d',
    $q$update public.event_registrations
          set event_id = 'b0000000-0000-0000-0000-00000000000d'
        where event_id = 'b0000000-0000-0000-0000-0000000000d0'
          and profile_id = 'a0000000-0000-0000-0000-00000000000d'$q$),
  'FEHLER:23514 event is at capacity',
  'Schicht 1 allein: Umhaengen einer registrierten Zeile auf ein volles Event wird abgewiesen');

select * from finish();
rollback;
