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

Blue SHALL be the only accent family. The accent tokens are `--color-accent`,
`--color-accent-strong`, `--color-accent-soft` and `--color-accent-ink`. The system
SHALL NOT define a second accent, a gold token, or a per-format accent palette.

Body copy SHALL use `--color-ink`, which is anthracite in the `hell` theme and
never pure black.

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

The wordmark is `eff.bee.zee`, lowercase throughout, with the separating dots in
the accent colour. Accessible names for the mark SHALL read `eff.bee.zee`.

#### Scenario: One asset serves both themes

- **WHEN** the brand mark is rendered on a light surface and on a dark surface
- **THEN** the same component is used in both, inheriting the surrounding colour
