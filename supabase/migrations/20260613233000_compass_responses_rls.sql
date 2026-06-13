-- compass_responses RLS policies — Mini-Compass onboarding (AGE-243).
--
-- compass_responses was created in 20260611172126_stammdaten_and_compass.sql with
-- RLS ENABLED but NO policies (Ebene 2 "prepared, not wired"). With RLS on and no
-- policy, authenticated clients can neither read nor write it. The Mini-Compass
-- onboarding is the first feature to write member answers here, so it needs both:
--   * write-own  — the onboarding inserts/replaces the member's own answer rows;
--   * select-own — the onboarding reads back whether the member already has
--                  responses (resume/"already done" detection).
--
-- Visibility: STRICTLY own-profile (NOT own-or-Prime+). Unlike offers/needs/
-- interests (which Prime+ may see for matching), compass answers carry private
-- potential/transaction signals (potential_level, tx_volume_band) — they are the
-- member's private orientation data. The Erfolgsradar derived from them is exposed
-- via profile_theme_scores (own-or-Prime+), not by reading compass_responses
-- directly. recompute_potential_score reads these rows as SECURITY DEFINER and is
-- unaffected by these policies.
--
-- Mirrors the goals "strictly own" shape (20260613073842_profile_extension.sql).
-- Forward-only.

create policy compass_responses_select_own on public.compass_responses
  for select to authenticated
  using ( profile_id = (select auth.uid()) );

create policy compass_responses_write_own on public.compass_responses
  for all to authenticated
  using ( profile_id = (select auth.uid()) )
  with check ( profile_id = (select auth.uid()) );
