## MODIFIED Requirements

### Requirement: The application shell docks the navigation to the viewport edge

The sidebar SHALL sit flush against the left edge of the viewport across the full
height, separated from the content by a right-hand rule. It SHALL NOT be rounded,
shadowed, inset, or centred inside a container — it is the frame of the
application, not a card floating on it.

This doctrine SHALL be read as a statement about the **frame's own edges**, and
SHALL NOT be read as forbidding every element that sits above the content. It
governs the parts that make up the frame — the bars themselves — and says of
them that they meet the viewport rather than hang inside a container. It has
never governed the tools that work **within** the frame: overlays, drawers,
toasts, the profile menu and the notifications popover are all rounded, all
shadowed, and all raised above the content, and none of them has ever been in
conflict with it. A **conversation window** belongs to that class, not to the
frame. What the doctrine forbids is a **bar** that floats like a card; it does
not forbid a tool that floats over the page.

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

**The two bars dock at different widths, and each keeps its own.** The
navigation docks at `lg`; the right bar docks at `xl`. That is not a symmetry
that was overlooked but one that was measured and rejected: at `lg` the content
column between an expanded navigation and an 18 rem right bar left names in the
directory truncated to a single character. Between `lg` and `xl` the navigation
is therefore docked while the right bar is still a drawer, and that band is a
designed state, not a gap.

Below **`xl`** the right bar SHALL open as an off-canvas drawer, entering from
the right, and SHALL have **its own control in the topbar**, mirroring the one
that opens the navigation drawer. A docked bar that only exists above its
threshold leaves its drawer with no way in; and re-purposing an existing link
into a toggle below it would make one control mean two things at two widths.

**At most one drawer SHALL be open at a time**: opening one SHALL close the
other. Each drawer SHALL close when the viewport crosses **its own** docking
threshold, where the docked form takes over — a drawer left open across that
threshold is invisible but still modal, and a shared threshold would leave the
right bar's drawer standing through the whole `lg`–`xl` band. Each drawer SHALL
also close when a selection inside it navigates the page, or it would stand over
the destination with the page behind it still locked.

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

- **WHEN** the application is rendered at `xl` or wider with the right bar present
- **THEN** one bar touches the left edge and one the right, both run the full
  height, and the content sits between them

#### Scenario: Between the two thresholds only the navigation is docked

- **WHEN** the application is rendered at a width at or above `lg` but below `xl`
- **THEN** the navigation is docked and the right bar is a drawer with its own
  control in the topbar

#### Scenario: Header, content and footer share one offset

- **WHEN** either docked bar changes between its open width and its rail width
- **THEN** the header, the main region and the footer all shift by the same
  amount, and none of them keeps the previous offset

#### Scenario: Opening one drawer closes the other

- **WHEN** a member at a width where both bars are drawers has one open and
  opens the other
- **THEN** the first drawer closes, and exactly one drawer is open

#### Scenario: A drawer does not survive the jump to `lg`

- **WHEN** a member opens the **navigation** drawer below `lg` and the viewport
  then widens past `lg`
- **THEN** that drawer is closed, and the page behind it scrolls normally

#### Scenario: The right bar's drawer closes at its own threshold, not at `lg`

- **WHEN** a member opens the **messages** drawer and the viewport then widens
  past `xl`
- **THEN** that drawer is closed, and it was still available throughout the band
  between `lg` and `xl`

#### Scenario: Each drawer has a way in

- **WHEN** a member at a width where both bars are drawers looks at the topbar
- **THEN** each drawer has its own named control there, and neither is reachable
  only by a control that means something else at a wider viewport

#### Scenario: Navigating out of a drawer closes it

- **WHEN** a member selects something inside a drawer that navigates the page
- **THEN** the drawer closes, and the destination is not left behind a locked
  page

#### Scenario: The signed-out visitor sees one bar, not two

- **WHEN** a signed-out visitor is shown the frame
- **THEN** the right bar is absent, and no control offers it

#### Scenario: A floating tool is not a floating bar

