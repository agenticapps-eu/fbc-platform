-- Directory search & filters (AGE-241). Server-side full-text + faceted search for
-- the Prime+ member directory. Spec: docs/design-system.md §5/§6, docs/data-model.md §8/§9.
--
-- The directory is Prime+ only, and visibility is enforced by RLS — not the client:
-- profiles_select_self_or_prime (AGE-235) returns full profile rows ONLY for the own
-- profile or Prime+. search_directory() is SECURITY INVOKER, so a Discover (or anon)
-- caller sees at most their own row — never other members. The Community "Verzeichnis"
-- tab is additionally hidden below Prime in the UI (comfort only, not the boundary).
--
-- Forward-only. Adds:
--   1. profiles.search_doc — generated german tsvector over the searchable columns.
--   2. GIN index on search_doc + btree on region (branche already indexed in AGE-234).
--   3. search_directory(...) RPC: full-text query + facet filters, RLS-respecting.

-- ── 1. Full-text document (generated, stored) ────────────────────────────────
-- array_to_string() is only STABLE (its volatility is generic across element types),
-- so an inline generated expression using it is rejected as non-immutable (42P17).
-- For text[] inputs the conversion is in fact deterministic, so we wrap the document
-- build in an IMMUTABLE helper — the supported pattern for tsvector generated columns.
create or replace function public.fbc_profile_search_doc(
  p_name         text,
  p_company      text,
  p_branche      text,
  p_short_bio    text,
  p_headline     text,
  p_roles        text[],
  p_competencies text[],
  p_interests    text[]
)
returns tsvector
language sql
immutable
set search_path = ''
as $$
  select to_tsvector(
    'german',
    coalesce(p_name, '') || ' ' ||
    coalesce(p_company, '') || ' ' ||
    coalesce(p_branche, '') || ' ' ||
    coalesce(p_short_bio, '') || ' ' ||
    coalesce(p_headline, '') || ' ' ||
    coalesce(array_to_string(p_roles, ' '), '') || ' ' ||
    coalesce(array_to_string(p_competencies, ' '), '') || ' ' ||
    coalesce(array_to_string(p_interests, ' '), '')
  );
$$;

comment on function public.fbc_profile_search_doc is
  'IMMUTABLE builder for profiles.search_doc (german tsvector). Wraps array_to_string '
  '(STABLE in general, deterministic for text[]) so it can drive a generated column.';

alter table public.profiles
  add column search_doc tsvector generated always as (
    public.fbc_profile_search_doc(
      name, company, branche, short_bio, headline, roles, competencies, interests
    )
  ) stored;

comment on column public.profiles.search_doc is
  'Generated german tsvector over name/company/branche/short_bio/headline/roles/'
  'competencies/interests. Powers the Prime+ directory full-text search '
  '(search_directory). GIN-indexed.';

-- ── 2. Indexes (sensible indexing per DoD) ───────────────────────────────────
create index profiles_search_doc_gin on public.profiles using gin (search_doc);
create index if not exists profiles_region_idx on public.profiles (region);

-- ── 3. Directory search RPC ──────────────────────────────────────────────────
-- SECURITY INVOKER (default): the caller's RLS decides which profile rows are visible.
-- All filters are optional (null/'' = no filter). p_theme matches a member active in
-- that theme via any offer / need / interest. p_offering: 'offers' = bietet, 'needs' =
-- sucht. Only is_public members are listed (members who opted out stay hidden).
create or replace function public.search_directory(
  p_query      text default null,
  p_theme      text default null,
  p_branche    text default null,
  p_region     text default null,
  p_competency text default null,
  p_offering   text default null
)
returns table (
  id           uuid,
  name         text,
  avatar_url   text,
  region       text,
  company      text,
  short_bio    text,
  branche      text,
  tier         text,
  roles        text[],
  competencies text[],
  has_offers   boolean,
  has_needs    boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    p.id, p.name, p.avatar_url, p.region, p.company, p.short_bio,
    p.branche, p.tier, p.roles, p.competencies,
    exists (select 1 from public.offers o where o.profile_id = p.id) as has_offers,
    exists (select 1 from public.needs  n where n.profile_id = p.id) as has_needs
  from public.profiles p
  where p.is_public
    and (p_query is null or p_query = ''
         or p.search_doc @@ websearch_to_tsquery('german', p_query))
    and (p_branche is null or p_branche = '' or p.branche = p_branche)
    and (p_region is null or p_region = '' or p.region = p_region)
    and (p_competency is null or p_competency = '' or p.competencies @> array[p_competency])
    and (p_theme is null or p_theme = '' or exists (
           select 1 from public.offers o where o.profile_id = p.id and o.theme = p_theme
           union all
           select 1 from public.needs n where n.profile_id = p.id and n.theme = p_theme
           union all
           select 1 from public.profile_interests pi
             where pi.profile_id = p.id and pi.theme = p_theme
         ))
    and (p_offering is null or p_offering = ''
         or (p_offering = 'offers' and exists (select 1 from public.offers o where o.profile_id = p.id))
         or (p_offering = 'needs'  and exists (select 1 from public.needs  n where n.profile_id = p.id)))
  order by p.name nulls last;
$$;

comment on function public.search_directory is
  'Prime+ member-directory search: german full-text (search_doc) + facet filters '
  '(theme/branche/region/competency, bietet/sucht). SECURITY INVOKER — RLS '
  '(profiles_select_self_or_prime) is the visibility boundary; Discover/anon see at '
  'most their own row. Lists only is_public profiles.';

-- Authenticated callers only; RLS still gates the rows. anon gets no execute grant.
revoke all on function public.search_directory(text, text, text, text, text, text) from public;
grant execute on function public.search_directory(text, text, text, text, text, text) to authenticated;
