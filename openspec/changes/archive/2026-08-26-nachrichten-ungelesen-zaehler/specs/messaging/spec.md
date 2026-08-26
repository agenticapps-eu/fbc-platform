## ADDED Requirements

### Requirement: A read position is private to the member it belongs to

The system SHALL record a member's read position on a thread as a row owned by
that member in `public.thread_read_positions`, keyed by `(thread_id,
profile_id)`, and SHALL permit a member to see and write only rows whose
`profile_id` is their own.

A read position SHALL NOT be stored on `public.message_threads`. That table is
readable by both participants, so a column on it would disclose to each
participant when the other last opened the conversation — a read receipt at
thread granularity, which this capability does not provide. A column-level grant
SHALL NOT be treated as a remedy: the restriction is row-dependent (which column
is mine depends on which side of the pair I am) and a column grant is
row-independent.

Writing a read position SHALL additionally require that the member participates
in the thread, so that a row cannot be created against a conversation the member
has nothing to do with.

An absent read position SHALL mean the member has never opened the thread, and
SHALL NOT be treated as "everything read".

#### Scenario: A participant cannot see the counterpart's read position

- **WHEN** a thread participant queries read positions for their thread
- **THEN** only their own row is returned, and the counterpart's row is not
  disclosed by this or any other read surface

#### Scenario: A member advances only their own read position

- **WHEN** a member marks a thread read
- **THEN** their own row is written and the counterpart's row is unchanged

#### Scenario: A non-participant cannot record a read position

- **WHEN** a member who participates in neither side of a thread attempts to
  write a read position for it
- **THEN** the write is denied

#### Scenario: An unactivated account cannot record a read position

- **WHEN** an authenticated account whose profile has no `activated_at`
  attempts to write a read position
- **THEN** the write is denied

#### Scenario: A member cannot write a read position in another member's name

- **WHEN** a member attempts to write a row whose `profile_id` is not their own
- **THEN** the write is denied

#### Scenario: The thread table gains no read-position column

- **WHEN** the columns of `public.message_threads` are inspected
- **THEN** they carry no per-participant read timestamp, and the table's grants
  for `authenticated` remain SELECT and INSERT only

### Requirement: Unread messages are counted against the caller's own read position

A message SHALL count as unread for a member when it belongs to a thread they
participate in, was not sent by them, and is strictly newer than their own read
position on that thread. A member's own messages SHALL NEVER count as unread for
themselves.

The read position SHALL be recorded per thread rather than per message, so that
opening a conversation is a single write regardless of how many messages it
contains. A member who opens a conversation and reads only part of it therefore
has no unread messages left in it; this is the accepted cost of one write
instead of one per message.

The read position SHALL be written from a clock that advances within a
transaction, so that a message committed while the conversation is open is not
silently swallowed by a timestamp taken at transaction start.

The system SHALL expose the per-thread unread count as a `SECURITY INVOKER`
routine, so that the existing thread- and message-visibility policies and the
owner-only read-position policy decide what it can see. It SHALL NOT be a
`SECURITY DEFINER` routine restating those rules, because a routine that
bypasses row-level security must then reimplement the activation gate, and a
second statement of a rule is a second place for it to drift.

The routine SHALL return one row per thread that has at least one unread
message, and SHALL omit threads with none, so that the absence of a row and a
count of zero are never two ways of saying the same thing. The count SHALL be
returned as `bigint`, the type the underlying aggregate produces.

#### Scenario: A member has never opened a thread

- **WHEN** a member has no read position on a thread that holds messages from
  the other participant
- **THEN** all of those messages count as unread for that member

#### Scenario: Own messages never count as unread

- **WHEN** a member sends a message into a thread
- **THEN** their own unread count for that thread is unchanged

#### Scenario: A newer message from the counterpart becomes unread

- **WHEN** the counterpart sends a message after the member's read position
- **THEN** that message counts as unread for the member, and not for the sender

#### Scenario: A thread with nothing unread is omitted

- **WHEN** a member participates in a thread in which every message predates
  their read position
- **THEN** the routine returns no row for that thread

#### Scenario: An unactivated account sees no counts

- **WHEN** an authenticated account whose profile has no `activated_at` calls
  the routine
- **THEN** it returns no rows, because the underlying visibility policies
  already require activation

#### Scenario: The routine holds under an empty ambient search path

- **WHEN** the routine is called from a session whose `search_path` does not
  include `public`
- **THEN** it resolves its own references and returns the same result

### Requirement: The unread count is surfaced where a member will meet it

The system SHALL surface the total unread count as an entry point in the
application header and on the member's own profile page, both leading to the
conversation list. `/chat` SHALL remain routed without a sidebar menu entry.

The conversation list SHALL mark each thread that holds unread messages, so that
a member who arrives from either entry point can tell which conversation the
count refers to.

A count of zero SHALL NOT be rendered — not as a badge on the header entry
point, not as a numeral on the profile page, and not as a marker on a
conversation row. At launch every member's count is zero, and a zero shown in
three places is a status report where an invitation belongs.

The count SHALL NOT be conveyed by colour alone; the header entry point SHALL
carry an accessible name that states the number.

#### Scenario: Zero is shown as nothing

- **WHEN** a member has no unread messages
- **THEN** the header entry point renders without a badge, the profile page
  shows no numeral for it, and no conversation row is marked

#### Scenario: The count is legible without seeing colour

- **WHEN** a member has unread messages
- **THEN** the header entry point's accessible name states how many

#### Scenario: Opening a conversation clears its count

- **WHEN** a member opens a thread that had unread messages
- **THEN** their read position advances, the thread's marker disappears, and the
  header and profile totals drop by that thread's share

#### Scenario: The conversation list marks what is unread

- **WHEN** a member opens the conversation list holding unread messages in one
  of several threads
- **THEN** that thread's row is marked and the others are not

#### Scenario: The conversation list stays reachable without a menu entry

- **WHEN** a member activates the header entry point or the profile surface
- **THEN** `/chat` opens, and the sidebar menu still carries no entry for it

### Requirement: The unread count follows incoming messages live

The system SHALL update the unread count on an incoming message without a
reload, reusing the existing realtime publication on `public.messages` and its
policies, and SHALL require no additional publication entry and no additional
policy.

The subscription SHALL rely on row-level security for its filtering rather than
on a client-side thread filter, and that reliance SHALL be verified rather than
assumed: an account that may not read a message SHALL receive no event for it.

A message arriving in the conversation the member currently has open SHALL NOT
raise the total and then lower it again. The read position SHALL advance for
that thread as the message arrives.

#### Scenario: An incoming message raises the count live

- **WHEN** a message arrives in a thread the member participates in while the
  application is open on any page
- **THEN** the header count rises without a reload

#### Scenario: A message in the open conversation does not flicker the total

- **WHEN** a message arrives in the thread the member is currently viewing
- **THEN** the total does not rise and fall, and the conversation row is not
  marked unread

#### Scenario: A member receives no event for a message they may not read

- **WHEN** a message is inserted into a thread an account does not participate
  in, or the account is not activated
- **THEN** that account's subscription delivers no event for it
