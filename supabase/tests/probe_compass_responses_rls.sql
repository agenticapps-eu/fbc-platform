-- Behavioural probe for compass_responses RLS (AGE-243). Self-contained: creates
-- two members, then verifies the own-row policies added in
-- 20260613233000_compass_responses_rls.sql:
--   * a member may INSERT and SELECT their OWN compass_responses;
--   * a member may NOT SELECT another member's rows (RLS filters them out);
--   * a member may NOT INSERT a row for another profile_id (WITH CHECK denies it).
-- Runs in a transaction and rolls back, leaving no data behind.
--
-- RLS only engages for a non-owner role, so sensitive ops run as `authenticated`
-- with the member's JWT sub (helpers below), while assertions run as the test role.

begin;

insert into auth.users (id, aud, role, email) values
  ('00000000-0000-0000-0000-0000000243aa', 'authenticated', 'authenticated', 't243a@probe.fbc.invalid'),
  ('00000000-0000-0000-0000-0000000243bb', 'authenticated', 'authenticated', 't243b@probe.fbc.invalid');

-- Seed one row for B (as the superuser test role → bypasses RLS) so A's
-- cross-tenant SELECT has something it must NOT see.
insert into public.compass_responses (profile_id, theme, answers)
values ('00000000-0000-0000-0000-0000000243bb', 'sein', '{"rating": 7}'::jsonb);

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
  v_a uuid := '00000000-0000-0000-0000-0000000243aa';
  v_b uuid := '00000000-0000-0000-0000-0000000243bb';
  v text;
  n int;
begin
  -- A inserts its OWN row → allowed.
  v := pg_temp.try_as(v_a, $q$
    insert into public.compass_responses (profile_id, theme, answers)
    values ('00000000-0000-0000-0000-0000000243aa', 'tun', '{"rating": 5}'::jsonb)
  $q$);
  if v <> 'OK' then raise exception 'expected A to insert own row, got %', v; end if;

  -- A sees only its OWN row (1), not B's.
  n := pg_temp.count_as(v_a, 'select count(*)::int from public.compass_responses');
  if n <> 1 then raise exception 'expected A to see exactly 1 own row, saw %', n; end if;

  -- A may NOT insert a row for B's profile_id → WITH CHECK denies it.
  v := pg_temp.try_as(v_a, $q$
    insert into public.compass_responses (profile_id, theme, answers)
    values ('00000000-0000-0000-0000-0000000243bb', 'haben', '{"rating": 1}'::jsonb)
  $q$);
  if v <> 'DENIED' then raise exception 'expected A to be DENIED inserting for B, got %', v; end if;

  -- B still sees only its own seeded row (1), unaffected by A.
  n := pg_temp.count_as(v_b, 'select count(*)::int from public.compass_responses');
  if n <> 1 then raise exception 'expected B to see exactly 1 own row, saw %', n; end if;

  raise notice 'probe_compass_responses_rls: all assertions passed';
end $$;

rollback;
