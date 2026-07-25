## ADDED Requirements

### Requirement: Matching v2 features are gated behind a paid matching tier

The system SHALL gate the Matching v2 feature set (provision entries and the
standalone DKRI funnel) behind a paid matching tier expressed as a rank
threshold above the existing Prime+ gate, enforced in the database via a
`SECURITY DEFINER` predicate rather than on client-supplied identity. A member
whose matching-tier rank is below the threshold MUST NOT be able to reach the v2
features even if the client is bypassed.

#### Scenario: Paid-tier member reaches v2 features

- **WHEN** a member whose matching-tier rank clears the paid threshold accesses a
  Matching v2 feature
- **THEN** the gating predicate returns true and the RLS-protected v2 rows are
  available to them

#### Scenario: Below-threshold member is denied v2

- **WHEN** a member whose matching-tier rank is below the paid threshold attempts
  to read or write a Matching v2 (provision) row
- **THEN** the RLS gate denies the access because the paid-tier predicate is false

### Requirement: Brokered matches record a provision entry

The system SHALL create exactly one provision/commission entry when a match
reaches the brokered/closed state, written only by the server (never by a
member), keyed to the match so re-processing the same match SHALL NOT create a
duplicate. Reading a provision entry SHALL be restricted to the deal's two
participants and to holders of the matching-manager role.

#### Scenario: A brokered deal produces one provision entry

- **WHEN** a match transitions into the brokered/closed state
- **THEN** the server creates a single provision entry keyed to that match

#### Scenario: Re-brokering does not duplicate provision

- **WHEN** the brokered/closed transition is processed again for a match that
  already has a provision entry
- **THEN** no second provision entry is created (idempotent per match)

#### Scenario: Non-participant cannot read a provision entry

- **WHEN** a member who is neither a participant of the deal nor a matching
  manager selects the provision entry
- **THEN** RLS returns no row

### Requirement: Standalone DKRI funnel is independent of FBC membership

The system SHALL provide a DKRI matching funnel that a prospect without an FBC
membership MAY enter, and this funnel SHALL NOT require or read a `profiles` tier
or any FBC membership state. A standalone DKRI intake SHALL feed the same
staff-managed `routing_queue` used by FBC-originated `dkri` requests.

#### Scenario: Non-FBC prospect enters the funnel

- **WHEN** a prospect without an FBC membership submits a DKRI intake
- **THEN** the intake is accepted without any FBC tier or membership check and a
  `routing_queue` entry is created for staff triage

#### Scenario: Funnel does not depend on membership state

- **WHEN** the standalone DKRI intake is processed
- **THEN** its acceptance does not read `profiles` tier or FBC membership, so a
  prospect who is not an FBC member is never rejected for lacking one
