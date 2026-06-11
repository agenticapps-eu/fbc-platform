-- Layer 1 structural post-conditions (catalog-only; runs in any state).
-- Every column must be TRUE after the migration. partner_categories seed
-- count (= 6) is checked separately post-push.
select
  to_regclass('public.partner_categories') is not null                                  as partner_cats_exists,
  to_regclass('public.compass_responses') is not null                                   as compass_exists,
  exists (select 1 from pg_constraint c
          join pg_class t on t.oid = c.conrelid
          join pg_namespace n on n.oid = t.relnamespace
          where n.nspname='public' and t.relname='compass_responses' and c.contype='c') as compass_has_checks,
  coalesce((select relrowsecurity from pg_class
            where oid = to_regclass('public.partner_categories')), false)               as partner_cats_rls_on,
  coalesce((select relrowsecurity from pg_class
            where oid = to_regclass('public.compass_responses')), false)                as compass_rls_on,
  exists (select 1 from pg_indexes
          where schemaname='public' and indexname='compass_responses_profile_id_idx')   as compass_index_exists;
