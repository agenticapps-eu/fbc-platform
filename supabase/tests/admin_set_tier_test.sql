-- Ein Admin setzt die Stufe eines Mitglieds (AGE-634).
-- Change: openspec/changes/admin-setzt-stufe/.
--
-- Echtes pgTAP mit plan()/finish() — nur solche Dateien stehen im CI-Lauf.
-- Diese Datei ist in ci.yml eingetragen.
--
-- ══ WAS HIER GEMESSEN WIRD ═════════════════════════════════════════════════
--   1. **Das Gate haelt im RUMPF.** An der Oberflaeche steht `RequireAdmin`
--      davor — das ist Komfort, keine Grenze. Wer die RPC direkt ruft, umgeht
--      es; nur `is_admin()` in der Funktion selbst haelt.
--   2. **Sie senkt.** Genau das kann `apply_upgrade` NICHT, und genau deshalb
--      gibt es sie. Ohne diese Zusage waere die neue Funktion eine zweite
--      Schreibstelle ohne eigenen Zweck.
--   3. **Die Spur nennt BEIDE Stufen.** Nur die neue zu speichern machte sie
--      unlesbar, sobald zwei Aenderungen aufeinanderfolgen.
--
-- ══ FALLEN, DIE DIESES PROJEKT SCHON GESTELLT HAT ══════════════════════════
--   * In pgTAP heisst es `alike()`, nicht `like()`.
--   * `try_as()` meldet JEDEN Fehler als 'DENIED:' — damit ist ein 42501 von
--     einem Tippfehler nicht zu unterscheiden. Hier gibt `code_as()` deshalb
--     den SQLSTATE zurueck, und die Zusagen lauten auf den Code.
--   * **Ein Negativbefund braucht eine Positivkontrolle.** „Der Nicht-Admin
--     aendert nichts" ist wertlos ohne „der Admin aendert sehr wohl etwas".
--   * Der lokale Stack ist geseedet — jede Mengenaussage ist auf die
--     Fixture-Kennungen eingeschraenkt, nie `count(*)` der ganzen Tabelle.

begin;
select plan(12);

-- ── Fixtures ────────────────────────────────────────────────────────────────
insert into auth.users (id, aud, role, email) values
  ('7c000000-0000-0000-0000-0000000000ad', 'authenticated', 'authenticated', 'st-admin@test.fbc'),
  ('7c000000-0000-0000-0000-00000000000a', 'authenticated', 'authenticated', 'st-a@test.fbc'),
  ('7c000000-0000-0000-0000-00000000000b', 'authenticated', 'authenticated', 'st-b@test.fbc');

update public.profiles set tier = 'impact', name = 'ST Admin', activated_at = now()
 where id = '7c000000-0000-0000-0000-0000000000ad';
update public.profiles set tier = 'impact', name = 'ST A', activated_at = now()
 where id = '7c000000-0000-0000-0000-00000000000a';
update public.profiles set tier = 'basic', name = 'ST B', activated_at = now()
 where id = '7c000000-0000-0000-0000-00000000000b';

insert into public.staff_roles (profile_id, role)
values ('7c000000-0000-0000-0000-0000000000ad', 'admin');

-- ── Helfer ──────────────────────────────────────────────────────────────────
/** Fuehrt `q` als `uid` aus und gibt den SQLSTATE zurueck — 'OK' bei Erfolg.
 *  Der SQLSTATE, nicht die Meldung: die Zusagen dieser Anforderung lauten auf
 *  42501, 22023 und P0002, und ein 'DENIED:'-Sammeltopf traefe sie alle. */
create function pg_temp.code_as(uid uuid, q text) returns text language plpgsql as $$
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

/** Die Stufe eines Profils, gelesen OHNE Rolle — die Messung soll nicht selbst
 *  an einer Policy scheitern und das als Befund ausgeben. */
create function pg_temp.stufe(p uuid) returns text language sql as $$
  select tier from public.profiles where id = p;
$$;

/** Wieviele set_tier-Spuren gibt es zu diesem Ziel? */
create function pg_temp.spuren(p uuid) returns int language sql as $$
  select count(*)::int from public.admin_audit where target = p and action = 'set_tier';
$$;

-- ── 1. Das Gate ─────────────────────────────────────────────────────────────
select is(
  pg_temp.code_as('7c000000-0000-0000-0000-00000000000a',
    $q$ select public.admin_set_tier('7c000000-0000-0000-0000-00000000000b', 'focus', 'geht nicht') $q$),
  '42501',
  'Ein Nicht-Admin bekommt 42501');

select is(pg_temp.stufe('7c000000-0000-0000-0000-00000000000b'), 'basic',
  'und die Stufe steht danach unveraendert');

select is(pg_temp.spuren('7c000000-0000-0000-0000-00000000000b'), 0,
  'und es entsteht keine Spur');

-- ── 2. Der Admin hebt an ────────────────────────────────────────────────────
select is(
  pg_temp.code_as('7c000000-0000-0000-0000-0000000000ad',
    $q$ select public.admin_set_tier('7c000000-0000-0000-0000-00000000000b', 'focus', 'Ueberweisung eingegangen') $q$),
  'OK',
  'Ein Admin darf — die Positivkontrolle zur Verneinung oben');

select is(pg_temp.stufe('7c000000-0000-0000-0000-00000000000b'), 'focus',
  'und die Stufe steht auf focus');

-- ── 3. Und er SENKT — das kann apply_upgrade nicht ──────────────────────────
select is(
  pg_temp.code_as('7c000000-0000-0000-0000-0000000000ad',
    $q$ select public.admin_set_tier('7c000000-0000-0000-0000-00000000000a', 'connect', 'Importfehler korrigiert') $q$),
  'OK',
  'Ein Admin senkt von impact auf connect');

select is(pg_temp.stufe('7c000000-0000-0000-0000-00000000000a'), 'connect',
  'und die Senkung steht wirklich in der Zeile');

-- Die Gegenprobe, die den Zweck dieser Funktion begruendet: derselbe Wunsch
-- ueber apply_upgrade ist ein No-op.
select is(
  (select public.apply_upgrade('7c000000-0000-0000-0000-00000000000b', 'basic')),
  'focus',
  'apply_upgrade senkt NICHT — sie gibt den unveraenderten Ist-Zustand zurueck');

-- ── 4. Die Spur ─────────────────────────────────────────────────────────────
select is(
  (select payload->>'von' from public.admin_audit
    where target = '7c000000-0000-0000-0000-00000000000a' and action = 'set_tier'
    order by at desc limit 1),
  'impact',
  'Die Spur nennt die ALTE Stufe');

select is(
  (select payload->>'nach' from public.admin_audit
    where target = '7c000000-0000-0000-0000-00000000000a' and action = 'set_tier'
    order by at desc limit 1),
  'connect',
  'und die neue');

select is(
  (select payload->>'grund' from public.admin_audit
    where target = '7c000000-0000-0000-0000-00000000000a' and action = 'set_tier'
    order by at desc limit 1),
  'Importfehler korrigiert',
  'und den Grund');

-- ── 5. Die Abweisungen ──────────────────────────────────────────────────────
select is(
  pg_temp.code_as('7c000000-0000-0000-0000-0000000000ad',
    $q$ select public.admin_set_tier('7c000000-0000-0000-0000-00000000000b', 'focus', '   ') $q$),
  '22023',
  'Eine Begruendung aus Leerzeichen ist keine');

select * from finish();
rollback;
