## REMOVED Requirements

### Requirement: Admin member management is not implemented

**Reason:** This change implements bulk mail, CRM, and topic newsletters,
superseding the requirement that forbids them. The member list is **not** part of
it any more — AGE-566 (`add-admin-member-list`) builds it and reshapes this same
requirement with `MODIFIED`, so the requirement still stands when this change is
archived and still forbids exactly the mass-mail this change delivers. That is why
the `REMOVED` block belongs here and why this change SHALL be archived **after**
`add-admin-member-list`.

## ADDED Requirements

### Requirement: Bulk email resolves recipients server-side and honours suppression

The system SHALL let an admin send a bulk email to a member **segment definition**
(not a client-supplied list of ids/addresses); the recipient set SHALL be resolved
server-side from that validated definition, gated on `is_admin()`. Every bulk send
SHALL consult the shared suppression / do-not-email list (see
`add-lifecycle-notifications`) and exclude suppressed or invalid-email members, SHALL
be delivered individualised (no shared BCC leaking recipients), and SHALL be
idempotent per campaign key so a retry does not re-send. Mass-send SHALL require a
step-up confirmation and be rate-limited so a single leaked admin session cannot
blast the platform. Each send SHALL write an audit entry (actor, segment definition,
exclusions, delivery result) to the privacy audit log (see `add-dsgvo-compliance`).

#### Scenario: Admin sends to a server-resolved segment

- **WHEN** an admin selects a segment definition and confirms a bulk send
- **THEN** the recipient set is resolved server-side, suppressed/invalid members are
  excluded, and each remaining member receives an individualised email

#### Scenario: Non-admin cannot bulk send

- **WHEN** a member without the `admin` staff role attempts to trigger a bulk send
- **THEN** the action is denied by the `is_admin()` gate

#### Scenario: A retried campaign does not re-send

- **WHEN** a bulk campaign is re-run with the same campaign key
- **THEN** members already sent for that campaign are not emailed again

#### Scenario: A suppressed member is excluded

- **WHEN** a member in the segment is on the suppression list or has no valid email
- **THEN** they are excluded from the send

### Requirement: In-platform CRM surface for admins

The system SHALL provide an admin-only CRM surface (a contact list with filters and
recorded outreach) gated on `is_admin()` in the database. All CRM reads AND
mutations (INSERT/UPDATE/DELETE of contacts and outreach) SHALL be enforced in the
database, not only on read. Outreach recorded against a contact SHALL be written to
the shared privacy audit log (see `add-dsgvo-compliance`) rather than a separate
parallel outreach log, and SHALL be readable only to admins.

#### Scenario: Admin reviews contacts and logs outreach

- **WHEN** an admin filters the CRM contact list and records an outreach entry
- **THEN** the filtered contacts are returned and the outreach is persisted and
  written to the privacy audit log

#### Scenario: Non-admin cannot read or mutate the CRM

- **WHEN** a member without the `admin` staff role queries or attempts to
  insert/update/delete CRM contacts or outreach
- **THEN** the database gate denies it

### Requirement: Topic newsletters default to opt-out and honour per-member choice

The system SHALL record each member's subscription per newsletter topic as one row
per `(member, topic)`, controllable only by the member (own-row RLS), defaulting to
**opted-out** (no pre-ticked subscription); a member with no record for a topic is
treated as opted-out. A topic newsletter send SHALL be gated on `is_admin()`, SHALL
apply the per-topic opt-in filter **server-side** (not trusted from a UI selection),
SHALL exclude suppressed members, and SHALL include an unsubscribe link. A send with
no eligible recipients SHALL complete as a no-op without error.

#### Scenario: Member controls their own topic subscription

- **WHEN** a member opts in or out of a newsletter topic
- **THEN** the choice is persisted against that topic for their own profile only

#### Scenario: Opted-out members are excluded server-side

- **WHEN** an admin sends a topic newsletter to "all members"
- **THEN** the send resolves recipients server-side and only members opted in to that
  topic (and not suppressed) receive it

#### Scenario: Non-admin cannot send a newsletter

- **WHEN** a member without the `admin` staff role attempts a topic newsletter send
- **THEN** the `is_admin()` gate denies it

#### Scenario: A topic with no subscribers is a no-op

- **WHEN** a topic newsletter is sent but no member is opted in (or all are suppressed)
- **THEN** the send completes as a no-op without error

#### Scenario: Unsubscribe link opts the member out

- **WHEN** a member follows the unsubscribe link in a topic newsletter
- **THEN** their subscription for that topic is set to opted-out
