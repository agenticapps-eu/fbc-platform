-- AGE-237 security follow-up — database-sentinel audit (2026-06-30).
--
-- `profiles_public` is meant to be a READ-ONLY projection of public profile columns,
-- readable by members. Two problems were found:
--
--  1) CRITICAL — write bypass. The view is auto-updatable (single base table,
--     simple projection), owned by `postgres`, with `security_invoker = off`. Writes
--     through it therefore execute as the owner, which bypasses `profiles` RLS
--     (`relforcerowsecurity = false`). Yet `anon` AND `authenticated` held
--     INSERT/UPDATE/DELETE on the view (default Supabase blanket grant). Result: any
--     anonymous visitor — or any logged-in member, including Discover — could modify or
--     delete real public profiles via PATCH/DELETE /rest/v1/profiles_public.
--
--  2) MEDIUM — anon read. `anon` held SELECT, exposing member name/company/region/bio
--     to logged-out visitors, contradicting the feed/Home name-masking. `fetchAuthors`
--     (src/lib/feed.ts) already falls back to "Mitglied" when it cannot read the view,
--     so the anonymous feed/Home keep rendering (authors stay masked as "Ein Mitglied").
--
-- Fix: the view is read-only and members-only.
--   - Revoke ALL write privileges from anon + authenticated.
--   - Revoke SELECT from anon (authenticated keeps SELECT for the directory/feed lookup).
-- service_role / postgres are unaffected (server-side).

revoke insert, update, delete, truncate, references, trigger
  on public.profiles_public from anon, authenticated;

revoke select on public.profiles_public from anon;

-- LOW (preventive) — `partners` carries a `contact` column and was anon-readable via
-- `partners_read_all USING(true)`. It is "Potential Ecosystem" (Level 2) data, 0 rows
-- today; restrict reads to authenticated before it is ever populated. RLS already
-- blocks anon writes (no permissive write policy). `partner_categories` stays public
-- (non-sensitive labels). (database-sentinel audit 2026-06-30.)
drop policy if exists partners_read_all on public.partners;
create policy partners_read_authenticated on public.partners
  for select to authenticated using (true);
