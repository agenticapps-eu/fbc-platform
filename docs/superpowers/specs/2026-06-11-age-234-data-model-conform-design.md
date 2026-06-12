# Design — Conform FBC data model to P4 spec (AGE-234)

**Date:** 2026-06-11 **Linear:** AGE-234 **Spec:** `docs/data-model.md` (P4, binding)
**Status:** Approved (brainstorming)

## Goal

Bring the FBC data model into conformance with the binding P4 specification
(`docs/data-model.md`). The foundation slice already merged to `main`
(`profiles`, `profile_contacts`, a 3-value `membership_level` PG enum, and
misplaced routing columns) diverges from P4 in several ways, and ~17 spec
tables are not yet built. This design covers the rework **and** the additive
build, forward-only.

"Done" = P4 §10 Definition of Done is verifiably satisfied: all tables, views,
functions, triggers exist; RLS enabled on every table (policies deferred to P5);
`membership_tiers` + `partner_categories` seeded; `db push` updates remote
cleanly; `src/lib/database.types.ts` regenerated.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Rework strategy | **Forward corrective migrations** | Never rewrite merged/applied migrations; team-safe; `db reset` replays cleanly. Preserves the just-repaired ledger. |
| RLS phasing | **Enable RLS only on new tables, no policies** | Matches P4 §0 (policies = P5/AGE-235). Existing foundation policies on `profiles`/`profile_contacts` are kept as-is. |
| Enum mechanism | **`text` + `check`** for all new enums | P4 §0 ("einfacher migrierbar als PG-Enums"). Existing PG enums are dropped during the foundation rework. |
| PR grouping | **3 PRs** | PR-A = foundation rework + stammdaten/Ebene-2 prep; PR-B = matching; PR-C = community + events + partner + querschnitt. |
| `profiles.headline` | **Dropped** | No P4 equivalent, no data. |

## Layering

Eight forward migrations, three PRs. Each migration: write SQL → `pnpm db:push`
→ `get_advisors` (expect 0 lint) → regenerate `database.types.ts`.

**PR-A**
- **Layer 0 — Foundation conform:** `membership_tiers` (+7 seeds), rework
  `profiles`, rework `profile_contacts`, drop PG enums, `profiles_public` view,
  `current_tier_rank()`, profile indexes.
- **Layer 1 — Stammdaten + Ebene-2 prep:** `partner_categories` (+6 seeds),
  `compass_responses`.

**PR-B**
- **Layer 2 — Matching:** `offers`, `needs`, `matches`, `contact_requests`,
  `message_threads`, `messages` + indexes.

**PR-C**
- **Layer 3 — Community:** `posts`, `comments`, `post_likes`.
- **Layer 4 — Events:** `events`, `event_registrations`.
- **Layer 5 — Partner:** `partners`.
- **Layer 6 — Querschnitt:** `feedback`, `notifications`.

## Layer 0 — Foundation corrective migration (highest risk)

Forward-only ALTERs against the live tables.

### `membership_tiers` (new)
`key text PK`, `label text not null`, `price_year int not null`,
`level_rank int not null unique`. Seed the 7 tiers
(discover=1/0 … explore … impuls … active … prime … circle … legacy=7/4800)
per P4 §1.

### `profiles` rework
- Rename/remap: `display_name → name`, `bio → short_bio`.
- Add: `region text`, `branche text`, `tier text default 'discover'`
  (FK → `membership_tiers(key)`), `potential_score int not null default 0`,
  `profile_completion int not null default 0`, `is_public bool not null default true`,
  `interests text[]`, `competencies text[]`, `goals text`, `website text`,
  `socials jsonb`.
- Migrate tier: `tier = membership_level::text` (the 3 live values are valid
  keys in the 7-tier table), then drop `membership_level` column **and** the
  `membership_level` PG enum type.
- Drop misplaced routing columns `potential_level`, `tx_volume_band`,
  `routing_target`, and drop the `routing_target` PG enum (these belong on
  `compass_responses`/`needs`/`matches` as `text`+`check`).
- Drop `headline`.

### `profile_contacts` rework
- Drop `website` (moves to `profiles`); keep `email`, `phone`.

### Grants / trigger
- Client `UPDATE` grant on `profiles` = new editable set: `name`, `avatar_url`,
  `region`, `company`, `short_bio`, `branche`, `is_public`, `interests`,
  `competencies`, `goals`, `website`, `socials`. **Not** `tier`,
  `potential_score`, `profile_completion` (server/admin-only — same protection
  as before).
- `handle_new_user()` inserts `(id, name, tier='discover')`.

### View / function / indexes
- View `profiles_public` = `id, name, avatar_url, region, company, short_bio`
  where `is_public`.
- Function `current_tier_rank()` (`security definer`, `set search_path`),
  joining `profiles.tier` → `membership_tiers.level_rank` for `auth.uid()`.
- Indexes: `profiles(tier)`, `profiles(region)`, `profiles(branche)`,
  GIN on `profiles(interests)`, `profiles(competencies)`.

## Conventions (P4 §0)

- New enums = `text` + `check`.
- RLS enabled on every new table, **no policies** (incl. reference tables
  `membership_tiers`/`partner_categories` → deny-all to clients until P5).
- `updated_at` trigger only on editable tables.
- `text[]` columns get GIN indexes; apply the §9 index list per table.
- Match-engine / service-role-created rows (`matches`) are not client-insertable.

## Testing & verification (per layer)

TDD-style: before each migration, a SQL schema-probe that **fails** (table /
column / constraint / seed not yet present), then passes after `db push`.
Plus per layer:
- `get_advisors` → 0 lint.
- Seed-row counts: `membership_tiers` = 7, `partner_categories` = 6.
- Regenerated `database.types.ts` diff committed.
- Final: `supabase migration list --linked` fully aligned; ADR in
  `docs/decisions/` recording the conform-to-spec rework.

## Out of scope

- RLS **policies** (P5 / AGE-235).
- Match-engine logic (AGE-245), routing logic (AGE-249), potential-score rules
  (AGE-242), profile-completion computation.
- Any frontend.
