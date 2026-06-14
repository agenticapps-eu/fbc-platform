-- Rule-based match engine + weighted score (AGE-245). Spec: docs/matching-spec.md §3–4.
-- Builds on the matching schema (20260612065636_matching.sql); creates NO new tables.
--
-- ONE SECURITY DEFINER function `public.generate_matches_for(p_profile uuid)` that,
-- for a given profile, finds complementary candidates, computes a weighted 0–100
-- score with a transparent `basis` jsonb, and UPSERTs the result into `matches`
-- (pair normalized: smaller uuid = a). Plus a thin `recompute_my_matches()` RPC for
-- the logged-in member. The engine runs with elevated rights ON PURPOSE — matching
-- is pair-spanning and must read OTHER members' offers/needs, which RLS would hide.
--
-- ── Score weights (matching-spec §3) ─────────────────────────────────────────
--   Komplementarität 35 · Themenbereich 20 · Branche 15 · Region 15
--   Interessen/Kompetenzen 10 · Mitgliedsstufe 5     (each 0..1, weighted, ×100)
--
-- ── Decisions / data-source choices (Phase-1 schema reality) ─────────────────
--  * Komplementarität: count of complementary category hits in BOTH directions
--    (my needs ↔ their offers AND their needs ↔ my offers) per the §2 map, which is
--    mirrored below as the `comp` VALUES list (single source in code:
--    src/config/matching.ts COMPLEMENTARITY). Saturates at 3 hits → "mehrere
--    Treffer = höher". At least one hit is required to be a candidate at all.
--  * Themenbereich: Jaccard of each profile's engaged themes (sein/tun/haben/wirken)
--    drawn from their offers+needs. No "complementary theme" taxonomy exists in
--    Phase 1, so theme OVERLAP is used (same theme → 1). Documented deviation.
--  * Branche: exact (case-insensitive) match = 1, else 0. The spec's "Nachbarbranche
--    = 0,5" needs an industry-neighbour map that does not exist yet — deferred.
--  * Region: same region (case-insensitive) = 1, else 0 (Start: Stuttgart).
--  * Interessen/Kompetenzen: Jaccard over interests ∪ competencies ∪ the tags on the
--    member's offers/needs (lowercased).
--  * Mitgliedsstufe: same tier = 1, neighbour rank (|Δ level_rank| = 1) = 0.5, else 0.
--  * routing: derived from the matched needs' tx_volume_band (§8) — 'dkri' if ANY
--    complementarity-driving need is large-volume (1m_10m / gt_10m), else 'fbc'.
--    Mirrors src/config/matching.ts DKRI_VOLUME_BANDS.
--
-- ── Upsert semantics ─────────────────────────────────────────────────────────
--  Only pairs with score ≥ 40 are written. ON CONFLICT updates score/basis/routing
--  but leaves `status` UNTOUCHED, so a pair already advanced to requested/accepted
--  is never reset to 'suggested' (new pairs default to 'suggested'). Stale matches
--  that drop below 40 are not deleted — out of scope for Phase 1.
--
-- Forward-only. No FORCE RLS in this project, so this DEFINER function (owned by the
-- migration role) reads pair-spanning data and writes the server-managed `matches`
-- table directly; RLS is intentionally bypassed and not weakened.

-- ── Jaccard helper (two callers: theme + keyword factors) ────────────────────
create or replace function public.array_jaccard(a text[], b text[])
  returns numeric
  language sql
  immutable
  set search_path = public
as $$
  select case
    when a is null or b is null or cardinality(a) = 0 or cardinality(b) = 0 then 0
    else cardinality(array(select unnest(a) intersect select unnest(b)))::numeric
       / nullif(cardinality(array(select unnest(a) union select unnest(b))), 0)
  end;
$$;
comment on function public.array_jaccard(text[], text[]) is
  'Set similarity |A∩B| / |A∪B| of two text arrays (0 when either is empty/null). '
  'Used by the match engine for the theme and interests/competencies factors.';

