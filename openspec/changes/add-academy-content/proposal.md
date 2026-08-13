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

## Post-C9 note (2026-08-13, not yet acted on)

`academy-lite-and-feed-weave` (AGE-533) shipped and was archived on 2026-08-13.
It moved `academy-library` underneath this change, which is still unimplemented:

- **"My Courses is a placeholder with no enrollment" no longer exists.** C9
  removed it — the page is deleted and `/meine-kurse` redirects to `/academy`.
  The `## REMOVED` block in `specs/academy-library/spec.md` still names that
  requirement, so `openspec archive` will abort here unless the entry is dropped
  first.
- **"Academy lists curated video lessons" survived but was rewritten** by C9's
  `## MODIFIED` block: the Academy is now a filtered view of `posts` with the
  tabs "Alle" and "Meine Academy". Re-read it before restating it — the text
  this change was written against is gone.
- Consequently the enrollment and progress model below has no "My Courses"
  surface left to land on. Where course progress lives is an open design
  question, not a rename.
