## ADDED Requirements

### Requirement: Displayed name is resolved by the viewer's tier

The system SHALL resolve the name shown for a member according to the viewing
caller's membership tier: a viewer whose tier clears the reveal threshold SHALL
see the member's full name, while a viewer below the threshold (and any anonymous
caller) SHALL see a masked label rather than the full name. This graduated reveal
extends the existing anonymous "Mitglied" fallback, which remains the masked label
for callers who cannot read a profile at all.

#### Scenario: Cleared-tier viewer sees the full name

- **WHEN** a viewer whose tier clears the reveal threshold reads another member in
  the directory
- **THEN** that member's full name is shown

#### Scenario: Below-threshold viewer sees the masked label

- **WHEN** a viewer whose tier is below the reveal threshold reads another member
- **THEN** a masked label is shown instead of the full name

#### Scenario: Anonymous viewer keeps the masked fallback

- **WHEN** an anonymous caller cannot read an author's profile row
- **THEN** the name still renders as the masked "Mitglied" fallback

### Requirement: Tiered name masking is enforced server-side

The system SHALL enforce the tiered name resolution in the database read path so a
below-threshold or anonymous caller never receives another member's full name over
the API, independently of the client. The client SHALL render whichever name value
the server returns and MUST NOT be the boundary that hides the full name.

#### Scenario: The API withholds the full name from a below-threshold caller

- **WHEN** a below-threshold caller requests directory rows
- **THEN** the full name is not present in the returned data; only the masked label
  is returned

#### Scenario: Client renders the server-resolved value

- **WHEN** the directory renders a member's name
- **THEN** it displays the name value returned by the server without deriving the
  full name from any other client-held source