-- ── Match engine ─────────────────────────────────────────────────────────────
create or replace function public.generate_matches_for(p_profile uuid)
  returns int
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_caller uuid := (select auth.uid());
  v_count  int;
begin
  -- AuthZ: a member may only (re)compute their OWN matches. service_role / migration
  -- context (auth.uid() is null) is allowed for seeds and admin recomputes.
  if v_caller is not null and v_caller <> p_profile then
    raise exception 'generate_matches_for: not allowed for another profile'
      using errcode = '42501';
  end if;

  if not exists (select 1 from public.profiles where id = p_profile) then
    raise exception 'generate_matches_for: profile % not found', p_profile
      using errcode = 'P0002';
  end if;

  insert into public.matches (a_profile_id, b_profile_id, score, basis, routing)
  with
  -- Komplementaritäts-Map (need-key → offer-key), mirrors src/config/matching.ts.
  comp (need_key, offer_key) as (values
    ('investoren',  'kapital'),       ('investoren',  'beteiligungen'),
    ('projekte',    'kapital'),       ('projekte',    'beteiligungen'),   ('projekte', 'kontakte'),
    ('immobilien',  'immobilien'),    ('immobilien',  'beteiligungen'),
    ('partner',     'kontakte'),      ('partner',     'beteiligungen'),   ('partner',  'leistungen'),
    ('experten',    'know_how'),      ('experten',    'leistungen'),
    ('kunden',      'kontakte'),      ('kunden',      'leistungen'),
    ('mitarbeiter', 'kontakte'),
    ('mentoren',    'mentoring'),     ('mentoren',    'know_how')
  ),
  -- Complementary category hits between p_profile and every other profile, both
  -- directions. `vol` carries the driving need's tx_volume_band for §8 routing.
  hits as (
    -- direction 1: my need ↔ their offer
    select o.profile_id as cand,
           n.category as need_cat, o.category as offer_cat, n.tx_volume_band as vol
    from public.needs n
    join comp c          on c.need_key = n.category
    join public.offers o on o.category = c.offer_key and o.profile_id <> p_profile
    where n.profile_id = p_profile
    union all
    -- direction 2: their need ↔ my offer
    select n.profile_id as cand,
           n.category, o.category, n.tx_volume_band
    from public.offers o
    join comp c          on c.offer_key = o.category
    join public.needs n  on n.category = c.need_key and n.profile_id <> p_profile
    where o.profile_id = p_profile
  ),
  cand_hits as (
    select cand,
           count(*)::int                              as hit_count,
           bool_or(vol in ('1m_10m', 'gt_10m'))       as has_dkri,
           jsonb_agg(distinct jsonb_build_object('need', need_cat, 'offer', offer_cat)) as pairs
    from hits
    group by cand
  ),
  -- Scoring attributes for p_profile and all candidates (one CTE, no duplication).
  attrs as (
    select
      p.id,
      p.region,
      p.branche,
      t.level_rank as rank,
      array(
        select distinct x.theme from (
          select theme from public.offers where profile_id = p.id and theme is not null
          union
          select theme from public.needs  where profile_id = p.id and theme is not null
        ) x
      ) as themes,
      array(
        select distinct lower(y.k) from (
          select unnest(coalesce(p.interests,    '{}'::text[])) as k
          union
          select unnest(coalesce(p.competencies, '{}'::text[]))
          union
          select unnest(coalesce(o.tags,  '{}'::text[])) from public.offers o where o.profile_id = p.id
          union
          select unnest(coalesce(nd.tags, '{}'::text[])) from public.needs  nd where nd.profile_id = p.id
        ) y(k)
      ) as keywords
    from public.profiles p
    join public.membership_tiers t on t.key = p.tier
    where p.id = p_profile or p.id in (select cand from cand_hits)
  )
  select
    least(ch.cand, p_profile)    as a_profile_id,
    greatest(ch.cand, p_profile) as b_profile_id,
    sc.score,
    jsonb_build_object(
      'score', sc.score,
      'routing', case when ch.has_dkri then 'dkri' else 'fbc' end,
      'complementarity_pairs', ch.pairs,
      'components', jsonb_build_array(
        jsonb_build_object('key', 'complementarity', 'label', 'Komplementarität',
          'weight', 35, 'points', round(35 * r.r_comp, 1),
          'detail', ch.hit_count || ' komplementäre Treffer'),
        jsonb_build_object('key', 'theme',     'label', 'Themenbereich',
          'weight', 20, 'points', round(20 * r.r_theme, 1)),
        jsonb_build_object('key', 'branche',   'label', 'Branche',
          'weight', 15, 'points', round(15 * r.r_branche, 1)),
        jsonb_build_object('key', 'region',    'label', 'Region',
          'weight', 15, 'points', round(15 * r.r_region, 1)),
        jsonb_build_object('key', 'interests', 'label', 'Interessen & Kompetenzen',
          'weight', 10, 'points', round(10 * r.r_keywords, 1)),
        jsonb_build_object('key', 'tier',      'label', 'Mitgliedsstufe',
          'weight', 5,  'points', round(5 * r.r_tier, 1))
      )
    ) as basis,
    case when ch.has_dkri then 'dkri' else 'fbc' end as routing
  from cand_hits ch
  join attrs me on me.id = p_profile
  join attrs ca on ca.id = ch.cand
  cross join lateral (
    select
      least(ch.hit_count / 3.0, 1)                                              as r_comp,
      public.array_jaccard(me.themes, ca.themes)                               as r_theme,
      (case when me.branche is not null and ca.branche is not null
              and lower(me.branche) = lower(ca.branche) then 1 else 0 end)::numeric as r_branche,
      (case when me.region is not null and ca.region is not null
              and lower(me.region) = lower(ca.region) then 1 else 0 end)::numeric   as r_region,
      public.array_jaccard(me.keywords, ca.keywords)                           as r_keywords,
      (case when ca.rank = me.rank then 1
            when abs(ca.rank - me.rank) = 1 then 0.5 else 0 end)::numeric       as r_tier
  ) r
  cross join lateral (
    select round(100 * (
        0.35 * r.r_comp
      + 0.20 * r.r_theme
      + 0.15 * r.r_branche
      + 0.15 * r.r_region
      + 0.10 * r.r_keywords
      + 0.05 * r.r_tier
    ))::int as score
  ) sc
  where sc.score >= 40
  on conflict (a_profile_id, b_profile_id) do update
    set score   = excluded.score,
        basis   = excluded.basis,
        routing = excluded.routing;
        -- status intentionally NOT updated: keep requested/accepted lifecycle intact.

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function public.generate_matches_for(uuid) is
  'Rule-based match engine (AGE-245): finds complementary candidates for a profile, '
  'computes the weighted score (complementarity 35 / theme 20 / branche 15 / region '
  '15 / interests+competencies 10 / tier 5), fills `basis`, and upserts matches with '
  'score ≥ 40 (pair normalized, status preserved). Returns the number of rows upserted. '
  'security definer — reads pair-spanning data RLS would hide. Own-profile only.';

-- Engine is server-side; members reach it only through recompute_my_matches.
revoke execute on function public.generate_matches_for(uuid) from public, anon, authenticated;
grant  execute on function public.generate_matches_for(uuid) to service_role;

-- ── Member-facing RPC ─────────────────────────────────────────────────────────
create or replace function public.recompute_my_matches()
  returns int
  language sql
  security definer
  set search_path = public
as $$
  select public.generate_matches_for((select auth.uid()));
$$;

comment on function public.recompute_my_matches() is
  'Recomputes the logged-in member''s matches via generate_matches_for(auth.uid()). '
  'Triggered after onboarding, after saving offers/needs/profile, and by the '
  '"Matches neu berechnen" button in the Matching-Hub (AGE-246).';

revoke execute on function public.recompute_my_matches() from public, anon;
grant  execute on function public.recompute_my_matches() to authenticated, service_role;
