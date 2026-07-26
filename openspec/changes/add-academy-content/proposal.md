# Add data-driven Academy content, enrollment and tier-gated access

## Why

The Academy is a placeholder today: it renders a small, hard-coded list of
curated video lessons with no content schema, no enrollment, and no progress
tracking, and "My Courses" only shows an empty state (`academy-library`).
Phase 1 needs a real learning surface where courses and their lessons are data,
members can enroll and resume, and richer content is reserved for higher tiers.
Linear: **AGE-262**.

## What Changes

- Replace the hard-coded lesson stub with a real content model of courses, lessons
  and downloadable resources (each with a `published` state), seeded via migration.
- Let a member enroll and track per-lesson completion; "My Courses" surfaces the
  next incomplete lesson (resume) and marks a course complete when all lessons are.
- **Enrollment is the tier gate**: enrolling requires clearing `courses.min_tier`
  (int rank, `has_level`); course cards stay visible to all for upsell, lessons and
  resources are readable only once enrolled, and access persists after a later
  downgrade.

## Impact

- Affected capability: `academy-library`.
- Removes the two prototype requirements (hard-coded list, placeholder My Courses)
  via `## REMOVED` blocks.
- New tables: courses, lessons, resources, enrollments, lesson progress — with RLS,
  explicit grants, and integrity constraints (unique enrollment/progress, unique
  lesson ordering). `anon` denied by default.
- Videos remain externally hosted (allowlisted YouTube/Vimeo embed reference only).
- No change to the tier authority model: `profiles.tier` remains the sole rank
  source; the enrollment gate reads it, never writes it.

## Out of scope (named follow-up)

- Admin content authoring UI (incl. resource upload) — fits `add-admin-console`;
  content is seeded via migration for now.
- Un-enrollment mechanics.
