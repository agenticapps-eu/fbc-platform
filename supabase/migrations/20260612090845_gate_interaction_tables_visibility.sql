-- Gate interaction tables on parent visibility (AGE-235, security follow-up).
--
-- 20260612082726 followed docs/rls-policies.md §7 literally: comments were readable
-- by any authenticated member (`using (true)`). That leaks comment bodies on posts
-- the member cannot see (e.g. a 'legacy'-visibility post readable only at rank >= 7),
-- contradicting the project's core rule that visibility is DB-enforced, not just a
-- frontend concern. Flagged by automated security review (MEDIUM — visibility bypass
-- via interaction table). The same bypass applies to the write side: a member could
-- like a post / register for an event they cannot see.
--
-- Fix: an interaction row is visible/writable only when its PARENT is visible to the
-- caller. We delegate to the parent's own RLS — `exists (select 1 from public.posts p
-- where p.id = ...)` is true only when posts' policies already let the caller see p —
-- so the tier logic stays in one place (posts/events) and cannot drift out of sync.

-- comments: readable only when the parent post is; insertable only on visible posts.
drop policy if exists comments_select_all on public.comments;
create policy comments_select_visible on public.comments
  for select to authenticated
  using ( exists (select 1 from public.posts p where p.id = comments.post_id) );

drop policy if exists comments_insert_own on public.comments;
create policy comments_insert_own on public.comments
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (select 1 from public.posts p where p.id = comments.post_id)
  );

-- post_likes: SELECT stays owner-only (already no cross-visibility leak); a like may
-- only be placed on a post the caller can see.
drop policy if exists likes_write_own on public.post_likes;
create policy likes_write_own on public.post_likes
  for all to authenticated
  using ( profile_id = (select auth.uid()) )
  with check (
    profile_id = (select auth.uid())
    and exists (select 1 from public.posts p where p.id = post_likes.post_id)
  );

-- event_registrations: a member may only register for an event they can see (SELECT
-- stays self-or-host via regs_select_self_or_host).
drop policy if exists regs_write_own on public.event_registrations;
create policy regs_write_own on public.event_registrations
  for all to authenticated
  using ( profile_id = (select auth.uid()) )
  with check (
    profile_id = (select auth.uid())
    and exists (select 1 from public.events e where e.id = event_registrations.event_id)
  );
