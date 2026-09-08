-- Kontolöschung: die Auth-Identität geht, der fremde Gesprächsfaden bleibt
-- (AGE-708). Change: openspec/changes/kontoloeschung/.
--
-- Echtes pgTAP mit plan()/finish() — nur solche Dateien stehen im CI-Lauf.
-- WER DIESE DATEI ANLEGT, TRÄGT SIE IN `.github/workflows/ci.yml` EIN.
-- Eine Datei mit `plan()` ist kein Beleg, dass sie irgendwo läuft; genau das
-- ist diesem Projekt am 23.08. zweimal hintereinander passiert.
--
-- ══ WAS HIER GEMESSEN WIRD ═════════════════════════════════════════════════
-- Genau eine Sache, und sie ist die Voraussetzung für alles Weitere:
--
--   Ein `delete from auth.users` darf die Profilzeile NICHT mitnehmen,
--   und über sie nicht die 35 Tabellen, die an ihr hängen.
--
-- Heute nimmt es sie mit — `profiles.id references auth.users (id) on delete
-- cascade`, und 28 der 35 Fremdschlüssel auf `profiles` kaskadieren ebenfalls.
-- Ein `auth.admin.deleteUser()` löscht damit still Beiträge, Kommentare,
-- Nachrichten und Kontaktanfragen. Das ist das Gegenteil der Entscheidung
-- „anonymisieren, Fremdsicht bleibt" (Donald, 08.09.).
--
-- ══ WARUM DER FREMDSCHLÜSSEL WEG MUSS UND NICHT NUR DIE KASKADE ════════════
-- Aus dem Plan-Review (codex, HIGH). Ein Fremdschlüssel ohne `on delete`-Klausel
-- ist `no action` — der VERHINDERT die Auth-Löschung, solange die Profilzeile
-- zeigt. Zwischen „Kaskade weg" und „Fremdschlüssel weg" liegt der ganze
-- Change, und im Schema sehen beide ähnlich aus. Deshalb prüft Test 1 den
-- Katalog auf die Abwesenheit der Bedingung, und Test 4 fährt die Löschung
-- wirklich — ein Katalogbefund allein hätte `no action` durchgehen lassen.
--
-- ══ FALLEN, DIE DIESES PROJEKT SCHON GESTELLT HAT ══════════════════════════
--   * In pgTAP heisst es `alike()`, nicht `like()`.
--   * Der lokale Stack ist geseedet. Jede Mengenaussage ist hier auf die
--     eigenen Fixture-IDs EINGESCHLOSSEN, nie ein `count(*)` der Tabelle und
--     nie eine Ausnahmeliste — die schliesst die eigenen Zeilen aus, nicht die
--     fremden.
--   * Eine Zusage, die gegen eine LEERE Datenbank grün ist, misst nichts. CI
--     fährt genau diese leere Datenbank. Darum legt jeder Test seine Zeile
--     selbst an und liest sie danach namentlich zurück.

begin;
select plan(6);

-- ── Fixtures ────────────────────────────────────────────────────────────────
-- Der auth.users-Insert feuert handle_new_user() und legt public.profiles an.
insert into auth.users (id, aud, role, email) values
  ('e5000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'kl-geht@test.fbc'),
  ('e5000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'kl-bleibt@test.fbc');

update public.profiles
   set name = 'Kl Geht', activated_at = now(), is_public = true, tier = 'impact'
 where id = 'e5000000-0000-0000-0000-000000000001';
update public.profiles
   set name = 'Kl Bleibt', activated_at = now(), is_public = true, tier = 'impact'
 where id = 'e5000000-0000-0000-0000-000000000002';

-- Der Beitrag des gehenden Mitglieds, mit einem Kommentar des bleibenden.
-- Das ist der fremde Gesprächsfaden, um den es geht: verschwindet der Beitrag,
-- verliert der Kommentar seinen Anfang.
insert into public.posts (id, author_id, body, visibility) values
  ('e5000000-0000-0000-0000-0000000000a1',
   'e5000000-0000-0000-0000-000000000001',
   'Beitrag des gehenden Mitglieds', 'members');

insert into public.comments (id, post_id, author_id, body) values
  ('e5000000-0000-0000-0000-0000000000b1',
   'e5000000-0000-0000-0000-0000000000a1',
   'e5000000-0000-0000-0000-000000000002',
   'Kommentar des bleibenden Mitglieds');

-- ── 1. Der Fremdschlüssel auf auth.users ist fort ───────────────────────────
-- Nicht „traegt keine Kaskade": ganz fort. `no action` waere ebenfalls
-- kaskadenfrei und trotzdem der falsche Zustand.
select is(
  (select count(*)::int
     from pg_constraint con
     join pg_class c   on c.oid = con.conrelid
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'profiles'
      and con.contype = 'f'
      and con.confrelid = 'auth.users'::regclass),
  0,
  'profiles traegt keinen Fremdschluessel mehr auf auth.users');

-- ── 2. Vorbedingung: der Faden steht, bevor gelöscht wird ───────────────────
-- Ohne diese Zusage koennte Test 3 auch dann gruen sein, wenn die Fixtures
-- gar nicht angelegt wurden — eine Positivkontrolle fuer den eigenen Aufbau.
select is(
  (select count(*)::int from public.posts
    where id = 'e5000000-0000-0000-0000-0000000000a1'),
  1,
  'Vorbedingung: der Beitrag existiert vor der Loeschung');

-- ── 3. Die Auth-Identität geht ──────────────────────────────────────────────
delete from auth.users where id = 'e5000000-0000-0000-0000-000000000001';

select is(
  (select count(*)::int from auth.users
    where id = 'e5000000-0000-0000-0000-000000000001'),
  0,
  'die auth.users-Zeile ist fort');

-- ── 4. …und nimmt die Profilzeile NICHT mit ─────────────────────────────────
-- Der Anker, an dem die 35 Fremdschluessel haengen. Faellt er, faellt alles.
select is(
  (select count(*)::int from public.profiles
    where id = 'e5000000-0000-0000-0000-000000000001'),
  1,
  'die Profilzeile bleibt als Anker stehen');

-- ── 5. …und nicht den Beitrag ───────────────────────────────────────────────
select is(
  (select count(*)::int from public.posts
    where id = 'e5000000-0000-0000-0000-0000000000a1'),
  1,
  'der Beitrag des gegangenen Mitglieds steht noch');

-- ── 6. …und nicht den fremden Kommentar darunter ────────────────────────────
-- Der Kommentar haengt am BEITRAG, nicht am gegangenen Mitglied. Er faellt
-- also nur mit, wenn der Beitrag faellt — und genau das ist der Schaden, den
-- „fremde Gespraechsfaeden bleiben stehen" verhindern soll.
select is(
  (select count(*)::int from public.comments
    where id = 'e5000000-0000-0000-0000-0000000000b1'),
  1,
  'der Kommentar des bleibenden Mitglieds hat seinen Anfang behalten');

select * from finish();
rollback;
