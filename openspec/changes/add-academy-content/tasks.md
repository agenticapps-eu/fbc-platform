# Tasks

## 1. Content model

- [ ] 1.1 Add `courses` (title, description, `min_tier` int rank, `published`),
      `lessons` (course FK, unique ordering, `published`, embed reference) and
      `lesson_resources` (lesson FK, downloadable) with RLS + explicit grants
- [ ] 1.2 Seed the current hard-coded lessons as published rows via migration and
      remove the code-defined stub
- [ ] 1.3 Render the Academy from the tables (published only), showing course cards
      for above-tier courses

## 2. Enrollment and progress

- [ ] 2.1 `course_enrollments` unique per `(member, course)`; INSERT `WITH CHECK`
      joins `courses` and requires `has_level(courses.min_tier)`; own-row SELECT
- [ ] 2.2 `lesson_progress` unique per `(member, lesson)`, idempotent; own-row RLS;
      writable only for lessons in an enrolled course
- [ ] 2.3 Gate lesson/resource SELECT on an existing enrollment (access persists
      after a later tier downgrade)
- [ ] 2.4 Render "My Courses" from real enrollment + progress; surface the next
      incomplete lesson (resume) and mark a course complete when all lessons are

## 3. Access model

- [ ] 3.1 Course-card metadata readable by any authenticated member (for the
      locked/upsell card); lessons/resources enrolled-only; `anon` denied
- [ ] 3.2 Restrict embed references to allowlisted YouTube/Vimeo URLs

## 4. Verification

- [ ] 4.1 Test: Academy lists published courses/lessons from the database; drafts hidden
- [ ] 4.2 Test: a below-tier member sees the course card but no lessons/resources, and
      cannot enroll
- [ ] 4.3 Test: enrolling then completing lessons updates progress; a repeated
      mark-complete is idempotent; a course completes when all lessons are
- [ ] 4.4 Test: an enrolled member keeps access after a downgrade; `anon` sees nothing

## Out of scope (named follow-up)

- Admin content authoring UI (create/edit/reorder/retire courses & lessons,
  resource upload) — a named follow-up fitting `add-admin-console`; content is
  seeded via migration for now.
- Un-enrollment mechanics.
