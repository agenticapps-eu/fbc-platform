# Demo Seed (`demo_seed.ts`) — Design

**Date:** 2026-06-16 · **Linear:** AGE-254 · **Status:** Approved

## Goal

A presentable, internally-consistent demo world for the AGE-255 acceptance run —
personas across all tiers with complementary offers/needs, real engine-generated
matches, a community feed (with one video), upcoming events, one accepted contact
+ a sample chat — produced by a single idempotent, prod-guarded TypeScript script
runnable via `infisical run -- tsx supabase/seed/demo_seed.ts`.

Spec: `docs/community-events-spec.md §4`.

## Constraints that shape the design

1. **One shared database.** Infisical `env=dev` and `env=prod` both point at the
   single Supabase project `foelowldexkcqzewvrcf` ([[dev-equals-prod-supabase]]).
   There is no separate prod to "avoid" — the live DB is the only DB. An
   environment/ref-based guard is therefore meaningless.
2. **No service-role key in `dev` Infisical.** `SUPABASE_DB_PASSWORD` *is*
   present. A direct Postgres connection (session pooler) is the reliable path —
   it bypasses RLS and can write `auth.users`, so no service-role key is needed.
3. **A 33k curated SQL seed already exists** (`demo_personas.sql` +
   `demo_legacy_profile.sql`, committed in PR #41). It already builds personas,
   offers/needs, matches, contacts, 1 accepted + 1 pending request, and a chat.
   Only **feed posts and events are missing.**

## Decisions (user-approved)

- **Guard = explicit opt-in**, not environment detection. The script refuses
  unless `DEMO_SEED_CONFIRM=fbc-demo` is set, after printing the resolved target
  host. This is the only enforceable meaning of "no accidental run" on a shared DB.
- **TS orchestrator over existing SQL** — reuse the curated SQL verbatim, add only
  feed + events in TS. No duplication, no drift.
- **Keep `@demo.fbc.invalid`** emails (RFC-2606 non-routable; demo accounts can
  never receive real mail on the shared prod DB; matches the 17 existing personas).

## Architecture

Single script `supabase/seed/demo_seed.ts` with pure helpers extracted to
`supabase/seed/demo_seed.lib.ts` (unit-tested).

| Unit | Responsibility | Depends on |
|---|---|---|
| `demo_seed.lib.ts` | `assertOptIn(env)`, `resolveDatabaseUrl(env)`, `parseMode(env)` — pure | env only |
| `demo_seed.ts` | connect (`pg`) → guard → run SQL files → seed feed → seed events → summary; or reset | lib + `pg` + SQL files |

### Flow (seed mode)

1. `parseMode` → `seed`. `assertOptIn` throws unless confirm flag set.
2. `resolveDatabaseUrl`: `DEMO_SEED_DATABASE_URL` → else build from
   `SUPABASE_DB_PASSWORD` + session-pooler host. Print host + LIVE-DB banner.
3. Run `demo_legacy_profile.sql`, then `demo_personas.sql` (already idempotent).
4. `seedPosts()` — ~5 posts (fixed UUIDs, `on conflict (id) do nothing`),
   `hashtags[]` set, one post has a YouTube watch URL in its **body** (matches
   AGE-250 `extractFirstVideo`-from-body). A few comments + likes (composite PKs).
5. `seedEvents()` — 4 events (fixed UUIDs), distinct types, `starts_at = now()+iv`,
   host = a persona, varied capacity/visibility; one near-capacity + a `waitlist`
   registration. Registrations keyed `(event_id, profile_id)`.
6. `printSummary()` — counts (personas, posts, events, accepted requests, messages).

### Flow (reset mode, `DEMO_SEED_MODE=reset`)

Same guard. Delete demo events by fixed UUID, then
`delete from auth.users where email like '%@demo.fbc.invalid'` (cascades
profiles → posts/offers/needs/matches/chat).

## Idempotency

Existing SQL is idempotent. New rows use fixed UUIDs + `on conflict do nothing`
or composite unique keys. Two consecutive runs ⇒ identical counts.

## Testing

- **TDD (unit):** `assertOptIn`, `resolveDatabaseUrl`, `parseMode` in
  `demo_seed.lib.test.ts` (vitest `include` extended to `supabase/seed/**`).
- **Verification (evidence, not CI):** run-twice identical counts; guard-refusal
  output. Live-DB writes are not unit-tested in CI by design.

## Artifacts

- `supabase/seed/demo_seed.ts`, `supabase/seed/demo_seed.lib.ts` (+ `.test.ts`)
- `docs/demo-seed.md` (invoke + reset)
- `docs/decisions/0003-demo-seed.md` (ADR)
- `package.json` (`tsx`, `pg`, `@types/pg`; `demo:seed`/`demo:reset` scripts)
- `vite.config.ts` (test include += `supabase/seed/**/*.test.ts`)

## Out of scope

The 17 curated personas, the matching engine, RLS — unchanged.
