## ADDED Requirements

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

#### Scenario: A retired variant identifier resolves to the default

- **WHEN** a visitor loads the app with `?variant=sommerfest`, `?variant=b`,
  `?variant=linkedin`, or any value that is neither `hell` nor `navy`
- **THEN** the `hell` theme is applied and the app renders normally

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
The pre-paint resolution SHALL follow the same precedence as the runtime resolver;
where the two disagree, the runtime would visibly correct the pre-paint value,
which is the flash this requirement exists to prevent.

A server-side preference is by definition unavailable before first paint. When it
arrives and differs from the pre-paint value, the system SHALL apply it as a
deliberate transition rather than leaving the visitor on the wrong theme.

#### Scenario: A returning visitor who chose navy sees no light frame

- **WHEN** a visitor whose stored preference is `navy` loads the app
- **THEN** the first painted frame is already in the `navy` theme

#### Scenario: Storage is unreadable

- **WHEN** the pre-paint resolution cannot read `localStorage` (private mode,
  blocked storage)
- **THEN** the default `hell` theme is applied and the app boots normally

### Requirement: The theme is a member preference, not a review tool

The system SHALL let a signed-in member choose their theme in the settings, and
SHALL persist that choice in `member_settings.theme`. For a signed-out visitor the
choice SHALL live only in `localStorage` and default to `hell`.

On sign-in the stored server value SHALL win and overwrite the local value, so that
a member's choice follows them across devices. A change made while signed in SHALL
be written to both. Signing out SHALL NOT reset the theme.

The system SHALL NOT expose the development variant switcher to members; the
settings control replaces it.

#### Scenario: The server value wins at sign-in

- **WHEN** a member whose `member_settings.theme` is `navy` signs in on a device
  whose `localStorage` holds `hell`
- **THEN** the `navy` theme is applied and `localStorage` is updated to `navy`

#### Scenario: A signed-out visitor keeps their local choice

- **WHEN** a signed-out visitor switches theme and reloads
- **THEN** the chosen theme is applied, resolved from `localStorage` alone

#### Scenario: The choice survives sign-out

- **WHEN** a member signs out
- **THEN** the theme they last chose remains applied

### Requirement: Design tokens are the only styling contract

The system SHALL define all colour, radius, shadow and typography tokens in
`src/index.css` as a Tailwind v4 `@theme` block with a single
`html[data-variant="navy"]` override. There is no `tailwind.config.js`.

Because Tailwind utility names are strings, the type checker cannot detect a stale
token reference. The system SHALL therefore enforce the absence of retired token
names by a text search in CI, not by review alone.

#### Scenario: A retired token name reaches the default branch

- **WHEN** a change introduces a `gold` token or utility anywhere under `src/`
- **THEN** CI fails

### Requirement: Fonts are served from the application's own origin

The system SHALL serve its webfonts from its own origin and SHALL NOT request fonts
from a third-party host at runtime. Fraunces carries display type, Inter carries
everything else.

#### Scenario: No third-party font request on load

- **WHEN** the application is loaded
- **THEN** no request is issued to a Google Fonts host, and the source contains no
  `fonts.googleapis.com` reference

### Requirement: The brand mark is a single theme-adaptive vector

The system SHALL render the brand mark as an inline SVG compass star that takes its
colour from `currentColor`, so that one asset serves both themes. The system SHALL
NOT keep a raster lockup, nor a second asset selected by theme.

The wordmark is `eff.bee.zee`, lowercase throughout, with the separating dots in
the accent colour. Accessible names for the mark SHALL read `eff.bee.zee`.

#### Scenario: One asset serves both themes

- **WHEN** the brand mark is rendered on a light surface and on a dark surface
- **THEN** the same component is used in both, inheriting the surrounding colour
