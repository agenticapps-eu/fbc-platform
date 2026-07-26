# Add lifecycle notifications and onboarding nudges

## Why

Today the `notifications` table, its owner-only RLS, and server-side inserts exist,
and a single transactional contact-request email is delivered via Resend — but the
notification-bell UI is not wired to read or mark notifications, and there is no
lifecycle/nudge mail system. New members can also stall mid-onboarding with nothing
prompting them to finish. Linear: **AGE-299** (lifecycle mails via Resend + nudge
system + bell wiring) and **AGE-261** (onboarding full build).

## What Changes

- Wire the in-app bell to the member's unread notifications, including marking them
  read.
- Add a lifecycle/nudge mail system that sends scheduled lifecycle emails via Resend
  beyond the single existing transactional mail.
- Send onboarding-completion nudges to members who have not finished onboarding.

## Impact

- Affected capability: `notifications`.
- Bell UI reads/marks the existing owner-only `notifications` rows (no RLS change);
  a new scheduled sender for lifecycle/nudge mails via Resend; onboarding state drives
  nudge eligibility.
- The existing owner-only visibility, server-side trigger inserts, and the
  transactional contact-request email are unchanged.
