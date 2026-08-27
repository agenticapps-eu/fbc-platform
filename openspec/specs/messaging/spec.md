# Messaging

## Purpose

Defines the one-to-one chat between two members. A conversation exists as a
single normalized thread per pair, and messages can only be exchanged once the
two members have an accepted contact request between them. Visibility and
write-permission are enforced in the database by RLS; realtime delivery reuses
the same policies. Reconstructed from the code as of the OpenSpec migration.
## Requirements
### Requirement: One thread per member pair

The system SHALL store conversations in `public.message_threads` with
`a_profile_id` and `b_profile_id`, and SHALL enforce a unique constraint on
`(a_profile_id, b_profile_id)` so at most one thread exists per pair. Threads
SHALL be created server-side with the pair normalized as
`(least(from_id,to_id), greatest(from_id,to_id))` and never re-created for a
pair that already has one.

#### Scenario: Thread is opened once on acceptance

- **WHEN** a contact request transitions to `accepted`
- **THEN** the lifecycle trigger inserts the normalized thread with
  `ON CONFLICT (a_profile_id, b_profile_id) DO NOTHING`, so re-acceptance never
  produces a duplicate

### Requirement: Thread visibility is limited to its participants

The system SHALL permit an authenticated member to SELECT a `message_threads`
row only when they are `a_profile_id` or `b_profile_id`, and SHALL permit a
thread INSERT only by a participant for whom an `accepted` contact request
exists between the two profiles.

#### Scenario: Non-participant cannot see a thread

- **WHEN** a member who is neither `a_profile_id` nor `b_profile_id` queries a
  thread
- **THEN** the `threads_select` policy returns no row

### Requirement: Messages carry sender and body within a thread

The system SHALL store messages in `public.messages` with `thread_id`,
`sender_id`, a non-null `body`, and `created_at`, each referencing an existing
`message_threads` row.

#### Scenario: Message is bound to a thread and sender

- **WHEN** a message is inserted
- **THEN** the row records its `thread_id`, `sender_id`, and `body`, and cascades
  on deletion of the parent thread

### Requirement: A member may read only messages in their own threads

The system SHALL permit an authenticated member to SELECT a `messages` row only
when they are a participant of the message's thread.

#### Scenario: Outsider cannot read messages

- **WHEN** a member who is not a participant of a thread queries that thread's
  messages
- **THEN** the `messages_select` policy returns no rows

### Requirement: Sending requires an accepted contact request

The system SHALL permit a `messages` INSERT only when `sender_id` equals the
caller, the caller participates in the target thread, AND an `accepted`
`contact_requests` row exists between the thread's two profiles; a message
SHALL NOT be sendable on a thread whose contact request is not accepted.

#### Scenario: Participant sends after acceptance

- **WHEN** a thread participant inserts a message with `sender_id = auth.uid()`
  and the pair's contact request is `accepted`
- **THEN** the `messages_insert` policy permits the INSERT

#### Scenario: Send is denied without acceptance

- **WHEN** a member attempts to insert a message on a thread whose contact
  request is not `accepted`
- **THEN** the INSERT is denied by RLS and the client rolls back the optimistic
  message and shows a "Nachricht nicht gesendet" error

#### Scenario: Spoofed sender is denied

- **WHEN** a member inserts a message with `sender_id` other than their own auth
  uid
- **THEN** the INSERT is denied by the policy's `sender_id = auth.uid()` check

### Requirement: New messages are delivered in realtime under RLS

The system SHALL publish `public.messages` INSERTs over the
`supabase_realtime` publication so participants receive live updates, and the
same `messages_select` RLS SHALL apply to realtime fan-out so a client receives
only message rows it is permitted to read.

#### Scenario: Participant receives a live message

- **WHEN** a message is inserted into a thread the member participates in and a
  realtime subscription for that thread is active
- **THEN** the member receives the new row live and it is merged idempotently
  into the conversation

#### Scenario: Realtime does not leak to non-participants

- **WHEN** a message is inserted into a thread a subscriber does not participate
  in
- **THEN** the subscriber receives no event, because realtime enforces
  `messages_select`

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

