# Add data-driven Academy content, enrollment and tier-gated access

## Why

The Academy is a placeholder today: it renders a small, hard-coded list of
curated video lessons with no content schema, no enrollment, and no progress
tracking, and "My Courses" only shows an empty state (`academy-library`).
Phase 1 needs a real learning surface where courses and their lessons are data,
members can enroll and resume, and richer content is reserved for higher tiers.
Linear: **AGE-262**.

## What Changes

- Replace the hard-coded lesson stub with a real content model of courses,
  lessons and downloadable resources stored in the database.
- Let a member enroll in a course and track per-lesson completion so "My Courses"
  reflects real progress.
- Gate access to a course by the viewer's membership tier, enforced in the
  database (RLS), not only in the UI.

## Impact

- Affected capability: `academy-library`.
- New tables for courses, lessons, resources, enrollments and lesson progress,
  each with RLS; the Academy and My Courses pages read from them instead of the
  code-defined array.
- Videos remain externally hosted (YouTube/Vimeo); the platform stores lesson
  metadata and the embed reference, not the media.
- No change to the tier authority model: `profiles.tier` remains the sole source
  of a member's rank; the new access gate reads it, never writes it.
