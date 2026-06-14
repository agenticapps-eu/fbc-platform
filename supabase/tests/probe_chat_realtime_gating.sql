-- Behavioural probe for the realtime chat gating (AGE-248, §9).
-- Self-contained; runs in a transaction and rolls back, leaving no data behind.
--
-- Builds a pair (A, B) with a contact_request and a bystander C, and asserts the
-- DB-enforced chat gating — independent of any client:
--   * BEFORE acceptance: a member cannot open a thread (threads_insert), and even
--     if a thread existed, a member cannot post a message (messages_insert).
--   * ON acceptance: the lifecycle trigger opens the thread; both participants can
--     post and read each other's messages.
--   * A non-participant (C) can neither read nor post in the thread.
--   * `messages` is in the supabase_realtime publication, so INSERTs actually fan
--     out over Realtime (without this, the UI's live updates never fire).
--
-- Mirrors the role-impersonation helpers of probe_routing_queue.sql.

begin;

insert into auth.users (id, aud, role, email) values
  ('00000000-0000-0000-0000-0000000248aa', 'authenticated', 'authenticated', 't248a@probe.fbc.invalid'),
  ('00000000-0000-0000-0000-0000000248bb', 'authenticated', 'authenticated', 't248b@probe.fbc.invalid'),
  ('00000000-0000-0000-0000-0000000248cc', 'authenticated', 'authenticated', 't248c@probe.fbc.invalid');

-- Prime tier is the UI gate; the RLS gates on participation + acceptance, not tier.
update public.profiles set tier = 'prime'
where id in (
  '00000000-0000-0000-0000-0000000248aa',
  '00000000-0000-0000-0000-0000000248bb',
  '00000000-0000-0000-0000-0000000248cc'
);

-- ── role-impersonation helpers (mirror supabase/tests/probe_routing_queue.sql) ──
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
  v_a       uuid := '00000000-0000-0000-0000-0000000248aa';
  v_b       uuid := '00000000-0000-0000-0000-0000000248bb';
  v_c       uuid := '00000000-0000-0000-0000-0000000248cc';
  v_thread  uuid;
  v_res     text;
begin
  -- A requests contact with B (match-less profile-page path → match_id null).
  -- Status defaults to 'pending'; the lifecycle trigger does NOT open a thread yet.
  insert into public.contact_requests (from_id, to_id, message)
  values (v_a, v_b, 'Hallo, lass uns sprechen');

  if exists (
    select 1 from public.message_threads
    where a_profile_id = least(v_a, v_b) and b_profile_id = greatest(v_a, v_b)
  ) then
    raise exception 'no thread should exist while the request is pending';
  end if;

  -- 1. BEFORE accept: a member cannot open a thread himself (threads_insert gate).
  v_res := pg_temp.try_as(v_a,
    'insert into public.message_threads (a_profile_id, b_profile_id) values ('''
    || least(v_a, v_b) || ''', ''' || greatest(v_a, v_b) || ''')');
  if v_res <> 'DENIED' then
    raise exception 'member must not open a thread before acceptance, got %', v_res;
  end if;

  -- Belt-and-suspenders: even if a thread DID exist while pending, a member could
  -- not post (messages_insert requires an accepted contact_request). Create the
  -- thread out-of-band (superuser → RLS bypassed) purely to probe the message gate.
  insert into public.message_threads (a_profile_id, b_profile_id)
  values (least(v_a, v_b), greatest(v_a, v_b))
  returning id into v_thread;

  v_res := pg_temp.try_as(v_a,
    'insert into public.messages (thread_id, sender_id, body) values ('''
    || v_thread || ''', ''' || v_a || ''', ''zu frueh'')');
  if v_res <> 'DENIED' then
    raise exception 'message INSERT must fail before acceptance, got %', v_res;
  end if;

  -- 2. ACCEPT (recipient B). Trigger reconciles the thread (on conflict do nothing).
  update public.contact_requests set status = 'accepted'
  where from_id = v_a and to_id = v_b;

  -- 3. AFTER accept: both participants can post.
  v_res := pg_temp.try_as(v_a,
    'insert into public.messages (thread_id, sender_id, body) values ('''
    || v_thread || ''', ''' || v_a || ''', ''hallo von A'')');
  if v_res <> 'OK' then raise exception 'A should be able to post after accept, got %', v_res; end if;

  v_res := pg_temp.try_as(v_b,
    'insert into public.messages (thread_id, sender_id, body) values ('''
    || v_thread || ''', ''' || v_b || ''', ''hallo von B'')');
  if v_res <> 'OK' then raise exception 'B should be able to post after accept, got %', v_res; end if;

  -- Both participants read the full conversation.
  if pg_temp.count_as(v_a, 'select count(*)::int from public.messages where thread_id = ''' || v_thread || '''') <> 2 then
    raise exception 'participant A should see both messages';
  end if;
  if pg_temp.count_as(v_b, 'select count(*)::int from public.messages where thread_id = ''' || v_thread || '''') <> 2 then
    raise exception 'participant B should see both messages';
  end if;

  -- 4. A non-participant (C) can neither read nor post.
  if pg_temp.count_as(v_c, 'select count(*)::int from public.messages where thread_id = ''' || v_thread || '''') <> 0 then
    raise exception 'non-participant C must not read the thread';
  end if;
  v_res := pg_temp.try_as(v_c,
    'insert into public.messages (thread_id, sender_id, body) values ('''
    || v_thread || ''', ''' || v_c || ''', ''eindringling'')');
  if v_res <> 'DENIED' then raise exception 'non-participant C must not post, got %', v_res; end if;

  -- 5. Realtime: messages must be in the supabase_realtime publication, else the
  --    live INSERT events never reach the client. (RED until 20260614140000.)
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    raise exception 'messages is not in the supabase_realtime publication — realtime will not fire';
  end if;

  raise notice 'probe_chat_realtime_gating: all assertions passed';
end $$;

rollback;
