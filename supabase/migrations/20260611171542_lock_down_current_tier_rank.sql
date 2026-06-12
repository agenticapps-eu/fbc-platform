-- Keep public.current_tier_rank() off the API surface (AGE-234).
--
-- The function is defined in 20260611171003_foundation_conform per P4 §8 but is
-- only consumed by P5/AGE-235 RLS policies — nothing calls it yet. Leaving it
-- executable by `authenticated` exposes a SECURITY DEFINER function via
-- /rest/v1/rpc/current_tier_rank (Supabase advisor 0029). Revoke EXECUTE now
-- (least privilege); P5 will grant exactly what its policies require. Mirrors
-- the lock_down_trigger_functions migration.
revoke execute on function public.current_tier_rank() from authenticated;
