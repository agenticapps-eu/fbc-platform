-- Behavioural probe for member_settings RLS (AGE-237). Self-contained: creates
-- three members, then verifies the own-profile policy added in
-- 20260630130000_member_settings.sql:
--   * a member may INSERT their OWN member_settings row;
--   * a member may SELECT their OWN member_settings row (cross-tenant row hidden);
--   * a member may UPDATE their OWN member_settings row;
--   * a member may NOT SELECT another member's row (RLS filters it out);
--   * a member may NOT INSERT a row for another profile_id (WITH CHECK denies it).
-- Runs in a transaction and rolls back, leaving no data behind.
--
-- RLS only engages for a non-owner role, so sensitive ops run as `authenticated`
-- with the member's JWT sub (helpers below), while assertions run as the test role.

begin;

insert into auth.users (id, aud, role, email) values
  ('00000000-0000-0000-0000-0000000237aa', 'authenticated', 'authenticated', 't237a@probe.fbc.invalid'),
  ('00000000-0000-0000-0000-0000000237bb', 'authenticated', 'authenticated', 't237b@probe.fbc.invalid'),
  ('00000000-0000-0000-0000-0000000237cc', 'authenticated', 'authenticated', 't237c@probe.fbc.invalid');

-- Seed one row for B (as the superuser test role → bypasses RLS) so A's
-- cross-tenant SELECT has something it must NOT see.
insert into public.member_settings (profile_id)
values ('00000000-0000-0000-0000-0000000237bb');

-- ── role-impersonation helpers (mirror supabase/tests/rls_test.sql) ──────────
create function pg_temp.count_as(uid uuid, q text) returns int language plpgsql as $$
declare n int;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  execute q into n;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return n;
end $$;

create function pg_temp.try_as(uid uuid, q text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    execute q;
  exception when others then
    reset role;
    perform set_config('request.jwt.claims', '', true);
    return 'DENIED';
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return 'OK';
end $$;

do $$
declare
  v_a uuid := '00000000-0000-0000-0000-0000000237aa';
  v_b uuid := '00000000-0000-0000-0000-0000000237bb';
  v_c uuid := '00000000-0000-0000-0000-0000000237cc';
  v text;
  n int;
begin
  -- A inserts its OWN row → allowed.
  v := pg_temp.try_as(v_a, $q$
    insert into public.member_settings (profile_id)
    values ('00000000-0000-0000-0000-0000000237aa')
  $q$);
  if v <> 'OK' then raise exception 'expected A to insert own row, got %', v; end if;

  -- A sees only its OWN row (1), not B's.
  n := pg_temp.count_as(v_a, 'select count(*)::int from public.member_settings');
  if n <> 1 then raise exception 'expected A to see exactly 1 own row, saw %', n; end if;

  -- A updates its OWN row → allowed.
  v := pg_temp.try_as(v_a, $q$
    update public.member_settings set visible_in_directory = false
    where profile_id = '00000000-0000-0000-0000-0000000237aa'
  $q$);
  if v <> 'OK' then raise exception 'expected A to update own row, got %', v; end if;

  -- B may NOT see A's row — direct targeted query returns 0.
  n := pg_temp.count_as(v_b,
    'select count(*)::int from public.member_settings'
    ' where profile_id = ''00000000-0000-0000-0000-0000000237aa''');
  if n <> 0 then raise exception 'expected B to see 0 rows for A, saw %', n; end if;

  -- B may NOT insert a row for C's profile_id → WITH CHECK denies it.
  -- C has no existing member_settings row, so the only blocker is the RLS
  -- with check (profile_id = (select auth.uid())) — not a PK collision.
  v := pg_temp.try_as(v_b, format($q$
    insert into public.member_settings (profile_id)
    values (%L)
  $q$, v_c));
  if v <> 'DENIED' then raise exception 'expected B to be DENIED inserting for C, got %', v; end if;

  raise notice 'probe_member_settings_rls: all assertions passed';
end $$;

rollback;
