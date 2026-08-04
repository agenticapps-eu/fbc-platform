-- Sichtbares Label „Compass" → „Kompass" (AGE-494, 2026-08-04).
-- Change: openspec/changes/mvp-scope-navigation (Capability potential-compass).
--
-- Das ist KEIN Bruch der Entscheidung „die Datenbank wird nicht umbenannt". Die
-- Trennlinie läuft zwischen OBJEKTNAMEN und ANGEZEIGTEM TEXT, nicht zwischen
-- Datenbank und Anwendung: `compass_responses`, `compass_avg`, `compass_themes`,
-- beide Policies, der Index und probe_compass_responses_rls.sql behalten ihren
-- Namen. Hier ändert sich ein String, den recompute_potential_score im
-- Breakdown zurückgibt und den src/lib/dashboard.ts:198 holt und
-- profil-widgets.tsx:219 als `c.label` rendert — sichtbarer Text, der zufällig
-- in SQL wohnt. Ohne diese Zeile stünde im Profil weiter „Compass", während die
-- ganze Oberfläche „Kompass" sagt.
--
-- Der STABILE SCHLÜSSEL `'key', 'compass'` bleibt unangetastet: er ist ein
-- Bezeichner, kein Text, und Clients dürfen daran hängen.
--
-- Vollständige Neudeklaration, weil Postgres keine partielle Änderung kennt.
-- Gegen 20260716070000_platform_feedback.sql ist AUSSCHLIESSLICH dieses eine
-- Label geändert; Gewichte, Sättigungen, der Feedback-Select und der
-- Erfolgsradar sind unverändert. probe_potential_score.sql belegt das.

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
  -- AGE-300: NUR aktionsgebundenes Feedback (ref_type gesetzt). Plattform-Feedback
  -- (§3.5) ist eine Meinung ÜBER die Plattform, kein Signal über das Mitglied —
  -- ohne diesen Filter verstellte ein Gast mit seiner eigenen Bewertung seinen
  -- eigenen Score. Der Kommentar dieser Funktion sagt seit AGE-242, was gemeint
  -- war: „feedback RECEIVED is modelled later (Ebene 2)" — Feedback ÜBER das
  -- Mitglied, nicht VOM Mitglied. Bis Ebene 2 ist ref_type die beste Näherung.
  select count(*), avg(rating)
  into v_feedback_count, v_feedback_avg
  from public.feedback
  where profile_id = p_profile_id
    and rating is not null
    and ref_type is not null;

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
        'key', 'compass', 'label', 'Kompass', 'weight', 25,
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
