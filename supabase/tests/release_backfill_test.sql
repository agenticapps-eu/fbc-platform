-- AGE-905 — Ein NACHGETRAGENER Release-Beitrag ist still.
--
-- ══ WARUM HIER NICHT DIE 23 ZEILEN DER MIGRATION GEPRUEFT WERDEN ═══════════
-- Die naheliegende Zusage waere „es stehen 23 Notes und 23 Karten da". Sie
-- waere in CI **leer wahr und zugleich falsch**: der Job `migrations` faehrt
-- `supabase db reset` gegen eine frische Datenbank, dort gibt es 0 Profile,
-- und die Migration ueberspringt sich selbst genau deshalb (sonst risse sie
-- den Aufbau mit). Eine Zusage ueber ihre Zeilen zaehlte dort 0 von 0.
--
-- Geprueft wird deshalb der MECHANISMUS an eigenen Fixtures: derselbe Weg, den
-- die Migration nimmt — `status` von `draft` auf `sent`, ohne
-- `send_release_note()` —, und die Zusagen, die daran haengen. Das ist
-- ausserdem die haltbarere Pruefung: sie gilt auch fuer den naechsten Nachtrag.
--
-- Die Wirkung der Migration auf die echten Flaechen misst `scripts/mess-905.ts`
-- lesend gegen lokal und PROD. Das gehoert dorthin, nicht hierher
-- (Rueckfuellschritte sind in pgTAP grundsaetzlich nicht messbar: Migrationen
-- laufen vor dem Seed).
--
-- ══ JEDE VERNEINUNG HAT IHRE POSITIVKONTROLLE ══════════════════════════════
-- „Es entsteht kein Hinweis" ist gruen, sobald die Zaehlung gar nichts trifft —
-- bei einer leeren Fixture, einem Tippfehler im Typ oder einem Empfaengerkreis,
-- der ohnehin leer ist. Neben jeder Stille steht deshalb dieselbe Messung an
-- einer ECHTEN Zustellung ueber `send_release_note()`, die laut sein MUSS.
--
-- Die Datei MUSS in der Dateiliste in `.github/workflows/ci.yml` stehen, sonst
-- laeuft sie nie (AGE-659).

begin;
select plan(23);

-- ── Fixtures ───────────────────────────────────────────────────────────────
-- Zwei aktivierte Mitglieder, damit ein Rundruf ueberhaupt Empfaenger haette.
-- Ohne sie waere jede Stille-Zusage trivial gruen.
insert into auth.users (id, aud, role, email) values
  ('a9050000-0000-0000-0000-00000000000a', 'authenticated', 'authenticated', 'age905-admin@test.fbc'),
  ('a9050000-0000-0000-0000-00000000000b', 'authenticated', 'authenticated', 'age905-m1@test.fbc'),
  ('a9050000-0000-0000-0000-00000000000c', 'authenticated', 'authenticated', 'age905-m2@test.fbc');

update public.profiles
   set tier = 'impact', activated_at = now(), created_at = now() - interval '90 days'
 where id in ('a9050000-0000-0000-0000-00000000000a',
              'a9050000-0000-0000-0000-00000000000b',
              'a9050000-0000-0000-0000-00000000000c');

insert into public.staff_roles (profile_id, role)
values ('a9050000-0000-0000-0000-00000000000a', 'admin');

-- Der Zeitpunkt, den ein Nachtrag setzt: WEIT in der Vergangenheit, damit ein
-- versehentliches `now()` sofort auffaellt statt nur um Millisekunden daneben
-- zu liegen.
create temp table age905_fix (erschienen timestamptz) on commit drop;
insert into age905_fix values (timestamptz '2026-08-01 09:00:00+02');

-- Zwei nachgetragene Notes derselben Ausgabe, eine Minute auseinander — das
-- ist die Staffelung, um die es geht.
insert into public.release_notes
  (id, title, body, entry_slugs, status, created_by, sent_at, recipient_count)
