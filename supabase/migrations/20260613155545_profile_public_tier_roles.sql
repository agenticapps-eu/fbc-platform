-- Extend profiles_public with tier + roles (AGE-239). Spec: docs/profile-spec.md §2.
-- The public profile page (AGE-239) renders Tier-Badge and Rollen as PUBLIC fields
-- (spec §2: visible to Discover), but the AGE-234 profiles_public projection omitted
-- them. This re-creates the view to expose tier + roles. Both are non-sensitive public
-- descriptors: tier is the membership level already shown as a badge across the app;
-- roles[] are the professional role chips the spec marks public. No PII added.
--
-- Kept SECURITY DEFINER (security_invoker = off), same rationale as AGE-235: the view
-- must serve the authenticated directory independent of the base-table RLS, which
-- reserves full-row access for own-profile or Prime+. Existing column order is
-- preserved; the two new columns are appended last (CREATE OR REPLACE VIEW requirement).
create or replace view public.profiles_public
  with (security_invoker = off) as
  select id, name, avatar_url, region, company, short_bio, tier, roles
  from public.profiles
  where is_public;

grant select on public.profiles_public to authenticated;

comment on view public.profiles_public is
  'Public directory projection (name, avatar_url, region, company, short_bio, tier, '
  'roles) of is_public profiles. SECURITY DEFINER by design: serves the authenticated '
  'directory independent of the base-table RLS, which reserves full/extended-field '
  'access for own-profile or Prime+. Only non-sensitive public columns are exposed.';
