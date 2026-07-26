## REMOVED Requirements

### Requirement: Author name masking is only partially resolved

**Reason:** Superseded — graduated, tier-based name reveal is now implemented via
the shared display-name resolver (see `member-profiles`), replacing the "partially
resolved / not yet implemented" status. The anonymous "Mitglied" fallback is
retained by the new requirements.

## ADDED Requirements

### Requirement: Directory names are resolved by the viewer's tier

The directory SHALL display each member's name via the shared display-name resolver
(see `member-profiles`): a caller who is the member themselves, or whose tier clears
`has_level(4)` (`exchange`), SHALL see the full name; every other authenticated
caller (`level_rank < 4`) and any anonymous caller SHALL see the masked "Mitglied"
label. Resolution SHALL occur in the database read path (`profiles_public` /
`search_directory`), so the full name is never sent to a below-threshold caller.

#### Scenario: Exchange-and-above viewer sees the full name

- **WHEN** a caller with `level_rank >= 4` reads another member in the directory
- **THEN** that member's full name is returned

#### Scenario: Below-threshold viewer sees the masked label

- **WHEN** a caller with `level_rank < 4` (but able to see the row) reads another member
- **THEN** the "Mitglied" masked label is returned and the full name is absent from
  the payload

#### Scenario: A member always sees their own full name

- **WHEN** a caller reads their own directory row
- **THEN** their full name is returned regardless of tier

#### Scenario: Anonymous caller keeps the masked fallback

- **WHEN** an anonymous caller cannot read an author's profile row
- **THEN** the name renders as the "Mitglied" fallback

#### Scenario: The masked name does not leak through search or ordering

- **WHEN** a below-threshold caller searches or orders the directory by name
- **THEN** the full name is not disclosed through match highlighting, ordering, or
  any returned free-text field
