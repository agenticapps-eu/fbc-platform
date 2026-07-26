# Add lifecycle notifications and onboarding nudges

## Why

Today the `notifications` table, its owner-only RLS, and server-side inserts exist,
and a single transactional contact-request email is delivered via Resend — but the
notification-bell UI is not wired to read or mark notifications, and there is no
lifecycle/nudge mail system. New members can also stall mid-onboarding with nothing
prompting them to finish. Linear: **AGE-299** (lifecycle mails via Resend + nudge
system + bell wiring) and **AGE-261** (onboarding full build).

## What Changes

- Wire the in-app bell to the member's unread notifications; marking read sets only
  `read_at` via the existing owner-only policy.
- Add a **scheduled lifecycle-mail sender** (distinct from the transactional
  contact-request mail) with a **durable send ledger** keyed `(member, mail_type,
occurrence)` for idempotency and attempted-vs-confirmed retry semantics.
- Treat lifecycle/nudge mails as **non-transactional** (legitimate interest):
  mandatory unsubscribe + suppression list honoured on every send.
- Record onboarding completion via a new **`onboarded_at`** timestamp; send
  completion nudges on a bounded cadence **24h → +3d → +7d, max 3**, stopping on completion.

## Impact

- Affected capability: `notifications`.
- New tables: a send ledger (unique `(member, mail_type, occurrence)`) and a
  suppression list; a new `onboarded_at` column. Explicit grants on new tables.
- New **privileged path**: the scheduled sender reads member emails server-side
  (least-privilege, not member-reachable) — this is a real addition beyond the
  owner-only `notifications_own` RLS, and recipient PII stays out of client logs.
- The existing owner-only visibility, server-side trigger inserts, and the
  transactional contact-request email are unchanged.
