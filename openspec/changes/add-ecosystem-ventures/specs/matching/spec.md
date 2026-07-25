## ADDED Requirements

### Requirement: Capital-Parks acquisition profile is a matching source

The system SHALL store a Capital-Parks acquisition profile in an
`acquisition_profiles` table carrying its acquisition criteria (an optional theme
from `sein`/`tun`/`haben`/`wirken`, branche, region, a `tx_volume_band`, and tags),
writable only through a server-controlled, staff-only ingest path and never by
ordinary members. An active acquisition profile SHALL be a first-class candidate
source for the matching engine, so member offers are scored against its criteria
alongside member-to-member matching.

#### Scenario: Acquisition profile is ingested by staff only

- **WHEN** an ordinary member attempts to insert or update an `acquisition_profiles`
  row
- **THEN** the write is denied; only the server-controlled staff ingest path may
  create or update an acquisition profile

#### Scenario: Member offer is scored against an acquisition profile

- **WHEN** the matching engine runs and a member offer is complementary to an
  active acquisition profile's criteria
- **THEN** a scored match is produced between that member and the acquisition
  profile source, using the same rule-based, server-side engine

#### Scenario: Large-volume acquisition match keeps DKRI routing

- **WHEN** an acquisition-profile match is driven by a large-volume band
  (`1m_10m` or `gt_10m`)
- **THEN** the match's `routing` is `dkri`, consistent with existing volume-based
  routing

### Requirement: Joint ventures are formed from platform projects

The system SHALL provide a joint-venture formation process that turns an accepted
match or platform project into a tracked joint venture, storing the venture in
`joint_ventures` and its members in `joint_venture_participants`. A joint venture
SHALL be created only through a server-controlled action (members SHALL NOT insert
ventures directly), and reading a venture SHALL be restricted by RLS to its
participants (and staff).

#### Scenario: Venture is formed from an accepted match

- **WHEN** the server-controlled action forms a joint venture from an accepted
  match or platform project
- **THEN** a `joint_ventures` row is created and its participating members are
  recorded in `joint_venture_participants`

#### Scenario: Members cannot create a venture directly

- **WHEN** a member attempts to INSERT into `joint_ventures` outside the
  server-controlled action
- **THEN** the write is denied because no client INSERT policy grants it

#### Scenario: Only participants read a venture

- **WHEN** a member who is not a participant selects a `joint_ventures` row
- **THEN** RLS returns no row (only participants and staff may read it)
