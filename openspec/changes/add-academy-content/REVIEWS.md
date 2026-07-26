## Reviewer: gemini

_generated 2026-07-26T09:08:10Z · timeout 180s_

VERDICT: REQUEST-CHANGES

- **Unspecified Tier Demotion Logic:** The spec doesn't define what happens if a member is enrolled in a course and their membership tier is later downgraded below the course's `min_tier`. Do they lose access? Is their progress preserved? This is a critical lifecycle scenario.
- **Missing Content Lifecycle:** There is no concept of a "draft" or "published" state for courses or lessons. This means new content is live as soon as it's created, which is problematic for content management and review workflows.
- **Vague Enrollment/Un-enrollment Mechanics:** The spec is silent on whether a member can un-enroll from a course. If they can, it's not clear what should happen to their existing `lesson_progress` data for that course.
- **No Definition of "Course Completion":** The model tracks per-lesson progress, but there is no requirement or mechanism to determine when a course itself is considered "complete" by the user.
- **No Mention of Admin/Privileged Access:** The RLS tier-gating rules don't account for staff or admin users who may need to access and manage all course content regardless of their own personal membership tier.
  Created execution plan for SessionEnd: 2 hook(s) to execute in parallel
  Expanding hook command: CMUX_BIN="${TERMLOOP_BUNDLED_CLI_PATH:-$(command -v termloop)}"; { [ -n "$TERMLOOP_SURFACE_ID" ] || [ -n "$TERMLOOP_WORKSPACE_ID" ]; } && [ "$TERMLOOP_HOOKS_DISABLED" != "1" ] && [ "$TERMLOOP_GEMINI_HOOKS_DISABLED" != "1" ] && [ -n "$CMUX_BIN" ] && [ -x "$CMUX_BIN" ] && { "$CMUX_BIN" gemini-hook session-end >/dev/null 2>/dev/null || true; echo '{}'; } || echo '{}' (cwd: /Users/donald/Sourcecode/factiv/fbc-platform)
Expanding hook command: /Users/donald/.superset/hooks/gemini-hook.sh (cwd: /Users/donald/Sourcecode/factiv/fbc-platform)
Hook execution for SessionEnd: 2 hooks executed successfully, total duration: 16ms
Created execution plan for SessionEnd: 2 hook(s) to execute in parallel
Expanding hook command: CMUX_BIN="${TERMLOOP_BUNDLED_CLI_PATH:-$(command -v termloop)}"; { [ -n "$TERMLOOP_SURFACE_ID" ] || [ -n "$TERMLOOP_WORKSPACE_ID" ]; } && [ "$TERMLOOP_HOOKS_DISABLED" != "1" ] && [ "$TERMLOOP_GEMINI_HOOKS_DISABLED" != "1" ] && [ -n "$CMUX_BIN" ] && [ -x "$CMUX_BIN" ] && { "$CMUX_BIN" gemini-hook session-end >/dev/null 2>/dev/null || true; echo '{}'; } || echo '{}' (cwd: /Users/donald/Sourcecode/factiv/fbc-platform)
  Expanding hook command: /Users/donald/.superset/hooks/gemini-hook.sh (cwd: /Users/donald/Sourcecode/factiv/fbc-platform)
  Hook execution for SessionEnd: 2 hooks executed successfully, total duration: 15ms

## Reviewer: codex

_generated 2026-07-26T09:09:12Z · timeout 180s_

VERDICT: REQUEST-CHANGES

- `lesson_resources` is omitted from tier-gating scenarios; direct queries could expose gated downloads. Its RLS must inherit the parent course’s visibility.
- Own-row progress policies are insufficient: members could record completion for lessons in courses they have not enrolled in—or cannot access. Enforce valid enrollment, lesson/course consistency, and current tier eligibility in the database.
- RLS behavior is underspecified. Define `SELECT`, `INSERT`, `UPDATE`, and `DELETE` policies, including both `USING` and `WITH CHECK`, plus the exact `auth.uid()`-to-profile mapping.
- Tier edge cases are missing: `NULL`/unknown tiers, `min_tier` defaults, missing profiles, and members downgraded after enrollment. These cases should fail closed, with defined “My Courses” behavior.
- Catalog intent is ambiguous: hiding the entire course row prevents showing a locked/upgrade card. Specify whether below-tier members may see course metadata while lessons/resources remain inaccessible.
- Required integrity constraints are absent: unique enrollment per member/course, unique progress per member/lesson, unique lesson ordering, foreign keys, and deletion behavior.
- External embed and resource references need security requirements: allowlisted HTTPS providers/domains, safe iframe sandboxing, and rejection of executable or phishing URLs.
- No publication state is defined. Tier-cleared members could read draft or incomplete database content unless courses and lessons have an enforced published/active state.

