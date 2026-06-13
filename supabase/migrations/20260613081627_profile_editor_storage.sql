-- Profile editor: avatar storage bucket + server-side profile_completion (AGE-238).
-- Spec: docs/profile-spec.md §6. Builds on 20260613073842_profile_extension.sql.
--
-- Two concerns, both required by the editor's DoD:
--   1. `avatars` storage bucket so members can upload a profile picture
--      (profiles.avatar_url points at it). The bucket is PUBLIC — objects render
--      via their public URL without any storage.objects SELECT policy, so we
--      deliberately add no read policy (a broad SELECT policy would only enable
--      listing every file; see Supabase linter 0025). Writes are restricted to
--      the caller's own `{uid}/…` folder via RLS, not client trust.
--   2. profile_completion is server-managed (NOT in the client UPDATE grant,
--      same protection as tier/potential_score). A BEFORE INSERT/UPDATE trigger
--      recomputes it from the profile row on every write, so it "aktualisiert
--      sich" (§6) without the client ever writing it. The editor mirrors the
--      same formula client-side for live feedback (see src/lib/profile.ts).

-- ── 1. avatars storage bucket (public; write only into your own folder) ──────
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- The editor uploads to `{uid}/{timestamp}.webp`; the first path segment must
-- equal auth.uid(). No SELECT policy — the public bucket serves object URLs to all.
create policy avatars_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy avatars_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy avatars_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- ── 2. profile_completion trigger ────────────────────────────────────────────
-- 12 profile-row fields, equally weighted; percent = filled * 100 / 12 (integer
-- division). ≥ 80 % ("vollständig") is reached at 10/12 filled (10*100/12 = 83).
-- Interests/goals live in their own tables and are intentionally excluded so the
-- trigger stays a pure single-row computation the client mirror can match exactly.
create or replace function public.set_profile_completion()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  new.profile_completion := (
      (nullif(btrim(coalesce(new.name, '')), '')       is not null)::int
    + (nullif(btrim(coalesce(new.avatar_url, '')), '') is not null)::int
    + (nullif(btrim(coalesce(new.region, '')), '')     is not null)::int
    + (nullif(btrim(coalesce(new.company, '')), '')    is not null)::int
    + (nullif(btrim(coalesce(new.short_bio, '')), '')  is not null)::int
    + (nullif(btrim(coalesce(new.branche, '')), '')    is not null)::int
    + (nullif(btrim(coalesce(new.headline, '')), '')   is not null)::int
    + (coalesce(array_length(new.roles, 1), 0) > 0)::int
    + (coalesce(array_length(new.competencies, 1), 0) > 0)::int
    + (nullif(btrim(coalesce(new.website, '')), '')    is not null)::int
    + (nullif(btrim(coalesce(new.dev_focus, '')), '')  is not null)::int
    + (new.socials is not null and new.socials <> '{}'::jsonb)::int
  ) * 100 / 12;
  return new;
end;
$$;

-- Trigger-only function: keep it off the API surface (mirrors set_updated_at hardening).
revoke execute on function public.set_profile_completion() from public, anon, authenticated;

create trigger trg_profiles_completion
  before insert or update on public.profiles
  for each row execute function public.set_profile_completion();

-- Backfill existing rows so stored completion matches the formula (no-op UPDATE
-- fires the trigger). updated_at is also touched, which is acceptable here.
update public.profiles set id = id;