values
  ('b9050000-0000-0000-0000-000000000001', 'Nachtrag eins', 'Text eins',
   array['2026-08-01-test-eins'], 'draft',
   'a9050000-0000-0000-0000-00000000000a', timestamptz '2026-08-01 09:00:00+02', 0),
  ('b9050000-0000-0000-0000-000000000002', 'Nachtrag zwei', 'Text zwei',
   array['2026-08-01-test-zwei'], 'draft',
   'a9050000-0000-0000-0000-00000000000a', timestamptz '2026-08-01 08:59:00+02', 0);

-- Merker: der Stand VOR dem Zustandswechsel. Differenzen statt absoluter
-- Zahlen, aus demselben Grund wie im Messskript.
create temp table age905_vorher as
select (select count(*) from public.notifications)      as hinweise,
       (select count(*) from public.push_zustellungen)   as pushs,
       (select count(*) from public.posts where kind = 'release') as karten;

-- ══ DER NACHTRAG: der Zustandswechsel OHNE send_release_note() ═════════════
update public.release_notes
   set status = 'sent'
 where id in ('b9050000-0000-0000-0000-000000000001',
              'b9050000-0000-0000-0000-000000000002');

-- ── 1–4: die Karten entstehen, und zwar richtig ───────────────────────────
select is(
  (select count(*)::int from public.posts
    where kind = 'release'
      and release_note_id in ('b9050000-0000-0000-0000-000000000001',
                              'b9050000-0000-0000-0000-000000000002')),
  2, 'Der Zustandswechsel erzeugt je Note genau eine Release-Karte');

select is(
  (select count(*)::int from public.posts
    where release_note_id in ('b9050000-0000-0000-0000-000000000001',
                              'b9050000-0000-0000-0000-000000000002')
      and visibility = 'members'),
  2, 'Die Karten tragen visibility = members, vom Ausloeser gesetzt');

select is(
  (select count(*)::int from public.posts
    where release_note_id in ('b9050000-0000-0000-0000-000000000001',
                              'b9050000-0000-0000-0000-000000000002')
      and body = ''),
  2, 'Die Karte speichert keinen Mitteilungsinhalt — body bleibt leer');

select is(
  (select count(*)::int from public.posts
    where release_note_id in ('b9050000-0000-0000-0000-000000000001',
                              'b9050000-0000-0000-0000-000000000002')
      and author_id = 'a9050000-0000-0000-0000-00000000000a'),
  2, 'author_id traegt das aufgeloeste Admin-Profil');

-- ── 5–7: die Zeit. Der teuerste Befund von AGE-718, hier festgenagelt ─────
select is(
  (select p.veroeffentlicht_ab from public.posts p
    where p.release_note_id = 'b9050000-0000-0000-0000-000000000001'),
  timestamptz '2026-08-01 09:00:00+02',
  'veroeffentlicht_ab traegt das Ausgabe-Datum, NICHT den Zeitpunkt des Laufs');

select is(
  (select p.created_at from public.posts p
    where p.release_note_id = 'b9050000-0000-0000-0000-000000000001'),
  timestamptz '2026-08-01 09:00:00+02',
  'created_at traegt dasselbe Datum — BEIDE Zeitspalten, nicht nur eine');

-- Die Staffelung: verschiedene Zeitstempel, und die Leseordnung faellt mit der
-- Feed-Ordnung zusammen. Gleiche Zeitstempel ordnete der Feed ueber die
-- zufaellige `id`, und dieselbe Ausgabe stuende auf jedem Bestand anders.
select is(
  (select count(distinct p.veroeffentlicht_ab)::int from public.posts p
    where p.release_note_id in ('b9050000-0000-0000-0000-000000000001',
                                'b9050000-0000-0000-0000-000000000002')),
  2, 'Die Karten einer Ausgabe tragen paarweise verschiedene Zeitstempel');

