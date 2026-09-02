# design-system Specification

## Purpose

TBD - created by archiving change redesign-blue-theme-system. Update Purpose after archive.
## Requirements
### Requirement: The platform ships exactly two themes over one token vocabulary

The system SHALL offer exactly two themes, `hell` and `navy`, selected through a
single `data-variant` attribute on the root `<html>` element. Both themes SHALL
define the same token names and differ only in their values, so that no component
knows which theme is active and no component branches on one. The default SHALL be
`hell`. Any other `data-variant` value — including values retired from earlier
variant sets — SHALL resolve to `hell` without error.

The themes SHALL differ **only in the chrome** — the sidebar and topbar surface and
what sits on it. The content layer (cards, page background, body copy, rules, the
accent, the status colours) SHALL carry identical values in both. `navy` is a brand
variant of the frame, not a reading mode: the system therefore offers **no dark
content theme**, and a member who wants dark body copy will not find it. This is a
deliberate trade for the one look the binding template's reference images show —
a dark sidebar beside a light page.

Blue SHALL be the only **interactive** accent family. The accent tokens are
`--color-accent`, `--color-accent-strong`, `--color-accent-soft` and
`--color-accent-ink`, and they SHALL remain the only colours that signal that
something can be clicked, is focused, or is active. The system SHALL NOT define a
second interactive accent, a gold token, or a per-format accent palette.

The system MAY define one further colour family whose sole job is to **identify a
subject area** — Events, members, messages, activity, contacts, compass,
highlights. That family SHALL be distinguishable from the interactive accent by
name, SHALL NOT be used for links, buttons, focus rings or active states, and
SHALL NOT be keyed on a format, a membership tier, or any other axis than the
subject area. Being content-layer colour, each of its tokens SHALL be defined
**once** and SHALL carry the same value in both themes — the `navy` block
overrides chrome tokens only, deliberately.

This carve-out is narrow on purpose. It exists because a card that names a subject
area reads faster with a coloured mark beside its words, and for no other reason.
It is not a licence to colour anything else.

Because a dark chrome can now stand beside a light page, the chrome SHALL carry its
own foreground tokens — `--color-on-chrome`, `--color-on-chrome-muted`,
`--color-chrome-active`, `--color-on-chrome-active` and `--color-accent-on-chrome`.
Components on the chrome SHALL read those and SHALL NOT reach for the content
tokens: `--color-ink` on a dark sidebar is dark on dark, and the content accent
reaches only 2.6:1 there.

Body copy SHALL use `--color-ink`, which is anthracite and never pure black.

Theme selection is not addressable by URL. A `?variant=` query parameter SHALL be
ignored entirely, including when it names a live theme — it SHALL NOT override a
stored preference.

#### Scenario: A retired variant identifier in storage resolves to the default

- **WHEN** the stored preference is `sommerfest`, `b`, `linkedin`, or any value that
  is neither `hell` nor `navy`
- **THEN** the `hell` theme is applied and the app renders normally

#### Scenario: A variant query parameter is ignored

- **WHEN** a visitor whose stored preference is `navy` loads the app with
  `?variant=hell` or `?variant=sommerfest`
- **THEN** the query parameter has no effect and the `navy` theme is applied

#### Scenario: Switching to navy leaves the content untouched

- **WHEN** a member switches from `hell` to `navy`
- **THEN** the sidebar and its foreground change, and cards, page background, body
  copy, rules, status colours and subject-area colours keep the values they had

#### Scenario: Components carry no theme branch

- **WHEN** a component renders a surface, text or accent colour
- **THEN** it reads a token whose name is identical in both themes, and contains no
  conditional keyed on the active theme

#### Scenario: A second accent family is not introduced

- **WHEN** the token vocabulary is inspected
- **THEN** no `gold` and no `--accent2` token exists, no token is keyed on a format
  or a membership tier, and every utility that expresses interactivity — link,
  button, focus ring, active state — resolves to the blue ramp

#### Scenario: A subject-area colour never signals interactivity

- **WHEN** a card, button or link is inspected that sits inside a subject area
- **THEN** its interactive colours come from the accent tokens, and the
  subject-area token appears only on the identifying mark or the surface behind it

### Requirement: The theme is applied before the first paint

The system SHALL set the root `data-variant` attribute before the application
bundle executes, so that no frame is painted in a theme the visitor did not choose.

The pre-paint resolution SHALL read only what is available synchronously on the
device — the stored local preference, otherwise the default — and SHALL apply
exactly the rule the runtime resolver applies to those same sources. Where the two
disagree, the runtime would visibly correct the pre-paint value, which is the flash
this requirement exists to prevent.

A server-side preference is by definition unavailable before first paint, so it is
deliberately outside that rule: a member whose server value is `navy` and whose
device holds `hell` SHALL see one `hell` frame first. When the server value arrives
and differs, the system SHALL apply it once and immediately rather than leaving the
member on the wrong theme; this is a single switch, not an animated transition. On
the ordinary path — same device, unchanged choice — the two agree and nothing moves.

#### Scenario: A returning visitor who chose navy sees no light frame

- **WHEN** a visitor whose stored preference is `navy` loads the app
- **THEN** the first painted frame is already in the `navy` theme

#### Scenario: Storage is unreadable

- **WHEN** the pre-paint resolution cannot read `localStorage` (private mode,
  blocked storage)
- **THEN** the default `hell` theme is applied and the app boots normally

#### Scenario: The server preference differs from the device

- **WHEN** a member whose `member_settings.theme` is `navy` opens the app on a device
  whose stored preference is `hell`
- **THEN** the first frame is `hell`, and the app switches to `navy` once, when the
  server value arrives

### Requirement: The theme is a member preference, not a review tool

The system SHALL let a signed-in member choose their theme in the settings, and
SHALL persist that choice in `member_settings.theme`. For a signed-out visitor the
choice SHALL live only in `localStorage` and default to `hell`.

On sign-in the stored server value SHALL win and overwrite the local value, so that
a member's choice follows them across devices. A change made while signed in SHALL
be written to both, and SHALL create the member's `member_settings` row if they have
none. Signing out SHALL NOT reset the theme.

Because the control lives in the member settings, a signed-out visitor SHALL have no
way to switch themes; they are served whatever was last chosen on that device. On a
shared device this means the next visitor starts in the previous one's theme until
they sign in, at which point their own server value wins — accepted deliberately,
because the theme carries no account meaning.

Writing to the server can fail while the local write cannot. When the server write
fails the system SHALL keep the chosen theme applied on the device and SHALL tell
the member it did not reach their other devices; it SHALL NOT fail silently, because
the next sign-in would then quietly restore the old value.

The system SHALL NOT expose the development variant switcher to members; the
settings control replaces it.

#### Scenario: The server value wins at sign-in

- **WHEN** a member whose `member_settings.theme` is `navy` signs in on a device
  whose `localStorage` holds `hell`
- **THEN** the `navy` theme is applied and `localStorage` is updated to `navy`

#### Scenario: A signed-out visitor is served the device's choice

- **WHEN** a signed-out visitor loads the app on a device whose stored preference is
  `navy`
- **THEN** the `navy` theme is applied, resolved from `localStorage` alone, and no
  control is offered to change it

#### Scenario: The server write fails

- **WHEN** a signed-in member switches theme and the write to `member_settings`
  fails
- **THEN** the chosen theme stays applied on the device and the member is told the
  choice was not saved

#### Scenario: The choice survives sign-out

- **WHEN** a member signs out
- **THEN** the theme they last chose remains applied

### Requirement: Design tokens are the only styling contract

The system SHALL define all colour, radius, shadow and typography tokens in
`src/index.css` as a Tailwind v4 `@theme` block with a single
`html[data-variant="navy"]` override. There is no `tailwind.config.js`.

Because Tailwind utility names are strings, the type checker cannot detect a stale
token reference. The system SHALL therefore enforce the absence of retired token
names by a text search in CI, not by review alone. The search SHALL cover `gold` and
the other retired names — `--color-night`, `--accent2`, `--color-fmt-*`,
`data-card-style` — and SHALL cover shipping code under `src/`. The frozen
`src/vision/` dummy is excluded: it is imported by nothing, reaches no bundle, and
keeps its own `--ebz-gold-*` namespace.

#### Scenario: A retired token name reaches the default branch

- **WHEN** a change introduces a `gold` token or utility, or one of `--color-night`,
  `--accent2`, `--color-fmt-*`, `data-card-style`, anywhere under `src/` outside
  `src/vision/`
- **THEN** CI fails

### Requirement: Fonts are served from the application's own origin

The system SHALL serve its webfonts from its own origin and SHALL NOT request fonts
from a third-party host at runtime. Fraunces carries display type, Inter carries
everything else.

#### Scenario: No third-party font request on load

