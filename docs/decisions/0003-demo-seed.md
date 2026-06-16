# ADR-0003: Demo seed as a prod-guarded TS orchestrator over the existing SQL

**Status**: Accepted  **Date**: 2026-06-16  **Linear**: AGE-254

## Context

Spec §4 (`docs/community-events-spec.md`) asks for a demo world produced by a
Node/TS seed script (`supabase/seed/demo_seed.ts`, run via `tsx`), idempotent and
"never against prod". Three realities complicate the literal reading:

1. **dev == prod.** Infisical `env=dev` and `env=prod` both target the single
   Supabase project `foelowldexkcqzewvrcf`. There is no separate prod database, so
   a guard that detects "prod" by environment or project-ref cannot work.
2. **No service-role key in the `dev` Infisical env;** `SUPABASE_DB_PASSWORD` is
   present.
3. A curated 33k SQL seed (`demo_personas.sql` + `demo_legacy_profile.sql`,
   PR #41) already builds personas, offers/needs, matches, contacts, one accepted
   + one pending request, and a chat. Only feed posts and events are missing.

## Decision

- **Connect via a direct Postgres connection (`pg`, session pooler) using
  `SUPABASE_DB_PASSWORD`** — not the service-role REST key. The DB role bypasses
  RLS and can write `auth.users`, and it can run the existing SQL verbatim.
- **The "prod guard" is an explicit opt-in**, not environment detection: the
  script refuses unless `DEMO_SEED_CONFIRM=fbc-demo`, after printing the resolved
  target host and a "writes to the LIVE shared project" banner. On a single shared
  DB, preventing an *accidental* run is the only enforceable safety property.
- **The TS script orchestrates the existing curated SQL** and adds only the
  missing feed + events in TS. No re-derivation of the curated content.
- **Keep `@demo.fbc.invalid`** persona emails (RFC-2606 non-routable) so demo
  accounts can never receive real transactional mail on the shared prod DB.

## Alternatives Rejected

- **Full standalone TS rewrite** (auth admin API + table writes, deprecate the
  SQL): re-creates 41k of curated, already-reviewed content → regression/drift
  risk for no benefit.
- **Environment/ref-based guard**: impossible — dev and prod are the same project.
- **Separate demo/staging Supabase project**: clean isolation but new infra,
  secrets, and migration-sync burden; out of scope for the prototype.
- **`@demo.fairbusinessclub.de` emails** (spec's example): risks delivering real
  mail if the domain exists, and diverges from the 17 already-seeded personas.

## Consequences

- A `DATABASE_URL`-style secret is not required; the script derives the
  connection from `SUPABASE_DB_PASSWORD` (override via `DEMO_SEED_DATABASE_URL`).
- New devDeps: `tsx`, `pg`, `@types/pg`. New scripts: `demo:seed`, `demo:reset`.
- "Idempotent + prod-guarded" is verified by run-twice evidence and guard-refusal
  output, plus unit tests on the pure guard/connection helpers — not by a CI test
  that writes to the live DB.
- If a dedicated demo project is provisioned later, only `resolveDatabaseUrl` and
  the guard's host banner change; the seed logic is unaffected.
