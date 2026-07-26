## ADDED Requirements

### Requirement: Academy content is a real course model

The system SHALL store Academy content as data in `courses`, `lessons` and
`lesson_resources` tables — a course carrying a title and description, each lesson
belonging to a course with an ordering and an external embed reference, and each
resource an optional downloadable attached to a lesson — and SHALL render the
Academy from these tables rather than a hard-coded, code-defined list. The
platform SHALL NOT host video content itself; only the embed reference is stored.

#### Scenario: Academy renders courses from the database

- **WHEN** a member opens the Academy page
- **THEN** the courses and their ordered lessons shown are read from the
  `courses`/`lessons` tables, not from a code-defined array

#### Scenario: A lesson references an externally hosted video

- **WHEN** a lesson is displayed
- **THEN** its video is played from the stored external embed reference
  (YouTube/Vimeo) and no media file is hosted by the platform

### Requirement: Members enroll and their lesson progress is tracked

The system SHALL let a member enroll in a course and record per-lesson completion,
storing enrollment in `course_enrollments` and completion in `lesson_progress`,
each row tied to the member's own profile and writable only by that member
(enforced by `*_write_own` RLS). "My Courses" SHALL reflect the member's real
enrollments and progress instead of a static empty state.

#### Scenario: Member enrolls and completes a lesson

- **WHEN** an enrolled member marks a lesson complete
- **THEN** a `lesson_progress` row is written for that member and lesson, and
  "My Courses" shows the course with its updated completion

#### Scenario: A member cannot write another member's progress

- **WHEN** a member attempts to insert or update a `course_enrollments` or
  `lesson_progress` row whose `profile_id` is not their own
- **THEN** the `*_write_own` RLS policy denies the write

### Requirement: Course access is gated by membership tier

The system SHALL reserve each course for members whose tier clears the course's
required tier (`courses.min_tier`), enforced by RLS in the database using the
existing tier/`has_level` helper so the gate holds independently of the client. A
member whose tier does not clear a course SHALL NOT be able to read its lessons or
enroll in it.

#### Scenario: Below-tier member is denied a gated course

- **WHEN** a member whose tier is below a course's `min_tier` selects that course
  or its lessons
- **THEN** RLS returns no rows for that course

#### Scenario: Enrollment requires clearing the course tier

- **WHEN** a member below a course's `min_tier` attempts to enroll
- **THEN** the enrollment is rejected because the tier gate is not cleared

#### Scenario: Cleared-tier member reads and enrolls

- **WHEN** a member whose tier clears a course's `min_tier` opens it
- **THEN** the course and its lessons are readable and the member may enroll