- **WHEN** the application is loaded
- **THEN** every font URL it requests is same-origin, and the source references no
  third-party font host — neither `fonts.googleapis.com` nor `fonts.gstatic.com`
  nor any other CDN

### Requirement: The brand mark is a single theme-adaptive vector

The system SHALL render the brand mark as an inline SVG compass star that takes its
colour from `currentColor`, so that one asset serves both themes. The system SHALL
NOT keep a raster lockup, nor a second asset selected by theme.

The star's four points SHALL break out of the surrounding ring rather than sit
inside it — enclosed, the mark reads as a filled circle with a pattern instead of a
compass. The favicon SHALL carry the same silhouette, so the browser tab and the
application do not show two different marks.

The wordmark is `eff.bee.zee`, lowercase throughout, with the separating dots in
the accent colour. On the chrome the mark SHALL use the chrome's foreground and
accent tokens. Accessible names for the mark SHALL read `eff.bee.zee`.

#### Scenario: One asset serves both themes

- **WHEN** the brand mark is rendered on a light surface and on a dark surface
- **THEN** the same component is used in both, inheriting the surrounding colour

#### Scenario: The mark and the favicon show the same shape

- **WHEN** the inline mark and `compass-favicon.svg` are compared
- **THEN** both show the star breaking out of the ring

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

### Requirement: Content uses the available width; only reading columns are capped

Pages SHALL use the width the viewport offers, up to 1440 px beside the sidebar.
A width cap SHALL apply only to routes that are a form or a single column of prose
— sign-in, onboarding, settings and the profile editor — and SHALL sit at 760 px.

The rule SHALL be stated as a list of the capped routes, not of the wide ones: a
default cap silently starves every multi-column layout added later, which is how
`lg:grid-cols-3` and `xl:grid-cols-4` on the dashboard came to be classes that
could never take effect.

**The cap SHALL apply to the reading or form column itself, not to the page
composition around it.** A capped route MAY place a companion panel beside its
column and use the remaining width for it, provided the column keeps its capped
measure. What the cap protects is the line length someone reads and the width of
the fields they fill in; it was never a rule that the rest of the viewport must
stay empty.

This is stated because the narrower reading — cap the route, leave the rest blank
— is the one that was implemented, and it left the sign-in route using 31 % of a
1440 px viewport with 992 px beside it doing nothing.

#### Scenario: A multi-column page gets its columns

- **WHEN** the member dashboard renders at 1440 px
- **THEN** its tile grid and its two-column section resolve at their intended
  breakpoints, and no card title is truncated for want of width

#### Scenario: A form keeps a readable measure

- **WHEN** the settings page renders at 1440 px
- **THEN** its column stays capped rather than stretching across the full width

#### Scenario: A capped route may use the width beside its column

- **WHEN** the sign-in route renders at 1440 px
- **THEN** its form column stays within the cap while a companion panel occupies
  the width beside it, rather than the width standing empty

### Requirement: Every content page opens with an image header

Each page reachable from the navigation SHALL open with a header carrying a title,
a one-line claim and a photograph. The photograph SHALL bleed to the right and
SHALL be overlaid by a gradient that keeps the text side an even surface: body copy
SHALL NOT sit on the image.

Each such page SHALL have its **own** motif, held in one route table rather than at
the call sites. A shared default image is not acceptable — a header that repeats
across pages replaces the orientation it exists to give.

This uniqueness rule binds the pages reachable from the navigation. A route
outside the navigation MAY carry a motif already assigned to one of them, and
where it does, that reuse SHALL be recorded alongside the image's provenance
rather than left to be discovered.

Form and reading routes (sign-in, onboarding, settings, profile editor) SHALL NOT
carry an image header: over a form it is decoration in front of the task.

**The sign-in route SHALL nevertheless carry imagery beside the form.** What the
rule above forbids is putting a picture *between* the visitor and the task; it
does not require the entry screen to be bare.

On wide viewports the sign-in route SHALL place a full-height panel beside the
form. That panel SHALL use the **same device** as an image header — photograph
with a gradient that keeps the text side an even surface — carrying the brand mark
and the claim on that even surface. No copy of any kind SHALL sit on the
photograph, here as anywhere else, and no form field, label or button SHALL appear
in the panel at all.

Naming it the same device is deliberate, and more honest than inventing a
different one: what changes is the axis, not the treatment. Beside the form it
orients before the task; above the form it stands in front of it. That is the
whole distinction, and it is written down because the silence was once read as
"the entry screen must be plain".

Where the panel is not shown, the brand mark and the claim SHALL still appear
above the form. Losing them entirely on narrow viewports would strip the identity
from the screen on the devices where most members sign in.

The sign-in route SHALL retain, at every width, every way out it offers: the
switch between signing in and registering, the forgotten-password path, the route
back to the public home, and the legal notices.

#### Scenario: A navigation page opens with its own motif

- **WHEN** a member opens Kompass, Academy, Events, Mitglieder or Aktivität
- **THEN** each shows a header with title, claim and a photograph that page does not
  share with the others

#### Scenario: The header text stands on an even surface

- **WHEN** an image header renders
- **THEN** the title and claim sit on the flat gradient side, not on the photograph

#### Scenario: The sign-in route carries a panel beside the form

- **WHEN** a visitor opens the sign-in route on a wide viewport
- **THEN** a panel with the photograph, the brand mark and the claim stands beside
  the form, and no text and no control of any kind sits on the photograph

#### Scenario: The brand survives where the panel does not

- **WHEN** a visitor opens the sign-in route on a narrow viewport
- **THEN** the form occupies the width alone and remains operable, and the brand
  mark and claim still appear above it

#### Scenario: Every way out survives the layout

- **WHEN** the sign-in route renders at any width, in either mode
- **THEN** the switch between signing in and registering, the forgotten-password
  path, the route back to the public home and the legal notices are all present

### Requirement: Imagery is served from the application's own origin

The system SHALL serve every photograph from its own origin and SHALL NOT request
imagery from a third-party host at runtime — the same rule the webfonts follow, for
the same reason: a request to a foreign CDN on page load discloses the visitor.

Licence and source of every image SHALL be recorded in the repository next to the
files, including what is not yet known about the attribution.

#### Scenario: No third-party image request on load

- **WHEN** any page with an image header is loaded
- **THEN** every image URL it requests is same-origin, and the source contains no
  reference to an image CDN

#### Scenario: Provenance is recorded

- **WHEN** the image directory is inspected
- **THEN** each file is listed with its source and licence

### Requirement: The navigation shows only what the launch actually delivers

The system SHALL present exactly seven member-facing menu entries, in two labelled
groups: _Entdecken_ — Start, Academy, Events, Mitglieder, Aktivität — and _Mein
Bereich_ — Mein Profil, Einstellungen. The group headings SHALL remain visible; two
groups of five and two are still structure worth naming.

Staff-only navigation SHALL sit outside that count. The administration entry
appears for administrators alone and is not part of the member-facing seven, so a
check on the rendered sidebar SHALL account for the viewer's role rather than
asserting a bare total.

A route SHALL NOT appear in the menu when it has no content to show at launch. A
route removed from the menu SHALL keep working when opened directly, unless a
redirect is stated for it, so links and bookmarks do not break and restoring the
entry is a single declaration.

No rendered link SHALL target a route that only redirects elsewhere. A menu entry
withdrawn in an earlier change leaves such links behind in cards and widgets, where
they read as working paths and lead nowhere.

The menu SHALL be identical for every membership level; rights gate content, not
navigation.

#### Scenario: The sidebar lists exactly the launch scope

- **WHEN** a signed-in member without a staff role renders the sidebar
- **THEN** it shows Start, Academy, Events, Mitglieder, Aktivität under
  _Entdecken_ and Mein Profil, Einstellungen under _Mein Bereich_, and nothing else

#### Scenario: An administrator additionally sees their own section

- **WHEN** a member with the `admin` role renders the sidebar
- **THEN** the same seven entries appear plus the administration section, and the
  member-facing seven are unchanged

#### Scenario: A demoted route stays reachable

- **WHEN** a member opens `/mitgliedschaft`, `/meine-kurse` or `/kontakte` directly
- **THEN** the page renders, although no menu entry leads there

#### Scenario: No link points at a redirect-only route

- **WHEN** the rendered interface is searched for links to routes that only redirect
- **THEN** none is found — in particular no card or widget still offers
  `/meine-chancen` or `/matching`

#### Scenario: An empty group is not rendered

- **WHEN** every entry of a group has left the menu
- **THEN** the group heading is not rendered either

### Requirement: Every main page opens empty with an invitation, not a status report

The system SHALL give every main page an empty state that names what will appear
there and offers one concrete action the member can take now. An empty state SHALL
NOT be phrased as an absence of data ("Keine Daten vorhanden", "Noch keine X") when
the member can do something about it.

