# Contact Requests

## Purpose

Defines the consent-based contact flow between two members: a sender asks to
connect, the recipient accepts or declines, and only an accepted request
releases the recipient's private contact data (email/phone). The rule "no
contact data before acceptance" is enforced in the database by RLS, never by
the frontend. Reconstructed from the code as of the OpenSpec migration.

## Requirements

### Requirement: One directed request per ordered pair

The system SHALL store contact requests in `public.contact_requests` with
`from_id`, `to_id`, an optional `match_id`, an optional `message`, and a
`status` constrained to `pending`, `accepted`, or `declined` (default
`pending`), and SHALL enforce a unique constraint on `(from_id, to_id)` so a
sender holds at most one request toward a given recipient.

#### Scenario: Duplicate request is rejected

- **WHEN** a sender inserts a second `contact_requests` row with the same
  `(from_id, to_id)` pair
- **THEN** the write is rejected by the `contact_requests_unique_pair` unique
  constraint (SQLSTATE 23505) and the UI reports "Anfrage besteht bereits"

#### Scenario: Match reference is optional

- **WHEN** a request is created from a public profile page with no originating
  match
- **THEN** the row is stored with `match_id = NULL` and remains valid

### Requirement: Sender may only insert a pending request for themselves

The system SHALL permit an authenticated member to INSERT a contact request
only when `from_id` equals the caller, `status = 'pending'`, the recipient is
contactable (`is_contactable(to_id)`), and — when `match_id` is supplied — that
match belongs to the `(from_id, to_id)` pair.

#### Scenario: Forged sender is denied

- **WHEN** a member inserts a request whose `from_id` is not their own auth uid
- **THEN** the `cr_insert_self` RLS policy denies the INSERT (SQLSTATE 42501)

#### Scenario: Pre-accepted insert is denied

- **WHEN** a member inserts a request with `status` other than `pending`
- **THEN** the INSERT is denied, so no member can self-issue an already
  `accepted` request to harvest contact data

#### Scenario: Mismatched match_id is denied

- **WHEN** a request carries a `match_id` whose match does not join `from_id`
  and `to_id`
- **THEN** the INSERT is denied by the policy's pair-ownership check

### Requirement: Recipient may only flip a pending request to accepted or declined

The system SHALL grant authenticated members UPDATE privilege on the `status`
column only, and SHALL permit the recipient to change a request that is
currently `pending` and addressed to them (`to_id = auth.uid()`) to either
`accepted` or `declined`; all other columns (`from_id`, `to_id`, `match_id`,
`message`) SHALL be non-writable by members.

#### Scenario: Recipient accepts a pending request

- **WHEN** the recipient of a `pending` request sets `status = 'accepted'`
- **THEN** the `cr_update_recipient` policy permits the UPDATE

#### Scenario: Rewriting from_id or match_id is denied

- **WHEN** a member attempts to UPDATE `from_id`, `to_id`, `match_id`, or
  `message` on a request
- **THEN** the write is denied at the column-privilege layer (members hold
  `UPDATE (status)` only)

#### Scenario: Re-flipping a non-pending request is denied

- **WHEN** a member attempts to change the status of a request that is not
  `pending` (e.g. re-accept an already accepted or declined row)
- **THEN** the UPDATE is denied by the policy's `status = 'pending'` USING clause

### Requirement: Contact data is released only on acceptance

The system SHALL expose a recipient's private `profile_contacts` (email/phone)
to a counterparty ONLY while a `contact_requests` row between the two profiles
has `status = 'accepted'`; contact data SHALL never become visible implicitly,
by any lesser status, or through the sending of a request alone.

#### Scenario: Accepted request releases contact data

- **WHEN** a member reads `profile_contacts` for a profile they have an
  `accepted` request with (in either direction)
- **THEN** the `contacts_select_self_or_released` policy returns the email/phone

#### Scenario: Pending or declined request reveals nothing

- **WHEN** a member reads `profile_contacts` for a profile whose request is
  `pending` or `declined`
- **THEN** no contact row is returned and the profile page shows only the
  request flow, not the contact details

### Requirement: Acceptance drives lifecycle side-effects server-side

The system SHALL run a `SECURITY DEFINER` trigger
(`handle_contact_request_change`) on `contact_requests` that, on INSERT,
transitions the originating suggested match to `requested` and notifies the
recipient; on transition to `accepted`, sets the match to `accepted`, opens the
normalized (least/greatest) message thread idempotently, and notifies the
sender; and on transition to `declined`, sets the match to `declined` without
undoing an existing acceptance and notifies the sender. These cross-member
writes SHALL NOT be performable by members directly.

#### Scenario: Acceptance opens the chat thread

- **WHEN** a request transitions to `accepted`
- **THEN** the trigger inserts a `message_threads` row for the pair
  (`ON CONFLICT DO NOTHING`), enabling the chat

#### Scenario: Recipient is notified on a new request

- **WHEN** a request is inserted
- **THEN** the trigger writes a `contact_request` notification for `to_id`, a
  row the members could not write themselves under `notifications_own`

### Requirement: Cold-request gates open under the admin toggle

The system SHALL, while the singleton `platform_settings.open_contact` flag is
false, require the sender to hold at least the `exchange` level
(`has_level(4)`) and SHALL block a cold request (no `match_id`) to a member
registered within the last 30 days (`is_new_member`, "Welpenschutz"); when an
admin sets `open_contact` to true (default true), both the level gate and the
Welpenschutz SHALL be lifted, while the self-`from_id`, `pending`-status,
`match_id` pair-ownership, and recipient opt-out (`is_contactable`) checks SHALL
remain enforced in every mode. Only `is_admin()` members SHALL be able to write
the flag.

#### Scenario: Basic member can request during an open event

- **WHEN** `open_contact` is true and a `basic` member sends a cold request to a
  contactable recipient
- **THEN** the `cr_insert_self` policy permits the INSERT despite the level gate
  and Welpenschutz being lifted

#### Scenario: Level gate applies when the toggle is off

- **WHEN** `open_contact` is false and a member below `exchange` attempts to send
  a request
- **THEN** the INSERT is denied (SQLSTATE 42501) and the UI reports the request
  is not possible rather than showing the raw Postgres error

#### Scenario: Cold request to a new member is blocked when closed

- **WHEN** `open_contact` is false and a member sends a request with no
  `match_id` to a recipient registered less than 30 days ago
- **THEN** the INSERT is denied by the Welpenschutz clause

#### Scenario: Only admins may change the flag

- **WHEN** a non-admin member attempts to UPDATE `platform_settings.open_contact`
- **THEN** the `platform_settings_update_admin` policy denies the write
