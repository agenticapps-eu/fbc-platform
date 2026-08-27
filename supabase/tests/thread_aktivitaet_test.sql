-- Aktivitaetsspalten auf `message_threads` (AGE-627).
-- Change: openspec/changes/chat-rechte-sidebar/.
--
-- Echtes pgTAP mit plan()/finish() — nur solche Dateien stehen im CI-Lauf; die
-- manuellen probe_*.sql tun es nicht. Diese Datei ist in ci.yml eingetragen.
--
-- ══ WAS HIER GEMESSEN WIRD ═════════════════════════════════════════════════
-- `design.md` macht drei Zusagen, die man im Browser nicht widerlegen kann:
--   1. Die drei Spalten werden vom Trigger gefuehrt, nicht vom Client — „der
--      Client schreibt diese Spalten nie, kann es nicht".
--   2. Sie sind KEINE neue Preisgabe: wer `last_message_body` liest, durfte
--      dieselbe Nachricht schon vorher lesen. Ein Dritter sieht die Zeile gar
--      nicht.
--   3. `last_message_at` ist ein SORTIERSCHLUESSEL. Ein Schluessel, den man
--      rueckwaerts bewegen kann, ist keiner.
--
-- Zusage 1 hat ZWEI Tueren, und nur eine davon ist offensichtlich:
--   * UPDATE auf `message_threads` — das Recht fehlt, tabellenweit UND
--     spaltenweise (grants_test.sql:130–146 haelt das seit AGE-583 fest).
--   * INSERT auf `message_threads` — das Recht BESTEHT (`threads_insert`).
--     Ohne eine eigene Vorkehrung koennte ein Mitglied beim Anlegen des
--     Threads eine erfundene Vorschauzeile setzen, die sein Gegenueber zu
--     sehen bekaeme. Deshalb der zweite Trigger, und deshalb Test 10.
--
-- ══ FALLEN, DIE DIESES PROJEKT SCHON GESTELLT HAT ══════════════════════════
--   * Ein UPDATE, das die RLS nicht durchlaesst, ergibt NULL ZEILEN statt
--     `42501`; `try_as()` meldet dafuer brav 'OK'. Jede Schreibzusage hier
--     lautet deshalb auf den BESTAND danach, nicht auf einen Fehlercode.
--   * In pgTAP heisst es `alike()`, nicht `like()`.
--   * Ein Negativbefund braucht eine Positivkontrolle: „der Dritte sieht
--     nichts" ist ohne „der Teilnehmer sieht etwas" von einer leeren Tabelle
--     nicht zu trennen. Dasselbe gilt fuer das fehlende UPDATE-Recht — die
--     Positivkontrolle ist, dass der Trigger die Spalte trotzdem fortschreibt.
--   * **Die Rueckfuellung des Bestandes ist hier NICHT gemessen, und das ist
--     eine bewusste Luecke.** Sie laeuft in der Migration, also vor jedem
--     Fixture; `supabase db reset` hat danach keinen einzigen Thread aus der
--     Zeit davor (es gibt keine `seed.sql`). Ein Test, der sie nachstellte,
--     muesste die UPDATE-Anweisung der Migration abschreiben und pruefte dann
--     seine eigene Kopie. Der Beleg gehoert deshalb an den Rollout: nach
--     `db push` auf DEV und PROD zaehlen, wieviele Threads MIT Nachricht ein
--     leeres `last_message_at` haben. Erwartet: null.

begin;
select plan(15);

-- ── Fixtures ────────────────────────────────────────────────────────────────
-- Der auth.users-Insert feuert handle_new_user() und legt public.profiles an.
insert into auth.users (id, aud, role, email) values
  ('7d000000-0000-0000-0000-00000000000a', 'authenticated', 'authenticated', 'tak-a@test.fbc'),
  ('7d000000-0000-0000-0000-00000000000b', 'authenticated', 'authenticated', 'tak-b@test.fbc'),
  ('7d000000-0000-0000-0000-00000000000c', 'authenticated', 'authenticated', 'tak-fremd@test.fbc');

update public.profiles set tier = 'impact', name = 'Tak A', activated_at = now()
 where id = '7d000000-0000-0000-0000-00000000000a';
update public.profiles set tier = 'impact', name = 'Tak B', activated_at = now()
 where id = '7d000000-0000-0000-0000-00000000000b';
update public.profiles set tier = 'impact', name = 'Tak Fremd', activated_at = now()
 where id = '7d000000-0000-0000-0000-00000000000c';

-- Angenommene Kontaktanfrage: `threads_insert` und `messages_insert` verlangen
-- sie beide. Ohne diese Zeile scheiterte die Positivkontrolle aus einem
-- Grund, der mit den Aktivitaetsspalten nichts zu tun hat.
insert into public.contact_requests (from_id, to_id, status) values
  ('7d000000-0000-0000-0000-00000000000a', '7d000000-0000-0000-0000-00000000000b', 'accepted');

