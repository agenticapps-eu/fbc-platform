-- PR-C post-conditions (catalog-only). All TRUE after migration.
select
  to_regclass('public.posts')               is not null as posts_exists,
  to_regclass('public.comments')            is not null as comments_exists,
  to_regclass('public.post_likes')          is not null as post_likes_exists,
  to_regclass('public.partners')            is not null as partners_exists,
  to_regclass('public.events')              is not null as events_exists,
  to_regclass('public.event_registrations') is not null as event_regs_exists,
  to_regclass('public.feedback')            is not null as feedback_exists,
  to_regclass('public.notifications')       is not null as notifications_exists,
  exists (select 1 from pg_constraint where conname='event_registrations_unique')              as evt_reg_unique,
  exists (select 1 from pg_constraint c join pg_class t on t.oid=c.conrelid
          join pg_namespace n on n.oid=t.relnamespace
          where n.nspname='public' and t.relname='post_likes' and c.contype='p')               as post_likes_pk,
  exists (select 1 from pg_indexes where schemaname='public' and indexname='posts_visibility_created_at_idx') as posts_idx,
  coalesce((select bool_and(relrowsecurity) from pg_class
            where relnamespace='public'::regnamespace
              and relname in ('posts','comments','post_likes','partners','events',
                              'event_registrations','feedback','notifications')), false)        as all_rls_on;
