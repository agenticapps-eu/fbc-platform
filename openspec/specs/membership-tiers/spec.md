# Membership Tiers

## Purpose

Defines the ordered membership levels that gate what a member may see and do
across the FBC community platform. Tier rank is the single numeric authority
that every visibility and capability rule (RLS, UI gating) reads. Reconstructed
from the code as of the OpenSpec migration; supersedes the legacy 3-tier
(Discover/Prime/Legacy) and 7-tier (P4) models described in
`docs/legacy-planning/`.

## Requirements

### Requirement: Six-level tier ladder

The system SHALL define exactly six membership tiers, each with a unique
ascending `level_rank`: `basic` (1), `connect` (2), `discover` (3), `exchange`
(4), `focus` (5), `impact` (6). Each tier SHALL carry a `label` and an annual
price in EUR (`price_year`): basic 0, connect 0, discover 150, exchange 300,
focus 600, impact 1200.

#### Scenario: Tiers are seeded in rank order

- **WHEN** the database is provisioned
- **THEN** `public.membership_tiers` contains the six keys above with unique
  `level_rank` values 1–6 and the prices listed

#### Scenario: A superseded tier key is absent

- **WHEN** any code queries `membership_tiers` for `explore`, `impuls`,
  `active`, `prime`, `circle`, or `legacy`
- **THEN** no row is returned (those keys were removed by the six-level migration)

### Requirement: New members default to Basic

The system SHALL assign the `basic` tier to every newly created profile unless
an explicit tier is supplied.

#### Scenario: Sign-up creates a Basic profile

- **WHEN** a new auth user is created and the profile trigger fires
- **THEN** the new `profiles` row has `tier = 'basic'`

### Requirement: Tier rank is the authority for gating

The system SHALL expose the caller's current tier rank through a
`SECURITY DEFINER` function `current_tier_rank()` that returns the `level_rank`
of the authenticated member, and all tier-based access rules SHALL compare
against this rank rather than against tier keys.

#### Scenario: Rank resolves for the authenticated member

- **WHEN** an authenticated member calls `current_tier_rank()`
- **THEN** it returns the `level_rank` of that member's `tier`

#### Scenario: Higher rank satisfies a lower-rank gate

- **WHEN** a resource requires rank ≥ N and the member's rank is M ≥ N
- **THEN** the tier gate permits access

### Requirement: A member holds exactly one tier

The system SHALL constrain `profiles.tier` to a single valid `membership_tiers`
key via foreign key, so a member occupies exactly one tier at a time.

#### Scenario: Invalid tier is rejected

- **WHEN** a write sets `profiles.tier` to a value not present in
  `membership_tiers`
- **THEN** the write is rejected by the foreign-key constraint
