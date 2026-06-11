-- Level 2/3 routing prep on profiles (AGE-234). These are STRUCTURAL
-- placeholders for the Potential Ecosystem (Ebene 2) and DKRI (Ebene 3) layers:
-- nullable, no behavior, no RLS/grant changes. Their exact domains/types are
-- defined by the (still-missing) P4 spec — these are best-guess types and may be
-- refined in a later migration.
--
-- Note: these columns are NOT in the client UPDATE grant on public.profiles, so
-- members cannot set their own routing values (admin/service_role only) — same
-- protection as membership_level. They remain readable in the directory for now;
-- if they later hold sensitive routing data, restrict with a column-level SELECT
-- grant or a view.

create type public.routing_target as enum ('fbc', 'dkri');

alter table public.profiles
  add column potential_level smallint,
  add column tx_volume_band  text,
  add column routing_target  public.routing_target;

comment on column public.profiles.potential_level is
  'Ebene 2 (Potential Ecosystem) standing — structural placeholder (AGE-234); domain undefined until P4. Best-guess type (smallint).';
comment on column public.profiles.tx_volume_band is
  'Transaction-volume band — structural placeholder (AGE-234); domain undefined until P4. Best-guess type (text).';
comment on column public.profiles.routing_target is
  'Platform-layer routing (fbc/dkri) — structural placeholder (AGE-234) for Ebene 3 (DKRI) integration; null = unrouted.';
