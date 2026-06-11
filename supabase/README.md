# Supabase

Migrations live in `migrations/`. Apply to the linked project with
`pnpm db:push` (wraps `supabase db push` via Infisical).

## Migrations

- `20260611115655_community_foundation.sql` — Community (Ebene 1) foundation:
  `membership_level` enum (discover/prime/legacy), `profiles` (1:1 `auth.users`),
  `profile_contacts` (owner-only), signup trigger, and RLS. Directory is readable
  by any authenticated member; contact data is owner-only; `membership_level` is
  client-immutable.
- `20260611115828_lock_down_trigger_functions.sql` — removes the trigger-only
  helper functions from the PostgREST API surface (advisor 0028/0029).
- `20260611120449_profile_routing_fields.sql` — nullable level-2/3 structural
  prep on `profiles` (`potential_level`, `tx_volume_band`, `routing_target`
  enum). No behavior yet; admin/service_role-writable only. Domains finalise
  with P4.
