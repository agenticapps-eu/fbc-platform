## ADDED Requirements

### Requirement: Scheduled lifecycle mails are sent idempotently via Resend

The system SHALL provide a scheduled lifecycle-mail sender that delivers lifecycle
emails via Resend, distinct from the existing transactional contact-request email.
Each lifecycle mail SHALL be recorded in a durable send ledger keyed uniquely by
`(member, mail_type, occurrence)`; the sender SHALL send a lifecycle mail only when
no confirmed ledger row exists for that key, so retries and re-runs never re-send.

#### Scenario: A due lifecycle mail is sent once

- **WHEN** a member is eligible and the scheduled sender runs
- **THEN** exactly one Resend email is sent and a confirmed ledger row for
  `(member, mail_type, occurrence)` is written; a re-run finds the row and does not re-send

#### Scenario: Ineligible or unreachable member is skipped

- **WHEN** a member has already been sent that occurrence, has no email address, is
  deleted/suspended, or is on the suppression list
- **THEN** the sender skips them without sending

#### Scenario: A failed send is retryable, not double-sent

- **WHEN** a Resend send fails or its outcome is ambiguous
- **THEN** the ledger distinguishes attempted from confirmed-sent, so the mail is
  retried without producing a duplicate confirmed send

### Requirement: Non-transactional mails honour unsubscribe and suppression

The system SHALL treat lifecycle and onboarding-nudge mails as non-transactional,
sent on a legitimate-interest basis with a mandatory unsubscribe link, and SHALL
honour a suppression list on every send so an unsubscribed member receives no
further non-transactional mail.

#### Scenario: Unsubscribed member receives no further nudges

- **WHEN** a member has unsubscribed (is on the suppression list)
- **THEN** no further lifecycle or onboarding-nudge mail is sent to them

### Requirement: Onboarding-completion nudges follow a bounded cadence

The system SHALL record onboarding completion with an `onboarded_at` timestamp, set
once when the member first crosses the completion bar, and SHALL send
onboarding-completion nudges only while `onboarded_at` is null, on a bounded
cadence: first at 24 hours after signup, then at +3 days, then at +7 days — at most
three nudges — stopping immediately once `onboarded_at` is set.

#### Scenario: Incomplete onboarding triggers the next due nudge

- **WHEN** a member's `onboarded_at` is null, the next cadence point (24h, +3d, or
  +7d) is reached, and fewer than three nudges have been sent
- **THEN** one onboarding-completion nudge is sent and recorded in the ledger

#### Scenario: Completion stops nudges immediately

- **WHEN** a member's `onboarded_at` is set
- **THEN** no further onboarding-completion nudge is sent, even if a later cadence
  point is reached

#### Scenario: The nudge cap is enforced

- **WHEN** three onboarding-completion nudges have already been sent to a member
- **THEN** no further onboarding nudge is sent regardless of completion state

### Requirement: The scheduled sender runs server-side with least privilege

The scheduled lifecycle/nudge sender SHALL run only from a server-side, non-member
context (scheduled invocation), reading member email addresses through a
least-privilege path, and SHALL NOT be reachable from member clients. Recipient
email addresses, mail bodies, and Resend message IDs SHALL NOT be written to
client-visible logs.

#### Scenario: The sender is not reachable from the member surface

- **WHEN** a member client attempts to invoke the scheduled sender
- **THEN** the invocation is refused; only the server-side scheduled context may run it
