-- Event-Vorlagen und Serientermine (AGE-630), Datenmodell.
-- `supabase test db`. Aufgaben 2 und 3 aus
-- openspec/changes/events-vorlagen-und-serientermine/tasks.md.
--
-- ══ WAS HIER ZUGESAGT WIRD ══════════════════════════════════════════════════
-- Diese Datei ist der RED-Schritt: sie beschreibt `public.event_vorlagen` und
-- die zwei neuen Spalten an `public.events`, bevor es die Migration gibt.
--
-- ══ ABSCHNITT 4 IST DER TEURE ═══════════════════════════════════════════════
-- Er hält den HOCH-Befund aus der Plan-Review fest (REVIEWS.md, opencode):
-- `events_write_host` wurde geschrieben, als es `vorlage_id` nicht gab, und
-- kennt die Spalte nicht. Ein einfacher Fremdschlüssel prüft nur EXISTENZ, und
-- die FK-Prüfung läuft NICHT unter der RLS der Zieltabelle — die Policy
-- „fremde Vorlage ist unerreichbar" hindert sie also nicht. Ohne den
-- komposit-FK (vorlage_id, host_id) könnte jeder aktivierte Host Events auf die
-- Slots einer FREMDEN Reihe schreiben; deren Erzeugung liefe danach lautlos in
-- `on conflict do nothing`, und die Serie entstünde nie.
--
-- Zu jeder Ablehnung steht hier eine Positivkontrolle daneben. Ohne sie belegte
-- eine Ablehnung nur, dass irgendetwas kracht — nicht, dass die gemeinte
-- Schranke greift.
--
-- ══ DIESE DATEI MUSS IN .github/workflows/ci.yml STEHEN ═════════════════════
-- Eine pgTAP-Datei mit `plan()` ist kein Beleg dafür, dass sie irgendwo läuft.
-- `scripts/pgtap-dateiliste.test.ts` prüft die Liste in beide Richtungen.

begin;
select plan(21);

