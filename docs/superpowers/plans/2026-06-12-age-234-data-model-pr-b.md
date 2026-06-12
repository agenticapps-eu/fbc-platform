# AGE-234 Data Model — PR-B (Matching) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (or superpowers:executing-plans) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Build the P4 §3 Matching tables (`offers`, `needs`, `matches`, `contact_requests`, `message_threads`, `messages`) with indexes — PR-B of the AGE-234 effort.

**Architecture:** Single forward migration against the remote dev project (no local Docker), same loop as PR-A: schema-probe via Supabase MCP `execute_sql` (RED) → write migration → `pnpm db:push` → re-probe (GREEN) → `get_advisors` → regenerate `src/lib/database.types.ts` → commit. New enums are `text`+`check`; RLS is **enabled with no policies** (deferred to P5/AGE-235). `matches` rows are created by the service-role match-engine (AGE-245), not clients — RLS-enabled/no-policy already makes the tables deny-all to `anon`/`authenticated`, so no client grants are added.

**Tech Stack:** Supabase Postgres 17, Supabase CLI 2.105 (linked to `foelowldexkcqzewvrcf`), Infisical (`pnpm db:push`), Supabase MCP (`execute_sql`, `get_advisors`, `generate_typescript_types`).

**Spec:** `docs/data-model.md` (P4 §3, §9). **Design/decisions:** `docs/superpowers/specs/2026-06-11-age-234-data-model-conform-design.md`, `docs/decisions/0001-conform-data-model-to-p4.md`. **Branch:** `donald/age-234-matching`.

> ⚠️ **Live-DB note:** `pnpm db:push` mutates the shared remote project (dev≈prod, prototype, no real users) and is run in the main session with live approval (Option B). Never use MCP `apply_migration` (ledger drift). Probes via `execute_sql` are read-only.

---

## File Structure

- Create: `supabase/migrations/<ts>_matching.sql` — all 6 matching tables + indexes.
- Create: `supabase/tests/probe_matching.sql` — catalog-only schema probe.
- Modify: `src/lib/database.types.ts` — regenerated after push.

No new ADR: PR-B is additive under ADR-0001's decisions.

---

## Task 1: Matching migration

**Files:**
- Create: `supabase/tests/probe_matching.sql`
- Create: `supabase/migrations/<ts>_matching.sql`
- Modify: `src/lib/database.types.ts`

- [ ] **Step 1: Write the failing probe**

Create `supabase/tests/probe_matching.sql` (catalog-only; runs in any state):

```sql
-- Matching post-conditions (catalog-only). All columns TRUE after migration.
select
  to_regclass('public.offers')           is not null as offers_exists,
  to_regclass('public.needs')            is not null as needs_exists,
  to_regclass('public.matches')          is not null as matches_exists,
  to_regclass('public.contact_requests') is not null as contact_requests_exists,
  to_regclass('public.message_threads')  is not null as message_threads_exists,
  to_regclass('public.messages')         is not null as messages_exists,
  exists (select 1 from pg_constraint where conname='matches_unique_pair')          as matches_unique_pair,
  exists (select 1 from pg_constraint where conname='matches_distinct_profiles')    as matches_distinct_chk,
  exists (select 1 from pg_constraint where conname='contact_requests_unique_pair') as cr_unique_pair,
  exists (select 1 from pg_constraint where conname='message_threads_unique_pair')  as mt_unique_pair,
  exists (select 1 from pg_indexes where schemaname='public' and indexname='offers_tags_gin') as offers_gin,
  exists (select 1 from pg_indexes where schemaname='public' and indexname='contact_requests_to_id_status_idx') as cr_to_status_idx,
  coalesce((select bool_and(relrowsecurity) from pg_class
            where relnamespace='public'::regnamespace
              and relname in ('offers','needs','matches','contact_requests','message_threads','messages')), false) as all_rls_on;
```

- [ ] **Step 2: Run the probe to verify it fails (RED)**

