# AGE-234 Data Model — PR-C (Community / Events / Partner / Querschnitt) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Build the remaining P4 tables — Community §4, Events §5, Partner §6, Querschnitt §7 — completing the AGE-234 table set.

**Architecture:** Single forward migration against the remote dev project, same loop as PR-A/B: probe via Supabase MCP `execute_sql` (RED) → write migration → `pnpm db:push` (main session, live approval) → re-probe (GREEN) → `get_advisors` → regenerate `src/lib/database.types.ts` → commit. `text`+`check` enums; RLS **enabled, no policies** (deferred to P5/AGE-235).

**Tech Stack:** Supabase Postgres 17, CLI 2.105 (linked `foelowldexkcqzewvrcf`), Infisical, Supabase MCP.

**Spec:** `docs/data-model.md` (P4 §4–§7, §9). **Decisions:** `docs/decisions/0001-conform-data-model-to-p4.md`. **Branch:** `donald/age-234-community-events-partner`.

> ⚠️ `pnpm db:push` mutates the shared remote project (run in main session w/ approval). Never MCP `apply_migration`. Probes are read-only.

> **Ordering note:** `partners` must be created **before** `events` (`events.host_partner_id → partners`). `posts` before `comments`/`post_likes`; `events` before `event_registrations`. `profiles`/`partner_categories` pre-exist.

> **§0 convention:** every table gets `created_at timestamptz default now()`. P4's terse specs for `post_likes` and `event_registrations` omit it; we add it per §0 (consistent with all prior tables).

---

## File Structure
- Create: `supabase/tests/probe_community_events.sql`
- Create: `supabase/migrations/<ts>_community_events_partner_querschnitt.sql`
- Modify: `src/lib/database.types.ts`

No new ADR (additive under ADR-0001).

---

## Task 1: Community/Events/Partner/Querschnitt migration

**Files:**
- Create: `supabase/tests/probe_community_events.sql`
- Create: `supabase/migrations/<ts>_community_events_partner_querschnitt.sql`
- Modify: `src/lib/database.types.ts`

- [ ] **Step 1: Write the failing probe** — create `supabase/tests/probe_community_events.sql`:

```sql
-- PR-C post-conditions (catalog-only). All TRUE after migration.
select
  to_regclass('public.posts')               is not null as posts_exists,
  to_regclass('public.comments')            is not null as comments_exists,
  to_regclass('public.post_likes')          is not null as post_likes_exists,
  to_regclass('public.partners')            is not null as partners_exists,
  to_regclass('public.events')              is not null as events_exists,
  to_regclass('public.event_registrations') is not null as event_regs_exists,
  to_regclass('public.feedback')            is not null as feedback_exists,
  to_regclass('public.notifications')       is not null as notifications_exists,
  exists (select 1 from pg_constraint where conname='event_registrations_unique')              as evt_reg_unique,
  exists (select 1 from pg_constraint c join pg_class t on t.oid=c.conrelid
          join pg_namespace n on n.oid=t.relnamespace
          where n.nspname='public' and t.relname='post_likes' and c.contype='p')               as post_likes_pk,
  exists (select 1 from pg_indexes where schemaname='public' and indexname='posts_visibility_created_at_idx') as posts_idx,
  coalesce((select bool_and(relrowsecurity) from pg_class
            where relnamespace='public'::regnamespace
              and relname in ('posts','comments','post_likes','partners','events',
                              'event_registrations','feedback','notifications')), false)        as all_rls_on;
```

- [ ] **Step 2: Run the probe (RED)** — via Supabase MCP `execute_sql` (`foelowldexkcqzewvrcf`). Expected: the eight `*_exists` columns `false`.

- [ ] **Step 3: Create the migration** — `pnpm exec supabase migration new community_events_partner_querschnitt`.

- [ ] **Step 4: Write the migration** — paste:

