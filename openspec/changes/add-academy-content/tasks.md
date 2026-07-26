# Tasks

## 1. Content model

- [ ] 1.1 Add `courses`, `lessons` and `lesson_resources` tables (title, description, ordering, external embed reference) with RLS + grants
- [ ] 1.2 Migrate the hard-coded lesson list into seed rows and remove the code-defined stub
- [ ] 1.3 Render the Academy page from the `courses`/`lessons` tables instead of the static array

## 2. Enrollment and progress

- [ ] 2.1 Add `course_enrollments` and `lesson_progress` tables scoped to the owning member with `*_write_own` RLS
- [ ] 2.2 Provide enroll and mark-lesson-complete actions for a member's own enrollment
- [ ] 2.3 Render "My Courses" from real enrollment + progress rows (replace the empty-state placeholder)

## 3. Tier-gated access

- [ ] 3.1 Add a `min_tier` (required tier) column on `courses`
- [ ] 3.2 Enforce course/lesson read access by the caller's tier via RLS using the existing `has_level`/tier helper
- [ ] 3.3 Deny enrollment into a course the member's tier does not clear

## 4. Verification

- [ ] 4.1 Test: Academy lists courses and lessons sourced from the database
- [ ] 4.2 Test: enrolling then completing a lesson updates the member's progress
- [ ] 4.3 Test: a below-tier member cannot read or enroll in a gated course