-- ── 8–10: DIE ZUSAGE — kein Hinweis, kein Push ────────────────────────────
select is(
  (select count(*)::int from public.notifications) - (select hinweise::int from age905_vorher),
  0, 'Der Nachtrag erzeugt KEINE notifications-Zeile');

select is(
  (select count(*)::int from public.notifications where type = 'release_note'),
  0, 'Insbesondere keine vom Typ release_note');

select is(
  (select count(*)::int from public.push_zustellungen) - (select pushs::int from age905_vorher),
  0, 'Der Nachtrag erzeugt KEINE push_zustellungen-Zeile');

-- ── 11–12: der teure Waechter ─────────────────────────────────────────────
-- `hinweis_neuer_beitrag()` verlaesst sich bei `kind <> 'member'` sofort und
-- stempelt `angekuendigt_am` dabei NICHT. Ohne den Stempel aus der Migration
-- haelt die Release-Karte allein `where p.kind = 'member'` in
-- `beitrag_ankuendigen()` zurueck. Hier steht BEIDES: dass der Stempel
-- gesetzt werden kann, und dass der Nachlauf auch ohne ihn nichts nachholt.
update public.posts
   set angekuendigt_am = now()
 where kind = 'release'
   and release_note_id = 'b9050000-0000-0000-0000-000000000001';

select is(
  (select count(*)::int from public.posts
    where kind = 'release'
      and release_note_id = 'b9050000-0000-0000-0000-000000000002'
      and angekuendigt_am is null),
  1, 'Eine ungestempelte Release-Karte ist moeglich — der Nachlauf sieht sie');

select lives_ok(
  $$ select public.beitrag_ankuendigen() $$,
  'beitrag_ankuendigen() laeuft');

select is(
  (select count(*)::int from public.notifications where type = 'post_created'
     and payload->>'post_id' in (
       select p.id::text from public.posts p
        where p.kind = 'release'
          and p.release_note_id in ('b9050000-0000-0000-0000-000000000001',
                                    'b9050000-0000-0000-0000-000000000002'))),
  0, 'beitrag_ankuendigen() holt KEINE Release-Karte nach, auch ungestempelt nicht');

-- ── 13–14: Wiederholbarkeit ───────────────────────────────────────────────
-- Derselbe Zustandswechsel ein zweites Mal: der Ausloeser feuert nicht (die
-- `when`-Bedingung verlangt `old.status = 'draft'`), und selbst wenn, faenge
-- ihn `on conflict … do nothing`.
update public.release_notes
   set status = 'sent'
 where id in ('b9050000-0000-0000-0000-000000000001',
              'b9050000-0000-0000-0000-000000000002');

select is(
  (select count(*)::int from public.posts
    where kind = 'release'
      and release_note_id in ('b9050000-0000-0000-0000-000000000001',
                              'b9050000-0000-0000-0000-000000000002')),
  2, 'Ein zweiter Zustandswechsel erzeugt keine zweite Karte');

select throws_ok(
  $$ insert into public.posts (author_id, body, visibility, kind, release_note_id,
                               created_at, veroeffentlicht_ab)
     values ('a9050000-0000-0000-0000-00000000000a', '', 'members', 'release',
             'b9050000-0000-0000-0000-000000000001', now(), now()) $$,
  '23505',
  null,
  'Eine zweite Karte auf dieselbe Note trifft den partiellen Unique-Index');

-- ── 15–16: ein Entwurf bleibt ohne Karte ──────────────────────────────────
insert into public.release_notes
  (id, title, body, entry_slugs, status, created_by)
values
  ('b9050000-0000-0000-0000-000000000003', 'Nur ein Entwurf', 'Unfertig',
   array['2026-08-01-test-drei'], 'draft', 'a9050000-0000-0000-0000-00000000000a');

select is(
  (select count(*)::int from public.posts
    where release_note_id = 'b9050000-0000-0000-0000-000000000003'),
  0, 'Ein Entwurf hat keine Feed-Karte');