The rule SHALL apply to **data-dependent regions** — a list, feed, collection or
summary whose content comes from rows that may not exist yet — and SHALL NOT
apply to pages made of static content or of a form that is always present. A
settings form, a page of fixed editorial content and a wizard entry point are
never "empty"; demanding a state for them would produce a placeholder that can
never render.

The regions in scope at launch are: the activity feed, the events list, the member
directory, the member's own profile when it is unfilled, the conversation list,
the member's own events, and the contacts and courses regions of the
menu-withdrawn routes. The academy and the membership page are **out of scope** —
both always render content today (a fixed set of lessons, the level summary), so
an empty state for them could never appear; the academy gains one when its library
becomes data-driven.

Where the member genuinely cannot act — a page whose content depends on other
people or on a later release — the empty state SHALL say what will fill it and
when, rather than leaving a bare negation, and SHALL NOT offer a control that does
nothing.

A filtered view that returns nothing SHALL be distinguished from a view that is
empty because nothing exists yet, and SHALL offer to clear the filters.

#### Scenario: An actionable empty state offers the action

- **WHEN** the activity feed has no posts and the member may write one
- **THEN** the empty state invites them to post and renders the control that does it

#### Scenario: A dependent empty state explains rather than negates

- **WHEN** a page cannot be filled by the member's own action
- **THEN** the empty state says what will appear there and what has to happen
  first, and offers no inert control

#### Scenario: Every enumerated region has one

- **WHEN** a member signs in to an account with no data and visits each page
  carrying a region named by this requirement
- **THEN** each region shows an empty state meeting these rules, none shows a bare
  paragraph or a blank area

#### Scenario: A static page needs no empty state

- **WHEN** a page consists of a form or fixed content that is always present
- **THEN** no empty state is required or rendered for it

#### Scenario: No result from filters is not the same as no data

- **WHEN** a member's filter combination matches nobody
- **THEN** the empty state says so and offers to reset the filters, distinct from
  the state shown when no members exist at all

### Requirement: Ein offenes Overlay hält die Seite dahinter still

Jedes modale Overlay SHALL das Scrollen des Dokuments sperren, solange es offen
ist, und die Scroll-Position beim Schließen **exakt** wiederherstellen.

Die Sperre SHALL `position: fixed` auf dem `body` setzen, zusammen mit einem
negativen `top` in Höhe der gemerkten Scroll-Position sowie `left` und `right`
auf `0`. `overflow: hidden` allein SHALL NOT genügen: auf iOS Safari scrollt
der Inhalt darunter weiter.

Das Wiederherstellen SHALL NOT entfallen. `position: fixed` setzt den
Dokument-Scroll auf null; ein Overlay, das nur die Stile zurücknimmt, lässt den
Leser am Seitenanfang zurück und ist damit schlechter als gar keine Sperre.

Die Sperre SHALL bereits vorhandene Inline-Werte dieser vier Eigenschaften
sichern und beim Freigeben genau wiederherstellen, statt sie zu leeren.

Ein Ausgleich für die Breite des verschwindenden Scrollbalkens SHALL NOT
hinzukommen: `html` trägt `scrollbar-gutter: stable`, der Platz ist ohnehin
reserviert, und ein zusätzliches `padding-right` erzeugte erst den seitlichen
Versatz, den es verhindern soll.

#### Scenario: Bei offenem Overlay steht die Seite

- **WHEN** ein Overlay geöffnet wird, während die Seite 600 px weit gescrollt ist
- **THEN** trägt der `body` `position: fixed` und `top: -600px`

#### Scenario: Nach dem Schließen steht der Leser wieder dort, wo er war

- **WHEN** dasselbe Overlay geschlossen wird
- **THEN** tragen die vier Eigenschaften wieder ihre Ausgangswerte
- **AND** die Scroll-Position ist wieder exakt 600 px

#### Scenario: Zwei Overlays entsperren sich nicht gegenseitig

- **WHEN** zwei Overlays offen sind und eines geschlossen wird
- **THEN** bleibt die Seite gesperrt
- **AND** erst das Schließen des zweiten gibt sie frei und stellt die Position
  wieder her

### Requirement: Ein Overlay mit `aria-modal` hält auch den Fokus

Ein Overlay, das sich als `aria-modal="true"` ausgibt, SHALL den Tastaturfokus
in sich behalten. Tab SHALL in drei Fällen umlenken:

1. auf dem letzten fokussierbaren Element des Overlays zum ersten,
2. mit Shift auf dem ersten zum letzten,
3. **von außerhalb des Overlays** zum ersten (mit Shift: zum letzten).

Fall 3 SHALL NOT entfallen. Drei der vier Overlays versetzen den Fokus beim
Öffnen nicht; ohne ihn stünde er hinter dem Dialog und eine Falle, die nur an
den Rändern des Containers greift, wäre dort wirkungslos.

Beim Öffnen SHALL der gemeinsame Hook den Fokus **nicht** versetzen. Wohin er
zuerst geht, entscheidet das jeweilige Overlay — die Bild-Lightbox etwa setzt
ihn genau einmal beim Öffnen, damit ein Bildwechsel ihn nicht jedes Mal auf
„Schließen" zurückreißt.

Sind mehrere Overlays offen, SHALL **nur das oberste** Tab behandeln.

Beim Schließen SHALL der Fokus an das Element zurückkehren, das ihn vor dem
Öffnen hatte — nur wenn dieses noch im Dokument hängt, ohne Scrollen
(`preventScroll`) und **nach** dem Wiederherstellen der Scroll-Position.

Fokussierbar SHALL heißen: Verweise mit `href`, Schaltflächen, Eingabe-,
Auswahl- und Textfelder sowie Elemente mit `tabindex` — jeweils ohne
`disabled`, ohne `tabindex="-1"` und ohne `input[type="hidden"]`.

#### Scenario: Tab läuft im Overlay um

- **WHEN** der Fokus auf dem letzten fokussierbaren Element eines offenen
  Overlays steht und Tab gedrückt wird
- **THEN** erhält das erste fokussierbare Element des Overlays den Fokus

#### Scenario: Shift-Tab läuft rückwärts um

- **WHEN** der Fokus auf dem ersten fokussierbaren Element steht und Shift-Tab
  gedrückt wird
- **THEN** erhält das letzte fokussierbare Element den Fokus

#### Scenario: Tab von außerhalb springt hinein

- **WHEN** ein Overlay offen ist, der Fokus außerhalb davon liegt und Tab
  gedrückt wird
- **THEN** erhält das erste fokussierbare Element des Overlays den Fokus

#### Scenario: Nur das oberste Overlay fängt Tab

- **WHEN** zwei Overlays offen sind und Tab gedrückt wird
- **THEN** lenkt ausschließlich das zuletzt geöffnete um

#### Scenario: Der Fokus kehrt zum Auslöser zurück

- **WHEN** ein Overlay über eine Schaltfläche geöffnet und danach geschlossen wird
- **THEN** trägt diese Schaltfläche den Fokus wieder
- **AND** die wiederhergestellte Scroll-Position bleibt unverändert

### Requirement: Alle modalen Overlays teilen sich diese eine Regel

Sperre und Fokus-Falle SHALL aus **einem** gemeinsamen Hook in
`src/components/ui/` kommen, an dem jedes gemountete modale Overlay hängt —
Bild-Lightbox, Avatar-Zuschnitt, Feedback-Panel und die Off-Canvas-Navigation.

Vier Einzellösungen SHALL NOT an seine Stelle treten. Der Mangel ist nicht die
fehlende Sperre an einer Stelle, sondern die fehlende Regel: das nächste
Overlay entstünde sonst wieder ohne.

Ein Overlay, das nur per Stilregel ausgeblendet wird statt abgemeldet zu
werden, SHALL seinen Zustand beim Verlassen des zugehörigen Breakpoints
schließen. Sonst hinge die Sperre an einem Overlay, das niemand mehr sieht.

#### Scenario: Jedes gemountete Overlay sperrt

- **WHEN** eines der vier gemounteten Overlays geöffnet wird
- **THEN** ist das Dokument gesperrt, und beim Schließen wird die Position
  wiederhergestellt

#### Scenario: Die Off-Canvas-Navigation schließt am Breakpoint

- **WHEN** die Navigation unterhalb von `lg` geöffnet ist und die Breite `lg`
  erreicht
- **THEN** ist sie geschlossen und die Seite wieder frei

### Requirement: Ein einziger Satz trägt die wiederverwendbaren UI-Glyphen

Das System SHALL die wiederverwendbaren Oberflächen-Symbole aus einem Satz
beziehen, der an einer Stelle liegt und einen Stil führt (24er-Viewbox,
`currentColor`, einheitliche Strichstärke und Endenform). Ein solches Symbol
SHALL NOT ein zweites Mal als eigene Komponente in einer Feature-Datei entstehen.

Der Satz trägt **wiederverwendbare Glyphen**. Ausdrücklich **nicht** dazu gehören
und unangetastet bleiben:

- die Markenmarke, die eine eigene Anforderung hat und `currentColor` bereits
  richtig führt,
- die Kompassmarke, der Avatar-Platzhalter und andere illustrative Vektoren,
- Diagramme und Datenvisualisierungen, deren Maße sich aus ihren Daten ergeben
  und die den 24er-Glyphstil nicht treffen können.

Diese Abgrenzung ist der Kern der Anforderung, nicht ihr Kleingedrucktes: eine
Zusage „kein `<svg>` außerhalb des Satzes" wäre gegen den Baum falsch und stünde
gegen die bestehende Anforderung an die Markenmarke.

Aufgelöst werden die verstreuten **Glyphen**: die vier in der Anwendungshülle,
das Feedback- und das Suchsymbol, die drei in der Aktivität, der **doppelt
vorhandene** Kronen-Glyph und der zweite Satz für die Matching-Kategorien.

Die Einhaltung SHALL durch einen Test erzwungen werden, der gegen den Quellbaum
läuft — nicht durch eine gepflegte Liste und nicht durch Absicht. Der Test SHALL
die ausgenommenen Dateien namentlich führen, damit eine neue Ausnahme eine
sichtbare Entscheidung ist.

Der Satz SHALL weiterhin ohne Icon-Bibliothek auskommen: eine Abhängigkeit für
einige Dutzend Pfade brächte hunderte ungenutzte Symbole und einen zweiten Stil.

#### Scenario: Ein Glyph steht genau einmal im Baum

- **WHEN** der Quellbaum nach Komponenten durchsucht wird, die einen
  wiederverwendbaren Glyph selbst zeichnen
- **THEN** findet sich außerhalb des Satzes keine, und kein Glyph existiert in
  zwei Fassungen

#### Scenario: Die Markenmarke bleibt, wo sie ist

- **WHEN** der erzwingende Test läuft
- **THEN** meldet er die Markenmarke, die Kompassmarke, den Avatar-Platzhalter und
  die Diagramm-Vektoren nicht als Verstoß

#### Scenario: Der Satz trägt beide Themes ohne Verzweigung

- **WHEN** dasselbe Symbol im hellen und im dunklen Chrome gezeichnet wird
- **THEN** trägt es die jeweilige Vordergrundfarbe, ohne dass die Komponente das
  Theme kennt oder auf es verzweigt

### Requirement: Ein Kanon ordnet jedem Gegenstandsbereich Icon und Farbe zu

Das System SHALL die Zuordnung `Gegenstandsbereich → Icon + Farbe` als **eine**
Modulkonstante führen. Eine Fläche SHALL sie von dort beziehen und SHALL NOT sie
je Karte neu treffen; eine Verzweigung über Bereiche in mehreren Dateien SHALL
NOT entstehen.

Der Kanon SHALL ausschließlich Gegenstandsbereiche tragen — Events, Mitglieder,
Nachrichten, Aktivität, Kontakte, Kompass, Highlights. Bedien-Symbole wie
Chevron, Menü, Glocke und Lupe SHALL NOT im Kanon stehen: sie bezeichnen keinen
Bereich, und eine Bereichsfarbe für sie wäre erfunden. Sie gehören in den Satz.

Die Farben des Kanons SHALL Tokens der Bereichsfamilie sein und SHALL NOT als
Farbwert im Bauteil stehen.

#### Scenario: Zwei Flächen zeigen denselben Bereich gleich

- **WHEN** derselbe Gegenstandsbereich auf zwei verschiedenen Seiten als Karte
  erscheint
- **THEN** trägt er beide Male dasselbe Symbol in derselben Farbe

#### Scenario: Ein Bedien-Symbol hat keine Bereichsfarbe

- **WHEN** ein Chevron oder das Menü-Symbol gezeichnet wird
- **THEN** stammt der Glyph aus dem Satz, und der Kanon kennt für ihn keinen
  Eintrag

### Requirement: Farbe trägt nie allein eine Bedeutung

Das System SHALL eine Aussage niemals nur über Farbe treffen. Eine Bereichsfarbe
SHALL immer neben einem Symbol oder einem Wort stehen, das dieselbe Aussage
trägt.

#### Scenario: Ohne Farbe bleibt die Karte lesbar

- **WHEN** eine Karte, die einen Gegenstandsbereich bezeichnet, ohne
  Farbunterscheidung betrachtet wird
- **THEN** geht aus Symbol oder Beschriftung weiterhin hervor, welchen Bereich
  sie meint

### Requirement: Karten mit einem Gegenstandsbereich zeigen ihn

Das System SHALL Karten, die einen Gegenstandsbereich bezeichnen, mit dessen
Symbol und Farbe aus dem Kanon versehen — auf dem Dashboard, in den Events und im
Mitgliederverzeichnis, dort wo eine Karte heute nur Text trägt.

Angewendet wird der Kanon auf die Flächen, die **bestehen**. Neue Karten SHALL
NOT allein deshalb entstehen, weil das Konzeptbild sie zeigt.

#### Scenario: Eine Textkarte bekommt ihr Symbol

- **WHEN** eine Dashboard-Karte einen Gegenstandsbereich bezeichnet
- **THEN** trägt sie dessen Symbol und Farbe aus dem Kanon, und beide bleiben beim
  Themewechsel unverändert

### Requirement: Ein Titelbild-Feld trägt das Verhältnis, auf das zugeschnitten wird

Das System SHALL die Felder, die ein hochgeladenes Titelbild aufnehmen, im
Seitenverhältnis **3:1** anlegen — dem Verhältnis, auf das beide Zuschneider
(`ProfilPage`, `EventCoverPicker`) das Bild bereits festlegen. Ein Feld, dessen
Verhältnis von dem der gespeicherten Bilder abweicht, erzwingt eine Wahl
zwischen Beschnitt und leerer Fläche; die Abweichung selbst ist die Ursache,
nicht die gewählte `object-fit`-Regel.

Diese Anforderung gilt für genau vier Bauteile und SHALL NOT als allgemeine
Regel für jedes Bild der Anwendung gelesen werden:

- den Profilkopf (`ProfileHero`),
- das Bildfeld der Event-Kachel,
- das Bildfeld des Event-Kopfes,
- die Karte des Mitgliederverzeichnisses (`MemberDirectory`).

Die **Verzeichnis-Karte** stand bis zu dieser Fassung in der Ausschlussliste,
mit der Begründung, sie trage anderes Bildmaterial. Das trifft nicht zu: sie
zieht ihr Bild über `bildUrl("covers", …)` aus **demselben** Bucket wie der
Profilkopf und führt seit AGE-595 bereits `aspect-[3/1]` mit `object-contain`.
Der Ausschluss war beim Schreiben richtig und am selben Abend nicht mehr —
die Fassung, die ihn aussprach, landete am 25.08. um 20:18, die Karte wurde um
22:38 konform. Aufgenommen wird sie deshalb als beschreibende Nachführung einer
Fläche, die die Regel längst hält, nicht als neue Vorgabe.

Eine **Vorschau** auf den Zuschnitt SHALL dieselbe Regel tragen wie die Fläche,
die sie vorwegnimmt. Heute sind das die Zuschnitt-Vorschauen in `ProfilPage`
und `EventCoverPicker`; die Klausel ist bewusst über diese Eigenschaft
formuliert und nicht über die zwei Namen, damit eine künftige Vorschau nicht
erneut einzeln nachgetragen werden muss. Der Grund steht mit darin: eine
Vorschau mit abweichendem Verhältnis zeigt etwas anderes als das Ergebnis
daneben — im Browser gemessen war die Profil-Vorschau 646 × 112 px (5,77:1)
mit `object-cover` und schnitt 77,2 % der Bildhöhe weg, unmittelbar nach einem
Zuschnitt auf 3:1 (AGE-600).

Ausdrücklich **nicht** erfasst sind allein die **Bilder im Feed**. Sie führen
zwar `aspect-[3/1]`, aber `object-cover`, und beschneiden damit als einzige
Fläche noch. Die frühere Begründung — sie trügen anderes Bildmaterial — SHALL
NOT weitergeführt werden: der Feed signiert über `signEventCovers` und zeigt
damit dasselbe `event-covers`-Material wie Kachel und Kopf. Der Ausschluss
ruht also allein auf einer offenen Entscheidung, die als AGE-664 vorliegt, und
diese Anforderung hält ihn offen, statt ihn mit einem falschen Grund zu decken.

