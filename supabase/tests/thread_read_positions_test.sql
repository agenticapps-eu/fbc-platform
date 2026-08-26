-- Lesestand und Ungelesen-Zähler (AGE-583).
-- Change: openspec/changes/nachrichten-ungelesen-zaehler/.
--
-- Echtes pgTAP mit plan()/finish() — nur solche Dateien stehen im CI-Lauf; die
-- manuellen probe_*.sql tun es nicht. Diese Datei ist in ci.yml eingetragen.
--
-- ══ WAS HIER GEMESSEN WIRD ═════════════════════════════════════════════════
-- Die eine Zusage, die man im Browser grundsaetzlich NICHT pruefen kann: der
-- Lesestand des Gegenuebers ist nicht LESBAR. Im UI wird er ohnehin nicht
-- angezeigt — ob er abfragbar waere, sieht man dort nie. Genau deshalb schlug
-- der Vorschlag des Linear-Vorgangs (zwei Spalten auf `message_threads`) die
-- Plan-Review: er haette dem Gespraechspartner eine Lesebestaetigung geliefert,
-- und jede Sichtprobe waere gruen geblieben.
--
-- ══ FALLEN, DIE DIESES PROJEKT SCHON GESTELLT HAT ══════════════════════════
--   * Ein UPDATE, das die RLS nicht durchlaesst, ergibt NULL ZEILEN statt
--     `42501`. `try_as()` meldet dafuer brav 'OK'. Jede Schreibzusage hier
--     lautet deshalb auf den BESTAND danach, nicht auf einen Fehlercode.
--   * `try_as()` meldet jeden Fehler als 'DENIED:' — fuer einen zugesicherten
--     Code muesste der SQLSTATE gelesen werden. Hier wird keiner zugesichert.
--   * In pgTAP heisst es `alike()`, nicht `like()`.
--   * Der lokale Stack ist geseedet. Jede Mengenaussage ist deshalb auf die
--     Fixture-IDs eingeschraenkt und nie auf `count(*)` der ganzen Tabelle.
--   * **Eine Messung aus lauter Nullen belegt nichts.** Der erste Lauf der
--     Handsonde meldete brav „0 ungelesen" — weil der Thread gar keine
--     Nachricht trug. Jede Zaehlzusage hier steht deshalb auf einer Zahl, die
--     sich BEWEGT, und die erwartete Zahl (2 von 3) trennt drei Fehler auf
--     einmal ab: die eigene Nachricht mitgezaehlt waere 3, gar nichts gezaehlt
--     waere 0, und der Lesestand des Gegenuebers benutzt waere ebenfalls 0.

begin;
select plan(25);

-- ── Fixtures ────────────────────────────────────────────────────────────────
-- Der auth.users-Insert feuert handle_new_user() und legt public.profiles an.
insert into auth.users (id, aud, role, email) values
  ('7a000000-0000-0000-0000-00000000000a', 'authenticated', 'authenticated', 'trp-a@test.fbc'),
  ('7a000000-0000-0000-0000-00000000000b', 'authenticated', 'authenticated', 'trp-b@test.fbc'),
  ('7a000000-0000-0000-0000-00000000000c', 'authenticated', 'authenticated', 'trp-fremd@test.fbc'),
  ('7a000000-0000-0000-0000-00000000000d', 'authenticated', 'authenticated', 'trp-unbestaetigt@test.fbc');

-- Alle auf `impact`: hinter dem Aktivierungs-Gate liegt bei importierten
-- Mitgliedern kein Stufen-Gate mehr, das einen Fehler noch auffinge.
update public.profiles set tier = 'impact', name = 'Trp A', activated_at = now()
 where id = '7a000000-0000-0000-0000-00000000000a';
update public.profiles set tier = 'impact', name = 'Trp B', activated_at = now()
 where id = '7a000000-0000-0000-0000-00000000000b';
update public.profiles set tier = 'impact', name = 'Trp Fremd', activated_at = now()
 where id = '7a000000-0000-0000-0000-00000000000c';
