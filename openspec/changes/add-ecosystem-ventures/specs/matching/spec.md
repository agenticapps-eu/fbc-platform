## ADDED Requirements

### Requirement: Ecosystem acquisition profiles are a staff-managed matching source

The system SHALL store ecosystem acquisition profiles in an `acquisition_profiles`
table that references an ecosystem **partner** (Capital-Parks is the first; the
model SHALL support further partners without a schema change) and carries structured
acquisition criteria (an optional theme from `sein`/`tun`/`haben`/`wirken`, branche,
region, an acquirer `tx_volume_band`, and tags) plus an `active` lifecycle flag.
Acquisition profiles SHALL be written only through a server-controlled, staff-only
ingest path; ordinary members SHALL NOT read or write them — only staff and the
server-side matching engine access them.

#### Scenario: Only staff ingest an acquisition profile

- **WHEN** an ordinary member attempts to read, insert, or update an
  `acquisition_profiles` row
- **THEN** it is denied; only the staff ingest path and the server-side matching
  engine access it

#### Scenario: An inactive profile is not matched

- **WHEN** an acquisition profile's `active` flag is false
- **THEN** the matching engine produces no new acquisition matches for it

### Requirement: Acquisition matches are server-computed in their own table

The system SHALL score member offers against active acquisition profiles using the
same rule-based, server-side engine, recording results in a dedicated
`acquisition_matches` table keyed to `(member, acquisition_profile)`. The
member-to-member `matches` table SHALL remain strictly member-to-member and is not
altered. Member-side-only weights (tier, profile completeness) SHALL NOT be applied
to the non-member acquisition source; a missing acquisition-side component
contributes no score. Members SHALL NOT write `acquisition_matches`.

#### Scenario: A complementary member offer produces an acquisition match

- **WHEN** the engine runs and a member offer is complementary to an active
  acquisition profile's criteria
- **THEN** a scored `acquisition_matches` row is created for that
  `(member, acquisition_profile)`, server-side

#### Scenario: The member-to-member matches table is unchanged

- **WHEN** an acquisition match is produced
- **THEN** it is written to `acquisition_matches`, and no non-member row is written
  to `matches`

#### Scenario: Large-volume acquisition match routes DKRI

- **WHEN** an acquisition match's acquirer `tx_volume_band` is large (`1m_10m` or
  `gt_10m`)
- **THEN** its routing is `dkri`, consistent with existing volume-based routing;
  otherwise it routes to staff review

### Requirement: Member identity is not disclosed to the acquirer without consent

An acquisition match SHALL surface to matching managers (staff) for brokering and
SHALL NOT automatically disclose the matched member's identity or contact data to
the acquiring partner. Disclosure to the partner SHALL occur only after the member
has consented. A member MAY read their own acquisition matches; the acquiring
partner SHALL NOT see matched members until the match is brokered with consent.

#### Scenario: Acquirer does not see the member before consent

- **WHEN** an acquisition match exists but the member has not consented to disclosure
- **THEN** the acquiring partner cannot read the member's identity or contact data;
  only staff see the match for brokering

#### Scenario: A member reads only their own acquisition matches

- **WHEN** a member reads acquisition matches
- **THEN** RLS returns only rows where they are the matched member
