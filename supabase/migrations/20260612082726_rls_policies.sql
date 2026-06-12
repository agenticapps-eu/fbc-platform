-- P5 — RLS policies & tier-based visibility (AGE-235). Builds on the AGE-234 schema.
--
-- RLS is already ENABLED on every table (AGE-234); this migration adds the POLICIES
-- and the is_prime_plus() helper, and re-grants EXECUTE on current_tier_rank()
-- (revoked in 20260611171542 with the explicit note "P5 will grant exactly what its
-- policies require"). Spec: docs/rls-policies.md. Deny-by-default: any table/role/
-- command without a permissive policy is denied. service_role bypasses RLS.
--
-- Tier ranks (membership_tiers.level_rank): discover=1 explore=2 impuls=3 active=4
-- prime=5 circle=6 legacy=7. Prototype thresholds: directory / search profiles /
-- contact flow gate at rank >= 5 (Prime), via is_prime_plus().
--
-- ── Decisions / deviations from the literal spec (docs/rls-policies.md) ───────
--  * Directory exposure (spec §1 suggested anon): product decision is
--    AUTHENTICATED-ONLY. profiles_public is granted to `authenticated` only;
--    anon gets nothing. (Resolves the open question carried from AGE-234.)
--  * profiles INSERT (spec §1): NOT added. profiles rows are provisioned by the
--    SECURITY DEFINER signup trigger (handle_new_user); the foundation grants the
--    client no INSERT and the PK would always conflict, so a client-INSERT policy
--    would be dead surface. Kept trigger-only (least privilege).
--  * posts/events visibility (spec §7/§8 used one `to anon, authenticated` policy):
--    split into an anon policy (public only) + an authenticated policy. Same
--    visibility outcome, but anon never evaluates current_tier_rank(), so that
--    SECURITY DEFINER function need not be re-exposed to anon via PostgREST RPC.

-- ── 0. Tier helper + EXECUTE grants (spec §0) ────────────────────────────────
create or replace function public.is_prime_plus() returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select coalesce(public.current_tier_rank() >= 5, false);
$$;
comment on function public.is_prime_plus() is
  'True when the caller is logged in and at least Prime (level_rank >= 5). Used by P5 RLS.';

-- RLS policy expressions are evaluated as the querying role, so the role must hold
-- EXECUTE on functions a policy calls (SECURITY DEFINER changes whose rights the
-- BODY runs with, not who may invoke). Both functions only ever return the caller's
-- own tier standing, so re-exposure via /rest/v1/rpc is harmless.
--  * current_tier_rank(): called directly by the authenticated posts/events policies.
--  * is_prime_plus():     called by profiles/offers/needs/contact_requests policies.
grant execute on function public.current_tier_rank() to authenticated;
grant execute on function public.is_prime_plus()    to authenticated;

-- ── 1. profiles (spec §1) ────────────────────────────────────────────────────
-- Replace the foundation's "any authenticated sees every row/column" select policy:
-- the full table (incl. interests/competencies/goals) is now own-profile or Prime+.
drop policy if exists "profiles_select_authenticated" on public.profiles;

create policy profiles_select_self_or_prime on public.profiles
  for select to authenticated
  using ( id = (select auth.uid()) or public.is_prime_plus() );

-- profiles_update_own (foundation) already enforces id = auth.uid() for UPDATE and
-- matches the spec's profiles_update_self — left untouched. No client INSERT (above).

-- Column separation is done by the view: profiles_public exposes ONLY the public
-- columns. It must run as a DEFINER projection (security_invoker = off) so the
-- authenticated directory still returns every public profile to Discover members —
-- the base-table policy above otherwise restricts non-Prime members to their own row.
-- Members-only: granted to `authenticated`, not `anon`.
alter view public.profiles_public set (security_invoker = off);
comment on view public.profiles_public is
  'Public directory projection (name, avatar_url, region, company, short_bio) of '
  'is_public profiles. SECURITY DEFINER by design: serves the authenticated '
  'directory independent of the base-table RLS, which reserves full/extended-field '
  'access for own-profile or Prime+. Only non-sensitive public columns are exposed.';

-- ── 2. profile_contacts (spec §2) — contact data, only after release ─────────
-- Replace the foundation's owner-only select with owner-OR-accepted-counterparty.
-- Insert/update own policies (foundation) are kept; they match the spec's upsert_self.
drop policy if exists "profile_contacts_select_own" on public.profile_contacts;

create policy contacts_select_self_or_released on public.profile_contacts
  for select to authenticated
  using (
    profile_id = (select auth.uid())
    or exists (
      select 1 from public.contact_requests cr
      where cr.status = 'accepted'
        and (
          (cr.from_id = (select auth.uid()) and cr.to_id = profile_contacts.profile_id) or
          (cr.to_id   = (select auth.uid()) and cr.from_id = profile_contacts.profile_id)
        )
    )
  );

-- ── 3. offers / needs (spec §3) ──────────────────────────────────────────────
create policy offers_select on public.offers
  for select to authenticated
  using ( profile_id = (select auth.uid()) or public.is_prime_plus() );
create policy offers_write_own on public.offers
  for all to authenticated
  using ( profile_id = (select auth.uid()) ) with check ( profile_id = (select auth.uid()) );

create policy needs_select on public.needs
  for select to authenticated
  using ( profile_id = (select auth.uid()) or public.is_prime_plus() );
create policy needs_write_own on public.needs
  for all to authenticated
  using ( profile_id = (select auth.uid()) ) with check ( profile_id = (select auth.uid()) );

-- ── 4. matches (spec §4) — participants read only; created by service role ───
create policy matches_select_participant on public.matches
  for select to authenticated
  using ( a_profile_id = (select auth.uid()) or b_profile_id = (select auth.uid()) );
-- No INSERT/UPDATE policy: the match-engine (AGE-245) writes with service_role.

-- ── 5. contact_requests (spec §5) — contact flow ─────────────────────────────
create policy cr_insert_self_prime on public.contact_requests
  for insert to authenticated
  with check ( from_id = (select auth.uid()) and public.is_prime_plus() );

create policy cr_select_participants on public.contact_requests
  for select to authenticated
  using ( from_id = (select auth.uid()) or to_id = (select auth.uid()) );

-- Only the recipient may change status (accept/decline).
create policy cr_update_recipient on public.contact_requests
  for update to authenticated
  using ( to_id = (select auth.uid()) ) with check ( to_id = (select auth.uid()) );

-- ── 6. message_threads / messages (spec §6) — chat only after release ────────
create policy threads_select on public.message_threads
  for select to authenticated
  using ( a_profile_id = (select auth.uid()) or b_profile_id = (select auth.uid()) );

create policy threads_insert on public.message_threads
  for insert to authenticated
  with check (
    (a_profile_id = (select auth.uid()) or b_profile_id = (select auth.uid()))
    and exists (
      select 1 from public.contact_requests cr
      where cr.status = 'accepted'
        and (
          (cr.from_id = a_profile_id and cr.to_id = b_profile_id) or
          (cr.from_id = b_profile_id and cr.to_id = a_profile_id)
        )
    )
  );

create policy messages_select on public.messages
  for select to authenticated
  using ( exists (
    select 1 from public.message_threads t
    where t.id = messages.thread_id
      and ( t.a_profile_id = (select auth.uid()) or t.b_profile_id = (select auth.uid()) )
  ));

-- INSERT only by a thread participant, and only while the contact is accepted.
create policy messages_insert on public.messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and exists (
      select 1 from public.message_threads t
      join public.contact_requests cr
        on cr.status = 'accepted'
       and ( (cr.from_id = t.a_profile_id and cr.to_id = t.b_profile_id)
          or (cr.from_id = t.b_profile_id and cr.to_id = t.a_profile_id) )
      where t.id = messages.thread_id
        and ( t.a_profile_id = (select auth.uid()) or t.b_profile_id = (select auth.uid()) )
    )
  );