- **WHEN** a rounded, shadowed element is rendered above the content — an
  overlay, a toast, a popover or a conversation window
- **THEN** the docking doctrine is not violated, because it governs the frame's
  bars and not the tools that work within the frame

## ADDED Requirements

### Requirement: Conversation windows sit in one row at the bottom of the frame

The conversation windows SHALL be laid out as a **single row along the bottom
edge**, aligned to the right and growing leftwards. The row SHALL be bounded by
**both docked bars** — it SHALL end where the right bar begins and SHALL NOT
extend past where the left one ends — and SHALL follow both of their current
widths through the **same shared mechanism** the frame already uses to offset its
content. A second, separately maintained copy of either width is the one that
goes stale, and a row that only accounted for the bar it sits next to would run
under the other one at exactly the narrowest width.

Every window SHALL have the **same width**, expanded or minimised, so that the
row's footprint does not change when a window is minimised. Minimising saves
height, not width; a row whose windows shifted sideways on every minimise would
move the composer a member is typing into.

The number of windows SHALL be bounded by a **fixed count**, chosen so that the
row fits at the narrowest width where windows are offered **with both bars at
their default widths**. The count SHALL NOT vary with the viewport: a rule that
opened a different number of windows at every window size would never behave
twice the same way, and could not be checked.

Where even that count does not fit — both bars expanded at the narrowest offered
width — the row SHALL be **clipped at the left bar's edge**, and the clipped
window SHALL be the **oldest**, which is the same one the eviction rule would
take next. It SHALL NOT be offered as a horizontal scroll, and the page SHALL
NOT become scrollable sideways: that guarantee is unconditional, and a part of
the frame is the last place to break it.

Window positions SHALL be **stable in the order they were opened** and SHALL NOT
reorder when a window is used. A window that slid sideways because the member
clicked into it would move the composer out from under the pointer.

The row SHALL be rendered through a **portal to the document body**, not inside
the frame's own tree. An ancestor carrying `transform`, `filter` or
`backdrop-filter` becomes the containing block for a fixed element, and this
application has ancestors that carry all three. This has cost it a trapped
overlay twice.

The row SHALL sit **below every modal surface** in the stacking order —
overlays, drawers, toasts and menus. A modal surface holds the page behind it
still; a window rendered above one would be visible on a page that no longer
answers, which is worse than being hidden.

Where a transient surface would otherwise cover the row, that surface SHALL be
displaced rather than the row lowered further. The displacement SHALL be
published as **one value from one place**, in the same manner as the bars'
widths.

Each window SHALL be **rounded and raised**, and SHALL be visually separated
from the content behind it. It is a tool over the page, not part of the frame's
edge.

#### Scenario: The row stands between the bars, not under either

- **WHEN** windows are open while **both** docked bars are expanded at the
  narrowest width where windows are offered
- **THEN** no window is covered by either bar, and every window is whole — none
  is cut off at an edge

#### Scenario: The row follows both bars' widths

- **WHEN** a member collapses or expands either docked bar with windows open
- **THEN** the row's corresponding edge shifts by the same amount the content
  does

#### Scenario: Tight space narrows the windows and keeps their number

- **WHEN** the space between the bars is too small for the windows at their full
  width
- **THEN** the same number of windows is shown, each narrower, and each still
  shows its title, its history and its composer

#### Scenario: Minimising moves nothing sideways

- **WHEN** a member minimises one window of several
- **THEN** the remaining windows keep their horizontal positions

#### Scenario: The row never pushes the page sideways

- **WHEN** the viewport is narrowed until the row no longer fits
- **THEN** the page still cannot be scrolled horizontally

#### Scenario: A modal surface covers the windows

- **WHEN** a modal overlay or drawer is opened while windows stand
- **THEN** the overlay covers them, and none of them is reachable above its
  backdrop

#### Scenario: A transient message does not sit on the composer

- **WHEN** a toast appears while a window stands open
- **THEN** it is shown clear of the row, and the window's composer stays visible
