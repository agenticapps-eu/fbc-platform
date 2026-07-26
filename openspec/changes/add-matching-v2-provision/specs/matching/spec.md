## ADDED Requirements

### Requirement: Matching v2 provision features are gated behind a paid matching tier

The system SHALL gate the Matching v2 provision features behind a paid matching
tier expressed as a minimum rank in the six-level model, enforced in the database
via a `SECURITY DEFINER` predicate over `has_level(N)` (fixed `search_path`,
identity derived from `auth.uid()`, `EXECUTE` restricted to the API roles) rather
than on client-supplied identity. A member whose rank is below the threshold MUST
NOT be able to reach the v2 provision surface even if the client is bypassed. This
gate governs access to the v2 feature surface; it does NOT retroactively hide a
brokered deal's provision from a participant who later drops below the threshold
(see the provision-read requirement).

#### Scenario: Paid-tier member reaches v2 provision features

- **WHEN** a member whose matching-tier rank clears the paid threshold accesses a
  v2 provision feature
- **THEN** the gating predicate returns true and the RLS-protected v2 rows are available

#### Scenario: Below-threshold member is denied the v2 surface

- **WHEN** a member below the paid threshold attempts to reach the v2 provision surface
- **THEN** the RLS gate denies access because `has_level(N)` is false

#### Scenario: Forged rank or direct write is denied

- **WHEN** a caller supplies a forged rank/identity or attempts a direct table
  write to bypass the predicate
- **THEN** the database-enforced gate denies it (the predicate reads authoritative
  rank, not client input)

### Requirement: A brokered deal is a first-class record referencing the match

The system SHALL represent a brokered deal as its own record that references the
underlying match and carries the deal's commercial lifecycle (brokered, closed,
unwound), written only by the server on an authoritative staff/server-side
transition — never by a member. There SHALL be at most one open brokered-deal
record per match (`UNIQUE(match_id)` for an open deal).

#### Scenario: A match is brokered into a deal record

- **WHEN** an authoritative broker transition occurs for a match
- **THEN** the server creates a single brokered-deal record referencing that match

#### Scenario: A match cannot be brokered twice concurrently

- **WHEN** a broker transition is processed again for a match that already has an
  open brokered-deal record
- **THEN** no second record is created (the uniqueness invariant holds)

### Requirement: A closed deal records exactly one provision entry

The system SHALL create exactly one provision/commission entry when a brokered
deal reaches the closed state, computed as a rate applied to the deal value, with
the rate and deal value snapshotted onto the entry at close (currency, payer/payee,
and timestamp recorded). Creation SHALL be atomic with the close transition and
unique per brokered deal (`UNIQUE(deal_id)`), written only by the server. Provision
entries SHALL be immutable: a later unwind SHALL write a linked reversal/voiding
entry and SHALL NOT delete or mutate the original.

#### Scenario: A closed deal produces one provision entry

- **WHEN** a brokered deal transitions to closed
- **THEN** the server creates a single provision entry keyed to that deal,
  snapshotting the rate, deal value, and currency

#### Scenario: Re-processing the close does not duplicate provision

- **WHEN** the close transition is processed again for a deal that already has a
  provision entry
- **THEN** no second provision entry is created (unique per deal)

#### Scenario: Unwinding a closed deal voids, never deletes

- **WHEN** a closed deal is later unwound
- **THEN** a linked reversal/voiding provision entry is written and the original
  provision entry is left immutable

### Requirement: Provision reads are limited to deal participants and managers

Reading a provision entry SHALL be limited to the deal's two participants and to
holders of the matching-manager role (resolved from the service-provisioned
`staff_roles`, never from member-writable `profiles.roles`). A participant SHALL be
able to read their own deal's provision regardless of their current matching tier.

#### Scenario: Participant reads their own provision regardless of tier

- **WHEN** a participant of a closed deal reads its provision entry, even if their
  current rank is below the paid threshold
- **THEN** RLS returns the row

#### Scenario: Non-participant cannot read a provision entry

- **WHEN** a member who is neither a participant nor a matching manager selects the
  provision entry
- **THEN** RLS returns no row
