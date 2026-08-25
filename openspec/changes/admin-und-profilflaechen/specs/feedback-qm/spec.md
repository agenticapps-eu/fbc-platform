## MODIFIED Requirements

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

## ADDED Requirements

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
