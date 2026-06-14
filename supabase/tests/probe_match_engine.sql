-- Behavioural probe for generate_matches_for (AGE-245). Self-contained: builds
-- two complementary demo profiles (A needs investoren ↔ B offers kapital) plus a
-- non-complementary third (C), runs the engine for A, and asserts a plausible
-- score, the correct `basis` shape/routing, and that the non-complementary pair
-- produces NO match. Runs in a transaction and rolls back — leaves no data behind.
--
-- Expected score A↔B (weights 35/20/15/15/10/5):
--   complementarity = 1 hit (investoren↔kapital) → least(1/3,1)=0.3333 ×35 = 11.667
--   theme   = both engage 'haben' (need/offer theme)        → 1.0    ×20 = 20.0
--   branche = both 'Finanzen'                               → 1.0    ×15 = 15.0
--   region  = both 'Stuttgart'                              → 1.0    ×15 = 15.0
--   keywords= both interests {finanzen}                     → 1.0    ×10 = 10.0
--   tier    = both 'prime'                                  → 1.0    × 5 =  5.0
--   total = 76.667 → round → 77   ·   routing = fbc (need band 100k_1m)
begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000245aa',
   'authenticated', 'authenticated', 't245a@probe.fbc.invalid',
   extensions.crypt('x', extensions.gen_salt('bf')),
   now(), now(), now(), '{"provider":"email","providers":["email"]}',
   '{"name":"Probe A"}', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000245bb',
   'authenticated', 'authenticated', 't245b@probe.fbc.invalid',
   extensions.crypt('x', extensions.gen_salt('bf')),
   now(), now(), now(), '{"provider":"email","providers":["email"]}',
   '{"name":"Probe B"}', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000245cc',
   'authenticated', 'authenticated', 't245c@probe.fbc.invalid',
   extensions.crypt('x', extensions.gen_salt('bf')),
   now(), now(), now(), '{"provider":"email","providers":["email"]}',
   '{"name":"Probe C"}', '', '', '', '');

-- Shared scoring attributes (region/branche/tier/interests) → factors 2–6 = full.
update public.profiles set
  region = 'Stuttgart', branche = 'Finanzen', tier = 'prime', interests = array['finanzen']
where id in ('00000000-0000-0000-0000-0000000245aa',
             '00000000-0000-0000-0000-0000000245bb',
             '00000000-0000-0000-0000-0000000245cc');

-- A: needs investoren (theme haben, volume 100k_1m → fbc routing).
insert into public.needs (profile_id, category, theme, title, tx_volume_band)
  values ('00000000-0000-0000-0000-0000000245aa', 'investoren', 'haben', 'Suche Kapitalgeber', '100k_1m');

-- B: offers kapital (theme haben) → complementary to A's need.
insert into public.offers (profile_id, category, theme, title)
  values ('00000000-0000-0000-0000-0000000245bb', 'kapital', 'haben', 'Biete Kapital');

-- C: offers mentoring + needs mentoren — NOT complementary to A (A has no offer,
--    and mentoring ∉ comp[investoren]) → A↔C must yield no match.
insert into public.offers (profile_id, category, theme, title)
  values ('00000000-0000-0000-0000-0000000245cc', 'mentoring', 'sein', 'Biete Mentoring');
insert into public.needs (profile_id, category, theme, title, tx_volume_band)
  values ('00000000-0000-0000-0000-0000000245cc', 'mentoren', 'sein', 'Suche Mentor', 'lt_10k');

-- Run the engine for A (service/migration context: auth.uid() is null → allowed).
select public.generate_matches_for('00000000-0000-0000-0000-0000000245aa') as upserted;

-- Assertions — every column TRUE.
select
  -- exactly one match was produced for A, and it is the A↔B pair
  (select count(*) from public.matches
     where a_profile_id = '00000000-0000-0000-0000-0000000245aa'
        or b_profile_id = '00000000-0000-0000-0000-0000000245aa') = 1 as one_match_for_a,
  exists (
    select 1 from public.matches
     where least(a_profile_id, b_profile_id) = least(
              '00000000-0000-0000-0000-0000000245aa'::uuid, '00000000-0000-0000-0000-0000000245bb'::uuid)
       and greatest(a_profile_id, b_profile_id) = greatest(
              '00000000-0000-0000-0000-0000000245aa'::uuid, '00000000-0000-0000-0000-0000000245bb'::uuid)
  ) as ab_pair_exists,
  -- plausible weighted score
  (select score from public.matches
     where a_profile_id in ('00000000-0000-0000-0000-0000000245aa','00000000-0000-0000-0000-0000000245bb')
       and b_profile_id in ('00000000-0000-0000-0000-0000000245aa','00000000-0000-0000-0000-0000000245bb')) = 77 as score_is_77,
  -- pair is normalized (a < b)
  (select a_profile_id < b_profile_id from public.matches
     where a_profile_id in ('00000000-0000-0000-0000-0000000245aa','00000000-0000-0000-0000-0000000245bb')
       and b_profile_id in ('00000000-0000-0000-0000-0000000245aa','00000000-0000-0000-0000-0000000245bb')) as pair_normalized,
  -- basis: score mirrors, 6 components, routing fbc, complementarity pair recorded
  (select (basis->>'score')::int from public.matches
     where a_profile_id in ('00000000-0000-0000-0000-0000000245aa','00000000-0000-0000-0000-0000000245bb')
       and b_profile_id in ('00000000-0000-0000-0000-0000000245aa','00000000-0000-0000-0000-0000000245bb')) = 77 as basis_score_matches,
  (select jsonb_array_length(basis->'components') from public.matches
     where a_profile_id in ('00000000-0000-0000-0000-0000000245aa','00000000-0000-0000-0000-0000000245bb')
       and b_profile_id in ('00000000-0000-0000-0000-0000000245aa','00000000-0000-0000-0000-0000000245bb')) = 6 as six_components,
  (select basis->>'routing' from public.matches
     where a_profile_id in ('00000000-0000-0000-0000-0000000245aa','00000000-0000-0000-0000-0000000245bb')
       and b_profile_id in ('00000000-0000-0000-0000-0000000245aa','00000000-0000-0000-0000-0000000245bb')) = 'fbc' as routing_fbc,
  (select routing from public.matches
     where a_profile_id in ('00000000-0000-0000-0000-0000000245aa','00000000-0000-0000-0000-0000000245bb')
       and b_profile_id in ('00000000-0000-0000-0000-0000000245aa','00000000-0000-0000-0000-0000000245bb')) = 'fbc' as routing_col_fbc,
  (select basis->'complementarity_pairs' @> '[{"need":"investoren","offer":"kapital"}]'::jsonb from public.matches
     where a_profile_id in ('00000000-0000-0000-0000-0000000245aa','00000000-0000-0000-0000-0000000245bb')
       and b_profile_id in ('00000000-0000-0000-0000-0000000245aa','00000000-0000-0000-0000-0000000245bb')) as basis_pair_recorded,
  -- non-complementary C produced no match with A
  (select count(*) from public.matches
     where (a_profile_id = '00000000-0000-0000-0000-0000000245cc'
            and b_profile_id = '00000000-0000-0000-0000-0000000245aa')
        or (a_profile_id = '00000000-0000-0000-0000-0000000245aa'
            and b_profile_id = '00000000-0000-0000-0000-0000000245cc')) = 0 as no_match_with_c;

rollback;
