# Feedback & QM

## Purpose

Captures member feedback across the FBC community platform in a single
`feedback` table that serves two shapes: action-bound ratings tied to an
event/match/course (the original P4 §7 model), and platform-wide quality-management
(QM) feedback — a star rating plus three free-text questions collected against the
route the member is on. Members write only their own feedback (RLS); a dedicated
admin path aggregates all feedback with author names for review. Reconstructed from
code as of the OpenSpec migration.
## Requirements
### Requirement: Feedback rows belong to a member

The system SHALL store every feedback row in `public.feedback` tied to a
`profile_id` (NOT NULL, FK to `profiles`, `on delete cascade`), and SHALL support
an optional action reference via `ref_type` (one of `event`, `match`, `course`) and
`ref_id`, an optional `rating` constrained to 1–5, and a free-text `note`.

#### Scenario: Action-bound feedback references an activity

- **WHEN** a member submits feedback about an event, match, or course
- **THEN** the row records `profile_id`, a `ref_type` from the allowed set, the
  `ref_id`, and a `rating` between 1 and 5

#### Scenario: Rating outside 1–5 is rejected

- **WHEN** a write sets `rating` to a value below 1 or above 5
- **THEN** the check constraint rejects the write

### Requirement: Platform QM feedback (MVP)

The system SHALL support platform-wide QM feedback in the same `feedback` table via
the columns `likes`, `misses`, `idea`, and `route`, where `ref_type`/`ref_id` remain
NULL and `route` records the path the feedback originated from. The QM widget SHALL
collect a 1–5 star rating together with the three questions "Was gefällt dir?",
"Was fehlt dir?", and "Welche Idee hast du?".

#### Scenario: Member submits platform feedback

- **WHEN** an authenticated member submits the QM feedback form
- **THEN** a `feedback` row is inserted with the star `rating`, `likes`, `misses`,
  `idea`, and the current `route`, and with `ref_type`/`ref_id` left NULL

#### Scenario: Submit requires a star rating

- **WHEN** the member has not selected a star rating
- **THEN** the QM widget disables submission

### Requirement: A member writes only their own feedback

The system SHALL enforce via the `feedback_own` RLS policy that an authenticated
member can insert, read, update, and delete only `feedback` rows whose `profile_id`
equals their own auth id.

#### Scenario: Member inserts feedback under their own id

- **WHEN** an authenticated member inserts a `feedback` row with
  `profile_id = auth.uid()`
- **THEN** the row is accepted

#### Scenario: Member cannot write feedback for another profile

- **WHEN** a member attempts to insert a `feedback` row whose `profile_id` is not
  their own auth id
- **THEN** the RLS `with check` clause rejects the write

### Requirement: Admin-only aggregate read

The system SHALL restrict aggregate reads of all feedback to admins. A
`SECURITY DEFINER` function `is_admin()` SHALL report whether the caller holds the
`admin` staff role, the `feedback_admin_read` policy SHALL grant admins `select` on
all `feedback` rows, and the `SECURITY DEFINER` function `admin_list_feedback()`
SHALL return feedback rows with the resolved author name — returning no rows to
any non-admin caller (including `matching_manager`).

The function SHALL take `p_limit` and `p_offset`, both with defaults, and SHALL
clamp `p_limit` into a bounded range rather than rejecting an out-of-range value:
a listing RPC has no error case its caller could act on. It SHALL additionally
return the author's `profile_id`, so that a later capability can address the
author directly instead of matching on a display name — a name is not an
identity, and two members may share one.

#### Scenario: Admin lists all feedback with author names

- **WHEN** a caller for whom `is_admin()` is true calls `admin_list_feedback()`
- **THEN** it returns feedback rows joined to the author's name (falling back
  to a placeholder when the name cannot be resolved), ordered by `created_at`
  descending

#### Scenario: Non-admin receives no rows

- **WHEN** a non-admin caller invokes `admin_list_feedback()`
- **THEN** the `where public.is_admin()` filter yields an empty result

