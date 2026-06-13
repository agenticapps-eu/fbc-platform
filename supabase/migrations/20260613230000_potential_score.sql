-- Potential / "Impact" score + Erfolgsradar derivation (AGE-242).
-- Rule-based (NOT a popularity score). Spec: the FBC concept's score formula.
--
-- ONE SECURITY DEFINER RPC, `recompute_potential_score(profile_id)`, that:
--   1. recomputes profiles.potential_score from five weighted components, and
--   2. (re)derives the four Erfolgsradar theme scores (profile_theme_scores),
-- then returns a transparent jsonb breakdown so the value is nachvollziehbar
-- (rendered as the Impact-Score detail in the dashboard).
--
-- Recompute is ON-DEMAND (prototype): the frontend calls it when the dashboard
-- loads and after a profile save (see src/lib/dashboard.ts / src/lib/profile.ts).
-- No DB trigger — keeps the write path simple and avoids self-recursion on the
-- profiles row.
--
-- ── Score components & weights ───────────────────────────────────────────────
--   Profilvollständigkeit 30 %  · Compass 25 % · Aktivität 20 %
--   Empfehlungen          15 %  · Feedback 10 %
-- Each component is normalized to 0..1, weighted, summed, ×100 → 0..100.
--
-- ── Decisions / data-source choices (Phase-1 schema reality) ─────────────────
--  * Profilvollständigkeit: profiles.profile_completion (already a real, trigger-
--    maintained 0–100 value). ratio = completion/100.
--  * Compass: share of the four themes the member has answered in
--    compass_responses (numeric answers present). ratio = themes/4. The mini-
--    compass UI is a Phase-2 stub, so for most members this is 0 today — that is
--    correct (an unanswered compass contributes nothing), not a bug.
--  * Aktivität: own posts + comments + offers + needs + event_registrations,
--    saturating at ACTIVITY_SATURATION. Real engagement, no denormalized counters.
--  * Empfehlungen: NO recommendations table exists in Phase 1. Proxy from real
--    signals that mean "others vouch for / sought out this member": ACCEPTED
--    INCOMING contact_requests + awarded certifications (profile_badges).
--    Saturates at RECOMMEND_SATURATION. (Swap in a real endorsements table later
--    by editing only this function.)
--  * Feedback: avg rating of feedback rows tied to the profile (1–5 → 0–1).
--    Prototype proxy — feedback received is modelled later (Ebene 2).
--
-- ── Erfolgsradar (profile_theme_scores, 0–10) ────────────────────────────────
--  Primary source = the mini-compass answers: numeric leaf values in
--  compass_responses.answers are averaged per theme (treated as a 0–10 scale).
--  Fallback when a theme has no compass answers yet = theme-tagged real signals
--  (offers + needs + interests for that theme), so the radar shows plausible
--  values from real data instead of all-zeros before the compass exists.
--
-- Forward-only. No FORCE RLS in this project, so this DEFINER function (owned by
-- the migration role) updates the server-managed potential_score column and the
-- theme scores directly; RLS is not in the way and is not weakened.

create or replace function public.recompute_potential_score(p_profile_id uuid)
  returns jsonb
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_caller uuid := (select auth.uid());

  -- Saturation constants: the count at which a component reaches 100 %.
  c_activity_saturation  constant numeric := 10;
  c_recommend_saturation constant numeric := 5;

  v_completion      int;
  v_compass_themes  int;
  v_activity_count  int;
  v_recommend_count int;
  v_feedback_count  int;
  v_feedback_avg    numeric;

  r_completion numeric;
  r_compass    numeric;
  r_activity   numeric;
  r_recommend  numeric;
  r_feedback   numeric;

  v_score       int;
  v_theme       text;
  v_compass_avg numeric;
  v_signal_count int;
  v_theme_score numeric;
  v_breakdown   jsonb;
