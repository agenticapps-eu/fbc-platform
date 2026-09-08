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
select plan(12);

-- ── Fixtures ────────────────────────────────────────────────────────────────
-- Der auth.users-Insert feuert handle_new_user() und legt public.profiles an.
insert into auth.users (id, aud, role, email) values
  ('e5000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'kl-geht@test.fbc'),
  ('e5000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'kl-bleibt@test.fbc'),
  ('e5000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'kl-erased@test.fbc'),
  ('e5000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'kl-weich@test.fbc'),
  ('e5000000-0000-0000-0000-0000000000ad', 'authenticated', 'authenticated', 'kl-admin@test.fbc');

insert into public.staff_roles (profile_id, role) values
  ('e5000000-0000-0000-0000-0000000000ad', 'admin');

update public.profiles
   set name = 'Kl Geht', activated_at = now(), is_public = true, tier = 'impact'
 where id = 'e5000000-0000-0000-0000-000000000001';
update public.profiles
   set name = 'Kl Bleibt', activated_at = now(), is_public = true, tier = 'impact'
 where id = 'e5000000-0000-0000-0000-000000000002';
update public.profiles
   set name = 'Kl Erased', activated_at = now(), is_public = true, tier = 'impact'
 where id = 'e5000000-0000-0000-0000-000000000003';
update public.profiles
   set name = 'Kl Weich', activated_at = now(), is_public = true, tier = 'impact'
 where id = 'e5000000-0000-0000-0000-000000000004';
update public.profiles
   set name = 'Kl Admin', activated_at = now(), is_public = true, tier = 'impact'
 where id = 'e5000000-0000-0000-0000-0000000000ad';

-- ── Helfer ──────────────────────────────────────────────────────────────────
-- Liefert SQLSTATE UND SQLERRM. Nur der SQLSTATE reicht hier nicht: ein
-- fehlendes Tabellenrecht und eine RLS-Ablehnung sind BEIDE `42501`. Eine
-- Zusage, die nur auf `42501` prueft, bliebe gruen, wenn das Gate ausfaellt
-- und statt seiner das ACL abweist — sie misst dann etwas anderes, als sie
-- behauptet. Darum wird unten an `%row-level security policy%` verankert.
create function pg_temp.fehler_als(uid uuid, q text) returns text language plpgsql as $$
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
  return 'KEIN FEHLER';
end $$;

-- Liest is_activated() in der Identitaet des uebergebenen Mitglieds.
create function pg_temp.aktiviert_als(uid uuid) returns boolean language plpgsql as $$
declare r boolean;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select public.is_activated() into r;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return r;
end $$;

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

-- ══ DER LÖSCHZUSTAND (D7) ══════════════════════════════════════════════════
-- `deleted_at` allein trägt die Unwiderruflichkeit NICHT: `admin_restore_member`
-- setzt genau dieses Feld auf `null` zurück. Ein Restore hätte den geleerten
-- Grabstein wieder ins Verzeichnis geholt — gefunden im Plan-Review (codex,
-- HIGH), und der Befund stand in einer Datei, die beim Planen offen lag.
--
-- Deshalb eine zweite, eigene Marke: `erased_at`. Sie wird nie geleert.

-- ── 7. Die Marke existiert ──────────────────────────────────────────────────
select is(
  (select count(*)::int
     from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'profiles'
      and column_name  = 'erased_at'),
  1,
  'profiles traegt die Marke erased_at');

-- Zwei Konten, die sich in GENAU EINEM Feld unterscheiden: beide sind
-- `deleted_at`, nur eines ist zusaetzlich `erased_at`. Damit misst der
-- Unterschied zwischen Test 8 und Test 10 die Marke und nichts sonst.
update public.profiles set deleted_at = now(), erased_at = now()
 where id = 'e5000000-0000-0000-0000-000000000003';
update public.profiles set deleted_at = now()
 where id = 'e5000000-0000-0000-0000-000000000004';

-- ── 8. Der Restore verweigert ein geloeschtes Konto ─────────────────────────
select throws_ok(
  $$ select public.admin_restore_member(
       'e5000000-0000-0000-0000-000000000003',
       'e5000000-0000-0000-0000-0000000000ad') $$,
  '22023',
  null,
  'admin_restore_member verweigert ein endgueltig geloeschtes Konto');

-- ── 9. …und das Konto ist danach immer noch geloescht ───────────────────────
-- Ohne diese Nachlese belegt Test 8 nur, dass IRGENDEIN Fehler kam — nicht,
-- dass der Zustand unangetastet blieb.
select is(
  (select deleted_at is not null from public.profiles
    where id = 'e5000000-0000-0000-0000-000000000003'),
  true,
  'nach der verweigerten Wiederherstellung ist das Konto weiter geloescht');

-- ── 10. Ein NUR weich geloeschtes Konto laesst sich weiter herstellen ───────
-- Die Gegenprobe zu Test 8. Ohne sie waere „Restore verweigert" auch dann
-- gruen, wenn admin_restore_member schlicht immer wirft.
select lives_ok(
  $$ select public.admin_restore_member(
       'e5000000-0000-0000-0000-000000000004',
       'e5000000-0000-0000-0000-0000000000ad') $$,
  'die weiche Admin-Loeschung aus AGE-581 bleibt wiederherstellbar');

-- ══ DIE ZUGRIFFSSPERRE (D8) ════════════════════════════════════════════════
-- `deleteUser()` entwertet ein bereits ausgestelltes Zugriffstoken nicht; da
-- die Profilzeile absichtlich stehenbleibt, liefert `auth.uid()` weiter
-- dieselbe ID. Die Sperre muss also aus der Datenbank kommen, nicht aus dem
-- Client. Sie tut es bereits: `is_activated()` liest `deleted_at`, und
-- gemessen am 08.09. pruefen 34 von 34 schreibenden public-Policies diese
-- Funktion. Diese zwei Zusagen halten das fest, damit es so bleibt.

-- ── 11. Das geloeschte Konto gilt nicht mehr als aktiviert ──────────────────
select is(
  pg_temp.aktiviert_als('e5000000-0000-0000-0000-000000000003'),
  false,
  'is_activated() ist fuer das geloeschte Konto falsch');

-- ── 12. …und es kann tatsaechlich nichts mehr schreiben ─────────────────────
-- `offers` und nicht `posts`: auf `posts` hat `authenticated` gar kein
-- INSERT-Recht, dort haette die Ablehnung aus dem ACL kommen koennen statt aus
-- der Policy — die Zusage haette dann nicht das Gate gemessen. Verankert an
-- der Meldung, weil beide Faelle `42501` sind.
select alike(
  pg_temp.fehler_als(
    'e5000000-0000-0000-0000-000000000003',
    $$ insert into public.offers (profile_id, title)
       values ('e5000000-0000-0000-0000-000000000003', 'darf nicht durchkommen') $$),
  'FEHLER:42501%row-level security policy%',
  'das geloeschte Konto wird beim Schreiben von der POLICY abgewiesen');

select * from finish();
rollback;