#### Scenario: The admin pages through the feedback

- **WHEN** an admin calls `admin_list_feedback(p_limit => 2, p_offset => 2)` over
  a stock of more than four rows
- **THEN** it returns the third and fourth row of the same descending order, and
  no row appears in both the first and the second page

#### Scenario: An out-of-range page size is clamped, not refused

- **WHEN** an admin calls the function with a `p_limit` of zero, of `null`, or of
  a number far above the permitted maximum
- **THEN** the call succeeds and returns a row count inside the permitted range,
  rather than raising

#### Scenario: The author is identified, not just named

- **WHEN** an admin lists feedback written by a member
- **THEN** each row carries that member's `profile_id` alongside the display
  name, and the two refer to the same member

### Requirement: Platform feedback is excluded from the potential score

The system SHALL count only action-bound feedback toward a member's potential score.
`recompute_potential_score()` SHALL aggregate feedback ratings only where
`ref_type is not null`, so a member's platform (QM) feedback does not influence their
own score.

#### Scenario: QM feedback does not move the score

- **WHEN** `recompute_potential_score()` computes the feedback component for a member
- **THEN** it averages only feedback rows with a non-null `ref_type`, ignoring
  platform QM rows (where `ref_type` is NULL)

### Requirement: Der Feedback-Knopf schwebt nur dort, wo er nichts verdeckt

Der schwebende Feedback-Knopf SHALL unterhalb des `sm`-Breakpoints **nicht**
schweben, sondern am Ende der Seite im Dokumentfluss stehen. Ab `sm` SHALL er
unverändert unten rechts schweben.

Er SHALL NOT stattdessen um einige Pixel verschoben werden. Ein fester Knopf
über einer Kachelreihe kollidierte beim nächsten Formular wieder, und dann
merkte es niemand, weil niemand danach messen würde.

Der Anlass ist gemessen (AGE-528, Task 9.7): auf 375×812 mit geöffnetem
Composer liegt der Knopf (240–340 × 690–732) auf der kuratierten Kachel
„Frage" (240–299 × 697–723); `document.elementFromPoint` in deren Mitte
liefert „Feedback".

#### Scenario: Auf dem Telefon verdeckt er keine Bedienelemente

- **WHEN** die Seite auf 375 px Breite mit geöffnetem Composer am Seitenanfang
  dargestellt wird
- **THEN** steht der Feedback-Knopf im Dokumentfluss am Seitenende
- **AND** `document.elementFromPoint` in der Mitte jeder sichtbaren kuratierten
  Kachel liefert diese Kachel, nicht den Feedback-Knopf

#### Scenario: Am Schreibtisch bleibt alles wie es war

- **WHEN** die Seite ab dem `sm`-Breakpoint dargestellt wird
- **THEN** schwebt der Knopf unverändert unten rechts

### Requirement: Die Admin-Sicht auf das Feedback ist eine eigene Fläche

The QM feedback SHALL live on its own admin route with its own entry in the
administration menu, and SHALL NOT additionally be rendered on the collected
admin settings page. Two surfaces over one dataset drift apart as soon as one of
them gains paging or filters, and the reader has no way to tell which of the two
is behind.

The surface SHALL page through the feedback rather than render the whole stock,
and it SHALL NOT flatten a failed load into an empty list: a surface that turns a
refused call into "there is no feedback" asserts something about the stock.

#### Scenario: The feedback has its own route

- **WHEN** an admin opens the administration menu
- **THEN** it offers an entry leading to a route that shows the QM feedback, and
  that route is guarded so a non-admin is redirected away

#### Scenario: The collected settings page no longer shows feedback

- **WHEN** an admin opens the collected admin settings page
- **THEN** no QM feedback is rendered there, for any caller including an admin

#### Scenario: A failed load is not an empty stock

- **WHEN** the call behind the feedback surface fails
- **THEN** the surface says so, and does not show the empty state it would show
  for a stock with no feedback in it

