# Legacy planning archive (read-only)

This directory preserves the pre-OpenSpec planning history of the FBC platform,
moved here by the migration to the AgenticApps v2 workflow (OpenSpec + Superpowers)
on 2026-07-25. **It is historical reference, not current truth.**

Current truth lives in:

- `openspec/specs/<capability>/spec.md` — the durable capability specifications,
  reconstructed from the code (migrations + `src/`) as of the migration.
- `openspec/changes/` — in-flight changes.
- Linear — the source of truth for status (project "FBC Plattform – Roadmap").

## What moved here

- `PROJECT.md`, `ROADMAP.md`, `STATE.md` — GSD-era planning docs (Linear-mirrored).
- `current-phase/` — the last GSD phase markers.
- `data-model.md`, `matching-spec.md`, `profile-spec.md`, `community-events-spec.md`,
  `rls-policies.md` — P4/P5-era design specs. **Superseded**: e.g. these describe a
  3- or 7-tier membership model; current truth is the **6-level model** (basic,
  connect, discover, exchange, focus, impact — AGE-311). Read them for rationale,
  not for the current schema.

## Not committed (gitignored — this repo is public)

Preserved on local disk but kept out of git history:

- `qa-screens/` — ~11 MB of app screenshots (logged-in tier states).
- `skill-observations/` — agent session telemetry.
- `design-mocks/` — binary design references.

The live workflow config remains at `.planning/config.json` (not moved).
