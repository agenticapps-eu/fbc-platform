-- Matching post-conditions (catalog-only). All columns TRUE after migration.
select
  to_regclass('public.offers')           is not null as offers_exists,
  to_regclass('public.needs')            is not null as needs_exists,
  to_regclass('public.matches')          is not null as matches_exists,
  to_regclass('public.contact_requests') is not null as contact_requests_exists,
  to_regclass('public.message_threads')  is not null as message_threads_exists,
  to_regclass('public.messages')         is not null as messages_exists,
  exists (select 1 from pg_constraint where conname='matches_unique_pair')          as matches_unique_pair,
  exists (select 1 from pg_constraint where conname='matches_distinct_profiles')    as matches_distinct_chk,
  exists (select 1 from pg_constraint where conname='contact_requests_unique_pair') as cr_unique_pair,
  exists (select 1 from pg_constraint where conname='message_threads_unique_pair')  as mt_unique_pair,
  exists (select 1 from pg_indexes where schemaname='public' and indexname='offers_tags_gin') as offers_gin,
  exists (select 1 from pg_indexes where schemaname='public' and indexname='contact_requests_to_id_status_idx') as cr_to_status_idx,
  coalesce((select bool_and(relrowsecurity) from pg_class
            where relnamespace='public'::regnamespace
              and relname in ('offers','needs','matches','contact_requests','message_threads','messages')), false) as all_rls_on;
