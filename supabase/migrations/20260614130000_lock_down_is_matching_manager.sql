-- Keep public.is_matching_manager() off the anon API surface (AGE-249, follow-up).
--
-- 20260614120000_volume_routing_queue granted EXECUTE to `authenticated` but did not
-- strip the default PUBLIC grant a new function carries, so `anon` could call it via
-- /rest/v1/rpc/is_matching_manager (Supabase advisor 0028). It only ever returns the
-- caller's own manager standing (false for anon → auth.uid() is null), so this is
-- hardening, not a leak — but least privilege says revoke it. Mirrors
-- lock_down_is_prime_plus. `authenticated` keeps its explicit grant, which the
-- routing_queue policies and list_routing_queue() require.
revoke execute on function public.is_matching_manager() from public, anon;
