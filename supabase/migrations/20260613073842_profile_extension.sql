-- Profile / "Mein Bereich"-Dashboard data model (AGE-238). Spec: docs/profile-spec.md §1.
-- Builds on the P4 schema (AGE-234) and P5 RLS (AGE-235). Forward-only.
--
-- Adds the descriptive/dashboard fields the member profile + dashboard render, plus
-- five sub-tables (success radar, themed interests, private goals, badge master data,
-- awarded badges). Visibility follows docs/rls-policies.md: extended profile data is
-- own-profile-OR-Prime+; goals are strictly private (own-profile only); badge master
-- data is reference data readable by all.
--
-- ── Decisions / deviations from the literal spec ─────────────────────────────
--  * headline: the foundation had a `headline` column; AGE-234 (foundation_conform)
--    DROPPED it. The spec re-introduces it here, so this is a genuine re-add.
--  * New sub-tables carry EXACTLY the spec'd fields (no created_at/updated_at). The
--    P4 §0 "every table gets created_at" convention is intentionally not applied —
--    the prompt requires "Felder exakt wie in der Spec". profile_badges.awarded_at
--    already records when a badge was granted.
--  * profile_badges WRITE: the spec groups it with "write own profile", but letting a
--    member self-award certifications ("Certified Mentor", …) would make the badge
--    meaningless and is an integrity hole. We therefore give profile_badges a SELECT
--    policy only (own-or-Prime+) and NO client write policy — badges are awarded by
--    service_role/admin/seed, mirroring `matches` (created server-side, no write
--    policy). theme_scores/interests keep client write-own as specified.
--  * Client UPDATE grant on profiles is extended ONLY for headline, roles, dev_focus
--    (the editor-owned fields, profile-spec §6). member_number, member_since,
--    dev_progress and next_steps stay server/admin-managed — same protection as tier,
--    potential_score and profile_completion.
--  * A `profiles.goals text` column already exists (P4, free-form). The structured
--    `goals` TABLE introduced here is the dashboard source (profile-spec §5.14); the
--    legacy text column is left untouched (out of scope to drop) and coexists in a
--    separate namespace.

-- ── 1. profiles: extended profile / dashboard fields (spec §1) ───────────────
alter table public.profiles
  add column headline      text,
  add column roles         text[],
  add column member_number text unique,
  add column member_since  date,
  add column dev_focus      text check (dev_focus in ('sein', 'tun', 'haben', 'wirken')),
  add column dev_progress   int  check (dev_progress between 0 and 100),
  add column next_steps     text[];

comment on column public.profiles.headline is
  'Free-text headline, e.g. "Unternehmer · Investor · Deal Keeper". roles[] is the structured source for headline chips.';
comment on column public.profiles.member_number is
  'FBC membership number (e.g. FBC-10023). Admin/service_role-assigned, not client-writable.';
comment on column public.profiles.member_since is
  '"Mitglied seit" date. Admin/service_role-assigned, not client-writable.';
comment on column public.profiles.dev_progress is
  '0–100 development progress. Server-maintained, not client-writable (like potential_score).';
comment on column public.profiles.next_steps is
  '"Nächste Schritte für dich". Server/coach-maintained, not client-writable.';

-- Editor-owned fields become client-updatable (additive column grant; profile-spec §6).
-- member_number / member_since / dev_progress / next_steps are deliberately excluded.
grant update (headline, roles, dev_focus) on public.profiles to authenticated;

-- ── 2. profile_theme_scores — Erfolgsradar (Sein/Tun/Haben/Wirken) ───────────
create table public.profile_theme_scores (
  profile_id uuid         not null references public.profiles (id) on delete cascade,
  theme      text         not null check (theme in ('sein', 'tun', 'haben', 'wirken')),
  score      numeric(3,1) not null check (score between 0 and 10),
  primary key (profile_id, theme)
);
comment on table public.profile_theme_scores is
  'Success-radar scores per theme (0–10). One row per (profile, theme). Visibility: own-profile or Prime+.';

-- ── 3. profile_interests — grouped interests ─────────────────────────────────
create table public.profile_interests (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  theme      text check (theme in ('sein', 'tun', 'haben', 'wirken')),
  label      text not null
);
comment on table public.profile_interests is
  'Themed interest chips grouped by theme. Visibility: own-profile or Prime+.';

-- ── 4. goals — private goals (own-profile only) ──────────────────────────────
create table public.goals (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  category   text not null check (category in ('persoenlich', 'unternehmerisch', 'finanziell', 'wirkung')),
  title      text not null,
  progress   int  check (progress between 0 and 100)
);
comment on table public.goals is
  'Private member goals across four categories. Strictly own-profile only (not Prime+, not public).';

-- ── 5. badges — master data (reference, readable by all) ─────────────────────
create table public.badges (
  key   text primary key,
  label text not null,
  icon  text
);
comment on table public.badges is
  'Badge master data (reference). Readable by all; awarded via profile_badges.';

insert into public.badges (key, label, icon) values
  ('transaction_manager', 'Certified Transaction Manager', null),
  ('mentor',              'Certified Mentor',              null),
  ('host',                'Certified Host',                null),
  ('ambassador',          'Certified Ambassador',          null);

-- ── 6. profile_badges — awarded badges ───────────────────────────────────────
create table public.profile_badges (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  badge_key  text not null references public.badges (key),
  awarded_at date not null default current_date,
  primary key (profile_id, badge_key)
);
comment on table public.profile_badges is
  'Badges awarded to a profile. Visibility: own-profile or Prime+. Awarded by service_role/admin (no client write policy), like matches.';

-- ── 7. Indexes (FK columns; PK leading column covers profile_id elsewhere) ────
create index profile_interests_profile_id_idx on public.profile_interests (profile_id);
create index goals_profile_id_idx             on public.goals (profile_id);
create index profile_badges_badge_key_idx     on public.profile_badges (badge_key);

-- ── 8. Row Level Security ─────────────────────────────────────────────────────
alter table public.profile_theme_scores enable row level security;
alter table public.profile_interests    enable row level security;
alter table public.goals                 enable row level security;
alter table public.badges                enable row level security;
alter table public.profile_badges        enable row level security;

-- theme_scores / interests: extended profile data — read own-or-Prime+, write own.
create policy theme_scores_select on public.profile_theme_scores
  for select to authenticated
  using ( profile_id = (select auth.uid()) or public.is_prime_plus() );
create policy theme_scores_write_own on public.profile_theme_scores
  for all to authenticated
  using ( profile_id = (select auth.uid()) ) with check ( profile_id = (select auth.uid()) );

create policy interests_select on public.profile_interests
  for select to authenticated
  using ( profile_id = (select auth.uid()) or public.is_prime_plus() );
create policy interests_write_own on public.profile_interests
  for all to authenticated
  using ( profile_id = (select auth.uid()) ) with check ( profile_id = (select auth.uid()) );

-- goals: strictly private — own profile only (read + write), never Prime+.
create policy goals_own on public.goals
  for all to authenticated
  using ( profile_id = (select auth.uid()) ) with check ( profile_id = (select auth.uid()) );

-- badges (master data): readable by everyone (like membership_tiers).
create policy badges_read_all on public.badges
  for select to anon, authenticated using ( true );

-- profile_badges: read own-or-Prime+. NO client write policy — awarded by
-- service_role/admin (see header decision; mirrors matches).
create policy profile_badges_select on public.profile_badges
  for select to authenticated
  using ( profile_id = (select auth.uid()) or public.is_prime_plus() );
