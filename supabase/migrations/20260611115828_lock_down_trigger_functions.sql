-- Lock down the trigger-only helper functions so they are NOT exposed as
-- PostgREST RPC endpoints (/rest/v1/rpc/...). They are only ever invoked by
-- triggers; revoking EXECUTE from the API roles removes them from the public
-- API surface without affecting trigger execution (triggers do not check the
-- caller's EXECUTE privilege). Closes Supabase security advisors 0028/0029 for
-- the SECURITY DEFINER public.handle_new_user().
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
