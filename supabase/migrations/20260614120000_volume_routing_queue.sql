-- FBC/DKRI volume routing + manager queue (AGE-249). Spec: docs/matching-spec.md §8.
-- ADR: docs/decisions/0002-staff-roles-and-dkri-routing-queue.md.
--
-- The match engine (AGE-245) already stamps matches.routing ('dkri' when a driving
-- need's tx_volume_band is large, mirrors src/config/matching.ts DKRI_VOLUME_BANDS).
-- This migration adds the rest of §8:
--   1. contact_requests carry the same routing flag (so an Anfrage knows its lane).
--   2. Large (dkri) requests ALSO land in a thin manager queue (routing_queue) for
--      visibility — "statt direkter Freigabe". Phase 1 is queue/visibility only; the
--      real DKRI deal workflow (gating the release behind manager action) is Phase 2,
--      so the existing accept→thread flow is left intact and unchanged here.
--   3. A SERVER-CONTROLLED staff-role mechanism gates the queue + manager view.
--
-- ── Why a dedicated staff_roles table (NOT profiles.roles) ───────────────────
-- profiles.roles is member-writable free-text chips (grant update(roles) to
-- authenticated, 20260613073842) — a member could grant themselves 'admin'. It is a
-- DISPLAY descriptor, never an authorization source. staff_roles is provisioned out
-- of band (service_role / admin SQL); the client gets SELECT on its OWN row only and
-- NO write grant. The is_matching_manager() helper mirrors is_prime_plus() (AGE-235).
--
-- Forward-only. The queue is populated by the SECURITY DEFINER lifecycle trigger
-- (owner rights, bypasses RLS) exactly like the rest of the contact-request flow.

-- ── 1. Server-controlled staff roles ────────────────────────────────────────
create table public.staff_roles (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  role       text not null check (role in ('matching_manager', 'admin')),
  created_at timestamptz not null default now()
);
alter table public.staff_roles enable row level security;

-- A member may read their OWN staff row (UI gating). No write grant: staff is
-- provisioned by service_role / admin SQL, never from the client. Deny-by-default
-- covers INSERT/UPDATE/DELETE.
grant select on public.staff_roles to authenticated;
create policy staff_roles_select_self on public.staff_roles
  for select to authenticated
  using ( profile_id = (select auth.uid()) );

create or replace function public.is_matching_manager() returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select exists (
    select 1 from public.staff_roles
    where profile_id = (select auth.uid())
      and role in ('matching_manager', 'admin')
  );
$$;
comment on function public.is_matching_manager() is
  'True when the caller holds a matching_manager/admin staff role. Server-controlled '
  '(staff_roles, not the member-writable profiles.roles). Used by routing_queue RLS '
  'and exposed to the manager view. Mirrors is_prime_plus() (AGE-235).';

-- The routing_queue policies run as the querying role, so it needs EXECUTE; the
-- helper only ever reveals the caller's own manager standing, so REST exposure is harmless.
grant execute on function public.is_matching_manager() to authenticated;

-- ── 2. contact_requests carry the routing lane (§8) ──────────────────────────
alter table public.contact_requests
  add column routing text not null default 'fbc' check (routing in ('fbc', 'dkri'));
comment on column public.contact_requests.routing is
  'FBC/DKRI lane (§8), derived from the linked match on INSERT by '
  'set_contact_request_routing. ''fbc'' when no match.';

-- ── 3. Manager / deal queue (§8) ─────────────────────────────────────────────
create table public.routing_queue (
  id          uuid primary key default gen_random_uuid(),
  match_id    uuid not null references public.matches (id) on delete cascade,
  need_id     uuid references public.needs (id) on delete set null,
  volume_band text check (volume_band in ('lt_10k', '10k_100k', '100k_1m', '1m_10m', 'gt_10m')),
  routing     text not null default 'dkri' check (routing in ('fbc', 'dkri')),
  status      text not null default 'open' check (status in ('open', 'in_review', 'forwarded')),
  assigned_to uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  -- One queue entry per match → the lifecycle trigger upserts idempotently.
  constraint routing_queue_unique_match unique (match_id)
);
alter table public.routing_queue enable row level security;

create index routing_queue_status_idx      on public.routing_queue (status);
create index routing_queue_assigned_to_idx on public.routing_queue (assigned_to);

-- Queue is staff-only: read for managers, and they may move a case along
-- (status) or claim it (assigned_to). Rows are created ONLY by the lifecycle
-- trigger (no client INSERT/DELETE grant).
grant select, update (status, assigned_to) on public.routing_queue to authenticated;

create policy routing_queue_select_staff on public.routing_queue
  for select to authenticated
  using ( public.is_matching_manager() );

create policy routing_queue_update_staff on public.routing_queue
  for update to authenticated
  using ( public.is_matching_manager() )
  with check ( public.is_matching_manager() );

-- ── 4a. Derive the request's routing lane from its match (BEFORE INSERT) ──────
-- A BEFORE trigger is required to set NEW.routing on the row itself; the lifecycle
-- side-effects stay in the AFTER trigger below.
create or replace function public.set_contact_request_routing()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  if new.match_id is not null then
    select coalesce(m.routing, 'fbc') into new.routing
    from public.matches m where m.id = new.match_id;
  end if;
  new.routing := coalesce(new.routing, 'fbc');
  return new;
end;
$$;
comment on function public.set_contact_request_routing() is
  'BEFORE INSERT on contact_requests: copies the FBC/DKRI lane from the linked match '
  '(''fbc'' when no match). SECURITY DEFINER — reads matches, which the requester '
  'cannot select pair-spanning under RLS.';

revoke execute on function public.set_contact_request_routing() from public, anon, authenticated;

create trigger contact_requests_set_routing
  before insert on public.contact_requests
  for each row execute function public.set_contact_request_routing();

-- ── 4b. Route large (dkri) requests into the manager queue (lifecycle trigger) ─
-- Extends the AGE-247 lifecycle trigger with ONE block: on INSERT of a dkri request,
-- enqueue the case for the matching managers. Everything else is unchanged — the
-- normal accept→thread release still happens (Phase-1 = queue visibility only).
create or replace function public.handle_contact_request_change()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_from_name text;
  v_to_name   text;
  v_need_id   uuid;
  v_band      text;
begin
  if tg_op = 'INSERT' then
    -- New request → the originating match becomes 'requested'. Never downgrade an
    -- already-accepted pair; match_id is optional (profile-page requests may omit it).
    if new.match_id is not null then
      update public.matches
        set status = 'requested'
        where id = new.match_id and status = 'suggested';
    end if;

    -- §8: large-volume (dkri) requests land in the manager queue for visibility,
    -- in ADDITION to the normal flow. Resolve the driving large-volume need among
    -- the pair (prefer the largest band, then the newest). Idempotent per match.
    if new.routing = 'dkri' and new.match_id is not null then
      select n.id, n.tx_volume_band into v_need_id, v_band
      from public.needs n
      where n.profile_id in (new.from_id, new.to_id)
        and n.tx_volume_band in ('1m_10m', 'gt_10m')
      order by case n.tx_volume_band when 'gt_10m' then 2 else 1 end desc, n.created_at desc
      limit 1;

      insert into public.routing_queue (match_id, need_id, volume_band, routing)
      values (new.match_id, v_need_id, v_band, 'dkri')
      on conflict (match_id) do nothing;
    end if;

    select name into v_from_name from public.profiles where id = new.from_id;
    insert into public.notifications (profile_id, type, payload)
    values (
      new.to_id,
      'contact_request',
      jsonb_build_object(
        'request_id', new.id,
        'match_id',   new.match_id,
        'from_id',    new.from_id,
        'from_name',  v_from_name,
        'message',    new.message
      )
    );
    return new;
  end if;

  -- UPDATE: only react to an actual status change (e.g. accept / decline).
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    select name into v_to_name from public.profiles where id = new.to_id;

    if new.status = 'accepted' then
      if new.match_id is not null then
        update public.matches set status = 'accepted' where id = new.match_id;
      end if;
      -- Open the chat: create the (normalized, unique) thread if absent.
      insert into public.message_threads (a_profile_id, b_profile_id)
      values (least(new.from_id, new.to_id), greatest(new.from_id, new.to_id))
      on conflict (a_profile_id, b_profile_id) do nothing;

      insert into public.notifications (profile_id, type, payload)
      values (
        new.from_id,
        'contact_request_accepted',
        jsonb_build_object(
          'request_id', new.id, 'match_id', new.match_id,
          'to_id', new.to_id, 'to_name', v_to_name
        )
      );

    elsif new.status = 'declined' then
      -- Mirror onto the match, but never undo an acceptance.
      if new.match_id is not null then
        update public.matches set status = 'declined'
          where id = new.match_id and status <> 'accepted';
      end if;

      insert into public.notifications (profile_id, type, payload)
      values (
        new.from_id,
        'contact_request_declined',
        jsonb_build_object(
          'request_id', new.id, 'match_id', new.match_id,
          'to_id', new.to_id, 'to_name', v_to_name
        )
      );
    end if;
  end if;

  return new;
end;
$$;

comment on function public.handle_contact_request_change() is
  'AGE-247/AGE-249 contact-request lifecycle: on INSERT sets the originating match to '
  '''requested'', enqueues dkri requests into routing_queue (§8), and notifies the '
  'recipient; on status→accepted sets the match to ''accepted'', opens the message '
  'thread, and notifies the sender; on status→declined sets the match to ''declined'' '
  '(never undoing an acceptance) and notifies the sender. SECURITY DEFINER — writes '
  'matches/routing_queue/message_threads/notifications the two members cannot write '
  'under RLS. Contact data stays gated by contacts_select_self_or_released.';

-- ── 5. Enriched manager-queue read (§8 manager view) ─────────────────────────
-- The queue references match/need/profiles a manager NOT in the pair cannot read
-- under RLS (matches_select_participant, needs_select Prime+). This DEFINER RPC
-- returns the joined queue for managers only, mirroring the engine's deliberate
-- pair-spanning reads. Status/assignment changes go through the table's RLS-gated
-- UPDATE policy directly (no pair-spanning read needed there).
create or replace function public.list_routing_queue()
  returns table (
    id            uuid,
    match_id      uuid,
    status        text,
    routing       text,
    volume_band   text,
    score         int,
    member_a_name text,
    member_b_name text,
    need_category text,
    need_title    text,
    assigned_to   uuid,
    created_at    timestamptz
  )
  language sql
  stable
  security definer
  set search_path = public
as $$
  select
    q.id, q.match_id, q.status, q.routing, q.volume_band,
    m.score, pa.name, pb.name, n.category, n.title, q.assigned_to, q.created_at
  from public.routing_queue q
  join public.matches  m  on m.id = q.match_id
  join public.profiles pa on pa.id = m.a_profile_id
  join public.profiles pb on pb.id = m.b_profile_id
  left join public.needs n on n.id = q.need_id
  where public.is_matching_manager()
  order by q.created_at desc;
$$;
comment on function public.list_routing_queue() is
  'Manager-only enriched read of routing_queue (§8): joins each case to its match '
  'score, both members'' names and the driving need. Returns NOTHING for non-managers '
  '(is_matching_manager() guard in the WHERE). SECURITY DEFINER — reads pair-spanning '
  'rows RLS hides from a manager outside the pair.';

revoke execute on function public.list_routing_queue() from public, anon;
grant  execute on function public.list_routing_queue() to authenticated, service_role;