Run the file contents via Supabase MCP `execute_sql` (project `foelowldexkcqzewvrcf`).
Expected: the six `*_exists` columns `false` (tables not yet created).

- [ ] **Step 3: Create the migration file**

Run: `pnpm exec supabase migration new matching`
Expected: creates `supabase/migrations/<ts>_matching.sql` (empty).

- [ ] **Step 4: Write the migration**

Paste into the created file:

```sql
-- Matching (P4 §3) — AGE-234 PR-B. RLS enabled, policies deferred to P5/AGE-235.
-- offers/needs are member-authored; matches are created by the service-role
-- match-engine (AGE-245). message-INSERT gating (only when a contact_request is
-- accepted) is a P5 RLS concern. Enum-like columns use text+check (P4 §0).

-- ── offers — "Ich biete" (P4 §3) ─────────────────────────────────────────────
create table public.offers (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  category    text,
  theme       text check (theme in ('sein', 'tun', 'haben', 'wirken')),
  title       text not null,
  description text,
  tags        text[],
  created_at  timestamptz not null default now()
);
alter table public.offers enable row level security;

-- ── needs — "Ich suche" (offers + tx_volume_band for FBC/DKRI routing) ────────
create table public.needs (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid not null references public.profiles (id) on delete cascade,
  category       text,
  theme          text check (theme in ('sein', 'tun', 'haben', 'wirken')),
  title          text not null,
  description    text,
  tags           text[],
  tx_volume_band text check (tx_volume_band in ('lt_10k', '10k_100k', '100k_1m', '1m_10m', 'gt_10m')),
  created_at     timestamptz not null default now()
);
alter table public.needs enable row level security;

-- ── matches (created server-side by the match-engine, AGE-245) ───────────────
create table public.matches (
  id           uuid primary key default gen_random_uuid(),
  a_profile_id uuid not null references public.profiles (id) on delete cascade,
  b_profile_id uuid not null references public.profiles (id) on delete cascade,
  score        int  not null,
  basis        jsonb,
  status       text not null default 'suggested'
                 check (status in ('suggested', 'requested', 'accepted', 'declined')),
  routing      text not null default 'fbc' check (routing in ('fbc', 'dkri')),
  created_at   timestamptz not null default now(),
  constraint matches_distinct_profiles check (a_profile_id <> b_profile_id),
  constraint matches_unique_pair unique (a_profile_id, b_profile_id)
);
alter table public.matches enable row level security;

-- ── contact_requests (contact data revealed only at status='accepted', P5) ───
create table public.contact_requests (
  id         uuid primary key default gen_random_uuid(),
  from_id    uuid not null references public.profiles (id) on delete cascade,
  to_id      uuid not null references public.profiles (id) on delete cascade,
  match_id   uuid references public.matches (id) on delete set null,
  message    text,
  status     text not null default 'pending'
               check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  constraint contact_requests_unique_pair unique (from_id, to_id)
);
alter table public.contact_requests enable row level security;

-- ── message_threads ──────────────────────────────────────────────────────────
create table public.message_threads (
  id           uuid primary key default gen_random_uuid(),
  a_profile_id uuid not null references public.profiles (id) on delete cascade,
  b_profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at   timestamptz not null default now(),
  constraint message_threads_unique_pair unique (a_profile_id, b_profile_id)
);
alter table public.message_threads enable row level security;

-- ── messages ─────────────────────────────────────────────────────────────────
create table public.messages (
  id         uuid primary key default gen_random_uuid(),
  thread_id  uuid not null references public.message_threads (id) on delete cascade,
  sender_id  uuid not null references public.profiles (id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);
alter table public.messages enable row level security;

-- ── indexes (P4 §9; FK columns indexed generally) ────────────────────────────
create index offers_tags_gin                  on public.offers using gin (tags);
create index needs_tags_gin                   on public.needs using gin (tags);
create index offers_profile_id_idx            on public.offers (profile_id);
create index needs_profile_id_idx             on public.needs (profile_id);
create index matches_a_profile_id_idx         on public.matches (a_profile_id);
create index matches_b_profile_id_idx         on public.matches (b_profile_id);
create index contact_requests_to_id_status_idx on public.contact_requests (to_id, status);
create index contact_requests_from_id_idx     on public.contact_requests (from_id);
create index contact_requests_match_id_idx    on public.contact_requests (match_id);
create index message_threads_a_profile_id_idx on public.message_threads (a_profile_id);
create index message_threads_b_profile_id_idx on public.message_threads (b_profile_id);
create index messages_thread_id_idx           on public.messages (thread_id);
create index messages_sender_id_idx           on public.messages (sender_id);
```