-- Nie bestaetigt: `activated_at` bleibt bewusst null.
update public.profiles set tier = 'impact', name = 'Trp Unbestaetigt'
 where id = '7a000000-0000-0000-0000-00000000000d';

-- Der Thread von A und B. Direkt eingefuegt statt ueber den
-- Kontaktanfrage-Trigger: hier wird der Lesestand geprueft, nicht die
-- Entstehung des Threads (die haelt messaging/„One thread per member pair").
insert into public.message_threads (id, a_profile_id, b_profile_id) values
  ('7b000000-0000-0000-0000-0000000000ab',
   '7a000000-0000-0000-0000-00000000000a', '7a000000-0000-0000-0000-00000000000b');

-- Ein zweiter Thread, an dem A NICHT teilnimmt. Ohne ihn pruefte „A sieht nur
-- seins" eine Tabelle, in der es gar nichts anderes gibt.
insert into public.message_threads (id, a_profile_id, b_profile_id) values
  ('7b000000-0000-0000-0000-0000000000cb',
   '7a000000-0000-0000-0000-00000000000b', '7a000000-0000-0000-0000-00000000000c');

-- DREI Nachrichten im Thread von A und B: zwei von B, eine von A. Die
-- erwartete Zahl ist damit 2 — siehe Kopf.
insert into public.messages (id, thread_id, sender_id, body, created_at) values
  ('7c000000-0000-0000-0000-000000000001', '7b000000-0000-0000-0000-0000000000ab',
   '7a000000-0000-0000-0000-00000000000b', 'von B, eins', now() - interval '3 minutes'),
  ('7c000000-0000-0000-0000-000000000002', '7b000000-0000-0000-0000-0000000000ab',
   '7a000000-0000-0000-0000-00000000000b', 'von B, zwei', now() - interval '2 minutes'),
  ('7c000000-0000-0000-0000-000000000003', '7b000000-0000-0000-0000-0000000000ab',
   '7a000000-0000-0000-0000-00000000000a', 'von A',       now() - interval '1 minute');

-- B hat gelesen. Diese Zeile ist der Wert, den A NICHT sehen darf — und
-- zugleich die Positivkontrolle: ohne sie waere „A sieht eine Zeile" von „die
-- Tabelle hat nur eine" nicht zu trennen.
insert into public.thread_read_positions (thread_id, profile_id, last_read_at) values
  ('7b000000-0000-0000-0000-0000000000ab', '7a000000-0000-0000-0000-00000000000b', now());

-- ── Helfer (Muster aus rls_test.sql / post_saves_test.sql) ──────────────────
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

-- try_as: 'OK' wenn die Anweisung unter der Identitaet durchgeht, sonst
-- 'DENIED:<err>'. Siehe Kopf: bei UPDATE sagt 'OK' NICHTS ueber die Wirkung.
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

-- ── 1. Gestalt ──────────────────────────────────────────────────────────────
select has_table('public', 'thread_read_positions',
  'Die Tabelle thread_read_positions existiert');

select col_is_pk(
  'public', 'thread_read_positions', array['thread_id', 'profile_id'],
  'Der Primaerschluessel liegt auf (thread_id, profile_id) — ein Mitglied hat '
  'je Thread hoechstens einen Lesestand, und das haelt der Schluessel');

select is(
  (select relrowsecurity from pg_class
    where oid = 'public.thread_read_positions'::regclass),
  true, 'RLS ist auf thread_read_positions eingeschaltet');

-- DIE Zusage gegen den verworfenen Entwurf: der Lesestand liegt NICHT auf
-- message_threads, wo threads_select jedem Teilnehmer die ganze Zeile gibt.
select is(
  (select count(*)::int from information_schema.columns
    where table_schema = 'public' and table_name = 'message_threads'
      and column_name ~ 'read'),
  0,
  'message_threads traegt KEINE Lese-Spalte — dort waere sie fuer den '
  'Gespraechspartner lesbar und damit eine Lesebestaetigung');

-- ── 2. Der Lesestand ist eigentuemerprivat ──────────────────────────────────
-- Die eigentliche Zusage. B's Zeile steht im Bestand (siehe Fixtures); A muss
-- sie NICHT sehen, und die eigene sehr wohl.
select is(
  pg_temp.count_as('7a000000-0000-0000-0000-00000000000a',
    $$select count(*)::int from public.thread_read_positions$$),
  0,
  'A sieht NULL Lesestaende, solange nur B einen hat — die Zeile des '
  'Gegenuebers ist nicht lesbar');

select is(
  pg_temp.try_as('7a000000-0000-0000-0000-00000000000a',
    $$insert into public.thread_read_positions (thread_id, profile_id)
      values ('7b000000-0000-0000-0000-0000000000ab',
              '7a000000-0000-0000-0000-00000000000a')$$),
  'OK', 'A darf seinen eigenen Lesestand anlegen');

-- POSITIVKONTROLLE zur ersten Zusage: jetzt sieht A GENAU EINE Zeile, seine
-- eigene. Ohne diesen Test waere „sieht 0" von „die Funktion liest nie etwas"
-- nicht zu trennen.
select is(
  pg_temp.count_as('7a000000-0000-0000-0000-00000000000a',
    $$select count(*)::int from public.thread_read_positions$$),
  1,
  'Nach dem eigenen Insert sieht A GENAU EINE Zeile — seine, nicht B''s. '
  'Das ist die Positivkontrolle zur Zusage darueber');

select is(
  pg_temp.count_as('7a000000-0000-0000-0000-00000000000a',
    $$select count(*)::int from public.thread_read_positions
       where profile_id = '7a000000-0000-0000-0000-00000000000b'$$),
  0, 'Auch namentlich gefragt gibt es B''s Zeile fuer A nicht');

-- A versucht B's Zeile zu bewegen.
--
-- DIE ERSTE FASSUNG DIESER ZUSAGE WAR EIN VAKUUMTEST (Diff-Review, opencode,
-- MEDIUM): sie prüfte `try_as(...) = 'OK'`, also die Abwesenheit einer
-- Ausnahme. Ein RLS-geblocktes UPDATE trifft null Zeilen und wirft nichts —
-- diese Zusage wäre also auch ohne jede Policy gruen gewesen.
--
-- Gemessen wird jetzt die ZAHL DER GETROFFENEN ZEILEN, und zwar innerhalb der
-- Rolle. Das trennt „die Policy hat geblockt" von „es gab zufaellig nichts zu
-- treffen" in EINER Zusage, statt sich auf die naechste zu verlassen.
create function pg_temp.update_zeilen_as(uid uuid, q text) returns int language plpgsql as $$
declare n int;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  execute q;
  get diagnostics n = row_count;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return n;
end $$;

select is(
  pg_temp.update_zeilen_as('7a000000-0000-0000-0000-00000000000a',
    $$update public.thread_read_positions set last_read_at = '2020-01-01'
       where profile_id = '7a000000-0000-0000-0000-00000000000b'$$),
  0, 'A''s UPDATE auf B''s Zeile trifft NULL Zeilen — nicht bloss „keine Ausnahme"');

-- Positivkontrolle zur Zeile darueber: derselbe Weg trifft die EIGENE Zeile.
-- Ohne sie waere „0 getroffen" von „der Helfer zaehlt immer 0" nicht zu
-- unterscheiden.
select is(
  pg_temp.update_zeilen_as('7a000000-0000-0000-0000-00000000000a',
    $$update public.thread_read_positions set last_read_at = '2020-01-01'
       where profile_id = '7a000000-0000-0000-0000-00000000000a'$$),
  1, 'Derselbe Helfer trifft die EIGENE Zeile — die Null oben ist echt');

select is(
  (select extract(year from last_read_at)::int from public.thread_read_positions
    where thread_id = '7b000000-0000-0000-0000-0000000000ab'
      and profile_id = '7a000000-0000-0000-0000-00000000000b'),
  extract(year from now())::int,
  'B''s Lesestand ist UNVERAENDERT — das ist die Zusage, nicht das Ausbleiben '
  'eines Fehlers');

select alike(
  pg_temp.try_as('7a000000-0000-0000-0000-00000000000a',
    $$insert into public.thread_read_positions (thread_id, profile_id)
      values ('7b000000-0000-0000-0000-0000000000ab',
              '7a000000-0000-0000-0000-00000000000c')$$),
  'DENIED:%', 'A kann keine Zeile in fremdem Namen anlegen');

-- Ein Unbeteiligter am Thread. Ohne das koennte ein aktiviertes Mitglied
-- Zeilen auf beliebige Thread-IDs legen — und ein Fremdschluessel ist ein
-- Existenz-Orakel: erfunden bricht mit 23503, vorhanden geht durch.
select alike(
  pg_temp.try_as('7a000000-0000-0000-0000-00000000000c',
    $$insert into public.thread_read_positions (thread_id, profile_id)
      values ('7b000000-0000-0000-0000-0000000000ab',
              '7a000000-0000-0000-0000-00000000000c')$$),
  'DENIED:%',
  'Ein Unbeteiligter kann fuer diesen Thread keinen Lesestand anlegen — sonst '
  'verriete die Fremdschluesselpruefung, welche Threads es gibt');

-- POSITIVKONTROLLE dazu: derselbe Fremde DARF es auf SEINEM Thread.
select is(
  pg_temp.try_as('7a000000-0000-0000-0000-00000000000c',
    $$insert into public.thread_read_positions (thread_id, profile_id)
      values ('7b000000-0000-0000-0000-0000000000cb',
              '7a000000-0000-0000-0000-00000000000c')$$),
  'OK',
  'Derselbe Aufrufer darf es auf SEINEM Thread — ohne diesen Test waere die '
  'Verweigerung darueber von einem Leerlauf nicht zu unterscheiden');

select alike(
  pg_temp.try_as('7a000000-0000-0000-0000-00000000000d',
    $$insert into public.thread_read_positions (thread_id, profile_id)
      values ('7b000000-0000-0000-0000-0000000000ab',
              '7a000000-0000-0000-0000-00000000000d')$$),
  'DENIED:%', 'Ein nie bestaetigtes Konto legt keinen Lesestand an');

-- ── 2b. Der Zeitpunkt gehoert dem Server ────────────────────────────────────
-- Aus der Diff-Review (gemini, HIGH). Der Client schickt `last_read_at` mit —
-- mitschicken MUSS er, sonst ruecht PostgREST den Wert im Konfliktzweig nicht
-- an — aber der Trigger ueberschreibt ihn. Hier steht ein absurder Wert, damit
-- ein entfernter Trigger auffaellt statt plausibel auszusehen.
select is(
  pg_temp.try_as('7a000000-0000-0000-0000-00000000000a',
    $$insert into public.thread_read_positions (thread_id, profile_id, last_read_at)
      values ('7b000000-0000-0000-0000-0000000000ab',
              '7a000000-0000-0000-0000-00000000000a', '1970-01-01')
      on conflict (thread_id, profile_id)
      do update set last_read_at = excluded.last_read_at$$),
  'OK', 'A markiert gelesen und schickt einen Client-Zeitpunkt mit');

select cmp_ok(
  (select last_read_at from public.thread_read_positions
    where thread_id = '7b000000-0000-0000-0000-0000000000ab'
      and profile_id = '7a000000-0000-0000-0000-00000000000a'),
  '>', now() - interval '1 minute',
  'Der Server hat den Client-Zeitpunkt (1970) ueberschrieben — sonst verglichen '
  'wir zwei Uhren, und eine vorgehende liesse Nachrichten als gelesen gelten, '
  'bevor es sie gibt');

-- Und der ZWEITE Aufruf wirkt auch. Ohne die Spalte im Rumpf baute PostgREST
-- ein `do update set` ohne sie, und das Markieren waere ab dem zweiten Mal
-- lautlos wirkungslos.
select cmp_ok(
  (select count(*)::int from public.thread_read_positions
    where thread_id = '7b000000-0000-0000-0000-0000000000ab'
      and profile_id = '7a000000-0000-0000-0000-00000000000a'),
  '=', 1, 'Der Upsert legt keine zweite Zeile an');

-- ── 3. Der Zaehler ──────────────────────────────────────────────────────────
-- A hat inzwischen einen Lesestand (Insert oben, ohne last_read_at ⇒
-- clock_timestamp()) — also nichts mehr ungelesen. Erst zuruecksetzen, dann
-- messen, sonst misst der naechste Test seinen eigenen Vorgaenger.
delete from public.thread_read_positions
 where profile_id = '7a000000-0000-0000-0000-00000000000a';

select is(
  pg_temp.count_as('7a000000-0000-0000-0000-00000000000a',
    $$select coalesce(sum(unread_count), 0)::int
        from public.unread_message_counts()$$),
  2,
  'Ohne Lesestand zaehlt A ZWEI ungelesene: beide von B, die eigene nicht. '
  'Die Zwei trennt drei Fehler ab — 3 hiesse eigene mitgezaehlt, 0 hiesse gar '
  'nicht gezaehlt oder B''s Lesestand benutzt');

select is(
  pg_temp.count_as('7a000000-0000-0000-0000-00000000000b',
    $$select coalesce(sum(unread_count), 0)::int
        from public.unread_message_counts()$$),
  0,
  'B hat gelesen und danach nur selbst geschrieben — kein Ungelesenes. Die '
  'eigenen zwei Nachrichten zaehlen fuer B nicht');

-- Threads ohne Ungelesenes kommen GAR NICHT zurueck. Nicht als Zeile mit 0:
-- sonst waeren „keine Zeile" und „Zahl 0" zwei Wege, dasselbe zu sagen.
select is(
  pg_temp.count_as('7a000000-0000-0000-0000-00000000000b',
    $$select count(*)::int from public.unread_message_counts()$$),
  0, 'Ein Thread ohne Ungelesenes liefert GAR KEINE Zeile, nicht eine mit 0');

select is(
  pg_temp.count_as('7a000000-0000-0000-0000-00000000000d',
    $$select count(*)::int from public.unread_message_counts()$$),
  0,
  'Ein nie bestaetigtes Konto bekommt null Zeilen — und zwar, ohne dass die '
  'Funktion das Wort „aktiviert" enthaelt: sie erbt die Regel als INVOKER');

-- Der Lesestand wirkt: A liest, danach ist nichts mehr ungelesen.
select is(
  pg_temp.try_as('7a000000-0000-0000-0000-00000000000a',
    $$insert into public.thread_read_positions (thread_id, profile_id)
      values ('7b000000-0000-0000-0000-0000000000ab',
              '7a000000-0000-0000-0000-00000000000a')$$),
  'OK', 'A markiert gelesen');

select is(
  pg_temp.count_as('7a000000-0000-0000-0000-00000000000a',
    $$select count(*)::int from public.unread_message_counts()$$),
  0, 'Nach dem Lesen liefert die Funktion fuer A keine Zeile mehr');

-- Die Funktion traegt `set search_path = ''` und qualifiziert alles. Ohne das
-- fiele sie um, sobald jemand den Pfad anders setzt — und `pg_dump` LEERT ihn
-- fuer eine ganze Sitzung.
--
-- Der Pfad wird HIER an der Funktionsdefinition gesetzt, nicht per set_config
-- im Abfragetext. Der erste Versuch tat Letzteres — und riss damit pgTAP
-- selbst um: nach `set_config('search_path','pg_temp',true)` fand psql
-- `ok(boolean, text)` nicht mehr, weil `extensions` aus dem Pfad gefallen war.
-- Der Lauf meldete „All 20 subtests passed" UND Exit 3. Ein `set` an der
-- Funktion gilt nur fuer deren Aufruf und wird beim Verlassen zurueckgenommen.
create function pg_temp.zaehle_ohne_pfad(uid uuid) returns int
  language plpgsql
  set search_path = 'pg_temp'
as $$
declare n int;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  execute 'select count(*)::int from public.unread_message_counts()' into n;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return n;
end $$;

select is(
  pg_temp.zaehle_ohne_pfad('7a000000-0000-0000-0000-00000000000a'),
  0,
  'Die Funktion traegt auch ohne `public` im search_path — sie qualifiziert '
  'jede Referenz selbst');

select finish();
rollback;
