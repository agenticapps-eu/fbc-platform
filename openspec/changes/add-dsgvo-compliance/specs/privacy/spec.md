## ADDED Requirements

### Requirement: Processing has a recorded lawful basis per purpose

The system SHALL associate each processing purpose with a GDPR Art. 6 lawful
basis and SHALL rely on consent only for purposes whose lawful basis is consent.
Purposes grounded in contract or legitimate interest (e.g. providing the
directory, matching contact requests, maintaining the audit log) SHALL NOT be
gated on consent.

#### Scenario: A contract-based purpose does not require consent

- **WHEN** the platform processes personal data for a purpose whose lawful basis
  is contract or legitimate interest
- **THEN** the processing proceeds without a consent record, and its lawful basis
  is recorded for that purpose

#### Scenario: A consent-based purpose requires a consent record

- **WHEN** the platform processes personal data for a purpose whose lawful basis
  is consent
- **THEN** the processing does not proceed unless a matching, un-withdrawn consent
  record exists

### Requirement: Consent is captured, versioned, and withdrawable

The system SHALL persist a consent record (member, purpose, policy version,
affirmative-act evidence, timestamp) for every consent-based purpose, SHALL let a
member withdraw consent as easily as it was given (Art. 7(3)), and SHALL halt the
dependent processing once consent is withdrawn or once the policy version a member
consented to is superseded, until fresh consent is recorded. Recording consent
gates consent-dependent processing only — not account provisioning.

#### Scenario: Consent is recorded before consent-based processing

- **WHEN** a member grants consent for a stated purpose and policy version
- **THEN** a consent record capturing the purpose, policy version, and timestamp is
  persisted before that processing takes effect

#### Scenario: Withdrawal halts the dependent processing

- **WHEN** a member withdraws a previously granted consent
- **THEN** the withdrawal is recorded with its timestamp and the consent-based
  processing for that purpose stops

#### Scenario: A superseded policy version requires re-consent

- **WHEN** the policy version for a purpose is superseded and a member has consented
  only to the older version
- **THEN** the consent-based processing halts until the member records fresh consent
  to the current version

### Requirement: Members can exercise access, portability, and erasure

The system SHALL let an authenticated member obtain an Art. 15 access copy of the
personal data held about them and an Art. 20 portability export of the data they
provided, in a common machine-readable format, covering the enumerated set of
tables that hold their personal data. A member SHALL be able to request erasure of
their data, and SHALL never be able to export or erase another member's data.

#### Scenario: Member exports their own data in a portable format

- **WHEN** an authenticated member requests an export
- **THEN** the system returns, in a common machine-readable format, the personal
  data held for that member across the enumerated tables — and no other member's data

#### Scenario: A member cannot reach another member's data

- **WHEN** a member requests export or erasure targeting a different member
- **THEN** the request is denied

### Requirement: Erasure respects retention duties and the auth identity

Erasure SHALL delete or irreversibly anonymise the member's personal data, EXCEPT
data the platform is legally required to retain — consent/withdrawal evidence,
audit-log entries, and issued invoices (HGB/AO retention) — which SHALL be
preserved (anonymised where the record permits). Erasure SHALL also remove the
member's `auth.users` identity and revoke active sessions.

#### Scenario: Erasure preserves legally-required records

- **WHEN** a member's data is erased
- **THEN** their profile and consent-based personal data are deleted or anonymised,
  while consent/withdrawal evidence, audit entries, and issued invoices are retained
  for their statutory period

#### Scenario: Erasure removes the auth identity

- **WHEN** erasure completes
- **THEN** the member's `auth.users` record is removed and active sessions are revoked

### Requirement: Sensitive-data access and changes are recorded in a tamper-evident audit log

The system SHALL record an append-only audit-log entry (actor, subject, action,
timestamp, result) for access to and changes of the enumerated set of sensitive
member fields. The audit table SHALL grant INSERT only, and no UPDATE or DELETE to
any client role — including the entry's own subject and `authenticated`. Privileged
writers (`service_role`, edge functions) SHALL be the sole inserters, so entries
cannot be forged or suppressed from the member surface; actor data in the log is
retained as legally-required evidence rather than being subject to erasure.

#### Scenario: A sensitive-data change is logged server-side

- **WHEN** a sensitive member field is read or modified through a privileged path
- **THEN** an audit-log entry recording actor, subject, action, and timestamp is
  written server-side

#### Scenario: No client role can alter the audit log

- **WHEN** any client role — including the entry's subject — attempts to UPDATE or
  DELETE an audit-log row
- **THEN** the operation is denied and the append-only record is preserved
