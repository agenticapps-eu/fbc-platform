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

Blue SHALL be the only accent family. The accent tokens are `--color-accent`,
`--color-accent-strong`, `--color-accent-soft` and `--color-accent-ink`. The system
SHALL NOT define a second accent, a gold token, or a per-format accent palette.

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
  copy, rules and status colours keep the values they had

#### Scenario: Components carry no theme branch

- **WHEN** a component renders a surface, text or accent colour
- **THEN** it reads a token whose name is identical in both themes, and contains no
  conditional keyed on the active theme

#### Scenario: A second accent family is not introduced

- **WHEN** the token vocabulary is inspected
- **THEN** no `gold`, `--accent2` or `--color-fmt-*` token exists, and the accent
  utilities resolve to the blue ramp

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

### Requirement: Content uses the available width; only reading columns are capped

Pages SHALL use the width the viewport offers, up to 1440 px beside the sidebar.
A width cap SHALL apply only to routes that are a form or a single column of prose
— sign-in, onboarding, settings and the profile editor — and SHALL sit at 760 px.

The rule SHALL be stated as a list of the capped routes, not of the wide ones: a
default cap silently starves every multi-column layout added later, which is how
`lg:grid-cols-3` and `xl:grid-cols-4` on the dashboard came to be classes that
could never take effect.

#### Scenario: A multi-column page gets its columns

- **WHEN** the member dashboard renders at 1440 px
- **THEN** its tile grid and its two-column section resolve at their intended
  breakpoints, and no card title is truncated for want of width

#### Scenario: A form keeps a readable measure

- **WHEN** the settings page renders at 1440 px
- **THEN** its column stays capped rather than stretching across the full width

### Requirement: Every content page opens with an image header

Each page reachable from the navigation SHALL open with a header carrying a title,
a one-line claim and a photograph. The photograph SHALL bleed to the right and
SHALL be overlaid by a gradient that keeps the text side an even surface: body copy
SHALL NOT sit on the image.

Each such page SHALL have its **own** motif, held in one route table rather than at
the call sites. A shared default image is not acceptable — a header that repeats
across pages replaces the orientation it exists to give.

Form and reading routes (sign-in, onboarding, settings, profile editor) SHALL NOT
carry an image header: over a form it is decoration in front of the task.

#### Scenario: A navigation page opens with its own motif

- **WHEN** a member opens Kompass, Academy, Events, Mitglieder or Aktivität
- **THEN** each shows a header with title, claim and a photograph that page does not
  share with the others

#### Scenario: The header text stands on an even surface

- **WHEN** an image header renders
- **THEN** the title and claim sit on the flat gradient side, not on the photograph

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