- [ ] **Step 5: Apply the migration**

Run: `pnpm db:push` (main session; approve the live push).
Expected: applies `<ts>_matching`; "Finished supabase db push."

- [ ] **Step 6: Run the probe to verify it passes (GREEN)**

Run `supabase/tests/probe_matching.sql` via `execute_sql`. Expected: every column `true`.

- [ ] **Step 7: Advisor check**

Supabase MCP `get_advisors` (security + performance). Expected: only the expected `rls_enabled_no_policy` INFO on the 6 new tables (and the 3 pre-existing). No WARN/ERROR.

- [ ] **Step 8: Regenerate types**

Supabase MCP `generate_typescript_types` → write `src/lib/database.types.ts` → `pnpm exec prettier --write src/lib/database.types.ts` → `pnpm typecheck` (must pass).

- [ ] **Step 9: Commit**

```bash
export PATH="/Users/donald/.local/share/fnm/aliases/default/bin:$PATH"
export SSH_AUTH_SOCK=/Users/donald/.ssh/agent.sock
git add supabase/migrations supabase/tests/probe_matching.sql src/lib/database.types.ts
git commit -m "feat: add matching tables (AGE-234)

offers, needs, matches, contact_requests, message_threads, messages per
P4 §3 with §9 indexes. text+check enums; matches has distinct-profiles +
unique-pair constraints (service-role/match-engine created). RLS enabled,
policies deferred to P5. Schema probe + regenerated types included.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Verify, two-stage review, security, open PR-B

- [ ] **Step 1: Ledger alignment** — `infisical run --env=dev -- supabase migration list --linked`; all migrations aligned (7 total).
- [ ] **Step 2: Probe green** — re-run `probe_matching.sql`; all true.
- [ ] **Step 3: Advisor sweep** — `get_advisors`; only expected `rls_enabled_no_policy` INFO.
- [ ] **Step 4: Two-stage review** — spec-compliance reviewer (P4 §3 coverage, nothing extra), then code-quality reviewer (constraint/FK/index correctness, ordering: matches before contact_requests.match_id FK; message_threads before messages). Fix findings, re-review.
- [ ] **Step 5: Final security review** — RLS on all 6; no client write path to matches; contact_requests/messages deny-all until P5; no secrets.
- [ ] **Step 6: Push + PR** — `git push -u origin donald/age-234-matching`; open PR-B → `main` (title `feat: matching tables (AGE-234)`), summarize §3 tables, link spec/ADR, note RLS policies = P5.

---

## Self-Review (completed)

- **Spec coverage (P4 §3):** offers ✓, needs (+tx_volume_band) ✓, matches (+distinct/unique constraints, status/routing checks) ✓, contact_requests (+unique pair, match_id on delete set null) ✓, message_threads (+unique pair) ✓, messages ✓. §9 indexes: offers/needs GIN, matches a/b, contact_requests(to_id,status), all FK cols ✓.
- **Ordering:** matches created before contact_requests (FK match_id); message_threads before messages (FK thread_id). Correct.
- **Placeholders:** none. **Decisions:** consistent with ADR-0001 (text+check, RLS-enable-only, forward-only).