Der Profilkopf SHALL dabei **keinen Höhendeckel** mehr führen. Das nimmt die
Deckelung aus AGE-566 zurück. Ihre Begründung — eine mitwachsende Bahn schiebt
den Namen unter die Falz — bleibt richtig und ist der bewusst gezahlte Preis:
eine Bahn mit fester Höhe **ist** auf einer breiten Seite selbst rund 6:1, und
in ihr kann ein 2,7:1-Bild nur beschnitten oder von breiten Balken umgeben
sein. Nachgemessen bei 1370 px Fensterbreite: die Bahn steht in einer
Inhaltsspalte von 1217 px, war mit Deckel 1217 x 256 px (also selbst 4,75:1)
und schnitt von einem 2,70:1-Bild 43,2 % der Höhe weg. Ohne Deckel wird sie
1217 x 406 px.

Das Bild SHALL innerhalb seines Feldes **vollständig** sichtbar sein. Wo das
gespeicherte Bild nicht genau 3:1 ist, SHALL es eingepasst und nicht
beschnitten werden.

Die Bestände hinter diesen Feldern sind **zwei verschiedene Buckets**, und sie
sind getrennt gemessen — eine Zahl aus dem einen belegt für das andere nichts.
Die folgenden Zahlen sind der **Stand vom 25.08.2026** und SHALL als datierter
Beleg gelesen werden, nicht als fortlaufende Zusage: ein Bestand wächst mit
jedem Upload, und diese Fassung hat ihn nicht neu gezählt.

- `covers` (Profilbanner), alle 55 Objekte: Median 2,70:1, Minimum 1,33:1,
  Maximum 3,00:1, keines breiter als 3:1. Für die 49 Bilder zwischen 2,2:1 und
  2,95:1 bleiben schmale Ränder, für die vier Ausreißer darunter breitere.
- `event-covers` (Event-Titelbilder) auf PROD: **ein** Objekt, und das ist
  3,00:1 — es kam durch `EventCoverPicker`. Alles, was über das Produkt
  hochgeladen wird, ist 3:1 und sitzt randlos.

Der **Demo-Seed** war bis zum 28.08. die benannte Ausnahme: seine acht
Event-Bilder (1,50:1, eines 1,33:1) sind Seiten-Heldenbilder, die am
Zuschneider vorbei hochgeladen wurden und unter dieser Regel mit rund 25 %
freier Fläche je Seite in der Kachel standen — bei dem einen 1,33:1-Motiv sind
es 27,8 %. Nachzuziehen war der Seed, nicht das Feld, und das ist geschehen:
beide Upload-Stellen (`import_world_seed.ts`, `demo_event_covers.ts`)
schneiden über `titelbildZuschnitt` auf 1500 × 500 zu (AGE-599).

Der **Bestand auf DEV** ist davon nicht eingeholt, und das SHALL NOT als
Gegenbeispiel gegen diese Anforderung gelten. Am 31.08. dort gemessen: acht
Objekte in `event-covers`, **null davon 3:1** (1600 × 1067 bis 1600 × 1200,
also 1,333:1 bis 1,501:1).

**Warum ein Seed-Lauf das nicht heilt, SHALL festgehalten sein** — die
naheliegende Annahme ist falsch und führt zu Datenverlust. Die Objekte tragen
Pfade der Form `<host_id>/vorschau-<bild>.webp` und stammen aus dem **Spiegel
DEV ← PROD** (AGE-576), nicht aus einem Seed-Lauf gegen DEV. Der Spiegel
kopiert absichtlich 1:1 und schneidet nicht zu. Daraus folgt:

- `demo_event_covers.ts` zielt zwar auf DEV, spricht aber die synthetischen
  Demo-Events an. Am 31.08. gemessen: **null von acht** dieser IDs existieren
  dort. Ein Lauf fände nichts und lüde nichts hoch.
- `import_world_seed.ts` schreibt die passende Pfadform, zielt aber auf PROD
  (`ZIEL_PROJEKT`, von `zielPruefen()` erzwungen).

Die acht Objekte auf DEV zu löschen SHALL NOT als Vorbereitung eines
Seed-Laufs geschehen: danach zeigten acht Events auf Pfade ohne Objekt — graue
Kästen ohne Fehlermeldung —, und keines der beiden Skripte stellte sie wieder
her.

**Entschieden am 31.08. (Donald): DEV bleibt so, PROD wird nicht angefasst.**
Für Testzwecke ist der Bestand brauchbar; ein vollständiger Neuaufbau bleibt
möglich, ist aber ein eigener Vorgang. Der Zuschnitt selbst ist davon
unberührt: beide Seed-Stellen schneiden zu, und beide schicken
`x-upsert: false`, weil ein Upsert in einem privaten Bucket an der
SELECT-Policy scheitert.

Geschützt ist das **gespeicherte** Bild, nicht das Original vor dem Zuschnitt.
Beide Upload-Wege schneiden zu, bevor gespeichert wird; eine Zusage über das
ursprüngliche Motiv könnte diese Anforderung nicht halten.

Die frei bleibende Fläche SHALL die Gestaltung tragen, die das Feld ohne Bild
zeigt, und diese SHALL **unter** dem Bild liegen, nicht neben ihm. Ein
Platzhalter, der nur im Zweig „kein Bild" existiert, lässt beim eingepassten
Bild die Fläche des Elternteils durchscheinen — eine flache Füllfarbe neben dem
Motiv liest sich als Fehler, nicht als Rahmung.

Marken, die auf dem Bild liegen — die Datumsmarke des Events — SHALL am
Container hängen bleiben und nicht am Bild. Sie beschriften die Kachel, nicht
das Motiv.

Der Nachweis SHALL im Browser geführt werden, aus den Maßen des Containers
(`getBoundingClientRect`), den natürlichen Maßen des Bildes und dem daraus
berechneten Faktor `s = min(bw/nw, bh/nh)`. Ein Test in jsdom SHALL
ausdrücklich nur als **strukturelle** Zusage gelten: unter `cover` wie unter
`contain` behält die `<img>`-Box die Maße ihres Containers, und nur der gemalte
Inhalt darin unterscheidet sich — jsdom sieht davon nichts und kann die
Einpassung daher nicht belegen.

#### Scenario: Das Bildfeld hat das Verhältnis des Zuschnitts

- **WHEN** eines der drei Bauteile mit einem Titelbild gerendert wird
- **THEN** ist sein Bildfeld 3:1

#### Scenario: Die Kachel hält 3:1 auch ohne Titelbild

- **WHEN** eine Event-Kachel ohne Titelbild gerendert wird
- **THEN** ist ihr Feld 3:1
- **AND** der Grund ist die Ausrichtung im Raster: bebilderte und unbebilderte
  Kacheln stehen nebeneinander und dürfen nicht ungleich hoch sein

#### Scenario: Der Event-Kopf ohne Titelbild bleibt ein flaches Band

- **WHEN** der Event-Kopf ohne Titelbild gerendert wird
- **THEN** ist er ein flaches Band und NICHT 3:1
- **AND** er steht allein, es gibt kein Raster auszurichten, und ein
  3:1-Platzhalter wäre auf einer 1100 px breiten Seite rund 370 px leerer
  Verlauf über dem Titel

#### Scenario: Ein gespeichertes 3:1-Bild sitzt randlos

- **WHEN** ein genau auf 3:1 zugeschnittenes Bild dargestellt wird
- **THEN** füllt es sein Feld vollständig aus, ohne Beschnitt und ohne freie
  Fläche

#### Scenario: Ein abweichendes Bild wird eingepasst, nicht beschnitten

- **WHEN** ein Bild mit einem anderen Verhältnis als 3:1 dargestellt wird
- **THEN** ist es vollständig sichtbar
- **AND** es fehlt an keiner Kante ein Teil des gespeicherten Bildes

#### Scenario: Die freie Fläche liegt unter dem Bild

- **WHEN** ein eingepasstes Bild sein Feld nicht ausfüllt
- **THEN** zeigt die verbleibende Fläche dieselbe Gestaltung wie das Feld ohne
  Bild

#### Scenario: Die Höhe des Profilkopfes folgt der Breite

- **WHEN** der Profilkopf bei zwei verschiedenen Fensterbreiten dargestellt wird
- **THEN** verhält sich seine Höhe wie seine Breite, ohne obere Schranke

#### Scenario: Ein schmaleres Fenster beschneidet nicht

- **WHEN** dieselbe Ansicht bei einer schmaleren Fensterbreite dargestellt wird
- **THEN** bleibt das ganze Bild sichtbar
- **AND** Größe und Lage der freien Fläche dürfen sich dabei ändern

#### Scenario: Die Datumsmarke bleibt am Feld

- **WHEN** ein Event-Bild eingepasst dargestellt wird und dabei freie Fläche
  entsteht
- **THEN** sitzt die Datumsmarke weiterhin an der Ecke des Feldes

### Requirement: Keine Seite laesst sich seitlich schieben

Die Anwendung SHALL ab einer Fensterbreite von **320 px** ohne waagerechtes
Schieben bedienbar sein.

