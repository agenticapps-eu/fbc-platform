## MODIFIED Requirements

### Requirement: The application shell docks the navigation to the viewport edge

The sidebar SHALL sit flush against the left edge of the viewport across the full
height, separated from the content by a right-hand rule. It SHALL NOT be rounded,
shadowed, inset, or centred inside a container — it is the frame of the
application, not a card floating on it.

The brand mark SHALL sit at the top of the sidebar, and the topbar SHALL begin to
its right; the two SHALL share one height so their bottom rules meet on a single
line. Below `lg` the sidebar SHALL instead open as an off-canvas drawer, and the
mark SHALL move into the topbar so it is never absent.

The sidebar SHALL be collapsible to an icon rail. Collapsed, it SHALL show the
mark and the item icons only, and each item SHALL keep its name reachable by
pointer and by assistive technology. The collapsed state SHALL persist across
reloads and SHALL stay device-local: it describes a workstation, not an account.

Every navigation item SHALL carry an icon, and the active item's icon SHALL be
filled where the others are drawn as lines — collapsed, the icon is the only thing
left to carry the selection.

The signed-out sign-in path SHALL exist exactly once in the frame: in the topbar.
The sidebar SHALL NOT repeat it.

The shell SHALL admit a **second docked bar at the right edge**, built to the
same rules: full height, flush to the edge, separated by a rule on the side
facing the content, never rounded or floating. Both docked bars SHALL be offset
from the content through **one shared mechanism**, so that the header, the main
region and the footer move together — an offset applied to only some of them
would let the frame's own parts drift apart at exactly one collapse state.

Below `lg` the right bar SHALL likewise open as an off-canvas drawer, entering
from the right, and SHALL have **its own control in the topbar**, mirroring the
one that opens the navigation drawer. A docked bar that only exists above `lg`
leaves its drawer with no way in; and re-purposing an existing link into a
toggle below `lg` would make one control mean two things at two widths.

**At most one drawer SHALL be open at a time**: opening one SHALL close the
other. Each drawer SHALL close when the viewport crosses into `lg`, where the
docked form takes over — a drawer left open across that threshold is invisible
but still modal. Each drawer SHALL also close when a selection inside it
navigates the page, or it would stand over the destination with the page behind
it still locked.

Both docked bars SHALL render only for signed-in members. The frame is rendered
for signed-out visitors as well, and a bar offering a capability they do not
have is an entry point into nothing.

#### Scenario: The sidebar meets the viewport edge

- **WHEN** the application is rendered at `lg` or wider
- **THEN** the sidebar touches the left and top edge of the viewport, runs the full
  height, and is separated from the content only by its right-hand rule

#### Scenario: The rail keeps every destination reachable

- **WHEN** a member collapses the sidebar and reloads the page
- **THEN** the sidebar is still collapsed, shows the mark and the icons, and each
  icon exposes its destination's name

#### Scenario: The signed-out visitor finds one way in

- **WHEN** a signed-out visitor looks at the frame
- **THEN** exactly one sign-in control is offered, and it sits in the topbar

#### Scenario: Both docked bars meet their own edge

- **WHEN** the application is rendered at `lg` or wider with the right bar present
- **THEN** one bar touches the left edge and one the right, both run the full
  height, and the content sits between them

#### Scenario: Header, content and footer share one offset

- **WHEN** either docked bar changes between its open width and its rail width
- **THEN** the header, the main region and the footer all shift by the same
  amount, and none of them keeps the previous offset

#### Scenario: Opening one drawer closes the other

- **WHEN** a member below `lg` has one drawer open and opens the other
- **THEN** the first drawer closes, and exactly one drawer is open

#### Scenario: A drawer does not survive the jump to `lg`

- **WHEN** a member opens either drawer below `lg` and the viewport then widens
  past `lg`
- **THEN** that drawer is closed, and the page behind it scrolls normally

#### Scenario: Each drawer has a way in

- **WHEN** a member below `lg` looks at the topbar
- **THEN** each drawer has its own named control there, and neither is reachable
  only by a control that means something else above `lg`

#### Scenario: Navigating out of a drawer closes it

- **WHEN** a member selects something inside a drawer that navigates the page
- **THEN** the drawer closes, and the destination is not left behind a locked
  page

#### Scenario: The signed-out visitor sees one bar, not two

- **WHEN** a signed-out visitor is shown the frame
- **THEN** the right bar is absent, and no control offers it

## ADDED Requirements

### Requirement: The right docked bar starts collapsed and remembers its own state

The right bar SHALL start **collapsed** for a member who has never set it. It is
an accompaniment, not the destination of the page, and a member who has not
asked for it SHALL NOT lose content width to it on first sight.

Collapsed, the bar SHALL remain a working entry point rather than an empty
stripe: it SHALL carry the same messages glyph the topbar uses and, when the
member has unread messages, the same count.

The bar's collapsed state SHALL persist across reloads and SHALL stay
device-local, exactly as the left sidebar's does, and SHALL be stored
**separately** from it. Collapsing the navigation SHALL NOT collapse the
messages bar, nor the reverse — they answer different questions about the same
workstation.

A failure to read or write that stored state SHALL leave the bar working and
merely forgetful. Storage is unavailable in some browsing modes, and a frame
that throws there would take the whole application with it.

#### Scenario: The first visit does not spend content width

- **WHEN** a member who has never touched the right bar opens any page at `lg`
  or wider
- **THEN** the bar is collapsed to its rail, and the content keeps the width the
  rail does not occupy

#### Scenario: The rail still reports unread messages

- **WHEN** a member with unread messages sees the collapsed right bar
- **THEN** the rail shows the messages glyph carrying that count, and the count
  is reachable by assistive technology

#### Scenario: The two bars remember independently

- **WHEN** a member collapses the navigation, expands the right bar, and reloads
- **THEN** the navigation is still collapsed and the right bar is still expanded

#### Scenario: Unavailable storage costs only the memory

- **WHEN** the device denies access to local storage
- **THEN** the bar still opens and closes on demand, and the application renders
