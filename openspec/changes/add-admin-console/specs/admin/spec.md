## ADDED Requirements

### Requirement: Admin member list with filters

The system SHALL provide an admin-only member-list view served by a
`SECURITY DEFINER` RPC that returns member rows with filterable fields (such as
tier, status and join date), gated so it returns rows only when `is_admin()`.
The `/admin` route is UI convenience only; the enforcing boundary is the
database.

#### Scenario: Admin lists and filters members

- **WHEN** an admin opens the member list and applies a filter
- **THEN** the RPC returns the matching member rows because `is_admin()` is true

#### Scenario: Non-admin gets no members

- **WHEN** a member without the `admin` staff role calls the member-list RPC
- **THEN** the `is_admin()` gate returns zero rows

### Requirement: Bulk email to a member segment

The system SHALL let an admin send a bulk/mass email to a selected segment of
members, with the send gated on `is_admin()` and delivered only to the members in
the chosen segment. A non-admin MUST NOT be able to trigger a bulk send.

#### Scenario: Admin sends to a segment

- **WHEN** an admin selects a member segment and triggers a bulk email
- **THEN** the email is sent to exactly the members in that segment and to no one
  outside it

#### Scenario: Non-admin cannot bulk send

- **WHEN** a member without the `admin` staff role attempts to trigger a bulk send
- **THEN** the action is denied by the `is_admin()` gate

### Requirement: In-platform CRM surface for admins

The system SHALL provide an admin-only CRM surface (a contact list with filters
and recorded outreach) that replaces the external Odoo workflow, gated on
`is_admin()` in the database. Outreach recorded against a contact SHALL be
readable only to admins.

#### Scenario: Admin reviews contacts and logs outreach

- **WHEN** an admin filters the CRM contact list and records an outreach entry
  against a contact
- **THEN** the filtered contacts are returned and the outreach entry is persisted
  against that contact

#### Scenario: Non-admin cannot read the CRM

- **WHEN** a member without the `admin` staff role queries the CRM contacts or
  outreach
- **THEN** RLS / the `is_admin()` gate returns nothing

### Requirement: Topic newsletters honor per-member opt-in/opt-out

The system SHALL record each member's opt-in/opt-out per newsletter topic, with
the member controlling their own subscription, and SHALL include a member in a
topic newsletter send only when that member is opted in to that topic. An opted-out
member MUST be excluded from that topic's send.

#### Scenario: Member controls their topic subscription

- **WHEN** a member opts out of a newsletter topic
- **THEN** their opt-out is persisted against that topic for their own profile only

#### Scenario: Opted-out member is excluded from the send

- **WHEN** a topic newsletter is sent
- **THEN** only members opted in to that topic receive it, and members opted out
  of it are excluded
