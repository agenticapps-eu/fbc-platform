# Add lifecycle notifications and onboarding nudges

## Why

Today the `notifications` table, its owner-only RLS, and server-side inserts exist,
and a single transactional contact-request email is delivered via Resend — but there
is no lifecycle/nudge mail system. New members can also stall mid-onboarding with
nothing prompting them to finish. Linear: **AGE-299** (lifecycle mails via Resend +
nudge system) and **AGE-261** (onboarding full build).

**Die Verdrahtung der Glocke ist am 27.08.2026 herausgelöst worden** — sie steht
jetzt in `glocke-und-hinweistypen` (AGE-620) und wird dort zusammen mit fünf neuen
In-App-Hinweistypen gebaut. Grund: die Glocke braucht keine der Zutaten dieses
Changes (kein Resend, kein Sendejournal, keine Sperrliste, kein
`onboarded_at`) — sie liest die Tabelle, die es längst gibt. Sie hier zu lassen
hätte eine Ein-Tages-Aufgabe an ein Vorhaben gekettet, das im
Nach-Go-Live-Backlog liegt. Dieser Change behält den **Mail-Teil** und bleibt
dort.

## What Changes

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