-- ── Fixtures ────────────────────────────────────────────────────────────────
-- Der `auth.users`-Insert feuert `handle_new_user()` und legt die
-- `public.profiles`-Zeile an; die Aktivierung kommt danach.
insert into auth.users (id, aud, role, email) values
  ('c0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'age630-host@test.fbc'),
  ('c0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'age630-fremd@test.fbc');

update public.profiles
   set activated_at = now()
 where id in ('c0000000-0000-0000-0000-000000000001',
              'c0000000-0000-0000-0000-000000000002');

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

create function pg_temp.zaehl_als(uid uuid, q text) returns int
language plpgsql as $$
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

-- ── 1. Die Tabelle und ihre Spalten ─────────────────────────────────────────
select has_table('public', 'event_vorlagen',
  'public.event_vorlagen existiert');
select has_column('public', 'event_vorlagen', 'host_id',
  'event_vorlagen.host_id existiert');
select has_column('public', 'event_vorlagen', 'wiederholung',
  'event_vorlagen.wiederholung existiert');
select has_column('public', 'event_vorlagen', 'ortszeit',
  'event_vorlagen.ortszeit existiert — die Regel führt Ortszeit, keinen Zeitpunkt');
select has_column('public', 'event_vorlagen', 'zeitzone',
  'event_vorlagen.zeitzone existiert');
select has_column('public', 'event_vorlagen', 'cover_path',
  'event_vorlagen.cover_path existiert');
select has_column('public', 'event_vorlagen', 'dauer',
  'event_vorlagen.dauer existiert — ends_at folgt aus einer Dauer, nicht aus einer zweiten Ortszeit');

-- ── 2. Die Regelformen schliessen einander aus ──────────────────────────────
-- Als EIGENTÜMER geprüft: eine Prüfbedingung erreicht man als `authenticated`
-- nie, dort weist die Policy vorher ab.
select throws_ok($$
  insert into public.event_vorlagen (host_id, title, wiederholung, ortszeit, zeitzone)
  values ('c0000000-0000-0000-0000-000000000001', 'ohne wochentag', 'woechentlich', '19:00', 'Europe/Berlin')
$$, '23514', null,
  'woechentlich ohne wochentag wird abgewiesen');

select throws_ok($$
  insert into public.event_vorlagen (host_id, title, wiederholung, wochentag, tag_im_monat, ortszeit, zeitzone)
  values ('c0000000-0000-0000-0000-000000000001', 'zu viel', 'woechentlich', 2, 15, '19:00', 'Europe/Berlin')
$$, '23514', null,
  'woechentlich mit tag_im_monat wird abgewiesen — die fremden Spalten müssen null sein');

select throws_ok($$
  insert into public.event_vorlagen (host_id, title, wiederholung, ortszeit, zeitzone)
  values ('c0000000-0000-0000-0000-000000000001', 'ohne tag', 'monatlich_tag', '19:00', 'Europe/Berlin')
$$, '23514', null,
  'monatlich_tag ohne tag_im_monat wird abgewiesen');

select throws_ok($$
  insert into public.event_vorlagen (host_id, title, wiederholung, wochentag, ortszeit, zeitzone)
  values ('c0000000-0000-0000-0000-000000000001', 'ohne position', 'monatlich_n_ter_wochentag', 2, '19:00', 'Europe/Berlin')
$$, '23514', null,
  'monatlich_n_ter_wochentag ohne wochentag_position wird abgewiesen');

-- Positivkontrolle: ohne sie belegten die vier Ablehnungen oben nur, dass
-- IRGENDEINE Prüfbedingung greift.
select lives_ok($$
  insert into public.event_vorlagen (id, host_id, title, wiederholung, wochentag, ortszeit, zeitzone)
  values ('11111111-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
          'Stammtisch', 'woechentlich', 2, '19:00', 'Europe/Berlin')
$$, 'eine vollständige woechentlich-Vorlage geht durch');

-- ── 3. Die Zeitzone wird beim Schreiben geprüft ─────────────────────────────
-- Ohne diese Bedingung ist 'Europe/Belin' speicherbar und tötet erst die
-- Erzeugung, mit einer Meldung weit weg von der Ursache.
select throws_ok($$
  insert into public.event_vorlagen (host_id, title, wiederholung, wochentag, ortszeit, zeitzone)
  values ('c0000000-0000-0000-0000-000000000001', 'tippfehler', 'woechentlich', 2, '19:00', 'Europe/Belin')
$$, '23514', null,
  'eine unbekannte Zeitzone wird schon beim Speichern abgewiesen');

-- ── 4. Die neuen Spalten an events, und der teure Befund ────────────────────
select has_column('public', 'events', 'vorlage_id',
  'events.vorlage_id existiert');
select has_column('public', 'events', 'slot_datum',
  'events.slot_datum existiert — der Idempotenzschlüssel, NICHT starts_at');

-- Die Vorlage des Fremden, angelegt als Eigentümer.
insert into public.event_vorlagen (id, host_id, title, wiederholung, wochentag, ortszeit, zeitzone)
values ('11111111-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002',
        'Fremde Reihe', 'woechentlich', 4, '18:00', 'Europe/Berlin');

select is(
  pg_temp.zaehl_als('c0000000-0000-0000-0000-000000000001',
    $$select count(*)::int from public.event_vorlagen
       where id = '11111111-0000-0000-0000-000000000002'$$),
  0, 'eine fremde Vorlage ist nicht lesbar');

select is(
  pg_temp.zaehl_als('c0000000-0000-0000-0000-000000000001',
    $$select count(*)::int from public.event_vorlagen
       where id = '11111111-0000-0000-0000-000000000001'$$),
  1, 'die eigene Vorlage ist lesbar — Positivkontrolle zur Zeile darüber');

-- DER BEFUND: ein eigenes Event mit FREMDER vorlage_id.
select alike(
  pg_temp.try_as('c0000000-0000-0000-0000-000000000001', $$
    insert into public.events (title, type, starts_at, host_id, visibility, vorlage_id, slot_datum)
    values ('Slot-Besetzung', 'presence', '2026-10-06 17:00+00',
            'c0000000-0000-0000-0000-000000000001', 'members',
            '11111111-0000-0000-0000-000000000002', '2026-10-06')
  $$),
  'FEHLER:23503%',
  'ein Event mit FREMDER vorlage_id wird abgewiesen — sonst besetzt man fremde Serienslots');

-- Positivkontrolle: mit der EIGENEN Vorlage geht derselbe Schreibvorgang durch.
-- Ohne sie könnte die Zeile darüber auch an etwas ganz anderem scheitern.
select is(
  pg_temp.try_as('c0000000-0000-0000-0000-000000000001', $$
    insert into public.events (id, title, type, starts_at, host_id, visibility, vorlage_id, slot_datum)
    values ('22222222-0000-0000-0000-000000000001', 'Eigener Termin', 'presence', '2026-10-06 17:00+00',
            'c0000000-0000-0000-0000-000000000001', 'members',
            '11111111-0000-0000-0000-000000000001', '2026-10-06')
  $$),
  'OK',
  'mit der EIGENEN vorlage_id geht derselbe Schreibvorgang durch');

-- ── 5. Der Idempotenzschlüssel ──────────────────────────────────────────────
select throws_ok($$
  insert into public.events (title, type, starts_at, host_id, visibility, vorlage_id, slot_datum)
  values ('Doppelter Slot', 'presence', '2026-10-06 18:00+00',
          'c0000000-0000-0000-0000-000000000001', 'members',
          '11111111-0000-0000-0000-000000000001', '2026-10-06')
$$, '23505', null,
  'zwei Termine derselben Vorlage auf demselben Slot werden abgewiesen');

-- Der Bestand darf davon nichts merken: `vorlage_id` ist dort null, und
-- Postgres behandelt null-Werte in eindeutigen Indizes als verschieden.
select lives_ok($$
  insert into public.events (title, type, starts_at, host_id, visibility)
  values ('Einzelevent A', 'presence', '2026-11-02 18:00+00',
          'c0000000-0000-0000-0000-000000000001', 'members'),
         ('Einzelevent B', 'presence', '2026-11-02 18:00+00',
          'c0000000-0000-0000-0000-000000000001', 'members')
$$, 'zwei Events ohne Vorlage kollidieren nicht — der Index berührt den Bestand nicht');

select finish();
rollback;