-- ── 7. posts / comments / post_likes (spec §7) — visibility × rank ───────────
create policy posts_select_public_anon on public.posts
  for select to anon
  using ( visibility = 'public' );

create policy posts_select_by_visibility on public.posts
  for select to authenticated
  using (
    visibility in ('public', 'members')
    or ( visibility = 'prime'  and coalesce(public.current_tier_rank(), 0) >= 5 )
    or ( visibility = 'legacy' and coalesce(public.current_tier_rank(), 0) >= 7 )
    or author_id = (select auth.uid())
  );

create policy posts_write_own on public.posts
  for all to authenticated
  using ( author_id = (select auth.uid()) ) with check ( author_id = (select auth.uid()) );

-- comments/post_likes: members only; write your own (spec §7).
create policy comments_select_all on public.comments
  for select to authenticated using ( true );
create policy comments_insert_own on public.comments
  for insert to authenticated with check ( author_id = (select auth.uid()) );

create policy likes_write_own on public.post_likes
  for all to authenticated
  using ( profile_id = (select auth.uid()) ) with check ( profile_id = (select auth.uid()) );

-- ── 8. events / event_registrations (spec §8) ───────────────────────────────
create policy events_select_public_anon on public.events
  for select to anon
  using ( visibility = 'public' );

create policy events_select_by_visibility on public.events
  for select to authenticated
  using (
    visibility in ('public', 'members')
    or ( visibility = 'prime'  and coalesce(public.current_tier_rank(), 0) >= 5 )
    or ( visibility = 'legacy' and coalesce(public.current_tier_rank(), 0) >= 7 )
    or host_id = (select auth.uid())
  );

create policy events_write_host on public.events
  for all to authenticated
  using ( host_id = (select auth.uid()) ) with check ( host_id = (select auth.uid()) );

-- Registrations: your own; a host sees registrations for their events.
create policy regs_select_self_or_host on public.event_registrations
  for select to authenticated
  using (
    profile_id = (select auth.uid())
    or exists ( select 1 from public.events e
                where e.id = event_registrations.event_id and e.host_id = (select auth.uid()) )
  );
create policy regs_write_own on public.event_registrations
  for all to authenticated
  using ( profile_id = (select auth.uid()) ) with check ( profile_id = (select auth.uid()) );

-- ── 9. Stammdaten & Partner (spec §9) — reference data, readable by all ──────
create policy tiers_read_all on public.membership_tiers
  for select to anon, authenticated using ( true );
create policy partner_cat_read_all on public.partner_categories
  for select to anon, authenticated using ( true );
create policy partners_read_all on public.partners
  for select to anon, authenticated using ( true );
-- Partners get NO policy on profiles/offers/needs/matches/contact_requests: they
-- read only public content (and, later, their own events/content).

-- ── 10. feedback / notifications (spec §10) — own rows only ──────────────────
create policy feedback_own on public.feedback
  for all to authenticated
  using ( profile_id = (select auth.uid()) ) with check ( profile_id = (select auth.uid()) );

create policy notifications_own on public.notifications
  for all to authenticated
  using ( profile_id = (select auth.uid()) ) with check ( profile_id = (select auth.uid()) );