## Reviewer: opencode

_generated 2026-07-26T09:11:13Z · timeout 180s_

VERDICT: REQUEST-CHANGES

- **Spec delta is ADD-only but the change REPLACES two existing requirements.** The current `academy-library/spec.md` has "Academy lists curated video lessons" (hard-coded list) and "My Courses is a placeholder with no enrollment" (empty state). This change makes both false, yet the delta only `## ADDED Requirements`. After archive, the consolidated spec will hold contradictory requirements ("hard-coded list" AND "rendered from DB"). Must `## MODIFIED`/`## REMOVED` the two superseded requirements and re-state them as the data-driven form.
- **Enrollment tier-gate has no defined enforcement mechanism.** The `*_write_own` RLS only checks `profile_id = auth.uid()`, so a below-tier member self-inserting an enrollment row passes `write_own`. Scenario "Enrollment requires clearing the course tier" asserts rejection but names no policy. The spec must require an enrollment INSERT policy that joins `courses` and checks `has_level(courses.min_tier)` (or equivalent). Without it the scenario is unenforceable.
- **Tier downgrade mid-enrollment is unspecified.** RLS gates lesson reads by current tier, so an `exchange`-tier member enrolled in an `exchange`-gated course who downgrades to `basic` loses read access mid-course and can no longer resume, even though their `course_enrollments` row persists. Is that intended? Decision + scenario missing — likely a complaint/PII-fairness surface.
- **`courses.min_tier` column type is undefined and the helper choice conflicts with the canon.** `has_level(p_min_rank int)` takes an integer rank, but the membership-tiers spec canonizes `current_tier_rank()` as the authority every access rule reads, and `min_tier` reads like a tier _name_. Specify: is `min_tier` an `int` rank or a `text` tier key, and which helper is the gate predicate (`has_level` vs `current_tier_rank()`) — align with `access-control`/`membership-tiers`.
- **No admin / authoring requirement.** The model only specifies reads + member enrollment writes. There is no requirement/scenario/RLS for an operator to create, update, reorder, or retire courses/lessons/resources. Task 1.2 seeds rows, but ongoing authoring has no defined path — a real capability gap, especially since `lesson_resources` are downloadables that need admin upload.
- **Read RLS for own enrollments/progress is unspecified.** "My Courses" needs to read `course_enrollments`/`lesson_progress`, but the spec only addresses _writes_ (`*_write_own`). A scenario asserting the owner can read their own rows (and only their own) is missing.
- **"Resume" is promised in Why but not delivered in the delta.** Why says "members can enroll and resume," but the delta only tracks per-lesson completion — no `last_lesson_id`, position, or "resume where you left off" scenario. Either drop the resume claim from Why or add a requirement.
- **Academy landing behavior for gated courses is undecided.** Below-tier members get no rows for gated courses, so the Academy landing silently hides higher-tier courses entirely — no teaser, no upsell. Confirm whether that is intended, or whether course _cards_ should be readable while lessons/enrollment are gated (a common pattern). No scenario captures this.
- **Anonymous / unauthenticated access unspecified.** All scenarios say "a member"; nothing states whether the Academy is readable by `anon`/unauthenticated. Given `academy-library` today is member-visible and `has_level` requires `authenticated`, a scenario should assert the deny-by-default result for anon.
- **Idempotency of `mark complete` unspecified.** No unique constraint `(profile_id, lesson_id)` or upsert behavior is named — repeated "mark complete" calls could create duplicate `lesson_progress` rows. Minor but should be pinned.
- **External embed reference has no integrity constraint.** Storing arbitrary admin-supplied URLs with no validation that they belong to YouTube/Vimeo is fine for v1, but worth a note once the (currently missing) admin path lands.
