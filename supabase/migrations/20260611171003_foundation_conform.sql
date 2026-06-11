-- Conform the merged foundation to the binding P4 spec (AGE-234). Forward-only.
-- See docs/data-model.md and docs/decisions/0001-conform-data-model-to-p4.md.

-- ── 1. membership_tiers (P4 §1) ──────────────────────────────────────────────
create table public.membership_tiers (
  key        text primary key,
  label      text not null,
  price_year int  not null,
  level_rank int  not null unique
);
comment on table public.membership_tiers is
  'Membership tiers (P4 §1). level_rank ascends discover=1 … legacy=7.';

insert into public.membership_tiers (key, label, price_year, level_rank) values
  ('discover', 'Discover', 0,    1),
  ('explore',  'Explore',  150,  2),
  ('impuls',   'Impuls',   300,  3),
  ('active',   'Active',   600,  4),
  ('prime',    'Prime',    1200, 5),
  ('circle',   'Circle',   2400, 6),
  ('legacy',   'Legacy',   4800, 7);

alter table public.membership_tiers enable row level security;
-- No policies: deferred to P5/AGE-235. service_role bypasses RLS.

-- ── 2. profiles: add P4 columns ──────────────────────────────────────────────
alter table public.profiles
  add column name               text,
  add column region             text,
  add column branche            text,
  add column short_bio          text,
  add column tier               text    not null default 'discover',
  add column potential_score    int     not null default 0,
  add column profile_completion int     not null default 0,
  add column is_public          boolean not null default true,
  add column interests          text[],
  add column competencies       text[],
  add column goals              text,
  add column website            text,
  add column socials            jsonb;

-- migrate data from the diverging foundation columns
update public.profiles set
  name      = display_name,
  short_bio = bio,
  tier      = membership_level::text;

-- tier → membership_tiers(key)
alter table public.profiles
  add constraint profiles_tier_fkey foreign key (tier)
    references public.membership_tiers (key);

-- drop diverging / misplaced columns
alter table public.profiles
  drop column display_name,
  drop column headline,
  drop column bio,
  drop column membership_level,
  drop column potential_level,
  drop column tx_volume_band,
  drop column routing_target;

comment on column public.profiles.tier is
  'FK → membership_tiers(key). Client-immutable; only service_role/admin may change it.';
comment on column public.profiles.potential_score is
  'Rule-based potential (AGE-242); server-maintained, not client-writable.';
comment on column public.profiles.profile_completion is
  '0–100 completeness; server-maintained, not client-writable.';

-- drop now-unused PG enums (P4 §0 prefers text+check)
drop type public.membership_level;
drop type public.routing_target;

-- ── 3. profile_contacts: website moves to profiles ───────────────────────────
alter table public.profile_contacts drop column website;

-- ── 4. refresh client UPDATE grant to the new editable column set ────────────
-- tier / potential_score / profile_completion stay server/admin-only.
revoke update on public.profiles from authenticated;
grant update (name, avatar_url, region, company, short_bio, branche,
              is_public, interests, competencies, goals, website, socials)
  on public.profiles to authenticated;

-- ── 5. signup trigger inserts P4 columns ─────────────────────────────────────
create or replace function public.handle_new_user() returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  insert into public.profiles (id, name, tier)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    'discover'
  );
  return new;
end;
$$;
-- keep trigger-only fn off the API surface (re-assert after replace)
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ── 6. profiles_public view (P4 §8) ──────────────────────────────────────────
create or replace view public.profiles_public
  with (security_invoker = on) as
  select id, name, avatar_url, region, company, short_bio
  from public.profiles
  where is_public;
grant select on public.profiles_public to authenticated;
-- anon/public exposure of the directory is a P5/AGE-235 policy decision.

-- ── 7. current_tier_rank() (P4 §8; used by P5 RLS) ───────────────────────────
create or replace function public.current_tier_rank() returns int
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select t.level_rank
  from public.profiles p
  join public.membership_tiers t on t.key = p.tier
  where p.id = (select auth.uid());
$$;
revoke execute on function public.current_tier_rank() from public, anon;
grant execute on function public.current_tier_rank() to authenticated;

-- ── 8. indexes (P4 §9) ───────────────────────────────────────────────────────
create index profiles_tier_idx        on public.profiles (tier);
create index profiles_region_idx      on public.profiles (region);
create index profiles_branche_idx     on public.profiles (branche);
create index profiles_interests_gin   on public.profiles using gin (interests);
create index profiles_competencies_gin on public.profiles using gin (competencies);
