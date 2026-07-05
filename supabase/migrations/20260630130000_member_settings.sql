-- member_settings — 1:1 mit profiles. Benachrichtigungs- & Sichtbarkeits-
-- Präferenzen. Strikt own-profile (read + write), nie Prime+, nie public.
create table public.member_settings (
  profile_id              uuid primary key references public.profiles (id) on delete cascade,
  notify_email_requests   boolean not null default true,
  notify_email_events     boolean not null default true,
  notify_email_digest     boolean not null default false,
  visible_in_directory    boolean not null default true,
  contactable_by_prime    boolean not null default true,
  updated_at              timestamptz not null default now()
);

comment on table public.member_settings is
  'Per-member notification + visibility preferences. Strictly own-profile only.';

revoke all on public.member_settings from anon, authenticated;
grant select, insert, update on public.member_settings to authenticated;

alter table public.member_settings enable row level security;

create policy member_settings_own on public.member_settings
  for all to authenticated
  using ( profile_id = (select auth.uid()) )
  with check ( profile_id = (select auth.uid()) );

create trigger member_settings_set_updated_at
  before update on public.member_settings
  for each row execute function public.set_updated_at();
