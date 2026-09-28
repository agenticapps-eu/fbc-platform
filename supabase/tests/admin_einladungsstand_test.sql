-- Der Einladungsstand in der Mitgliederliste (AGE-927).
-- Change: openspec/changes/mitglied-anlegen/.
--
-- Echtes pgTAP mit plan()/finish() — nur solche Dateien stehen im CI-Lauf.
--
-- WARUM EINE EIGENE DATEI:
-- `admin_member_list_test.sql` hält 74 Zusagen an einem eng gebauten Bestand.
-- Die Aufnahmestrecke braucht einen ANDEREN Bestand — Profile mit und ohne
-- Token, mit abgelaufenem, mit entwertetem, mit benutztem. Beides in einer
-- Datei hiesse, zwei Vorrichtungen umeinander herumzubauen.
--
-- WAS HIER NICHT GEPRÜFT WIRD UND WARUM:
-- Ob eine MAIL ankam. `eingeladen_am` sagt „ein Link wurde erzeugt" und nichts
-- sonst; der Versand quittiert anderswo, und ein 202 belegt nichts. Eine Zusage
-- über Zustellung wäre hier nicht bloss ungeprüft, sie wäre unprüfbar.
--
-- FALLEN, DIE DIESES PROJEKT SCHON GESTELLT HAT:
--   * In pgTAP heisst es `alike()`, nicht `like()`.
--   * Der lokale Stack ist geseedet. Jede Mengenaussage läuft deshalb über
--     einen Suchbegriff, der genau die Sondenkonten trifft — sonst misst man
--     den Seed und nicht die Funktion.
--   * `activation_tokens` trägt RLS ohne Policy und ohne Grant. Der Test
--     schreibt sie als `postgres`; das ist derselbe Weg, den die
--     DEFINER-Funktionen gehen, und genau deshalb prüft Abschnitt 5, dass er
--     für anon und authenticated NICHT offensteht.

begin;
select plan(19);