begin
  -- AuthZ: a member may only (re)compute their OWN score. service_role / migration
  -- context (auth.uid() is null) is allowed for seeds and admin recomputes.
  if v_caller is not null and v_caller <> p_profile_id then
    raise exception 'recompute_potential_score: not allowed for another profile'
      using errcode = '42501';
  end if;

  -- ── 1. Component inputs (real data) ────────────────────────────────────────
  select coalesce(profile_completion, 0) into v_completion
  from public.profiles where id = p_profile_id;
  if not found then
    raise exception 'recompute_potential_score: profile % not found', p_profile_id
      using errcode = 'P0002';
  end if;

  -- Compass: distinct themes answered with at least one numeric answer.
  select count(distinct cr.theme) into v_compass_themes
  from public.compass_responses cr
  where cr.profile_id = p_profile_id
    and cr.theme is not null
    and exists (
      select 1 from jsonb_each(coalesce(cr.answers, '{}'::jsonb)) e
      where jsonb_typeof(e.value) = 'number'
    );

  -- Aktivität: own engagement across the activity-producing tables.
  select
      (select count(*) from public.posts               where author_id  = p_profile_id)
    + (select count(*) from public.comments            where author_id  = p_profile_id)
    + (select count(*) from public.offers              where profile_id = p_profile_id)
    + (select count(*) from public.needs               where profile_id = p_profile_id)
    + (select count(*) from public.event_registrations where profile_id = p_profile_id)
  into v_activity_count;

  -- Empfehlungen: accepted incoming contact requests + awarded certifications.
  select
      (select count(*) from public.contact_requests
        where to_id = p_profile_id and status = 'accepted')
    + (select count(*) from public.profile_badges where profile_id = p_profile_id)
  into v_recommend_count;

  -- Feedback: avg rating tied to the profile (prototype proxy).
  select count(*), avg(rating)
  into v_feedback_count, v_feedback_avg
  from public.feedback
  where profile_id = p_profile_id and rating is not null;

  -- ── 2. Normalize to 0..1 ───────────────────────────────────────────────────
  r_completion := least(greatest(v_completion, 0) / 100.0, 1);
  r_compass    := least(v_compass_themes / 4.0, 1);
  r_activity   := least(v_activity_count / c_activity_saturation, 1);
  r_recommend  := least(v_recommend_count / c_recommend_saturation, 1);
  r_feedback   := case
                    when coalesce(v_feedback_count, 0) = 0 then 0
                    else least(greatest((v_feedback_avg - 1) / 4.0, 0), 1)
                  end;

  -- ── 3. Weighted sum → 0..100 ───────────────────────────────────────────────
  v_score := round(100 * (
      0.30 * r_completion
    + 0.25 * r_compass
    + 0.20 * r_activity
    + 0.15 * r_recommend
    + 0.10 * r_feedback
  ))::int;

  update public.profiles set potential_score = v_score where id = p_profile_id;

  -- ── 4. Erfolgsradar: theme scores (compass primary, activity fallback) ─────
  foreach v_theme in array array['sein', 'tun', 'haben', 'wirken'] loop
    select avg((e.value #>> '{}')::numeric) into v_compass_avg
    from public.compass_responses cr
    cross join lateral jsonb_each(coalesce(cr.answers, '{}'::jsonb)) e
    where cr.profile_id = p_profile_id
      and cr.theme = v_theme
      and jsonb_typeof(e.value) = 'number';

    if v_compass_avg is not null then
      v_theme_score := least(greatest(v_compass_avg, 0), 10);
    else
      select
          (select count(*) from public.offers
            where profile_id = p_profile_id and theme = v_theme)
        + (select count(*) from public.needs
            where profile_id = p_profile_id and theme = v_theme)
        + (select count(*) from public.profile_interests
            where profile_id = p_profile_id and theme = v_theme)
      into v_signal_count;
      v_theme_score := least(v_signal_count * 2.0, 10);
    end if;

    insert into public.profile_theme_scores (profile_id, theme, score)
    values (p_profile_id, v_theme, round(v_theme_score, 1))
    on conflict (profile_id, theme) do update set score = excluded.score;
  end loop;

  -- ── 5. Transparent breakdown (points = weight × ratio) ─────────────────────
  v_breakdown := jsonb_build_object(
    'score', v_score,
    'components', jsonb_build_array(
      jsonb_build_object(
        'key', 'completion', 'label', 'Profilvollständigkeit', 'weight', 30,
        'points', round(30 * r_completion, 1),
        'detail', v_completion || ' % ausgefüllt'),
      jsonb_build_object(
        'key', 'compass', 'label', 'Compass', 'weight', 25,
        'points', round(25 * r_compass, 1),
        'detail', v_compass_themes || '/4 Themen beantwortet'),
      jsonb_build_object(
        'key', 'activity', 'label', 'Aktivität', 'weight', 20,
        'points', round(20 * r_activity, 1),
        'detail', v_activity_count || ' Aktivitäten'),
      jsonb_build_object(
        'key', 'recommendations', 'label', 'Empfehlungen', 'weight', 15,
        'points', round(15 * r_recommend, 1),
        'detail', v_recommend_count || ' Empfehlungen'),
      jsonb_build_object(
        'key', 'feedback', 'label', 'Feedback', 'weight', 10,
        'points', round(10 * r_feedback, 1),
        'detail', case
                    when coalesce(v_feedback_count, 0) = 0 then 'Noch kein Feedback'
                    else round(v_feedback_avg, 1) || ' ★ Ø (' || v_feedback_count || ')'
                  end)
    )
  );

  return v_breakdown;
end;
$$;

comment on function public.recompute_potential_score(uuid) is
  'Rule-based Impact/Potential score (AGE-242): recomputes profiles.potential_score '
  'from 5 weighted components (completion 30, compass 25, activity 20, recommendations '
  '15, feedback 10) and (re)derives profile_theme_scores (Erfolgsradar) from compass '
  'answers (activity fallback). Returns a jsonb breakdown. Own-profile only.';

-- Keep it off the anon surface; members call it for their own profile.
revoke execute on function public.recompute_potential_score(uuid) from public, anon;
grant execute on function public.recompute_potential_score(uuid) to authenticated, service_role;