Die Zusage SHALL **nicht allein** an `documentElement.scrollWidth > clientWidth`
gemessen werden. Dieser Wert uebersieht Inhaltsueberlauf, der von einem
Vorfahren beschnitten wird, und in der Geraete-Emulation waechst die
Vergleichsgroesse mit dem Fehler mit. Gemessen SHALL **je Element** werden:
sein rechter Rand gegen `documentElement.clientWidth`, und sein eigener
`scrollWidth − clientWidth`. Elemente mit `position: fixed` und `.sr-only`
SHALL dabei ausgenommen sein — beide sind absichtlich vom Fluss geloest und
melden sich sonst auf jeder Route.

320 px SHALL als **Mindestbreite** festgeschrieben sein — darunter wird nicht
unterstuetzt. Ohne eine benannte Zahl ist „laeuft ueber" keine pruefbare
Aussage, sondern eine Meinung ueber ein Geraet.

**`overflow-x: hidden` oder `clip` auf einem Seitencontainer SHALL NOT als
Erfuellung gelten.** Beides versteckt den Ueberlauf und schneidet dabei Inhalt
ab, den niemand mehr erreichen kann. Die Zusage lautet, dass nichts ueberlaeuft,
nicht dass man es nicht sieht.

Ein Bereich, dessen Inhalt bei dieser Breite **nicht** sinnvoll umbrechen kann —
eine Tabelle mit mehreren Datenspalten —, SHALL einen **eigenen** waagerecht
scrollbaren Rahmen bekommen. Der Rahmen SHALL die Seite selbst unverschoben
lassen.

#### Scenario: Die eingeloggte Startseite bei 320 px

- **WHEN** die Startseite bei einer Fensterbreite von 320 px dargestellt wird
- **THEN** ist `documentElement.scrollWidth` gleich `clientWidth`
- **AND** keine Karte ragt ueber den rechten Rand des Fensters hinaus

#### Scenario: Das Verzeichnis bei 320 px

- **WHEN** das Mitgliederverzeichnis bei 320 px dargestellt wird
- **THEN** laesst sich die Seite nicht seitlich schieben, obwohl die Karten
  Namen tragen, die laenger sind als die verfuegbare Breite

#### Scenario: Ein Bereich, der nicht umbrechen kann, scrollt fuer sich

- **WHEN** die Mitgliederliste der Administration bei 320 px dargestellt wird
- **THEN** ist ihre Tabelle in einem eigenen waagerecht scrollbaren Rahmen
  erreichbar
- **AND** die Seite selbst laesst sich nicht schieben
- **AND** der Rahmen scrollt tatsaechlich — die Tabelle ist breiter als er, und
  jede Spalte ist durch Schieben erreichbar

### Requirement: Geteilte Layout-Bausteine schrumpfen unter ihren Inhalt

Ein wiederverwendbarer Baustein, der als Kind eines Rasters oder einer Flexbox
eingesetzt wird — die Karte und der Wrapper des gestaffelten Listen-Reveals —,
SHALL `min-width: 0` tragen.

Der Grund SHALL mitgefuehrt werden, weil die Regel ohne ihn wie Kosmetik
aussieht: Flex- und Grid-Kinder stehen per Voreinstellung auf `min-width: auto`
und schrumpfen **nicht** unter ihren Inhalt. Traegt ein Nachfahre
`white-space: nowrap` — was `truncate` setzt —, fordert er seine volle
Textbreite, und der Baustein waechst mit. **Kuerzender Text ohne diese
Einengung bewirkt das Gegenteil dessen, wonach er benannt ist:** er kuerzt
nicht, er drueckt auf.

Die Zusage SHALL am **Baustein** haengen und nicht an seinen Aufrufstellen. Eine
Regel, die jede Aufrufstelle einzeln verpflichtet, ist an genau der Stelle
verletzbar, an der niemand hinsieht — und sie ist von aussen nicht pruefbar,
weil zwischen kuerzendem Text und Rasterkind regelmaessig eine Komponentengrenze
liegt.

`line-clamp-*` SHALL ausdruecklich **nicht** erfasst sein. Es bricht um und
setzt kein `nowrap`; es kann waagerecht nicht druecken. Es mitzuzaehlen
erweiterte die Regel ueber ihre Begruendung hinaus.

#### Scenario: Eine Karte mit kuerzendem Text bleibt in ihrer Spalte

- **GIVEN** eine Karte in einem Raster, die eine Zeile mit kuerzendem Text traegt
- **WHEN** der Text laenger ist als die Spalte breit
- **THEN** bleibt die Karte so breit wie ihre Spalte
- **AND** der Text wird gekuerzt dargestellt

#### Scenario: Breite Fenster bleiben unveraendert

- **WHEN** dieselben Flaechen bei 1440 px dargestellt werden
- **THEN** loesen Rasterspuren und Kartenbreiten auf wie zuvor
- **AND** die bestehende Zusage, dass das Dashboard seine Spalten bekommt,
  gilt unveraendert weiter — `min-width: 0` senkt nur den Boden und ist
  oberhalb der Spurbreite wirkungslos

#### Scenario: Der Baustein traegt es, nicht die Aufrufstelle

- **WHEN** eine neue Flaeche die Karte in ein Raster stellt, ohne selbst etwas
  zu setzen
- **THEN** bleibt die Karte in ihrer Spalte

### Requirement: Feste Spaltenbreiten gelten erst ab einem Breakpoint

Ein Raster mit einer festen Spaltenbreite SHALL diese Breite **nur** oberhalb
eines Breakpoints setzen. Unterhalb SHALL der Inhalt einspaltig stapeln.

Der Pruefstein SHALL nicht der Ueberlauf sein, sondern die **Benutzbarkeit der
schmalsten Spalte**: bei 320 px loesten die beiden vorhandenen Raster zu
`160px 26px 91px` und `160px 26px 80px 91px` auf. Die 26 px sind ein
Eingabefeld. Es ist unbedienbar, noch bevor die Zeile ueberlaeuft — ein Raster,
das erst beim Ueberlauf auffaellt, war lange vorher schon kaputt.

#### Scenario: Eine Formularzeile bei 320 px

- **WHEN** eine Zeile mit fester erster Spalte bei 320 px dargestellt wird
- **THEN** stapeln ihre Felder untereinander
- **AND** jedes Eingabefeld ist mindestens **200 px** breit — bei 320 px
  Fensterbreite bleiben nach Seiten- und Kartenrand rund 240 px, ein gestapeltes
  Feld nutzt sie also nahezu ganz. Die heutige Auflösung zu **26 px** verfehlt
  das um eine Groessenordnung, und „lesbar" ohne Zahl ist nicht abnehmbar.

#### Scenario: Der Waechter faengt eine neue feste Spalte

- **WHEN** eine Rasterdefinition mit fester Breite ohne Breakpoint-Praefix
  hinzugefuegt wird
- **THEN** schlaegt der Testlauf fehl und benennt Datei und Zeile

### Requirement: A third-party media player is loaded only on explicit request

Rendering a page SHALL NOT cause any network request to a media provider's
origin. An embedded video SHALL first render a placeholder drawn entirely from
the application's own origin. The provider's player SHALL be requested only
after the visitor activates that placeholder, and SHALL then start playing
without requiring a further activation inside the provider's frame.

The placeholder SHALL name the provider and SHALL state, before activation, that
activating it establishes a connection to that provider and transmits the
visitor's IP address. It SHALL link to the privacy notice.

The placeholder SHALL NOT request a preview image from the provider or from any
third-party thumbnail service. Such a request carries exactly the data the gate
exists to withhold, and would defeat the requirement while appearing to satisfy
it.

Every surface that embeds a video SHALL obtain this behaviour from the same
component, with no per-surface exception. Deferring the request through lazy
loading SHALL NOT be treated as satisfying this requirement: it postpones the
request rather than withholding it.

An activation SHALL be recorded **per provider** and SHALL persist on the
visitor's device until it is withdrawn. While a provider is released, that
provider's players SHALL load without a further placeholder, on this page and on
later visits. A release SHALL NOT extend to any other provider.

This reverses the earlier decision that an activation applies to exactly one
source URL and is never persisted. That decision made the gate ask again for
every video and after every reload, which no comparable surface does. Persisting
the answer is consent management, and this requirement therefore establishes the
smallest form of it that can carry a release: one recorded decision per provider,
no identifier, withdrawable from the privacy notice.

A player loaded **because a release was already recorded** SHALL NOT autoplay and
SHALL NOT take keyboard focus. Only the placeholder the visitor has just
activated SHALL do either. Carrying the activation behaviour over to a recorded
release would make every video on a page start at once and would move the focus
during page load.

Where the device storage is unavailable, the gate SHALL still hold: no release is
recorded, no release is read, and each placeholder behaves as it did before this
change. Failing to store a release SHALL NOT prevent the page from rendering.

The placeholder SHALL occupy the same area as the player that replaces it, so
that activation moves no surrounding content.

