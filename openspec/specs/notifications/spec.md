# Notifications

## Purpose

Provides per-member in-app notifications through a `notifications` table
(`profile_id`, `type`, `payload` jsonb, nullable `read_at`) whose visibility and
mutation are owner-only via RLS. Notification rows are created server-side by a
`SECURITY DEFINER` trigger on the contact-request lifecycle, because the owner-only
policy prevents one member from writing another member's notifications directly. As
of the OpenSpec migration this capability is partial (AGE-299): the table, RLS, and
server-side inserts exist, and a single transactional lifecycle email is delivered
via Resend, but the notification-bell UI is not yet wired to read or mark
notifications and no nudge system exists. Reconstructed from code.
## Requirements
### Requirement: Owner-only notification visibility

The system SHALL enforce via the `notifications_own` RLS policy that an authenticated
member can read only `notifications` rows whose `profile_id` equals their own auth id.
Each row SHALL carry a `profile_id` (NOT NULL, FK to `profiles`, `on delete cascade`),
a `type`, a jsonb `payload`, a nullable `read_at`, and a `created_at`.

#### Scenario: Member reads only their own notifications

- **WHEN** an authenticated member queries `notifications`
- **THEN** only rows where `profile_id = auth.uid()` are returned

#### Scenario: Another member's notifications are not visible

- **WHEN** a member queries for a `notifications` row belonging to a different profile
- **THEN** RLS excludes it from the result

### Requirement: Owner marks their own notifications read

The system SHALL allow an authenticated member to update only their own
`notifications` rows (via the `notifications_own` policy, `for all` with an owner
`with check`), so that marking a notification read by setting `read_at` is permitted
only for the owner.

#### Scenario: Owner sets read_at

- **WHEN** the owning member updates one of their notification rows to set `read_at`
- **THEN** the update is accepted

#### Scenario: Non-owner cannot mark another member's notification read

- **WHEN** a member attempts to update a `notifications` row whose `profile_id` is
  not their own auth id
- **THEN** the RLS policy rejects the update

### Requirement: Server-side notification creation for the counterparty

The system SHALL create notifications for the counterparty of a contact-request event
through a `SECURITY DEFINER` trigger (`handle_contact_request_change`) that bypasses
RLS, because `notifications_own` lets a member insert rows only for themselves. The
inserted row SHALL carry a `type` and a jsonb `payload` describing the event.

#### Scenario: New contact request notifies the recipient

- **WHEN** a contact request is inserted
- **THEN** the trigger inserts a `notifications` row for the recipient (`to_id`) with
  `type = 'contact_request'` and a `payload` carrying the request context

#### Scenario: Client cannot write the counterparty's notification directly

- **WHEN** a member attempts to insert a notification for the other party from the
  client
- **THEN** the `notifications_own` `with check` clause rejects it, and only the
  server-side trigger can create it

### Requirement: Transactional lifecycle email

The system SHALL send a branded transactional email via Resend for contact-request
lifecycle events, delivered by the `notify-contact-request` edge function triggered by
a database webhook. Email delivery SHALL be independent of the in-app notification rows,
which are written separately by the lifecycle trigger.

#### Scenario: New request sends an email to the recipient

- **WHEN** the `notify-contact-request` function processes a contact-request insert
  for a recipient with an email on file
- **THEN** it sends one Resend email to that recipient and does not itself write any
  in-app notification row

#### Scenario: Recipient without an email is skipped

- **WHEN** the recipient has no email address on file
- **THEN** the function acknowledges the webhook without sending an email

### Requirement: In-app bell reflects and clears unread notifications

The system SHALL wire the notification bell to the member's own `notifications`
rows, surfacing a live unread count and letting the member mark notifications
read — one at a time and all at once. Marking read SHALL set only `read_at`
(server time) through the existing owner-only `notifications_own` policy; no
other column is mutated from the bell, and the bell shows and mutates only the
member's own rows. The unread count SHALL stay current for the open session
(realtime subscription or poll).

The bell SHALL show no count when nothing is unread, rather than a zero.

The notification payload is text a member may have written — the existing
`contact_request` type carries a free-form `message`. The bell SHALL render it
as text and never as markup.

The bell SHALL tolerate a payload whose subject no longer exists or whose fields
are absent, rendering a sentence rather than an empty row or a raw type name.

#### Scenario: Bell shows the member's unread count

- **WHEN** a member with unread `notifications` rows opens the app
- **THEN** the bell surfaces the count of their own rows where `read_at` is null

#### Scenario: Nothing unread shows no number

- **WHEN** a member has no unread notifications
- **THEN** the bell shows no count and offers no mark-read action

#### Scenario: Marking a notification read sets only read_at

- **WHEN** the member marks a notification read from the bell
- **THEN** only its `read_at` is set to the server time via the owner-only
  policy and the unread count decreases

#### Scenario: Marking everything read is one request

- **WHEN** the member marks all notifications read
- **THEN** a single request clears them, rather than one request per row

#### Scenario: A member cannot mark another member's notification read

- **WHEN** a mark-read is attempted against a row the member does not own
- **THEN** the owner-only policy denies it and no row changes

#### Scenario: A payload with a dangling subject still reads as a sentence

- **WHEN** a notification's payload is empty, or names an object that has since
  been deleted
