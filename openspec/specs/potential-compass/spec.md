# Potential Compass

## Purpose

Captures a member's private orientation along the four themes `sein`/`tun`/`haben`/
`wirken` (the Mini-Compass) together with their potential level and transaction-volume
signal, so the platform can later derive success-radar and routing information from real
answers. This is a prepared Ebene-2 capability: the `compass_responses` schema exists
with owner-only RLS and a Mini-Compass entry point in the UI, but the broader potential
ecosystem it feeds is not yet wired. Reconstructed from the code as of the OpenSpec
migration; scope is limited to what the schema and page provide today.

## Requirements

### Requirement: Members record compass responses

The system SHALL let a member store `compass_responses` rows tied to their own profile,
each carrying an optional theme from `sein`/`tun`/`haben`/`wirken`, an `answers` jsonb
payload, a free-text `potential_level`, and a `tx_volume_band`. Theme and volume band
SHALL be constrained to their allowed values.

#### Scenario: Member saves compass answers

- **WHEN** a member completes the Mini-Compass onboarding
- **THEN** `compass_responses` rows are written with the member's `profile_id`, the
  theme, the `answers` jsonb and the transaction-volume signal

#### Scenario: Invalid theme or volume band is rejected

- **WHEN** a write sets `theme` outside `sein/tun/haben/wirken` or `tx_volume_band`
  outside `lt_10k/10k_100k/100k_1m/1m_10m/gt_10m`
- **THEN** the CHECK constraint rejects the row

### Requirement: Compass responses are owner-only

The system SHALL restrict both reading and writing of `compass_responses` strictly to
the owning member, enforced by RLS, because these rows carry private potential and
transaction signals. No Prime+ or cross-member read path SHALL exist on this table.

#### Scenario: Owner reads their own responses

- **WHEN** a member selects `compass_responses` where `profile_id` is their own id
- **THEN** the `compass_responses_select_own` policy returns the rows

#### Scenario: Another member is denied

- **WHEN** a member selects or writes a `compass_responses` row that is not their own
- **THEN** the RLS policies deny it (own-profile only, unlike offers/needs)

### Requirement: Routing is derived from transaction volume

The system SHALL treat a compass response's `routing` as derived from its
`tx_volume_band`, resolving to `dkri` for large volume (`>= 1m_10m`) and `fbc`
otherwise, constrained to those two values.

#### Scenario: Routing reflects the band

- **WHEN** a `compass_responses` row carries a large `tx_volume_band` (`1m_10m` or
  `gt_10m`)
- **THEN** its intended `routing` is `dkri` (per the column's documented derivation),
  and `routing` is constrained to `fbc`/`dkri`

### Requirement: Mini-Compass entry point reflects completion state

The system SHALL present a Mini-Compass entry point that starts, resumes, or repeats the
guided onboarding depending on whether the member already has responses and whether a
local draft exists.

That entry point SHALL NOT carry a navigation menu item and SHALL NOT be reached
from first login. It SHALL remain routable by URL at `/kompass`, so a member who
holds a link or bookmark still gets the page. The guided route (`/onboarding`),
the success radar and the rich Suche & Biete editor SHALL remain in the code,
unreferenced by the menu rather than removed, so restoring them is a menu entry
plus the removal of a redirect.

A member signing in for the first time SHALL land on the start page. The system
SHALL NOT consult compass completion when deciding where a first login goes.

#### Scenario: Returning member sees completed state

- **WHEN** a member who already has `compass_responses` opens the Kompass page
- **THEN** it shows that the compass is done and offers to run it again and to view the
  Erfolgsradar

#### Scenario: New member starts or resumes

- **WHEN** a member without responses opens the Kompass page
- **THEN** it offers "Mini-Kompass starten" (or "fortsetzen" when a local draft exists)

#### Scenario: First login does not enter the wizard

- **WHEN** a member without `compass_responses` and without a local draft signs in
  for the first time
- **THEN** they land on the start page, and no redirect to the guided onboarding occurs

#### Scenario: The page keeps no menu entry but stays routable

- **WHEN** the sidebar is rendered for any membership level
- **THEN** it contains no Kompass item, while navigating to `/kompass` directly
  still renders the page

### Requirement: The compass vocabulary drives a lightweight offer/need path

The system SHALL reuse the Mini-Compass "Ich biete" / "Ich suche" categories as a
lightweight path that needs no questionnaire: the same category keys SHALL back
the member-directory filter and the profile editor's chip selection. This path
SHALL NOT collect the `sein`/`tun`/`haben`/`wirken` scales, SHALL NOT compute a
success radar, and SHALL NOT write `compass_responses`.

The categories SHALL remain declared in one place, and the two sides SHALL NOT be
assumed symmetric: the offer side and the need side carry different category sets
that overlap only partially, so any surface listing "the categories" SHALL list
them per side.

#### Scenario: The lightweight path writes no compass responses

- **WHEN** a member picks categories in the profile editor and saves
- **THEN** `offers`/`needs` rows change and `compass_responses` is untouched

#### Scenario: The two sides are listed separately

- **WHEN** a surface offers the categories for filtering or selection
- **THEN** the offer side and the need side are presented as distinct lists rather
  than one merged list

### Requirement: The compass is named Kompass in the interface only

The system SHALL present the capability to members as **"Kompass"** in every
visible label and in its route (`/kompass`), while the database SHALL keep the
name `compass` throughout — `compass_responses`, `compass_avg`, `compass_themes`,
the `compass_responses_select_own` / `_write_own` policies, the index and the
pgTAP probe. Code identifiers SHALL likewise keep `Compass`.

The system SHALL redirect the former route `/compass` to `/kompass` so existing
links and bookmarks resolve, and SHALL carry a comment at the category
configuration that records this split, so the divergence is not later read as a
defect and "fixed" by a rename migration that would cost a cascade and buy a
member nothing.

The split runs between **object names and displayed text**, not between the
database and the application. A label string that a database function returns for
rendering is displayed text and SHALL be renamed with the rest: the potential
score's breakdown emits a component labelled "Compass" that the profile widgets
render verbatim. Renaming it replaces a function body, not a schema object, and
costs no cascade.

#### Scenario: A label emitted by the database is renamed too

- **WHEN** the potential-score breakdown is rendered in the profile
- **THEN** its compass component reads "Kompass", while the component's stable key
  and every table, view, policy and index keep the name `compass`

#### Scenario: A member sees only the German name

- **WHEN** any page, menu entry, button or message referring to the capability is
  rendered
- **THEN** it reads "Kompass" (or "Mini-Kompass"), never "Compass"

#### Scenario: An old link still resolves

- **WHEN** a member opens `/compass`
- **THEN** they are redirected to `/kompass`

#### Scenario: The database keeps its names

- **WHEN** the schema is inspected after the change
- **THEN** `compass_responses`, `compass_avg`, `compass_themes` and both compass
  policies exist under their original names