The conversation list SHALL additionally be available **without leaving the
current page**, as a standing surface in the application frame. Both surfaces
SHALL read **one source with one loaded extent**, so that a thread listed on one
is listed on the other, with the same unread markers and the same ordering.

The standing surface SHALL be available to every **signed-in** member —
messaging carries no membership level, and a surface that gated it would
contradict the capability it displays. It SHALL NOT render for a signed-out
visitor: the frame is rendered for them too, and an entry point to a capability
they do not have is a promise into nothing.

The standing surface SHALL NOT render on the conversation page itself. There the
list is already the page, and a second copy would take width from the
conversation it exists to reach.

`/chat` and `/chat/:threadId` SHALL remain routed. The standing surface is a
second way to the same threads, not a replacement: below the width where the
frame carries it, and from a link in an e-mail, the full page is still the way
in.

Every conversation SHALL have **exactly one address**, `/chat/:threadId`, and
that address SHALL always open the full view. An address names a **place**.

Selecting a thread on the standing surface SHALL NOT be required to travel to
that address. Where the frame carries docked conversation windows, the selection
SHALL open one, and the current address SHALL be left untouched; where it does
not, the selection SHALL navigate to the thread's address as before.

This replaces the earlier rule that every selection on the standing surface goes
through the deep link. That rule read a **guarantee about identity** — one
address, one conversation — as a **prescription about routes**, and the two are
not the same. A member reading the directory who answers a message has not moved
to another place; making the frame navigate anyway cost them the page they were
on. The guarantee survives intact: the address still names exactly one
conversation, it is still the only thing that appears in a link, in an e-mail
and in a notification, and it still opens the full view wherever it is followed.

Each surface SHALL distinguish **loading**, **failure** and a genuinely **empty**
list. A failure rendered as emptiness tells a member their contacts wrote
nothing, when in fact nothing was read.

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

#### Scenario: The list travels with the member

- **WHEN** a member with the standing surface open moves from one page to
  another
- **THEN** the same conversations remain listed, with the same unread markers,
  without the member having left the page they navigated to

#### Scenario: A member without any threads is invited, not blocked

- **WHEN** a signed-in member who has **no threads** opens the standing surface
- **THEN** it renders an empty state explaining how a conversation begins, and
  no membership wall is shown

#### Scenario: A failure is not reported as emptiness

- **WHEN** the list cannot be loaded
- **THEN** the surface says so, and does not present the member with an empty
  conversation list

#### Scenario: The signed-out visitor gets no entry point

- **WHEN** a signed-out visitor is shown the frame
- **THEN** the standing surface is absent entirely

#### Scenario: The conversation page does not carry the list twice

- **WHEN** a member opens `/chat` or a conversation's deep link
- **THEN** the standing surface is not rendered, and the page's own list is the
  only one

#### Scenario: One conversation, one address

- **WHEN** a conversation's address is followed — from a link, a notification or
  the address bar
- **THEN** the full view of exactly that conversation opens, whatever else was
  on screen

#### Scenario: Answering does not cost the page

- **WHEN** a member selects a thread on the standing surface while the frame
  carries docked conversation windows
- **THEN** a window for that conversation opens and the address in the address
  bar is unchanged

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

### Requirement: The conversation list loads a bounded page, not every message

Loading the conversation list SHALL request a **bounded** number of threads, and
SHALL request **at most one message per thread** to render each preview. It
SHALL NOT fetch the full message history of every thread in order to derive the
newest line of each.

The bound SHALL be expressed as an explicit limit and offset on the request, and
each surface that shows the list SHALL offer a way to request the **further**
threads. A bound without that way is not a page; it is a permanent truncation
dressed as one.

Ordering SHALL be by the most recent message in each thread, and that ordering
SHALL be applied **by the database, before the bound**. A limit applied after an
arbitrary order hides active conversations behind dormant ones, which is worse
than no limit at all — and an ordering computed after the bound can only sort
what the bound already chose.

That server-side ordering SHALL be derivable from the thread's own row. Deriving
it from the messages themselves is what makes the unbounded form necessary, so a
requirement that allowed it would re-create the problem it exists to remove.

Whatever the thread row carries for this purpose SHALL be visible to exactly the
audience that may already read the messages it summarises, and SHALL NOT be
writable by a client. A summary that reached further than its source would be a
disclosure; one the client could write would be a forgery.

