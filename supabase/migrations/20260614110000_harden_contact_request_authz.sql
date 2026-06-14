-- Harden contact_requests authorization (AGE-247 security fix; /cso CRITICAL).
--
-- Problem: cr_update_recipient's WITH CHECK pinned only to_id, and `authenticated`
-- held a table-wide UPDATE grant. Postgres RLS cannot see OLD in WITH CHECK, so a
-- recipient could rewrite from_id/match_id on a request sent to them and set
-- status='accepted'. contacts_select_self_or_released then releases an ARBITRARY
-- member's contact data (and the lifecycle trigger opens a thread / mutates an
-- unrelated match). cr_insert_self_prime also never pinned status, so a Prime+
-- member could INSERT a row already 'accepted' (from_id=self, to_id=victim) and
-- harvest the victim's contacts directly. Both defeat the core invariant:
-- contact data is never released without an actual mutual, consented acceptance.
--
-- Fix, two independent layers:
--   1. Column privilege — a member may UPDATE only the `status` column. Rewriting
--      from_id/to_id/match_id/message is denied at the privilege layer. The
--      SECURITY DEFINER lifecycle + webhook triggers run as owner, so they are
--      unaffected (they need no `authenticated` grant).
--   2. RLS transition pinning — INSERT must be 'pending' with a match_id that
--      actually belongs to the pair; UPDATE only flips a 'pending' row the
--      recipient owns to 'accepted'/'declined'. No re-accept flip-flops, no
--      forged-pair acceptance.

-- ── 1. Column-level UPDATE: status only ──────────────────────────────────────
revoke update on public.contact_requests from authenticated;
grant update (status) on public.contact_requests to authenticated;

-- ── 2a. Recipient may only flip a pending request to accepted/declined ───────
drop policy if exists cr_update_recipient on public.contact_requests;
create policy cr_update_recipient on public.contact_requests
  for update to authenticated
  using ( to_id = (select auth.uid()) and status = 'pending' )
  with check ( to_id = (select auth.uid()) and status in ('accepted', 'declined') );

-- ── 2b. Sender inserts a pending request; match_id must belong to the pair ────
drop policy if exists cr_insert_self_prime on public.contact_requests;
create policy cr_insert_self_prime on public.contact_requests
  for insert to authenticated
  with check (
    from_id = (select auth.uid())
    and public.is_prime_plus()
    and status = 'pending'
    and (
      match_id is null
      or exists (
        select 1 from public.matches m
        where m.id = match_id
          and (
            (m.a_profile_id = from_id and m.b_profile_id = to_id) or
            (m.a_profile_id = to_id and m.b_profile_id = from_id)
          )
      )
    )
  );

comment on policy cr_update_recipient on public.contact_requests is
  'AGE-247: recipient may only flip a pending request to accepted/declined. '
  'Column-level UPDATE is restricted to `status` so from_id/to_id/match_id/message '
  'cannot be rewritten — closes the contact-data-disclosure path.';
comment on policy cr_insert_self_prime on public.contact_requests is
  'AGE-247: a Prime+ sender inserts only a pending request for themselves, and '
  'only with a match_id that belongs to the (from_id,to_id) pair.';
