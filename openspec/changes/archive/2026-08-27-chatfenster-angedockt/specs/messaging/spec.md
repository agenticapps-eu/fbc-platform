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

## ADDED Requirements

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