This requirement exists because the cost of the unbounded form grows with how
much members **write**, not with how many members exist. It is therefore
invisible at launch and worst precisely when messaging succeeds.

The list SHALL NOT be loaded while the surface showing it is collapsed to an
entry point. A collapsed surface shows a count that is already maintained
separately; fetching threads to render nothing spends the very cost this
requirement bounds.

#### Scenario: A page of threads is bounded

- **WHEN** a member with more threads than one page holds opens the conversation
  list
- **THEN** the request carries an explicit limit, and the response holds at most
  that many threads

#### Scenario: Previews do not drag whole histories

- **WHEN** the conversation list renders previews for a page of threads
- **THEN** no more than one message per listed thread is retrieved

#### Scenario: The bounded page holds the active conversations

- **WHEN** a member has more threads than one page holds
- **THEN** the threads with the most recent messages are the ones listed first

#### Scenario: The remaining threads stay reachable

- **WHEN** a member with more threads than one page holds looks at either
  surface
- **THEN** a control offers the further threads, and activating it extends the
  list

#### Scenario: The summary reaches no further than the message

- **WHEN** a member who is not a participant of a thread reads that thread's row
- **THEN** they see nothing of it, exactly as they see nothing of its messages

#### Scenario: The client cannot write the summary

- **WHEN** a client attempts to write the thread row's activity summary directly
- **THEN** the write is refused

#### Scenario: A collapsed surface fetches no threads

- **WHEN** the standing surface is collapsed to its entry point
- **THEN** no request for the conversation list is made, and the count is still
  shown

### Requirement: A conversation opens as a docked window on the page the member is already on

Where the frame carries the standing conversation list **docked**, selecting a
thread on it SHALL open that conversation as a **window at the bottom of the
frame**, and SHALL NOT navigate. Where the standing list is carried as a drawer
instead, the selection SHALL navigate to the conversation's address, and the
drawer SHALL close as it does today. One frame, two widths, two behaviours —
and each is the only one available at its width, so no control means two things.

A docked window SHALL carry the same conversation the full view carries: the
message history, the composer, optimistic sending with rollback on failure, and
the partner's name and picture. The two SHALL be built from **one definition**;
a second, separately written conversation would drift from the first.

**At most three windows** SHALL stand at once. Opening a fourth conversation
SHALL close the window that has gone longest without being touched. Nothing is
lost by that: the conversation stays listed on the standing surface beside the
row, carrying its unread marker, one selection away.

**Touching** a window SHALL include working in it, not only operating its
controls: opening it, expanding it, sending from it, and directing pointer or
keyboard focus into it SHALL all count. A member typing a reply is using that
window, and a rule that only watched its title bar could evict the very window
being written in.

Each window SHALL be **minimisable** and **closable**, independently of the
others. Minimised, a window SHALL keep its title row — the partner's name, their
picture, its unread count and both controls — so that a minimised conversation
is still identifiable by name. It SHALL NOT collapse to a picture alone.

Both controls SHALL be real buttons carrying accessible names that state the
**action** and the conversation it applies to, so that three windows do not
present three identically named controls.

The windows SHALL survive **navigation** within the application, and SHALL
survive a **reload**. The open conversations and their minimised state SHALL be
stored device-locally. A failure to read or write that store SHALL leave the
windows working and merely forgetful.

That store SHALL be **partitioned by member**. Unlike the docked bars' collapsed
state — a plain yes-or-no about a workstation, which a second member at the same
machine may inherit without harm — this store holds **conversation identities**.
Restoring one member's windows for another would show them a count of
conversations they have no part in and a row of failures they cannot explain.
A member signing in SHALL therefore only ever restore their own windows.

A stored set SHALL be capped to three when it is read back, and a restored
window whose conversation can no longer be loaded SHALL show its failure state
rather than being silently dropped — a conversation that vanishes without a word
is indistinguishable from one that was never opened.

Selecting a conversation that **already has a window** SHALL raise and touch
that window rather than open a second one. A conversation is one thing; two
windows onto it would be two composers writing into the same history, and the
member would have no way to tell which one they last typed in.

