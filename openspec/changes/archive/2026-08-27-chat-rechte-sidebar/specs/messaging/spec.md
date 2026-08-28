## MODIFIED Requirements

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

Selecting a thread on the standing surface SHALL open that conversation at its
existing deep link, so that one address names one conversation however it was
reached.

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

- **WHEN** a member selects a thread on the standing surface
- **THEN** that thread's existing deep link opens the conversation

## ADDED Requirements

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
