## REMOVED Requirements

### Requirement: Academy lists curated video lessons

**Reason:** Superseded by "Academy content is a real course model" — the hard-coded
lesson list is replaced by database-backed courses/lessons.

### Requirement: My Courses is a placeholder with no enrollment

**Reason:** Superseded by "Members enroll and their lesson progress is tracked" —
My Courses now reflects real enrollments and progress.

## ADDED Requirements

### Requirement: Academy content is a real course model

The system SHALL store Academy content as data in `courses`, `lessons` and
`lesson_resources` tables — a course carrying a title, description, an integer
`min_tier` rank, and a published state; each lesson belonging to a course with a
unique ordering, a published state, and an external embed reference; each resource
an optional downloadable attached to a lesson — and SHALL render the Academy from
these tables rather than a hard-coded list. Only **published** courses/lessons are
visible to members. The platform SHALL NOT host video content itself; only the
embed reference (an allowlisted YouTube/Vimeo URL) is stored.

#### Scenario: Academy renders published courses from the database

- **WHEN** a member opens the Academy page
- **THEN** the published courses and their ordered published lessons are read from
  the `courses`/`lessons` tables, not from a code-defined array

#### Scenario: Draft content is not visible to members

- **WHEN** a course or lesson is not published
- **THEN** it is not returned to members

#### Scenario: A lesson references an externally hosted video

- **WHEN** a lesson is displayed
- **THEN** its video is played from the stored external embed reference
  (allowlisted YouTube/Vimeo) and no media file is hosted by the platform

### Requirement: Course cards are visible for upsell; lessons are gated by enrollment

The system SHALL let any authenticated member read published course **metadata**
(title, description, required tier) as a catalog card — including for courses above
their tier, so a locked/upsell card can be shown — while a course's **lessons and
resources** are readable only to members enrolled in that course. Unauthenticated
(`anon`) callers SHALL see nothing (deny by default).

#### Scenario: Below-tier member sees the card but not the lessons

- **WHEN** a member whose tier is below a course's `min_tier` views the Academy
- **THEN** the course card (metadata) is readable, but its lessons and resources
  return no rows

#### Scenario: Lesson resources inherit the lesson's gating

- **WHEN** a member who is not enrolled in a course queries a `lesson_resources` row
  belonging to it
- **THEN** RLS returns no row (resources inherit the enrolled-only gate)

#### Scenario: Anonymous caller sees nothing

- **WHEN** an unauthenticated caller queries any Academy table
- **THEN** RLS returns no rows

### Requirement: Enrollment is tier-gated; access persists once enrolled

The system SHALL let a member enroll in a published course only when their tier
clears the course's `min_tier`, enforced by an INSERT policy on
`course_enrollments` whose `WITH CHECK` joins `courses` and requires
`has_level(courses.min_tier)`. Enrollment is unique per `(member, course)`. Once
enrolled, the member SHALL retain read access to that course's lessons and
resources even if their tier is later downgraded (the gate is at enrollment, not on
every read). A member SHALL read only their own enrollment and progress rows.

#### Scenario: Below-tier member cannot enroll

- **WHEN** a member below a course's `min_tier` attempts to enroll
- **THEN** the INSERT policy's `WITH CHECK` rejects it

#### Scenario: Enrolled member keeps access after a downgrade

- **WHEN** an enrolled member's tier is later downgraded below the course's `min_tier`
- **THEN** they can still read that course's lessons and resume, because access is
  keyed to their existing enrollment

#### Scenario: A member cannot read or write another member's enrollment/progress

- **WHEN** a member attempts to read, insert, or update a `course_enrollments` or
  `lesson_progress` row whose `profile_id` is not their own
- **THEN** the own-row RLS policy denies it

### Requirement: Lesson progress and course completion are tracked

The system SHALL record per-lesson completion in `lesson_progress`, unique per
`(member, lesson)` and idempotent (a repeated mark-complete does not create a
duplicate), writable only by the enrolled member and only for lessons in a course
they are enrolled in. "My Courses" SHALL reflect the member's enrollments, surface
the next incomplete lesson so they can resume, and mark a course complete when every
published lesson in it is complete.

#### Scenario: Member completes a lesson and resumes

- **WHEN** an enrolled member marks a lesson complete
- **THEN** a `lesson_progress` row is written (idempotently) and "My Courses" shows
  the course's updated progress and the next incomplete lesson

#### Scenario: A course is complete when all its lessons are

- **WHEN** an enrolled member has completed every published lesson in a course
- **THEN** "My Courses" marks that course complete

#### Scenario: Progress cannot be recorded without enrollment

- **WHEN** a member marks a lesson complete for a course they are not enrolled in
- **THEN** the write is denied