-- ── Fixtures ────────────────────────────────────────────────────────────────
-- auth.users-Insert feuert handle_new_user() und legt public.profiles an.
insert into auth.users (id, aud, role, email) values
  ('e1000000-0000-0000-0000-0000000000ad', 'authenticated', 'authenticated', 'einladung-admin@test.fbc'),
  ('e1000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'einladung1@test.fbc'),
  ('e1000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'einladung2@test.fbc'),
  ('e1000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'einladung3@test.fbc'),
  ('e1000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'einladung4@test.fbc'),
  ('e1000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'einladung5@test.fbc');

insert into public.staff_roles (profile_id, role) values
  ('e1000000-0000-0000-0000-0000000000ad', 'admin');

update public.profiles set name = 'Einladungs-Admin', activated_at = now()
 where id = 'e1000000-0000-0000-0000-0000000000ad';

-- 1 — angelegt: unbestätigt, NIE ein Token
update public.profiles set name = 'Nie eingeladen', activated_at = null
 where id = 'e1000000-0000-0000-0000-000000000001';

-- 2 — eingeladen: unbestätigt, ein gültiges Token
update public.profiles set name = 'Frisch eingeladen', activated_at = null
 where id = 'e1000000-0000-0000-0000-000000000002';
insert into public.activation_tokens (token_hash, profile_id, expires_at, created_at)
values ('einladung-hash-2', 'e1000000-0000-0000-0000-000000000002',
        now() + interval '72 hours', now() - interval '2 hours');

-- 3 — eingeladen: unbestätigt, Token ABGELAUFEN
update public.profiles set name = 'Link verfallen', activated_at = null
 where id = 'e1000000-0000-0000-0000-000000000003';
insert into public.activation_tokens (token_hash, profile_id, expires_at, created_at)
values ('einladung-hash-3', 'e1000000-0000-0000-0000-000000000003',
        now() - interval '1 hour', now() - interval '10 days');

-- 4 — eingeladen: unbestätigt, Token ENTWERTET (der abgelehnte Versand)
update public.profiles set name = 'Versand abgelehnt', activated_at = null
 where id = 'e1000000-0000-0000-0000-000000000004';
insert into public.activation_tokens (token_hash, profile_id, expires_at, created_at, invalidated_at)
values ('einladung-hash-4', 'e1000000-0000-0000-0000-000000000004',
        now() + interval '72 hours', now() - interval '3 hours', now() - interval '3 hours');

-- 5 — zwei Token: `eingeladen_am` muss den SPÄTEREN tragen
update public.profiles set name = 'Zweimal eingeladen', activated_at = null
 where id = 'e1000000-0000-0000-0000-000000000005';
insert into public.activation_tokens (token_hash, profile_id, expires_at, created_at, invalidated_at)
values ('einladung-hash-5a', 'e1000000-0000-0000-0000-000000000005',
        now() + interval '72 hours', now() - interval '9 days', now() - interval '9 days');
insert into public.activation_tokens (token_hash, profile_id, expires_at, created_at)
values ('einladung-hash-5b', 'e1000000-0000-0000-0000-000000000005',
        now() + interval '72 hours', now() - interval '1 day');

-- Als Admin lesen. Die Funktion prüft `is_admin()` in ihrem Rumpf.
create function pg_temp.als_admin(q text) returns setof record language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', 'e1000000-0000-0000-0000-0000000000ad',
                      'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  return query execute q;
  reset role;
  perform set_config('request.jwt.claims', '', true);
end $$;

create function pg_temp.status_ids(p_status text) returns text language sql as $$
  select coalesce(string_agg(x.id::text, ' ' order by x.id::text), '')
    from pg_temp.als_admin(
      format('select id from public.admin_list_members(%L, %L, 100, 0)',
             'einladung', p_status)) as x(id uuid);
$$;

-- ── 1. Die beiden neuen Zustände bestehen überhaupt ────────────────────────
select lives_ok(
  $$ select 1 from pg_temp.als_admin(
       'select id from public.admin_list_members(null, ''angelegt'', 1, 0)') as x(id uuid) $$,
  'p_status = angelegt ist ein bekannter Wert');
select lives_ok(
  $$ select 1 from pg_temp.als_admin(
       'select id from public.admin_list_members(null, ''eingeladen'', 1, 0)') as x(id uuid) $$,
  'p_status = eingeladen ist ein bekannter Wert');

-- ── 2. Sie teilen `offen` auf ──────────────────────────────────────────────
select is(pg_temp.status_ids('angelegt'),
  'e1000000-0000-0000-0000-000000000001',
  'angelegt: genau das Profil ohne jedes Token');

select is(pg_temp.status_ids('eingeladen'),
  'e1000000-0000-0000-0000-000000000002 e1000000-0000-0000-0000-000000000003 '
  || 'e1000000-0000-0000-0000-000000000004 e1000000-0000-0000-0000-000000000005',
  'eingeladen: gültig, abgelaufen, entwertet und zweimal — die Frage lautet '
  '„wurde je eingeladen?", nicht „liegt gerade ein gültiger Link?"');

select is(pg_temp.status_ids('offen'),
  'e1000000-0000-0000-0000-000000000001 e1000000-0000-0000-0000-000000000002 '
  || 'e1000000-0000-0000-0000-000000000003 e1000000-0000-0000-0000-000000000004 '
  || 'e1000000-0000-0000-0000-000000000005',
  'offen bleibt die Vereinigung beider — es wird geteilt, nicht ersetzt');

-- ── 3. `eingeladen_am` ─────────────────────────────────────────────────────
create function pg_temp.eingeladen_am(p_id uuid) returns timestamptz language sql as $$
  select x.eingeladen_am from pg_temp.als_admin(
    format('select id, eingeladen_am from public.admin_list_members(%L, null, 100, 0)',
           'einladung')) as x(id uuid, eingeladen_am timestamptz)
   where x.id = p_id;
$$;

select ok(pg_temp.eingeladen_am('e1000000-0000-0000-0000-000000000001') is null,
  'eingeladen_am ist null, solange nie ein Link erzeugt wurde');

select ok(pg_temp.eingeladen_am('e1000000-0000-0000-0000-000000000002') is not null,
  'eingeladen_am trägt einen Zeitpunkt, sobald einer erzeugt wurde');

select ok(
  pg_temp.eingeladen_am('e1000000-0000-0000-0000-000000000005') > now() - interval '2 days',
  'eingeladen_am trägt bei zwei Token den SPÄTEREN, nicht den ersten');

-- ── 4. Die Zähler laufen mit der Liste, nicht neben ihr ────────────────────
create function pg_temp.zahl(p_status text) returns bigint language sql as $$
  select x.anzahl from pg_temp.als_admin(
    'select status, anzahl from public.admin_member_counts()') as x(status text, anzahl bigint)
   where x.status = p_status;
$$;

select ok(pg_temp.zahl('angelegt') is not null,
  'admin_member_counts kennt angelegt');
select ok(pg_temp.zahl('eingeladen') is not null,
  'admin_member_counts kennt eingeladen');
select is(pg_temp.zahl('angelegt') + pg_temp.zahl('eingeladen'), pg_temp.zahl('offen'),
  'angelegt + eingeladen = offen — eine Folge der geteilten Bedingung, keine '
  'Zusage, die jemand einhalten muss');

-- ── 5. `activation_tokens` bleibt unerreichbar ─────────────────────────────
-- Die Positivkontrolle steht oben: die Funktion LIEFERT den Wert. Ohne sie
-- wäre „der Zugriff scheitert" auch von einer Datenbank erfüllt, in der die
-- Tabelle gar nicht existiert.
create function pg_temp.state_as(uid uuid, q text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    execute q;
  exception when others then
    reset role;
    perform set_config('request.jwt.claims', '', true);
    return SQLSTATE;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return 'OK';
end $$;

select is(pg_temp.state_as('e1000000-0000-0000-0000-0000000000ad',
    'select count(*) from public.activation_tokens'), '42501',
  'activation_tokens: auch ein ADMIN liest sie nicht direkt — der Weg führt '
  'ausschliesslich über die DEFINER-Funktionen');

select is(has_table_privilege('anon', 'public.activation_tokens', 'select'), false,
  'activation_tokens: anon hält kein SELECT');
select is(has_table_privilege('authenticated', 'public.activation_tokens', 'select'), false,
  'activation_tokens: authenticated hält kein SELECT');

-- ── 6. Die geteilte Bedingung trägt den Zeitpunkt als ARGUMENT ─────────────
-- Sie muss `immutable` bleiben: läse sie selbst, wäre sie `stable` und der
-- Planer müsste sie je Zeile als Blackbox aufrufen.
select is(
  (select p.provolatile from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'member_state_matches'),
  'i'::"char",
  'member_state_matches bleibt immutable — der Einladungszeitpunkt kommt als Argument');

select is(
  (select p.pronargs::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'member_state_matches'),
  5,
  'member_state_matches trägt fünf Argumente');

-- Rechte werden ausgesprochen, nicht geerbt (AGE-312) — und ein `drop` nimmt
-- sie mit. Diese drei Zusagen sind der Beleg, dass der `revoke` nach der
-- Neuanlage wieder ausgesprochen wurde.
select is(has_function_privilege('anon',
    'public.member_state_matches(text,timestamptz,timestamptz,timestamptz,timestamptz)', 'execute'),
  false, 'member_state_matches: anon darf nicht ausführen — auch nach dem Abwurf nicht');
select is(has_function_privilege('authenticated',
    'public.member_state_matches(text,timestamptz,timestamptz,timestamptz,timestamptz)', 'execute'),
  false, 'member_state_matches: auch authenticated nicht — sie ist keine Fläche, sondern eine Bedingung');

-- ── 7. Ein unbekannter Status bleibt ein Fehler ────────────────────────────
select is(pg_temp.state_as('e1000000-0000-0000-0000-0000000000ad',
    'select * from public.admin_list_members(null, ''angelegtt'', 1, 0)'), '22023',
  'ein vertippter Status bricht weiter ab, statt still alles zu zeigen');

select * from finish();
rollback;