Windows SHALL NOT render on the conversation page itself, for the same reason
the standing list does not: there the conversation is already the page. This is
also the condition under which the frame holds only one message subscription:
the windows and the conversation page are never mounted at the same time, so
their live delivery can never be counted twice.

Closing a window while the focus is inside it SHALL move the focus to a
**named, reachable control** — another window's, or the standing surface's — and
SHALL NOT drop it to the document. A member working by keyboard who closes one
of three conversations must not be left with no position at all.

#### Scenario: Selecting a thread keeps the member where they are

- **WHEN** a member browsing the directory selects a conversation on the docked
  standing list
- **THEN** a window for it opens at the bottom of the frame and the directory is
  still on screen behind it

#### Scenario: Three conversations stand side by side

- **WHEN** a member opens three conversations in turn
- **THEN** all three windows stand at once, each with its own composer

#### Scenario: A fourth conversation takes the oldest place

- **WHEN** a member with three windows open selects a fourth conversation
- **THEN** the window untouched the longest closes, the fourth opens, and the
  closed conversation is still listed on the standing surface

#### Scenario: The window being written in is not the one evicted

- **WHEN** a member with three windows open works in the one they opened first —
  focusing it, typing, sending — and then opens a fourth conversation
- **THEN** the window they were working in stays, and a different one is closed

#### Scenario: A second member at the same machine restores nothing

- **WHEN** one member leaves windows open, signs out, and another member signs
  in on the same browser
- **THEN** the second member starts with no windows, and the first member's
  windows return when they sign back in

#### Scenario: Selecting an open conversation opens no second window

- **WHEN** a member selects a conversation that already has a window, minimised
  or not
- **THEN** that window is raised and no second window for it appears

#### Scenario: Closing a window leaves the keyboard somewhere

- **WHEN** a member using the keyboard closes a window from inside it
- **THEN** the focus lands on a named control of another window, or on the
  standing surface, and not on the document

#### Scenario: A minimised window keeps its name

- **WHEN** a member minimises a window
- **THEN** its title row remains, naming the partner and showing any unread
  count, and its history is no longer shown

#### Scenario: The windows survive the page and the reload

- **WHEN** a member with two windows open — one of them minimised — navigates to
  another page and then reloads
- **THEN** both windows are there afterwards, in the same state

#### Scenario: Below the docked width the address still opens the conversation

- **WHEN** a member selects a thread in the standing list's drawer form
- **THEN** the conversation's address opens and the drawer closes

#### Scenario: Storage that refuses costs only the memory

- **WHEN** the device denies access to local storage
- **THEN** windows still open, minimise and close, and the application renders

### Requirement: An open window advances the read position; a minimised one does not

A conversation shown in an **expanded** window SHALL advance the member's read
position exactly as the full view does — on opening it, on expanding it from
minimised, and on each incoming message from the partner while it stands open.

A **minimised** window SHALL NOT advance it. Its title row SHALL instead carry
that conversation's unread count. A conversation whose window is minimised has
not been read, and marking it read would remove it from the very count that
tells the member to look.

The unread total SHALL NOT flicker when a message arrives into an expanded
window: the surface that advances the read position SHALL be the one that
triggers the recount, and the frame's own live recount SHALL skip messages
belonging to a conversation standing expanded in front of the member. This is
the same guarantee already made for the conversation page, extended to the
second way of having a conversation in front of oneself.

Live delivery into open windows SHALL reuse the frame's **existing single**
realtime subscription. No window SHALL open a subscription of its own: three
windows opening three channels would multiply the connection count by what a
member happens to have open.

#### Scenario: Opening a window clears that conversation's count

- **WHEN** a member opens a window for a conversation holding unread messages
- **THEN** the read position advances, the thread's marker disappears, and the
  header total drops by that thread's share

#### Scenario: A minimised window keeps counting

- **WHEN** a message arrives for a conversation whose window is minimised
- **THEN** the header total rises and the window's title row shows the count

#### Scenario: The total does not flicker into an open window

- **WHEN** a message arrives for a conversation standing expanded in a window
- **THEN** the message appears in that window and the header total does not
  briefly rise before falling back

#### Scenario: Windows add no realtime channels

- **WHEN** a member has three windows open
- **THEN** the application holds the same number of message subscriptions it
  holds with none open

