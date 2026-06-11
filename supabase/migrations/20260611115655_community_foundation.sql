-- FBC Community (Ebene 1) — foundational data model: membership tiers + profiles.
--
-- Visibility model (enforced here in the DB, not just the client):
--   * The member directory (Verzeichnis) = basic profile fields, readable by ANY
--     authenticated member. Tiers gate capabilities/reach, not basic existence.
--   * Contact data lives in a separate table and is OWNER-ONLY. It is never
--     disclosed implicitly; explicit consent-based sharing is a later feature.
--   * membership_level is client-immutable (no privilege escalation): only
--     service_role/admin may change a member's tier.
--
-- Levels 2 (Potential Ecosystem) and 3 (DKRI) are prepared structurally (the
-- enum is extendable, profiles/RLS are tier-aware) but not implemented here.

-- ── Membership levels (ascending rights/visibility) ──────────────────────────
create type public.membership_level as enum ('discover', 'prime', 'legacy');

-- ── Profiles (1:1 with auth.users) ───────────────────────────────────────────
create table public.profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  display_name     text,
  headline         text,
  bio              text,
  company          text,
  avatar_url       text,
  membership_level public.membership_level not null default 'discover',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table public.profiles is
  'FBC member profiles (Community / Ebene 1). Basic fields form the public directory (Verzeichnis), readable by any authenticated member.';
comment on column public.profiles.membership_level is
  'Discover < Prime < Legacy. Governs capabilities/visibility. Client-immutable; only service_role/admin may change it.';

-- ── Contact data (owner-only; never auto-disclosed) ──────────────────────────
create table public.profile_contacts (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  email      text,
  phone      text,
  website    text,
  updated_at timestamptz not null default now()
);

comment on table public.profile_contacts is
  'Contact details, kept separate from profiles so RLS keeps them owner-only. Disclosure to other members requires an explicit (future) consent action — never implicit.';

-- ── updated_at maintenance ───────────────────────────────────────────────────
create function public.set_updated_at() returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger profile_contacts_set_updated_at
  before update on public.profile_contacts
  for each row execute function public.set_updated_at();

-- ── Auto-provision a profile on signup ───────────────────────────────────────
create function public.handle_new_user() returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Privileges: identity + tier columns are not client-writable ──────────────
-- Reset Supabase's default grants, then grant precisely. `authenticated` may
-- read the directory and edit only its own descriptive fields; id, created_at
-- and membership_level are excluded so the client cannot change them. Profiles
-- are inserted by the SECURITY DEFINER signup trigger, so no client INSERT.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, headline, bio, company, avatar_url)
  on public.profiles to authenticated;

revoke all on public.profile_contacts from anon, authenticated;
grant select, insert, update on public.profile_contacts to authenticated;

-- ── Row Level Security ───────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.profile_contacts enable row level security;

-- profiles: directory open to authenticated members; write only your own row.
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- profile_contacts: strictly owner-only (no cross-member visibility).
create policy "profile_contacts_select_own"
  on public.profile_contacts for select
  to authenticated
  using ((select auth.uid()) = profile_id);

create policy "profile_contacts_insert_own"
  on public.profile_contacts for insert
  to authenticated
  with check ((select auth.uid()) = profile_id);

create policy "profile_contacts_update_own"
  on public.profile_contacts for update
  to authenticated
  using ((select auth.uid()) = profile_id)
  with check ((select auth.uid()) = profile_id);
