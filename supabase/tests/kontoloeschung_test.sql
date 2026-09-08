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
select plan(30);

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

-- ══ DIE ANONYMISIERUNG ═════════════════════════════════════════════════════
-- Der eigentliche Vorgang. Was sie mit welcher Zeile tut, steht in
-- `openspec/changes/kontoloeschung/datenmatrix.md` — die Zusagen hier sind
-- gegen diese Matrix geschrieben, nicht gegen die Implementierung.
--
-- Das Mitglied `…05` bekommt dafür einen vollständigen Datensatz: Profilfelder,
-- Kontaktdaten, ein Angebot, einen veröffentlichten und einen geplanten
-- Beitrag, eine Unterhaltung mit `…06`, eine angenommene und eine offene
-- Kontaktanfrage, eine vergangene und eine künftige Veranstaltungsanmeldung.

-- `…07` gibt es, weil `contact_requests` ein `unique (from_id, to_id)` traegt:
-- die angenommene und die offene Anfrage koennen nicht dasselbe Gegenueber
-- haben.
insert into auth.users (id, aud, role, email) values
  ('e5000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'kl-voll@test.fbc'),
  ('e5000000-0000-0000-0000-000000000006', 'authenticated', 'authenticated', 'kl-gegenueber@test.fbc'),
  ('e5000000-0000-0000-0000-000000000007', 'authenticated', 'authenticated', 'kl-dritter@test.fbc');

update public.profiles
   set name = 'Wilhelmine Sonderbach', company = 'Sonderbach Consulting',
       branche = 'Beratung', short_bio = 'Begleitet Familienunternehmen',
       headline = 'Beraterin', roles = array['Beirat'],
       competencies = array['Nachfolge'], interests = array['Segeln'],
       region = 'Oberbayern', goals = 'Mehr Sichtbarkeit',
       next_steps = array['Profil schaerfen'], website = 'https://sonderbach.example',
       socials = '{"linkedin":"sonderbach"}'::jsonb,
       member_number = 'M-9911', member_since = '2019-04-01',
       dev_focus = 'wirken', dev_progress = 42,
       avatar_url = 'avatars/e5.../a.jpg', cover_url = 'covers/e5.../c.jpg',
       videos = array['https://example.invalid/v'],
       activated_at = now(), is_public = true, tier = 'impact'
 where id = 'e5000000-0000-0000-0000-000000000005';
update public.profiles
   set name = 'Kl Gegenueber', activated_at = now(), is_public = true, tier = 'impact'
 where id = 'e5000000-0000-0000-0000-000000000006';
update public.profiles
   set name = 'Kl Dritter', activated_at = now(), is_public = true, tier = 'impact'
 where id = 'e5000000-0000-0000-0000-000000000007';

insert into public.profile_contacts (profile_id, email, phone, street, postal_code, city, country)
values ('e5000000-0000-0000-0000-000000000005', 'w.sonderbach@example.invalid',
        '+49 89 1234', 'Beispielweg 3', '80331', 'Muenchen', 'DE');

insert into public.offers (id, profile_id, title) values
  ('e5000000-0000-0000-0000-0000000000c1', 'e5000000-0000-0000-0000-000000000005', 'Ein Angebot');

-- Ein veroeffentlichter Beitrag (bleibt) und ein geplanter (geht).
insert into public.posts (id, author_id, body, visibility, veroeffentlicht_ab) values
  ('e5000000-0000-0000-0000-0000000000a5', 'e5000000-0000-0000-0000-000000000005',
   'Veroeffentlichter Beitrag', 'members', now() - interval '1 day'),
  ('e5000000-0000-0000-0000-0000000000a6', 'e5000000-0000-0000-0000-000000000005',
   'Geplanter Beitrag', 'members', now() + interval '7 days');

-- Eine Unterhaltung. Der Verlauf gehoert AUCH dem Gegenueber.
insert into public.message_threads (id, a_profile_id, b_profile_id) values
  ('e5000000-0000-0000-0000-0000000000d1',
   'e5000000-0000-0000-0000-000000000005', 'e5000000-0000-0000-0000-000000000006');
insert into public.messages (id, thread_id, sender_id, body) values
  ('e5000000-0000-0000-0000-0000000000d2', 'e5000000-0000-0000-0000-0000000000d1',
   'e5000000-0000-0000-0000-000000000005', 'Nachricht an das Gegenueber');

-- Eine angenommene Anfrage (bleibt, sie ist Teil des fremden Verlaufs) und
-- eine offene (geht, sie bindet das Gegenueber an ein Konto ohne Eigentuemer).
insert into public.contact_requests (id, from_id, to_id, status) values
  ('e5000000-0000-0000-0000-0000000000e1', 'e5000000-0000-0000-0000-000000000005',
   'e5000000-0000-0000-0000-000000000006', 'accepted'),
  ('e5000000-0000-0000-0000-0000000000e2', 'e5000000-0000-0000-0000-000000000005',
   'e5000000-0000-0000-0000-000000000007', 'pending');

insert into public.events (id, title, starts_at, visibility) values
  ('e5000000-0000-0000-0000-0000000000f1', 'Vergangenes Treffen', now() - interval '30 days', 'public'),
  ('e5000000-0000-0000-0000-0000000000f2', 'Kuenftiges Treffen',  now() + interval '30 days', 'public');
insert into public.event_registrations (id, event_id, profile_id, status) values
  ('e5000000-0000-0000-0000-0000000000f3', 'e5000000-0000-0000-0000-0000000000f1',
   'e5000000-0000-0000-0000-000000000005', 'registered'),
  ('e5000000-0000-0000-0000-0000000000f4', 'e5000000-0000-0000-0000-0000000000f2',
   'e5000000-0000-0000-0000-000000000005', 'registered');

-- ── 13. Kein Client-Rolle darf die Funktion rufen ───────────────────────────
-- VOR dem Aufruf, damit die Zusage nicht an einem schon geleerten Konto misst.
-- `has_function_privilege` statt eines Aufrufversuchs: ein Aufruf haette auch
-- aus einem anderen Grund scheitern koennen und waere damit kein Rechtebeleg.
select is(
  (select bool_or(has_function_privilege(r, 'public.konto_anonymisieren(uuid)', 'EXECUTE'))
     from unnest(array['anon','authenticated','public']) r),
  false,
  'weder anon noch authenticated noch public duerfen konto_anonymisieren rufen');

-- Vorbedingung: der Name ist im Volltextindex, BEVOR anonymisiert wird.
-- Ohne sie waere Zusage 16 auch dann gruen, wenn der Index nie etwas trug.
select is(
  (select count(*)::int from public.profiles
    where id = 'e5000000-0000-0000-0000-000000000005'
      and search_doc @@ websearch_to_tsquery('german', 'Sonderbach')),
  1,
  'Vorbedingung: der Name steht im Volltextindex');

select public.konto_anonymisieren('e5000000-0000-0000-0000-000000000005');

-- ── 15. Jede Spalte der Matrix ist leer ─────────────────────────────────────
select is(
  (select count(*)::int from public.profiles
    where id = 'e5000000-0000-0000-0000-000000000005'
      and (name is not null or company is not null or branche is not null
        or short_bio is not null or headline is not null or roles is not null
        or competencies is not null or interests is not null or region is not null
        or goals is not null or next_steps is not null or website is not null
        or socials is not null or member_number is not null
        or member_since is not null or dev_focus is not null
        or dev_progress is not null or avatar_url is not null
        or cover_url is not null or videos <> '{}')),
  0,
  'keine Profilspalte der Datenmatrix traegt noch einen Personenbezug');

-- ── 16. …auch nicht der Volltextindex ───────────────────────────────────────
-- Der stille Rueckkanal: `search_doc` ist `generated always` ueber acht
-- Quellspalten. Bleibt EINE davon gefuellt, ist das Mitglied weiter auffindbar,
-- obwohl jede andere leer ist.
select is(
  (select count(*)::int from public.profiles
    where id = 'e5000000-0000-0000-0000-000000000005'
      and search_doc @@ websearch_to_tsquery('german', 'Sonderbach')),
  0,
  'der alte Name ist aus dem Volltextindex verschwunden');

-- ── 17. Kontakt- und Adressdaten sind fort ──────────────────────────────────
select is(
  (select count(*)::int from public.profile_contacts
    where profile_id = 'e5000000-0000-0000-0000-000000000005'),
  0,
  'die Kontakt- und Adresszeile ist geloescht');

-- ── 18. Beide Marken stehen ─────────────────────────────────────────────────
select is(
  (select deleted_at is not null and erased_at is not null from public.profiles
    where id = 'e5000000-0000-0000-0000-000000000005'),
  true,
  'deleted_at traegt die Sichtbarkeit, erased_at den Riegel');

-- ── 19./20. Der fremde Gespraechsfaden steht ───────────────────────────────
select is(
  (select count(*)::int from public.messages
    where id = 'e5000000-0000-0000-0000-0000000000d2'),
  1,
  'die Nachricht an das Gegenueber steht noch');

select is(
  (select count(*)::int from public.posts
    where id = 'e5000000-0000-0000-0000-0000000000a5'),
  1,
  'der veroeffentlichte Beitrag steht noch');

-- ── 21. Der geplante Beitrag ist fort ───────────────────────────────────────
-- Er ist noch niemandes Gespraechsfaden — und wuerde sonst nach der Loeschung
-- im Namen eines Kontos erscheinen, das keinen Eigentuemer mehr hat.
select is(
  (select count(*)::int from public.posts
    where id = 'e5000000-0000-0000-0000-0000000000a6'),
  0,
  'der geplante, nie veroeffentlichte Beitrag ist geloescht');

-- ── 22. Angenommene Anfrage bleibt, offene geht ─────────────────────────────
select is(
  (select string_agg(id::text, ',' order by id) from public.contact_requests
    where from_id = 'e5000000-0000-0000-0000-000000000005'),
  'e5000000-0000-0000-0000-0000000000e1',
  'die angenommene Anfrage bleibt, die offene ist zurueckgezogen');

-- ── 23./24. Kuenftige Anmeldung storniert, vergangene bleibt ────────────────
-- `event_registrations` fuehrt eine `waitlist`; eine stehenbleibende anonyme
-- Anmeldung haette den Platz blockiert, ohne dass jemand nachrueckt.
select is(
  (select status from public.event_registrations
    where id = 'e5000000-0000-0000-0000-0000000000f4'),
  'cancelled',
  'die Anmeldung zur kuenftigen Veranstaltung ist storniert');

select is(
  (select status from public.event_registrations
    where id = 'e5000000-0000-0000-0000-0000000000f3'),
  'registered',
  'die vergangene Teilnahme steht anonym weiter da');

-- ── 25. Der Aufruf ist wiederholbar ─────────────────────────────────────────
-- Ein Abbruch nach diesem Schritt muss durch erneutes Fahren heilbar sein.
select lives_ok(
  $$ select public.konto_anonymisieren('e5000000-0000-0000-0000-000000000005') $$,
  'ein zweiter Aufruf laeuft ohne Fehler durch (idempotent)');

-- ══ DIE SICHT DER ANDEREN ══════════════════════════════════════════════════
-- Bis hierher hat der Test als Eigentuemer gelesen, also an der RLS vorbei.
-- Die Entscheidung „anonymisieren, Fremdsicht bleibt" ist aber eine Aussage
-- ueber das, was ein ANDERES MITGLIED sieht. Die letzten drei Zusagen lesen
-- deshalb in der Identitaet des Gegenuebers.

create function pg_temp.zaehl_als(uid uuid, q text) returns int language plpgsql as $$
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

-- ── 26. Das Gegenueber hat seinen Verlauf behalten ──────────────────────────
select is(
  pg_temp.zaehl_als('e5000000-0000-0000-0000-000000000006',
    $$ select count(*)::int from public.messages
        where id = 'e5000000-0000-0000-0000-0000000000d2' $$),
  1,
  'das Gegenueber sieht die Nachricht des geloeschten Mitglieds weiterhin');

-- ── 27. …und sieht dort „Ehemaliges Mitglied" ───────────────────────────────
-- `former_member_entries` (AGE-581) ist die vorhandene Auskunft dafuer. Dass
-- sie ohne Aenderung auch fuer eine Kontoloeschung greift, ist der Grund,
-- warum dieser Change die Anzeige nicht neu bauen musste — sie haengt an
-- `deleted_at`, und die Anonymisierung setzt es mit.
select is(
  pg_temp.zaehl_als('e5000000-0000-0000-0000-000000000006',
    $$ select count(*)::int from public.former_member_entries(
         array['e5000000-0000-0000-0000-0000000000a5']::uuid[], '{}'::uuid[])
        where former $$),
  1,
  'der Beitrag wird dem Gegenueber als „Ehemaliges Mitglied" ausgewiesen');

-- ── 28. …und findet das Mitglied im Verzeichnis nicht mehr ──────────────────
-- Der Beleg zu Aufgabe 2.5: es wurde KEINE neue Sichtbarkeitsregel geschrieben.
-- Die Unsichtbarkeit kommt allein daher, dass die Anonymisierung `deleted_at`
-- mitsetzt und die vorhandenen Praedikate es ohnehin lesen — auch
-- `profiles_public`, das mit `security_invoker = off` laeuft und deshalb sonst
-- eine eigene Baustelle gewesen waere.
select is(
  pg_temp.zaehl_als('e5000000-0000-0000-0000-000000000006',
    $$ select count(*)::int from public.profiles_public
        where id = 'e5000000-0000-0000-0000-000000000005' $$),
  0,
  'das geloeschte Mitglied ist aus profiles_public verschwunden');

-- ══ DER SCHEMAWAECHTER ═════════════════════════════════════════════════════
-- ── 29. Bei unvorbereitetem Schema wird die Loeschung verweigert ────────────
-- Der teuerste denkbare Fehlzustand: die Funktion liegt in einer Umgebung, in
-- der der kaskadierende Fremdschluessel noch steht. Dann wuerde der naechste
-- Schritt — `auth.users` entfernen — die Profilzeile und 35 Tabellen mit
-- fremden Beitraegen mitnehmen.
--
-- `not valid` beim Wiederanlegen ist Absicht: der Test hat oben schon eine
-- Profilzeile ohne auth-Zeile erzeugt (Zusage 4), eine vollstaendige Pruefung
-- des Bestands wuerde also am eigenen Aufbau scheitern statt am Gegenstand.
-- Fuer den Katalog — und nur den liest der Waechter — ist die Bedingung
-- trotzdem da.
alter table public.profiles
  add constraint kl_probe_fkey foreign key (id)
  references auth.users (id) on delete cascade not valid;

select throws_ok(
  $$ select public.konto_anonymisieren('e5000000-0000-0000-0000-000000000002') $$,
  '55000',
  null,
  'bei noch stehendem Fremdschluessel verweigert die Anonymisierung (fail closed)');

alter table public.profiles drop constraint kl_probe_fkey;

-- Die Gegenprobe: ohne den Fremdschluessel laeuft derselbe Aufruf durch.
-- Ohne sie belegte Zusage 29 nur, dass die Funktion ueberhaupt wirft.
select lives_ok(
  $$ select public.konto_anonymisieren('e5000000-0000-0000-0000-000000000002') $$,
  'ohne den Fremdschluessel laeuft derselbe Aufruf durch');

select * from finish();
rollback;