- **THEN** the bell renders a sentence for it and does not show a raw type name

#### Scenario: The three existing types are visible at last

- **WHEN** a member has a `contact_request`, `contact_request_accepted` or
  `contact_request_declined` row
- **THEN** the bell surfaces it like any other type, with no per-type exception

### Requirement: Four member-activity events raise in-app notifications

The system SHALL raise an in-app notification, written server-side, for each of
four events: a post being created, an event being created, a comment being made
on a member's own post, and a like being placed on a member's own post.

The notification SHALL carry the identifiers needed to reach its subject and a
short display text naming the origin — the acting member's name, or the event's
title. It SHALL NOT carry post or comment body text: a notification row is not
subject to the subject's visibility once written, and body text would outlive a
later tightening of it.

A member SHALL NOT be notified about their own action.

**An event SHALL be announced exactly once.** An event with a host is mirrored
into `posts` as a `kind='event'` row by an existing trigger; announcing both the
event and its mirror would notify the same members twice. The post-created
announcement SHALL therefore apply only to member-written posts, and the event
announcement SHALL come from the event itself — so that an event **without** a
host, for which no mirror row exists, is still announced.

#### Scenario: A new post notifies the other members

- **WHEN** a member creates a post
- **THEN** a notification row is written for each eligible member, carrying the
  post's identifier and the author's name, and none is written for the author

#### Scenario: An event is announced once, not twice

- **WHEN** an event with a host is created and its mirror post row is written by
  the existing trigger
- **THEN** exactly one announcement reaches each eligible member

#### Scenario: An event without a host is still announced

- **WHEN** an event is created with no host, so no mirror post row exists
- **THEN** the event announcement is written for each eligible member

#### Scenario: A comment reaches the post's owner

- **WHEN** a member comments on another member's post
- **THEN** exactly one notification is written, to the post's owner, naming the
  commenting member

#### Scenario: A like reaches the post's owner

- **WHEN** a member likes another member's post
- **THEN** exactly one notification is written, to the post's owner, naming the
  liking member

#### Scenario: Acting on your own post notifies nobody

- **WHEN** a member comments on or likes their own post
- **THEN** no notification is written

#### Scenario: A notification carries no body text

- **WHEN** any of the four notifications is written
- **THEN** its payload contains identifiers and an origin name or title, and no
  post or comment body

### Requirement: Every recipient of a broadcast can see what it announces

Where a notification is broadcast rather than addressed to one member, every
recipient SHALL be permitted to read the announced object under that object's
own row-level policy at the moment the notification is written.

This SHALL be verified as **parity with the policy**, not as membership of a
transcribed set: for each row written, the check SHALL act as that recipient and
assert that the recipient can select the announced object.

The distinction is the whole requirement. A transcribed predicate is a copy with
an expiry date: while this change was being planned, the posts policy had
already been rewritten a day earlier — the transcription described a threshold
that no longer existed, and every test built on it would have passed while
describing the wrong system. A parity check cannot drift, because it asks the
policy instead of repeating it.

#### Scenario: Each recipient can read the post announced to them

- **WHEN** a post-created notification has been written
- **THEN** acting as each recipient in turn, that recipient can select the
  announced post

#### Scenario: Each recipient can read the event announced to them

- **WHEN** an event-created notification has been written
- **THEN** acting as each recipient in turn, that recipient can select the
  announced event

#### Scenario: A member who cannot read the object receives nothing

- **WHEN** a member exists who cannot select the announced object
- **THEN** no notification row was written for that member

#### Scenario: The parity check can fail

- **WHEN** the recipient set is deliberately widened beyond what the policy
  permits
- **THEN** the parity check fails, naming the recipient who cannot see the
  object

#### Scenario: A member who is not activated receives nothing

- **WHEN** any broadcast notification is raised
- **THEN** no row is written for a member whose account is not activated,
  deactivated or deleted

### Requirement: Each member can switch off any notification type

The system SHALL let each member switch off any of the four notification types
individually, from their settings. Each switch SHALL default to on, so that a
member who has never opened the setting is notified. A switched-off type SHALL
produce no row for that member — the notification is not written, not merely
hidden.

The setting SHALL be readable and writable only by the member it belongs to. The
server-side path that raises notifications SHALL read the recipient's setting
even though that setting is owner-only, and that path SHALL NOT be callable by
any client role: it exists only to be used by the trigger functions, so granting
it back would make it an oracle on other members' settings for no gain.

#### Scenario: A switched-off type writes no row

- **WHEN** a member has switched a type off and an event of that type occurs
- **THEN** no notification row is written for that member, while members who
  have not switched it off still receive theirs

#### Scenario: A member who never opened the settings is notified

- **WHEN** an event occurs and the member has no stored preference for its type
- **THEN** the notification is written

#### Scenario: Switching one type off leaves the others on

- **WHEN** a member switches exactly one type off
- **THEN** the remaining three types continue to produce notifications for them

#### Scenario: A member cannot read or change another member's switches

- **WHEN** a member attempts to read or write another member's notification
  settings
- **THEN** the owner-only policy denies it

#### Scenario: The opt-out lookup is not reachable from any client role

- **WHEN** a client role attempts to execute the function that reads a
  recipient's switches
- **THEN** it is refused, because no client role holds execute on it

