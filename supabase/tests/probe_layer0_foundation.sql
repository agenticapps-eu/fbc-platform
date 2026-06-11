-- Layer 0 structural post-conditions (catalog-only; runs in any state).
-- Every column must be TRUE after the migration. Seed counts are checked
-- separately post-push (membership_tiers = 7, legacy level_rank = 7).
select
  to_regclass('public.membership_tiers') is not null                                              as tiers_table_exists,
  exists (select 1 from information_schema.columns
          where table_schema='public' and table_name='profiles' and column_name='tier')           as profiles_has_tier,
  exists (select 1 from information_schema.columns
          where table_schema='public' and table_name='profiles' and column_name='name')           as profiles_has_name,
  exists (select 1 from information_schema.columns
          where table_schema='public' and table_name='profiles' and column_name='socials')        as profiles_has_socials,
  not exists (select 1 from information_schema.columns
          where table_schema='public' and table_name='profiles' and column_name='membership_level') as ml_col_dropped,
  not exists (select 1 from information_schema.columns
          where table_schema='public' and table_name='profiles' and column_name='headline')       as headline_dropped,
  not exists (select 1 from information_schema.columns
          where table_schema='public' and table_name='profiles' and column_name='routing_target') as routing_col_dropped,
  not exists (select 1 from information_schema.columns
          where table_schema='public' and table_name='profile_contacts' and column_name='website') as contacts_website_dropped,
  not exists (select 1 from pg_type where typname='membership_level')                              as enum_ml_dropped,
  not exists (select 1 from pg_type where typname='routing_target')                                as enum_routing_dropped,
  to_regclass('public.profiles_public') is not null                                               as view_exists,
  exists (select 1 from pg_proc where proname='current_tier_rank')                                as fn_tier_rank_exists,
  exists (select 1 from pg_constraint where conname='profiles_tier_fkey')                          as tier_fk_exists;