#### Scenario: A logged-out visitor opens a page carrying a video

- **WHEN** a visitor with no session and no recorded release opens a page on
  which a video is embedded
- **THEN** no network request is issued to any media provider's origin, and the
  placeholder is shown in the player's place

#### Scenario: The visitor activates the placeholder

- **WHEN** the visitor activates the placeholder
- **THEN** the provider's player replaces the placeholder and begins playing
  without a further activation inside the provider's frame

#### Scenario: The placeholder fetches no image from a third party

- **WHEN** the placeholder is rendered
- **THEN** it issues no request to the provider's thumbnail host or to any other
  third-party image service

#### Scenario: The placeholder states what activation causes

- **WHEN** the placeholder is rendered
- **THEN** it names the provider, states that activation connects to that
  provider and transmits the visitor's IP address, states that the decision is
  remembered until it is withdrawn, and links to the privacy notice

#### Scenario: The placeholder is operable without a pointing device

- **WHEN** the visitor reaches the placeholder by keyboard
- **THEN** it is a button carrying an accessible name that identifies it as
  loading a video from the named provider, it activates by keyboard, and after
  activation the focus moves to the player rather than being lost

#### Scenario: Activating one video releases the same provider on that page

- **WHEN** two videos from the same provider are embedded on one page and the
  visitor activates one of them
- **THEN** the other loads its player as well, without a reload and without a
  second activation

#### Scenario: A release does not extend to another provider

- **WHEN** a page carries one YouTube video and one Vimeo video and the visitor
  activates the YouTube one
- **THEN** the Vimeo placeholder remains, and no request is issued to Vimeo's
  origin

#### Scenario: A recorded release survives a reload

- **WHEN** a visitor who has released a provider opens a page carrying that
  provider's video again
- **THEN** the player is loaded without a placeholder and without a further
  activation

#### Scenario: A player loaded from a recorded release neither plays nor takes focus

- **WHEN** a page carrying two videos of a released provider is opened
- **THEN** neither player starts playing on its own, and the keyboard focus stays
  where the page put it

#### Scenario: A freshly activated player plays and takes focus

- **WHEN** the visitor activates a placeholder in the current view
- **THEN** that one player starts playing and receives the keyboard focus, while
  players loaded from the recorded release do neither

#### Scenario: Changing the source URL to a released provider needs no new activation

- **WHEN** the URL rendered by a placeholder is replaced by another URL of a
  provider that is already released
- **THEN** the new player is requested without a further activation

#### Scenario: Changing the source URL to an unreleased provider shows the gate

- **WHEN** the URL rendered by a placeholder is replaced by a URL of a provider
  that has not been released
- **THEN** the placeholder is shown again, and the new URL's player is not
  requested until it is activated in turn

#### Scenario: The visitor withdraws a release

- **WHEN** the visitor withdraws a provider's release from the privacy notice
- **THEN** that provider's videos show the placeholder again on the next page
  carrying one, and no request is issued to that provider's origin

#### Scenario: The withdrawal is reachable without an account

- **WHEN** a visitor with no session opens the privacy notice
- **THEN** the withdrawal for each released provider is present and operable
  there

#### Scenario: Device storage is unavailable

- **WHEN** reading or writing the recorded release fails
- **THEN** the page renders, the placeholder is shown, activating it loads that
  one player, and no release is carried to another placeholder or to a later
  visit

#### Scenario: Every embedding surface behaves identically

- **WHEN** a video is embedded on any surface, whether public or behind
  authentication
- **THEN** the same placeholder appears first, with no surface loading the
  provider's player directly

#### Scenario: A link that is not an embeddable video is unaffected

- **WHEN** a URL is not recognised as an embeddable video
- **THEN** the existing refusal is shown, and no placeholder and no player are
  rendered

### Requirement: An activated player is requested through each provider's privacy-preserving host and parameters

Once a visitor has activated a placeholder, the system SHALL request the player
through the least-disclosing address each provider offers: YouTube through
`youtube-nocookie.com`, and Vimeo with the provider's do-not-track parameter set.

This requirement is about **what the system asks for**, not about what a provider
then does. It states no promise on the provider's behalf, because no assertion
about a third party's cookie behaviour could be verified from this codebase.

This SHALL apply to the **built** embed URL only. The set of source hosts
accepted from a member SHALL be unchanged, so that the recognizer in the database
and the recognizer in the application continue to accept exactly the same inputs.

#### Scenario: An accepted YouTube link is embedded through the no-cookie host

- **WHEN** a recognised YouTube link is activated
- **THEN** the player is requested from `youtube-nocookie.com`

#### Scenario: An accepted Vimeo link is embedded with do-not-track set

- **WHEN** a recognised Vimeo link is activated
- **THEN** the player is requested with the provider's do-not-track parameter set

#### Scenario: The accepted source hosts are unchanged

- **WHEN** a member submits a link
- **THEN** it is accepted or refused exactly as before this change, and the
  database recognizer and the application recognizer still agree

### Requirement: A promotional claim made to visitors carries a source

A statement the platform itself makes to people who are not signed in — a count,
a statistic or a testimonial presented as evidence of the club — SHALL derive
from data the system holds, or SHALL name the person it comes from. Where neither
is available, the section SHALL be omitted rather than filled with an
illustrative value.

The rule is deliberately confined to what **the platform asserts about itself**.
It does not govern legal text, event data, prices, or anything a member writes:
those have their own sources and their own requirements, and stretching one rule
across all of them would make it unverifiable and therefore worthless.

A rounded or aspirational figure SHALL NOT be treated as exempt. A membership
count stated as more than the accounts that exist is a number a member can count.

An attribution to an unnamed archetype — "a member at this level" — SHALL NOT be
treated as naming a person.

#### Scenario: A guest page shows no unsourced promotional count

- **WHEN** a visitor without a session opens a page carrying the platform's own
  claims about itself
- **THEN** every such figure derives from data the system holds, and no section
  presents an illustrative one

#### Scenario: A testimonial names its author or is absent

- **WHEN** a public page would present a testimonial
- **THEN** it names the person it comes from, and otherwise the section is absent
  rather than attributed to an unnamed archetype

### Requirement: The guest home carries the same two-column structure as the signed-in home

On wide viewports the public home SHALL place its reading content in a main
column with a narrower rail beside it, using the ratio the signed-in home already
uses rather than introducing a third one. The image header SHALL span the full
width above that grid, not sit inside the main column. Below the breakpoint the
page SHALL collapse to a single column, with the rail's content following the
reading content rather than preceding it.

The rail SHALL carry only material that needs no query and no invented figure:
the membership levels the application already defines in code, and one invitation
to join.

The levels SHALL be read from the application's own level definitions, in the
order those definitions establish, and SHALL show for each the label, what it
unlocks, and its price. A list maintained separately from those definitions would
drift from what the platform actually sells.

#### Scenario: The guest home shows a rail on a wide viewport

- **WHEN** a visitor without a session opens the home page on a wide viewport
- **THEN** the reading content stands in a main column with a rail beside it, and
  the image header spans the width above both

#### Scenario: The rail collapses on a narrow viewport

- **WHEN** the same page is opened on a narrow viewport
- **THEN** it renders as one column and the rail's content follows the reading
  content rather than preceding it

#### Scenario: The rail names the levels the application defines

- **WHEN** the rail renders
- **THEN** the levels it lists are those the application holds in code, in their
  defined order, each with its label, what it unlocks and its price

### Requirement: The invitation to register opens registration

A control that invites a visitor to become a member SHALL lead to the registration
form, not to the sign-in form. The registration state SHALL therefore be
addressable, so that a link can reach it.

Every such control on the guest surfaces SHALL use it. A button labelled "become a
member" that presents a sign-in form asks the visitor to do something they cannot
do, and it does so at the exact moment they decided to join.

The state SHALL follow the address even when the sign-in route is already
rendered, because a route that does not remount keeps whatever state it had.

#### Scenario: An invitation to join opens the registration form

- **WHEN** a visitor activates a control inviting them to become a member
- **THEN** the registration form is shown, not the sign-in form

#### Scenario: The state follows the address without a remount

- **WHEN** the sign-in route is already rendered and the visitor navigates to the
  registration address
- **THEN** the registration form is shown rather than the previously rendered mode

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

**The initial default and the rail it produces are claims about `xl` and wider,
and only there.** The right bar docks at `xl`, not at `lg` — a threshold the
requirement "The application shell docks the navigation to the viewport edge"
establishes, together with the measurement that produced it. Between `lg` and
`xl` the bar is a drawer and there is no rail to start collapsed, so a promise
made from `lg` upward would be unkeepable across that whole band.

**The stored preference is untouched by this.** It is a single device-local
value that SHALL survive every width, including widths below `xl` where it has
nothing to render, and SHALL apply again unchanged when the viewport widens past
the threshold. Only the docked presentation is width-bound; persistence,
separation from the navigation's own state, and the tolerance for unavailable
storage all hold at every width.