select is(
  (select count(*)::int from public.notifications) - (select hinweise::int from age905_vorher),
  0, 'Und er erzeugt auch keinen Hinweis');

-- ── 17–18: ein Mitglied kann keine Release-Karte schreiben ────────────────
-- Das Recht INNERHALB der Transaktion, damit die Ablehnung aus der POLICY
-- kommt und nicht aus dem fehlenden Grant (AGE-582).
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"a9050000-0000-0000-0000-00000000000b","role":"authenticated"}', true);

select throws_ok(
  $$ insert into public.posts (author_id, body, visibility, kind, release_note_id,
                               created_at, veroeffentlicht_ab)
     values ('a9050000-0000-0000-0000-00000000000b', 'geschmuggelt', 'members',
             'release', 'b9050000-0000-0000-0000-000000000003', now(), now()) $$,
  '42501',
  null,
  'Ein Mitglied kann keine Release-Karte anlegen — die Policy weist ab');

-- Und hier NICHT `throws_ok('42501')`, obwohl es sich so liest.
--
-- Die UPDATE-Policy traegt `using (… is_admin() … status = 'draft')`. Fuer ein
-- Mitglied FILTERT diese Klausel die Zeile heraus, und Postgres fuehrt das
-- Statement daraufhin ERFOLGREICH mit null geaenderten Zeilen aus. `42501`
-- entstuende aus einem fehlenden RECHT, nicht aus einer gefilterten Zeile —
-- `authenticated` hat `update` auf `release_notes` aber sehr wohl.
--
-- Gemessen wird deshalb die Zeilenzahl, und danach der Zustand NACHGELESEN:
-- „null Zeilen" allein belegt nichts, die Zeile koennte auch fehlen.
-- `lives_ok` und nicht eine gezaehlte Zeilenzahl: ein daten-aenderndes CTE darf
-- nicht in einer Unterabfrage stehen, und eine Hilfstabelle koennte diese Rolle
-- nicht beschreiben — `set local role authenticated` verliert jedes Recht an
-- einer Tabelle des Testeigentuemers, und der Fehler waere wieder `42501`,
-- diesmal aus dem falschen Grund.
select lives_ok(
  $$ update public.release_notes set status = 'sent'
      where id = 'b9050000-0000-0000-0000-000000000003' $$,
  'Das UPDATE eines Mitglieds wirft NICHT — die USING-Klausel filtert die Zeile');

reset role;

select is(
  (select status from public.release_notes
    where id = 'b9050000-0000-0000-0000-000000000003'),
  'draft',
  'NACHGELESEN: der Entwurf ist immer noch ein Entwurf');

-- ── 19–21: DIE POSITIVKONTROLLE — eine ECHTE Zustellung ist laut ──────────
-- Ohne diesen Block belegt keine der Stille-Zusagen oben etwas: sie waeren
-- alle gruen, wenn der Rundruf generell nichts taete.
insert into public.release_notes
  (id, title, body, entry_slugs, status, created_by)
values
  ('b9050000-0000-0000-0000-000000000004', 'Echte Zustellung', 'Diese geht raus',
   array['2026-08-01-test-vier'], 'draft', 'a9050000-0000-0000-0000-00000000000a');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"a9050000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select lives_ok(
  $$ select public.send_release_note('b9050000-0000-0000-0000-000000000004') $$,
  'Ein Admin kann weiterhin echt zustellen');

reset role;

select cmp_ok(
  (select count(*)::int from public.notifications where type = 'release_note'),
  '>', 0,
  'POSITIVKONTROLLE: eine echte Zustellung erzeugt sehr wohl release_note-Hinweise');

select is(
  (select count(*)::int from public.posts
    where kind = 'release'
      and release_note_id = 'b9050000-0000-0000-0000-000000000004'),
  1, 'Und sie erzeugt ihre Feed-Karte wie bisher');

select * from finish();
rollback;