```sql
-- Community/Events/Partner/Querschnitt (P4 §4–§7) — AGE-234 PR-C.
-- RLS enabled, policies deferred to P5/AGE-235. Enum-like cols use text+check.
-- created_at added to every table per P4 §0 (incl. post_likes/event_registrations
-- whose terse §4/§5 specs omit it).

-- ── Community (P4 §4) ────────────────────────────────────────────────────────
create table public.posts (
  id         uuid primary key default gen_random_uuid(),
  author_id  uuid not null references public.profiles (id) on delete cascade,
  body       text not null,
  hashtags   text[],
  visibility text not null default 'members'
               check (visibility in ('public', 'members', 'prime', 'legacy')),
  created_at timestamptz not null default now()
);
alter table public.posts enable row level security;

create table public.comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts (id) on delete cascade,
  author_id  uuid not null references public.profiles (id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);
alter table public.comments enable row level security;

create table public.post_likes (
  post_id    uuid not null references public.posts (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, profile_id)
);
alter table public.post_likes enable row level security;

-- ── Partner (P4 §6) — before events (events.host_partner_id → partners) ───────
create table public.partners (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  category    text references public.partner_categories (key),
  logo_url    text,
  contact     text,
  region      text,
  description text,
  website     text,
  created_at  timestamptz not null default now()
);
alter table public.partners enable row level security;

-- ── Events (P4 §5) ───────────────────────────────────────────────────────────
create table public.events (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  type            text check (type in ('online', 'presence', 'dinner', 'workshop', 'mastermind')),
  starts_at       timestamptz,
  location        text,
  host_id         uuid references public.profiles (id) on delete set null,
  host_partner_id uuid references public.partners (id) on delete set null,
  visibility      text not null default 'public'
                    check (visibility in ('public', 'members', 'prime', 'legacy')),
  capacity        int,
  created_at      timestamptz not null default now()
);
alter table public.events enable row level security;

create table public.event_registrations (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  status     text not null default 'registered'
               check (status in ('registered', 'waitlist', 'cancelled')),
  checked_in boolean not null default false,
  rating     int check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  constraint event_registrations_unique unique (event_id, profile_id)
);
alter table public.event_registrations enable row level security;

-- ── Querschnitt (P4 §7) ──────────────────────────────────────────────────────
create table public.feedback (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  ref_type   text check (ref_type in ('event', 'match', 'course')),
  ref_id     uuid,
  rating     int check (rating between 1 and 5),
  note       text,
  created_at timestamptz not null default now()
);
alter table public.feedback enable row level security;

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  type       text,
  payload    jsonb,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
alter table public.notifications enable row level security;

-- ── indexes (P4 §9; FK columns indexed generally) ────────────────────────────
create index posts_visibility_created_at_idx   on public.posts (visibility, created_at);
create index posts_author_id_idx               on public.posts (author_id);
create index comments_post_id_idx              on public.comments (post_id);
create index comments_author_id_idx            on public.comments (author_id);
create index post_likes_profile_id_idx         on public.post_likes (profile_id);
create index partners_category_idx             on public.partners (category);
create index events_host_id_idx                on public.events (host_id);
create index events_host_partner_id_idx        on public.events (host_partner_id);
create index event_registrations_event_id_idx  on public.event_registrations (event_id);
create index event_registrations_profile_id_idx on public.event_registrations (profile_id);
create index feedback_profile_id_idx           on public.feedback (profile_id);
create index notifications_profile_id_idx       on public.notifications (profile_id);
```

- [ ] **Step 5: Apply** — `pnpm db:push` (approve live). Expected: "Finished supabase db push."
- [ ] **Step 6: Probe (GREEN)** — re-run the probe; every column `true`.
- [ ] **Step 7: Advisors** — `get_advisors` (security + performance); expect only `rls_enabled_no_policy` INFO on the 8 new tables (+ prior). No WARN/ERROR.
- [ ] **Step 8: Regenerate types** — MCP `generate_typescript_types` → `src/lib/database.types.ts` → `pnpm exec prettier --write …` → `pnpm typecheck` (pass).
- [ ] **Step 9: Commit**

```bash
export PATH="/Users/donald/.local/share/fnm/aliases/default/bin:$PATH"
export SSH_AUTH_SOCK=/Users/donald/.ssh/agent.sock
git add supabase/migrations supabase/tests/probe_community_events.sql src/lib/database.types.ts
git commit -m "feat: add community, events, partner, querschnitt tables (AGE-234)

posts/comments/post_likes (§4), events/event_registrations (§5), partners
(§6), feedback/notifications (§7) per P4 with §9 indexes. text+check enums;
created_at added per §0. RLS enabled, policies deferred to P5. Schema probe
+ regenerated types included.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Verify, review, open PR-C
- [ ] Ledger alignment (`migration list --linked`, 8 total migrations).
- [ ] Probe green; advisor sweep (only expected INFO).
- [ ] Two-stage review (spec §4–§7 coverage; then code-quality: ordering partners-before-events, post_likes composite PK, rating checks, FK cascade/set-null, index correctness) + final security review (RLS on all 8; partners has no member-data access path; feedback/notifications/posts deny-all until P5; no secrets).
- [ ] Push + open PR-C → `main` (title `feat: community, events, partner, querschnitt tables (AGE-234)`); note this completes the AGE-234 table set; RLS policies = P5.

---

## Self-Review (completed)
- **Spec coverage:** posts/comments/post_likes (§4) ✓; events (host_id/host_partner_id set-null, type/visibility checks) + event_registrations (unique, status check, rating) (§5) ✓; partners (§6, category FK→partner_categories) ✓; feedback (ref_type check, rating) + notifications (payload jsonb, read_at) (§7) ✓. §9 indexes: posts(visibility,created_at), event_registrations(event_id/profile_id), FK cols ✓.
- **Ordering:** partners before events; posts before comments/post_likes; events before event_registrations. ✓
- **Decisions:** text+check, RLS-enable-only, forward-only (ADR-0001). created_at added per §0 (documented). No placeholders.
