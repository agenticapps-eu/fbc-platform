## ADDED Requirements

### Requirement: In-app bell reflects and clears unread notifications

The system SHALL wire the notification bell to the member's own `notifications`
rows, surfacing a live unread count and letting the member mark notifications
read. Marking read SHALL set only `read_at` (server timestamp) through the
existing owner-only `notifications_own` policy; no other column is mutated from
the bell, and the bell shows and mutates only the member's own rows. The unread
count SHALL stay current for the open session (realtime subscription or poll).

The bell SHALL show no count when there is nothing unread, rather than a zero.

#### Scenario: Bell shows the member's unread count

- **WHEN** a member with unread `notifications` rows opens the app
- **THEN** the bell surfaces the count of their own rows where `read_at` is null

#### Scenario: Marking a notification read sets only read_at

- **WHEN** the member marks a notification read from the bell
- **THEN** only its `read_at` is set to the server time via the owner-only
  policy and the unread count decreases

#### Scenario: Empty state

- **WHEN** a member has no unread notifications
- **THEN** the bell shows no count and offers no mark-read action

#### Scenario: A member cannot mark another member's notification read

- **WHEN** a mark-read is attempted against a row the member does not own
- **THEN** the owner-only policy denies it and no row changes

#### Scenario: The three existing types are visible at last

- **WHEN** a member has a `contact_request`, `contact_request_accepted` or
  `contact_request_declined` row
- **THEN** the bell surfaces it like any other type, with no per-type exception

### Requirement: Five member-activity events raise in-app notifications

The system SHALL raise an in-app notification, written server-side, for each of
five events: a member becoming activated, a post being created, an event being
created, a comment being made on a member's own post, and a like being placed on
a member's own post.

The notification SHALL carry the identifiers needed to reach its subject and a
short display text naming the origin — the acting member's name, or the event's
title. It SHALL NOT carry post or comment body text: a notification row is not
subject to the subject's own visibility rule once written, and body text would
outlive a later tightening of it.

A member SHALL NOT be notified about their own action.

#### Scenario: A new post notifies the members who may read it

- **WHEN** a member creates a post
- **THEN** a notification row is written for each eligible member, carrying the
  post's identifier and the author's name, and none is written for the author

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

- **WHEN** any of the five notifications is written
- **THEN** its payload contains identifiers and an origin name or title, and no
  post or comment body

### Requirement: A broadcast notification reaches only members who may see its subject

Where a notification is broadcast rather than addressed to one member, the set
of recipients SHALL be exactly the set of members permitted to read its subject
under that subject's own row-level policy. A notification SHALL NOT be written
for a member who could not read the thing it announces.

A notification is a second copy of a fact. Broadcasting one past the boundary
that governs the fact would disclose both the fact and its origin to members
from whom the platform is otherwise withholding them, and would lead them to a
page they cannot open.

Concretely, and matching the policies as they stand:

- a newly activated member SHALL be announced only to members who may read a
  full profile row;
- a post SHALL be announced only to members who may read that post at its
  visibility, and a post readable by its author alone SHALL be announced to
  nobody;
- an event SHALL be announced only to members who may read that event at its
  visibility, and an event readable by its host alone SHALL be announced to
  nobody;
- in every case only activated members SHALL be recipients.

The predicate SHALL be expressed once and shared by the triggers, so that the
notification boundary and the read boundary cannot drift apart independently.

#### Scenario: A members-only post is not announced below its level

- **WHEN** a post is created whose visibility restricts it to a level above some
  activated members
- **THEN** no notification row is written for those members, and the members at
  or above the level do receive one

#### Scenario: A public post is announced to every activated member

- **WHEN** a post is created that every activated member may read
- **THEN** every activated member other than the author receives a notification

#### Scenario: A post only its author can read is announced to nobody

- **WHEN** a post is created at a visibility no other member may read
- **THEN** no notification row is written at all

#### Scenario: A new member is not announced to members who cannot see profiles

- **WHEN** a member becomes activated
- **THEN** only members permitted to read a full profile row receive the
  announcement

#### Scenario: An event restricted to its host is announced to nobody

- **WHEN** an event is created at a visibility no other member may read
- **THEN** no notification row is written

#### Scenario: A member who is not activated receives nothing

- **WHEN** any broadcast notification is raised
- **THEN** no row is written for a member whose account is not activated

### Requirement: Each member can switch off any notification type

The system SHALL let each member switch off any of the five notification types
individually, from their settings. Each switch SHALL default to on, so that a
member who has never visited the setting is notified. A switched-off type SHALL
produce no row for that member — the notification is not written, not merely
hidden.

The setting SHALL be readable and writable only by the member it belongs to. The
server-side path that raises notifications SHALL read the recipient's setting
even though that setting is owner-only, so that switching a type off cannot fail
silently.

#### Scenario: A switched-off type writes no row

- **WHEN** a member has switched a type off and an event of that type occurs
- **THEN** no notification row is written for that member, while members who
  have not switched it off still receive theirs

#### Scenario: A member who never opened the settings is notified

- **WHEN** an event occurs and the member has no stored preference for its type
- **THEN** the notification is written

#### Scenario: Switching one type off leaves the others on

- **WHEN** a member switches exactly one type off
- **THEN** the remaining four types continue to produce notifications for them

#### Scenario: A member cannot read or change another member's switches

- **WHEN** a member attempts to read or write another member's notification
  settings
- **THEN** the owner-only policy denies it
