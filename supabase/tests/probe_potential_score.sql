-- Behavioural probe for recompute_potential_score (AGE-242). Self-contained:
-- builds a member with known inputs for all five components, recomputes, and
-- asserts the score, the breakdown shape, and the derived Erfolgsradar values.
-- Runs in a transaction and rolls back, so it leaves no data behind.
--
-- Expected (with the weights completion 30 / compass 25 / activity 20 /
-- recommendations 15 / feedback 10 and saturations activity=10, recommend=5):
--   completion = 100 %                       → 1.00 × 30 = 30.0
--   compass    = 1 of 4 themes answered      → 0.25 × 25 =  6.25
--   activity   = 1 offer + 1 need (=2/10)    → 0.20 × 20 =  4.0
--   recommend  = 1 badge + 1 accepted in (=2/5) → 0.40 × 15 = 6.0
--   feedback   = avg rating 4 → (4-1)/4=0.75 → 0.75 × 10 =  7.5
--   total = 53.75 → round → 54
--   radar: sein = compass avg 8.5; tun (no compass) = fallback 1 signal ×2 = 2.0
--          haben = 1 interest ×2 = 2.0; wirken = no signal = 0.0
begin;

-- Two auth users (main + a recommender for the incoming contact request).
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000242aa',
   'authenticated', 'authenticated', 't242a@probe.fbc.invalid',
   extensions.crypt('x', extensions.gen_salt('bf')),
   now(), now(), now(), '{"provider":"email","providers":["email"]}',
   '{"name":"Probe A"}', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000242bb',
   'authenticated', 'authenticated', 't242b@probe.fbc.invalid',
   extensions.crypt('x', extensions.gen_salt('bf')),
   now(), now(), now(), '{"provider":"email","providers":["email"]}',
   '{"name":"Probe B"}', '', '', '', '');

-- Profilvollständigkeit: fill all 12 weighted fields → completion 100 (trigger).
update public.profiles set
  name = 'Probe A', region = 'R', company = 'C', short_bio = 'B', branche = 'X',
  headline = 'H', roles = array['r'], competencies = array['c'],
  website = 'https://x.test', avatar_url = 'https://x.test/a.webp',
  dev_focus = 'wirken', socials = '{"linkedin":"x"}'::jsonb
where id = '00000000-0000-0000-0000-0000000242aa';

-- Aktivität: 1 offer (theme sein) + 1 need (theme tun).
insert into public.offers (profile_id, theme, title)
  values ('00000000-0000-0000-0000-0000000242aa', 'sein', 'Angebot');
insert into public.needs (profile_id, theme, title)
  values ('00000000-0000-0000-0000-0000000242aa', 'tun', 'Gesuch');

-- Radar fallback signal: 1 interest (theme haben).
insert into public.profile_interests (profile_id, theme, label)
  values ('00000000-0000-0000-0000-0000000242aa', 'haben', 'Interesse');

-- Empfehlungen: 1 awarded badge + 1 accepted incoming contact request.
insert into public.profile_badges (profile_id, badge_key)
  values ('00000000-0000-0000-0000-0000000242aa', 'mentor');
insert into public.contact_requests (from_id, to_id, status)
  values ('00000000-0000-0000-0000-0000000242bb',
          '00000000-0000-0000-0000-0000000242aa', 'accepted');

-- Feedback: avg rating 4.
insert into public.feedback (profile_id, rating)
  values ('00000000-0000-0000-0000-0000000242aa', 4);

-- Compass: theme 'sein' answered with numeric answers averaging 8.5.
insert into public.compass_responses (profile_id, theme, answers)
  values ('00000000-0000-0000-0000-0000000242aa', 'sein', '{"q1":8,"q2":9}'::jsonb);

-- Recompute (persists potential_score + profile_theme_scores).
select public.recompute_potential_score('00000000-0000-0000-0000-0000000242aa');

-- Assertions — every column TRUE.
select
  (select potential_score from public.profiles
     where id = '00000000-0000-0000-0000-0000000242aa') = 54 as score_is_54,
  (select score from public.profile_theme_scores
     where profile_id = '00000000-0000-0000-0000-0000000242aa' and theme = 'sein') = 8.5 as sein_from_compass,
  (select score from public.profile_theme_scores
     where profile_id = '00000000-0000-0000-0000-0000000242aa' and theme = 'tun') = 2.0 as tun_from_fallback,
  (select score from public.profile_theme_scores
     where profile_id = '00000000-0000-0000-0000-0000000242aa' and theme = 'haben') = 2.0 as haben_from_fallback,
  (select score from public.profile_theme_scores
     where profile_id = '00000000-0000-0000-0000-0000000242aa' and theme = 'wirken') = 0.0 as wirken_empty,
  (select count(*) from public.profile_theme_scores
     where profile_id = '00000000-0000-0000-0000-0000000242aa') = 4 as four_theme_rows,
  jsonb_array_length(
    (public.recompute_potential_score('00000000-0000-0000-0000-0000000242aa'))->'components') = 5 as five_components,
  ((public.recompute_potential_score('00000000-0000-0000-0000-0000000242aa'))->>'score')::int = 54 as breakdown_score_matches;

rollback;
