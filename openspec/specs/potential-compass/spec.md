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

#### Scenario: Returning member sees completed state

- **WHEN** a member who already has `compass_responses` opens the Compass page
- **THEN** it shows that the compass is done and offers to run it again and to view the
  Erfolgsradar

#### Scenario: New member starts or resumes

- **WHEN** a member without responses opens the Compass page
- **THEN** it offers "Mini-Compass starten" (or "fortsetzen" when a local draft exists)
