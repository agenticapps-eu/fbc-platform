## ADDED Requirements

### Requirement: Explicit consent is captured and recorded

The system SHALL capture explicit member consent at signup and at any action that
processes personal data, and SHALL persist a consent record (member, purpose,
policy version, timestamp) as evidence. Processing that depends on consent MUST NOT
proceed unless a matching consent record exists.

#### Scenario: Signup requires recorded consent

- **WHEN** a person completes signup without granting the required consent
- **THEN** the account cannot be provisioned and no consent-dependent processing
  occurs until an explicit consent record is stored

#### Scenario: A consent-dependent action records its purpose

- **WHEN** a member performs an action that processes personal data for a stated
  purpose
- **THEN** a consent record referencing that purpose and policy version is persisted
  before the processing takes effect

### Requirement: Members can export and erase their own data

The system SHALL let a member obtain an export of their own personal data and
request its erasure, so the platform satisfies the DSGVO data-subject rights of
access and to be forgotten. Erasure SHALL remove or anonymise the member's data and
MUST NOT be performable by one member against another.

#### Scenario: Member exports their own data

- **WHEN** an authenticated member requests an export of their data
- **THEN** the system returns the personal data held for that member and no other
  member's data

#### Scenario: Member erases their own data

- **WHEN** an authenticated member requests erasure of their data
- **THEN** the member's personal data is deleted or anonymised, while a member cannot
  trigger erasure of a different member's data

### Requirement: Sensitive data access and changes are audited

The system SHALL record an append-only audit-log entry for access to and changes of
sensitive member data, written server-side so that a member can neither forge an
entry nor delete one that concerns them.

#### Scenario: A sensitive-data change is logged

- **WHEN** sensitive member data is read or modified through a privileged path
- **THEN** an audit-log entry (who, what, when) is written server-side

#### Scenario: A member cannot tamper with the audit log

- **WHEN** a member attempts to update or delete audit-log entries
- **THEN** the operation is denied and the append-only record is preserved

### Requirement: Cold outreach requires a documented legal review

The system SHALL block any cold-outreach or address-based messaging until a
documented legal review for that outreach has been recorded and approved. Absent an
approved review, the outreach path MUST fail closed.

#### Scenario: Outreach without an approved review is blocked

- **WHEN** a cold / address-based message is initiated with no approved legal review
  on record
- **THEN** the system refuses to send it

#### Scenario: Approved review permits the outreach

- **WHEN** the outreach is covered by a recorded, approved legal review
- **THEN** the messaging is permitted to proceed
