-- Behavioural probe for FBC/DKRI volume routing + manager queue (AGE-249, §8).
-- Self-contained; runs in a transaction and rolls back, leaving no data behind.
--
-- Builds a dkri pair (A needs investoren @ gt_10m ↔ B offers kapital), runs the
-- match engine, sends a contact request, and asserts:
--   * the request is stamped routing='dkri' (set_contact_request_routing, BEFORE INSERT);
--   * the lifecycle trigger enqueued exactly one routing_queue row for the match,
--     with the driving need, volume_band gt_10m, routing dkri, status open;
--   * routing_queue RLS: a matching_manager sees the row, a plain member sees none;
--   * a plain member's UPDATE is a no-op (RLS), a manager's status/assign change sticks.

begin;

insert into auth.users (id, aud, role, email) values
  ('00000000-0000-0000-0000-0000000249aa', 'authenticated', 'authenticated', 't249a@probe.fbc.invalid'),
  ('00000000-0000-0000-0000-0000000249bb', 'authenticated', 'authenticated', 't249b@probe.fbc.invalid'),
  ('00000000-0000-0000-0000-0000000249mm', 'authenticated', 'authenticated', 't249m@probe.fbc.invalid');

-- Shared scoring attributes so the engine yields a match ≥ 40 (mirrors probe_match_engine).
update public.profiles set
  region = 'Stuttgart', branche = 'Finanzen', tier = 'prime', interests = array['finanzen']
where id in ('00000000-0000-0000-0000-0000000249aa', '00000000-0000-0000-0000-0000000249bb');

-- A: needs investoren at a LARGE volume (gt_10m → dkri). B: offers kapital.
insert into public.needs (profile_id, category, theme, title, tx_volume_band)
  values ('00000000-0000-0000-0000-0000000249aa', 'investoren', 'haben', 'Suche Großinvestor', 'gt_10m');
insert into public.offers (profile_id, category, theme, title)
  values ('00000000-0000-0000-0000-0000000249bb', 'kapital', 'haben', 'Biete Kapital');

-- Engine builds the A↔B match (service/migration context: auth.uid() is null → allowed).
select public.generate_matches_for('00000000-0000-0000-0000-0000000249aa');

-- ── role-impersonation helpers (mirror supabase/tests/probe_compass_responses_rls.sql) ──
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
  v_a       uuid := '00000000-0000-0000-0000-0000000249aa';
  v_b       uuid := '00000000-0000-0000-0000-0000000249bb';
  v_m       uuid := '00000000-0000-0000-0000-0000000249mm';
  v_match   uuid;
  v_need    uuid;
  v_routing text;
  v_qstatus text;
  v_qband   text;
  v_qneed   uuid;
  v_qcount  int;
  v_res     text;
begin
  select id into v_match from public.matches
    where least(a_profile_id, b_profile_id) = least(v_a, v_b)
      and greatest(a_profile_id, b_profile_id) = greatest(v_a, v_b);
  if v_match is null then raise exception 'precondition: no A<->B match produced'; end if;
  if (select routing from public.matches where id = v_match) <> 'dkri' then
    raise exception 'precondition: match routing should be dkri';
  end if;
  select id into v_need from public.needs where profile_id = v_a;

  -- A sends a contact request on the dkri match (superuser → RLS bypassed; triggers fire).
  insert into public.contact_requests (from_id, to_id, match_id, message)
  values (v_a, v_b, v_match, 'Interesse an Zusammenarbeit');

  -- 1. the request carries the dkri lane (BEFORE INSERT trigger).
  select routing into v_routing from public.contact_requests where from_id = v_a and to_id = v_b;
  if v_routing <> 'dkri' then raise exception 'expected request routing dkri, got %', v_routing; end if;

  -- 2. exactly one queue row for the match, with the driving need + band + open status.
  select count(*)::int into v_qcount from public.routing_queue where match_id = v_match;
  if v_qcount <> 1 then raise exception 'expected 1 queue row, got %', v_qcount; end if;
  select status, volume_band, need_id into v_qstatus, v_qband, v_qneed
    from public.routing_queue where match_id = v_match;
  if v_qstatus <> 'open'   then raise exception 'expected queue status open, got %', v_qstatus; end if;
  if v_qband   <> 'gt_10m' then raise exception 'expected queue band gt_10m, got %', v_qband; end if;
  if v_qneed is distinct from v_need then raise exception 'expected queue need_id %, got %', v_need, v_qneed; end if;

  -- Promote M to matching_manager (server-side provisioning — no client path).
  insert into public.staff_roles (profile_id, role) values (v_m, 'matching_manager');

  -- 3. RLS: manager sees the queue, plain members do not.
  if pg_temp.count_as(v_m, 'select count(*)::int from public.routing_queue') <> 1 then
    raise exception 'manager should see the queue row';
  end if;
  if pg_temp.count_as(v_a, 'select count(*)::int from public.routing_queue') <> 0 then
    raise exception 'plain member A must not see the queue';
  end if;
  if pg_temp.count_as(v_b, 'select count(*)::int from public.routing_queue') <> 0 then
    raise exception 'plain member B must not see the queue';
  end if;

  -- 4a. A's UPDATE is a no-op (row invisible under RLS → 0 rows changed, status unchanged).
  perform pg_temp.try_as(v_a,
    'update public.routing_queue set status = ''forwarded'' where match_id = ''' || v_match || '''');
  if (select status from public.routing_queue where match_id = v_match) <> 'open' then
    raise exception 'plain member A must not be able to change queue status';
  end if;

  -- 4b. Manager moves the case along + claims it → sticks.
  v_res := pg_temp.try_as(v_m,
    'update public.routing_queue set status = ''in_review'', assigned_to = ''' || v_m
    || ''' where match_id = ''' || v_match || '''');
  if v_res <> 'OK' then raise exception 'manager update should succeed, got %', v_res; end if;
  if (select status from public.routing_queue where match_id = v_match) <> 'in_review' then
    raise exception 'manager status change should persist';
  end if;
  if (select assigned_to from public.routing_queue where match_id = v_match) <> v_m then
    raise exception 'manager assign should persist';
  end if;

  raise notice 'probe_routing_queue: all assertions passed';
end $$;

rollback;
