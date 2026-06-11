# ADR-0001: Conform the FBC data model to the P4 spec
**Status**: Accepted  **Date**: 2026-06-11  **Linear**: AGE-234

## Context
The foundation slice (PR #5/#6) was built before the binding P4 spec
(`docs/data-model.md`) existed in the repo. It diverged: a 3-value
`membership_level` PG enum instead of a 7-tier `membership_tiers` table,
PG enums instead of text+check, routing fields on `profiles` instead of
`compass_responses`, and full RLS policies instead of P4's "enable only"
phasing.

## Decision
Conform fully to P4 via **forward corrective migrations** (never rewrite the
merged migrations). New enums use **text+check**. New tables get **RLS enabled
with no policies** (policies deferred to P5/AGE-235); the existing
`profiles`/`profile_contacts` policies are kept. `tier`, `potential_score`,
and `profile_completion` remain server/admin-only.

Helper functions defined now for P5 (`current_tier_rank`) are kept off the API
surface (EXECUTE revoked from `public`/`anon`/`authenticated`) until P5 wires
the policies that consume them — least privilege, and it clears Supabase
advisor 0029.

## Alternatives Rejected
- **Rewrite + `db reset`**: cleaner final history but rewrites already-merged/
  applied migrations and breaks the just-repaired ledger. Rejected as team-unsafe.
- **Keep the enum / write P5 policies now**: contradicts the binding spec and
  pre-empts AGE-235's holistic policy design.
- **Out-of-band DDL via `execute_sql`** to fix a grant: rejected — all schema
  changes go through migrations + `db push` so the ledger stays the source of
  truth (a follow-up migration was used instead).

## Consequences
- `database.types.ts` regenerates with the new shape; no consumers break (no UI
  reads these columns yet).
- P5/AGE-235 owns all RLS policies, including directory anon-exposure and the
  reference tables currently deny-all to clients. The expected
  `rls_enabled_no_policy` INFO advisors on `membership_tiers`,
  `partner_categories`, and `compass_responses` are accepted until then.
- Migrations are CLI-only (`pnpm db:push`) to keep the ledger aligned; new
  migrations are created with `supabase migration new` (no MCP `apply_migration`,
  which caused the earlier timestamp drift).
- This is PR-A (Layers 0–1). Matching (offers/needs/matches/contact_requests/
  message_threads/messages), Community (posts/comments/post_likes), Events,
  Partner, and Querschnitt (feedback/notifications) land in PR-B and PR-C.