#### Scenario: The first visit does not spend content width

- **WHEN** a member with no stored right-bar preference opens a page that
  carries the right bar, at `xl` or wider
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

### Requirement: Beide angedockten Leisten klappen über dasselbe Bedienelement ein

Das System SHALL für das Ein- und Ausklappen **beider** angedockter Leisten
**ein** Bedienelement führen: einen halben Pill am inneren Rand der Leiste, der
über deren Kante hinausragt und an der zweiten Leiste gespiegelt steht.

Der Pill SHALL an beiden Leisten **an derselben Stelle** sitzen: oben, auf Höhe
der Kopfzeile. Zwei Leisten, die gespiegelt gebaut sind und ihren Schalter an
verschiedenen Enden tragen, lesen sich als zwei verschiedene Dinge.

Der Pill SHALL **dauerhaft sichtbar** sein und SHALL NOT erst bei Mauskontakt
erscheinen. Ein Schalter, der Mauskontakt voraussetzt, ist auf Geräten ohne
Zeiger nicht erreichbar und verlangte dort ein zweites Verhalten.

Der Pill SHALL ein echtes `button`-Element sein, SHALL einen Namen tragen, der
die **Handlung** und die betroffene Leiste nennt („Navigation einklappen"), und
SHALL `aria-expanded` führen sowie, wo umsetzbar, die Leiste über `aria-controls`
benennen. Ein Name, der nur einen Zustand nennt („Navigation offen"), sagt nicht,
was ein Auslösen bewirkt.

Die Richtung seines Pfeils SHALL von **beiden** Achsen abhängen — Seite und
Zustand —, also vier Fälle abdecken. Am linken Rand zeigt er offen nach links
und eingeklappt nach rechts; rechts gespiegelt.

Der Pill SHALL die **Fläche und Schriftfarbe seiner Leiste** tragen und SHALL
NOT einen eigenen Rahmen führen. Er ist eine **Ausbuchtung der Leiste**, kein
Bedienelement, das darauf liegt — und eine Wölbung hat die Farbe dessen, was
sich wölbt. Wechselt eine Leiste ihre Fläche (die rechte tut das beim
Aufklappen), SHALL der Pill mitwechseln.

Abgehoben SHALL er über einen **Schatten** werden, nicht über einen Rand. Das
ist keine reine Geschmacksfrage: im hellen Theme sind Leiste und Kopf beide
weiss, und eine gleichfarbige Wölbung ohne Schatten wäre dort unsichtbar.

Das „gleiche Bedienelement an beiden Leisten" SHALL als **dieselbe Geste**
verstanden werden, nicht als dieselbe Farbe: an beiden wölbt sich die Leiste,
an derselben Stelle, in ihre eigene Richtung.

Die Zusage, dass eine angedockte Leiste **nicht gerundet und nicht schwebend**
ist, SHALL unberührt bleiben und SHALL sich weiterhin auf die **Fläche** der
Leiste beziehen: bündig am Rand, volle Höhe, ungerundet. Der Pill ist ihr
Bedienelement, nicht ihre Kante.

Die eingeklappte rechte Leiste SHALL Ungelesenes weiterhin **melden**, und diese
Meldung SHALL NOT ein zweiter Schalter zum Ausklappen sein. In einem Rail von
4,5 rem Breite stünden Melder und Pill in derselben Kopfzeile, keine 40 px
auseinander und mit derselben Wirkung — zwei Bedienelemente, die dasselbe tun,
sind an dieser Stelle keine Erleichterung, sondern eine Mehrdeutigkeit.

Der alte Einklapp-Knopf im Kopf der rechten Leiste SHALL entfallen. Er neben dem
Pill stehen zu lassen, verfehlte den Zweck dieser Anforderung vollständig.

Das Ein- und Ausklappen SHALL sich sonst nicht ändern: getrennte Zustände je
Leiste, beide überdauern das Neuladen, und das Einklappen der einen SHALL NOT
die andere mitnehmen.

#### Scenario: Beide Leisten tragen denselben Schalter an derselben Stelle

- **WHEN** ein angemeldetes Mitglied den Rahmen auf einem breiten Schirm sieht
- **THEN** trägt jede angedockte Leiste oben an ihrem inneren Rand einen halben
  Pill, der über die Kante hinausragt — an der rechten gespiegelt

#### Scenario: Der Pill klappt ein und aus

- **WHEN** ein Mitglied den Pill einer Leiste auslöst
- **THEN** wechselt genau diese Leiste zwischen offen und Rail, und die andere
  bleibt, wie sie war

#### Scenario: Der Pill steht auch ohne Mauskontakt da

- **WHEN** der Zeiger die Leiste nicht berührt
- **THEN** ist der Pill trotzdem sichtbar und auslösbar

#### Scenario: Es gibt links keine zweite Einklapp-Fläche mehr

- **WHEN** ein Mitglied die Navigationsleiste ansieht
- **THEN** trägt sie **keine** untere Einklapp-Zeile mehr; der Feedback-Zugang
  an ihrem unteren Rand bleibt bestehen

#### Scenario: Der eingeklappte rechte Rail meldet, ohne zu schalten

- **WHEN** ein Mitglied die eingeklappte rechte Leiste mit ungelesenen
  Nachrichten sieht
- **THEN** ist die Zahl ablesbar und angesagt, und der einzige Schalter zum
  Ausklappen ist der Pill

#### Scenario: Der alte Knopf im Kopf der rechten Leiste ist weg

- **WHEN** ein Mitglied die aufgeklappte rechte Leiste ansieht
- **THEN** trägt ihre Kopfzeile keinen eigenen Einklapp-Knopf mehr

#### Scenario: Der Pfeil zeigt in allen vier Fällen richtig

- **WHEN** eine Leiste offen oder eingeklappt ist, links oder rechts
- **THEN** zeigt der Pfeil des Pills in die Richtung, in die das Auslösen die
  Leiste bewegt

### Requirement: Ein Kartenraster bemisst seine Spaltenzahl an seinem Behälter

Ein Raster aus gleichartigen Karten SHALL seine Spaltenzahl an der Breite
**seines eigenen Behälters** schalten, nicht an der Fensterbreite. Der Behälter
SHALL dazu als Abfragebehälter ausgewiesen sein (`@container`), und die
Schwellen SHALL in Containerbreiten stehen (`@[<breite>]:`).

Jedes Raster SHALL eine **Untergrenze je Karte** einhalten und lieber eine
Spalte weniger zeigen, als diese Grenze zu unterschreiten. Die Untergrenze SHALL
**208 px** betragen — das ist die schmalste Karte, die die Anwendung heute schon
ausliefert (1280 px Fensterbreite bei angedockter Nachrichten-Leiste, so
abgenommen in AGE-627), und damit keine neue Meinung, sondern der bereits
geltende Boden.

Der Grund ist gemessen, nicht vermutet. Am 31.08. gegen `63f3237`: alle drei
Kartenraster der Anwendung schalteten am Viewport. Eine angedockte Spalte
verengt die Inhaltsspalte, aber nicht das Fenster — das Raster blieb
dreispaltig, während die Fläche schrumpfte. Mit einer 280 px breiten
Inhaltsspalte rechts fielen die Karten bei 1024 px auf **126 px** und bei
1280 px mit offener Nachrichten-Leiste auf **115 px**. Beides liegt unter den
rund 128 px, die AGE-627 ausdrücklich verworfen hat.

Der Deckel nach oben SHALL erhalten bleiben: ein Raster, für das eine
Höchstzahl an Spalten entschieden wurde, SHALL diese Zahl auch dann nicht
überschreiten, wenn der Behälter breiter wird. Eine Umstellung auf
Containerbreiten SHALL keine Fläche dichter machen, als sie heute ist.

#### Scenario: Die verengte Spalte bricht um, statt zu quetschen

- **WHEN** ein Kartenraster in einem Behälter von 409 px dargestellt wird
- **THEN** zeigt es **eine** Spalte über die volle Breite
- **AND** keine Karte ist schmaler als 208 px

#### Scenario: Der heutige Zustand bleibt unverändert

- **WHEN** ein Kartenraster mit Deckel 3 in einem Behälter von 657 px oder
  873 px dargestellt wird
- **THEN** zeigt es drei Spalten, wie vor der Umstellung

#### Scenario: Ein breiter Behälter macht die Fläche nicht dichter

- **WHEN** derselbe Behälter auf 1376 px wächst
- **THEN** zeigt das Raster weiterhin höchstens drei Spalten

#### Scenario: Die Fensterbreite allein entscheidet nicht mehr

- **WHEN** zwei Raster derselben Art bei gleicher Fensterbreite in
  unterschiedlich breiten Behältern stehen
- **THEN** dürfen sie verschiedene Spaltenzahlen zeigen

