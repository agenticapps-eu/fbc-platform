# Notifications

## Purpose

Provides per-member in-app notifications through a `notifications` table
(`profile_id`, `type`, `payload` jsonb, nullable `read_at`) whose visibility and
mutation are owner-only via RLS. Notification rows are created server-side by a
`SECURITY DEFINER` trigger on the contact-request lifecycle, because the owner-only
policy prevents one member from writing another member's notifications directly. As
of the OpenSpec migration this capability is partial (AGE-299): the table, RLS, and
server-side inserts exist, and a single transactional lifecycle email is delivered
via Resend, but the notification-bell UI is not yet wired to read or mark
notifications and no nudge system exists. Reconstructed from code.

## Requirements

### Requirement: Owner-only notification visibility

The system SHALL enforce via the `notifications_own` RLS policy that an authenticated
member can read only `notifications` rows whose `profile_id` equals their own auth id.
Each row SHALL carry a `profile_id` (NOT NULL, FK to `profiles`, `on delete cascade`),
a `type`, a jsonb `payload`, a nullable `read_at`, and a `created_at`.

#### Scenario: Member reads only their own notifications

- **WHEN** an authenticated member queries `notifications`
- **THEN** only rows where `profile_id = auth.uid()` are returned

#### Scenario: Another member's notifications are not visible

- **WHEN** a member queries for a `notifications` row belonging to a different profile
- **THEN** RLS excludes it from the result

### Requirement: Owner marks their own notifications read

The system SHALL allow an authenticated member to update only their own
`notifications` rows (via the `notifications_own` policy, `for all` with an owner
`with check`), so that marking a notification read by setting `read_at` is permitted
only for the owner.

#### Scenario: Owner sets read_at

- **WHEN** the owning member updates one of their notification rows to set `read_at`
- **THEN** the update is accepted

#### Scenario: Non-owner cannot mark another member's notification read

- **WHEN** a member attempts to update a `notifications` row whose `profile_id` is
  not their own auth id
- **THEN** the RLS policy rejects the update

### Requirement: Server-side notification creation for the counterparty

The system SHALL create notifications for the counterparty of a contact-request event
through a `SECURITY DEFINER` trigger (`handle_contact_request_change`) that bypasses
RLS, because `notifications_own` lets a member insert rows only for themselves. The
inserted row SHALL carry a `type` and a jsonb `payload` describing the event.

#### Scenario: New contact request notifies the recipient

- **WHEN** a contact request is inserted
- **THEN** the trigger inserts a `notifications` row for the recipient (`to_id`) with
  `type = 'contact_request'` and a `payload` carrying the request context

#### Scenario: Client cannot write the counterparty's notification directly

- **WHEN** a member attempts to insert a notification for the other party from the
  client
- **THEN** the `notifications_own` `with check` clause rejects it, and only the
  server-side trigger can create it

### Requirement: Transactional lifecycle email

The system SHALL send a branded transactional email via Resend for contact-request
lifecycle events, delivered by the `notify-contact-request` edge function triggered by
a database webhook. Email delivery SHALL be independent of the in-app notification rows,
which are written separately by the lifecycle trigger.

#### Scenario: New request sends an email to the recipient

- **WHEN** the `notify-contact-request` function processes a contact-request insert
  for a recipient with an email on file
- **THEN** it sends one Resend email to that recipient and does not itself write any
  in-app notification row

#### Scenario: Recipient without an email is skipped

- **WHEN** the recipient has no email address on file
- **THEN** the function acknowledges the webhook without sending an email