-- Der Thread von A und B.
insert into public.message_threads (id, a_profile_id, b_profile_id) values
  ('7e000000-0000-0000-0000-0000000000ab',
   '7d000000-0000-0000-0000-00000000000a', '7d000000-0000-0000-0000-00000000000b');

-- ── Helfer (Muster aus rls_test.sql / thread_read_positions_test.sql) ───────
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

create function pg_temp.run_as(uid uuid, q text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  execute q;
  reset role;
  perform set_config('request.jwt.claims', '', true);
end $$;

-- ── 1. Gestalt ──────────────────────────────────────────────────────────────
select has_column('public', 'message_threads', 'last_message_at',
  'message_threads traegt last_message_at — den Sortierschluessel');
select has_column('public', 'message_threads', 'last_message_body',
  'message_threads traegt last_message_body — die Vorschauzeile');
select has_column('public', 'message_threads', 'last_message_sender_id',
  'message_threads traegt last_message_sender_id — "Du: …" vs. Name');

select col_type_is('public', 'message_threads', 'last_message_at',
  'timestamp with time zone',
  'last_message_at ist timestamptz — nach etwas anderem laesst sich eine '
  'Unterhaltungsliste nicht verlaesslich ordnen');

-- Ohne Index waere `order by last_message_at desc` ein Sortierlauf ueber die
-- ganze Tabelle — die Begruendung fuer die Denormalisierung faellt damit weg.
select is(
  (select count(*)::int from pg_indexes
    where schemaname = 'public' and tablename = 'message_threads'
      and indexdef ilike '%last_message_at desc%'),
  1,
  'Ein Index traegt die Ordnung (last_message_at desc)');

-- ── 2. Der Trigger fuehrt die Spalten ───────────────────────────────────────
insert into public.messages (thread_id, sender_id, body, created_at) values
  ('7e000000-0000-0000-0000-0000000000ab', '7d000000-0000-0000-0000-00000000000b',
   'die erste', now() - interval '2 minutes');

select is(
  (select last_message_body || '|' || last_message_sender_id::text || '|' ||
          (last_message_at is not null)::text
     from public.message_threads where id = '7e000000-0000-0000-0000-0000000000ab'),
  'die erste|7d000000-0000-0000-0000-00000000000b|true',
  'Ein Insert in messages setzt alle drei Spalten');

insert into public.messages (thread_id, sender_id, body, created_at) values
  ('7e000000-0000-0000-0000-0000000000ab', '7d000000-0000-0000-0000-00000000000a',
   'die zweite', now() - interval '1 minute');

select is(
  (select last_message_body || '|' || last_message_sender_id::text
     from public.message_threads where id = '7e000000-0000-0000-0000-0000000000ab'),
  'die zweite|7d000000-0000-0000-0000-00000000000a',
  'Ein zweiter Insert ueberschreibt Vorschauzeile UND Absender');

-- Der Sortierschluessel bewegt sich nur vorwaerts. `created_at` ist vom Client
-- setzbar (das INSERT-Recht auf `messages` ist tabellenweit), eine
-- rueckdatierte Nachricht duerfte den Thread also nicht nach unten ziehen und
-- die juengere Vorschauzeile nicht verdraengen.
insert into public.messages (thread_id, sender_id, body, created_at) values
  ('7e000000-0000-0000-0000-0000000000ab', '7d000000-0000-0000-0000-00000000000b',
   'rueckdatiert', now() - interval '1 hour');

select is(
  (select last_message_body from public.message_threads
    where id = '7e000000-0000-0000-0000-0000000000ab'),
  'die zweite',
  'Eine rueckdatierte Nachricht bewegt den Sortierschluessel NICHT zurueck');

-- ── 3. Der Client schreibt die Spalten nie ──────────────────────────────────
-- Tuer 1: UPDATE. Das Recht fehlt tabellenweit und spaltenweise. Gemessen wird
-- der BESTAND danach, nicht der Fehlercode (siehe Kopf).
select is(
  (select count(*)::int from information_schema.role_column_grants
    where table_schema = 'public' and table_name = 'message_threads'
      and grantee = 'authenticated' and privilege_type = 'UPDATE'),
  0,
  'authenticated haelt KEIN UPDATE auf message_threads — auch kein '
  'spaltenweises (ein Spalten-Grant taucht in role_table_grants nicht auf)');

-- Tuer 2: INSERT. Das Recht BESTEHT. Ein Mitglied legt hier einen Thread mit
-- erfundener Vorschauzeile an; der BEFORE-Trigger muss sie verwerfen.
insert into public.contact_requests (from_id, to_id, status) values
  ('7d000000-0000-0000-0000-00000000000a', '7d000000-0000-0000-0000-00000000000c', 'accepted');

do $$ begin perform pg_temp.run_as('7d000000-0000-0000-0000-00000000000a', $q$
  insert into public.message_threads
    (id, a_profile_id, b_profile_id, last_message_at, last_message_body, last_message_sender_id)
  values ('7e000000-0000-0000-0000-0000000000ac',
          '7d000000-0000-0000-0000-00000000000a', '7d000000-0000-0000-0000-00000000000c',
          now(), 'erfunden', '7d000000-0000-0000-0000-00000000000c')
$q$); end $$;

select is(
  (select coalesce(last_message_body, '(leer)') || '|' ||
          coalesce(last_message_at::text, '(leer)') || '|' ||
          coalesce(last_message_sender_id::text, '(leer)')
     from public.message_threads where id = '7e000000-0000-0000-0000-0000000000ac'),
  '(leer)|(leer)|(leer)',
  'Beim INSERT gesetzte Aktivitaetswerte werden verworfen — sonst koennte ein '
  'Mitglied seinem Gegenueber eine erfundene Vorschauzeile unterschieben');

-- Positivkontrolle zu beiden Tueren: der Trigger schreibt trotzdem, und zwar
-- auch dann, wenn die Nachricht unter der Identitaet des Mitglieds entsteht.
-- Ohne diese Zusage waere „kein Schreibrecht" von „die Spalte bewegt sich nie"
-- nicht zu trennen.
do $$ begin perform pg_temp.run_as('7d000000-0000-0000-0000-00000000000a', $q$
  insert into public.messages (thread_id, sender_id, body)
  values ('7e000000-0000-0000-0000-0000000000ab',
          '7d000000-0000-0000-0000-00000000000a', 'unter eigener Identitaet')
$q$); end $$;

select is(
  (select last_message_body from public.message_threads
    where id = '7e000000-0000-0000-0000-0000000000ab'),
  'unter eigener Identitaet',
  'Positivkontrolle: der Trigger schreibt die Spalte fort, obwohl der '
  'Absender selbst kein UPDATE-Recht auf message_threads haelt');

-- ── 4. Keine neue Preisgabe ─────────────────────────────────────────────────
-- `threads_select` gilt unveraendert: ein Dritter sieht die Zeile gar nicht,
-- also auch die neuen Spalten nicht.
select is(
  pg_temp.count_as('7d000000-0000-0000-0000-00000000000c', $q$
    select count(*)::int from public.message_threads
     where id = '7e000000-0000-0000-0000-0000000000ab'
       and last_message_body is not null $q$),
  0,
  'Ein Dritter sieht die Vorschauzeile eines fremden Threads nicht');

select is(
  pg_temp.count_as('7d000000-0000-0000-0000-00000000000b', $q$
    select count(*)::int from public.message_threads
     where id = '7e000000-0000-0000-0000-0000000000ab'
       and last_message_body is not null $q$),
  1,
  'Positivkontrolle: der Teilnehmer sieht sie — der Befund oben misst die '
  'Policy und nicht eine leere Tabelle');

-- Und die Aussage aus AGE-583 gilt weiter: wer die Vorschauzeile lesen darf,
-- durfte dieselbe Nachricht schon vorher lesen. `threads_select` und
-- `messages_select` reichen exakt gleich weit — hier an derselben Identitaet
-- gemessen statt aus den Policy-Texten geschlossen.
select is(
  pg_temp.count_as('7d000000-0000-0000-0000-00000000000c', $q$
    select count(*)::int from public.messages
     where thread_id = '7e000000-0000-0000-0000-0000000000ab' $q$),
  0,
  'Derselbe Dritte sieht auch die Nachrichten nicht — die Spalte gibt nichts '
  'preis, was die Tabelle daneben nicht schon gab');

-- ── 5. Die Triggerfunktionen sind nicht aufrufbar ───────────────────────────
-- Muster aus 20260824150000: EXECUTE wird entzogen, weil Postgres das Recht
-- beim ANLEGEN des Triggers prueft und nicht bei jedem Feuern. Ohne den Entzug
-- staende eine Funktion offen, die message_threads unter fremdem Recht schreibt.
select is(
  (select count(*)::int from information_schema.role_routine_grants
    where routine_schema = 'public'
      and routine_name in ('messages_thread_aktivitaet', 'message_threads_aktivitaet_verwerfen')
      and grantee in ('anon', 'authenticated', 'PUBLIC')),
  0,
  'Die beiden Triggerfunktionen sind fuer anon/authenticated nicht ausfuehrbar');

select finish();
rollback;
