# Tasks

## 1. Bell wiring

- [ ] 1.1 Wire the bell to the member's unread `notifications` with a live count
      (realtime subscription or poll)
- [ ] 1.2 Mark-read sets only `read_at` (server time) via the owner-only policy;
      confirm grants permit SELECT + a constrained UPDATE
- [ ] 1.3 Handle the empty state and the RLS-rejection path (marking another
      member's row)

## 2. Send ledger & scheduled sender

- [ ] 2.1 Send-ledger table keyed uniquely on `(member, mail_type, occurrence)`,
      distinguishing attempted vs confirmed-sent; explicit grants
- [ ] 2.2 Scheduled Resend sender that sends only when no confirmed ledger row
      exists; retry on failure without a double-send
- [ ] 2.3 Skip members with no email, deleted/suspended, or on the suppression list
- [ ] 2.4 Run server-side only (scheduled context), least-privilege read of emails;
      keep addresses/bodies/message-ids out of client-visible logs

## 3. Unsubscribe / suppression

- [ ] 3.1 Suppression list + unsubscribe link on every non-transactional mail;
      honour it on every send

## 4. Onboarding completion & nudges

- [ ] 4.1 Add `onboarded_at`; set it server-side once when the member first crosses
      the completion bar (`profile_completion` threshold)
- [ ] 4.2 Send onboarding nudges only while `onboarded_at` is null — cadence
      24h → +3d → +7d, max 3, quiet hours; stop on completion
- [ ] 4.3 Handle the race where onboarding completes after job selection but before send

## 5. Verification

- [ ] 5.1 Test: bell reflects unread count; marking read sets `read_at` and
      decrements; cannot mark another member's row
- [ ] 5.2 Test: a due lifecycle mail sends once; a re-run does not re-send (ledger idempotency)
- [ ] 5.3 Test: a failed send is retried without a duplicate confirmed send
- [ ] 5.4 Test: unsubscribed / no-email / deleted member is skipped
- [ ] 5.5 Test: onboarding nudges follow 24h/+3d/+7d, cap at 3, and stop once
      `onboarded_at` is set
