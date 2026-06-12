-- Keep public.is_prime_plus() off the anon API surface (AGE-235, follow-up).
--
-- 20260612082726_rls_policies granted EXECUTE to `authenticated` but did not strip
-- the default PUBLIC grant a new function carries, so `anon` could call it via
-- /rest/v1/rpc/is_prime_plus (Supabase advisor 0028). It only ever returns the
-- caller's own tier standing (false for anon), so this is hardening, not a leak —
-- but least privilege says revoke it. Mirrors lock_down_current_tier_rank /
-- lock_down_trigger_functions. `authenticated` keeps its explicit grant, which the
-- profiles/offers/needs/contact_requests policies require.
revoke execute on function public.is_prime_plus() from public, anon;
