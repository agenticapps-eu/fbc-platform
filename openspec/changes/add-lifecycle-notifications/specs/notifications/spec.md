## ADDED Requirements

### Requirement: In-app bell reflects and clears unread notifications

The system SHALL wire the notification bell to the member's own `notifications`
rows, surfacing an unread count and letting the member mark notifications read by
setting `read_at`. Reads and updates SHALL go through the existing owner-only
`notifications_own` policy, so the bell shows and mutates only the member's own rows.

#### Scenario: Bell shows the member's unread count

- **WHEN** a member with unread `notifications` rows opens the app
- **THEN** the bell surfaces the count of their own rows where `read_at` is null

#### Scenario: Opening the bell marks notifications read

- **WHEN** the member views a notification through the bell
- **THEN** its `read_at` is set via the owner-only policy and the unread count
  decreases accordingly

### Requirement: Lifecycle mails are sent via Resend beyond the transactional email

The system SHALL provide a scheduled lifecycle/nudge mail sender that delivers
lifecycle emails via Resend in addition to the existing transactional
contact-request email. Each lifecycle mail SHALL be sent at most once per member per
occurrence, so a member is not re-sent the same lifecycle mail on repeated runs.

#### Scenario: A due lifecycle mail is sent once

- **WHEN** a member becomes eligible for a lifecycle mail and the scheduled sender runs
- **THEN** exactly one Resend email is sent for that occurrence, and a re-run does not
  send it again

#### Scenario: Ineligible member is skipped

- **WHEN** a member is not eligible for a lifecycle mail (already sent, or condition
  not met)
- **THEN** the sender skips them without sending

### Requirement: Onboarding-completion nudges

The system SHALL send an onboarding-completion nudge to members who have not
completed onboarding, and SHALL stop sending it once the member has completed
onboarding.

#### Scenario: Incomplete onboarding triggers a nudge

- **WHEN** a member has not completed onboarding and is due a nudge
- **THEN** an onboarding-completion nudge is sent to that member

#### Scenario: Completed onboarding stops nudges

- **WHEN** a member has completed onboarding
- **THEN** no further onboarding-completion nudge is sent to them
