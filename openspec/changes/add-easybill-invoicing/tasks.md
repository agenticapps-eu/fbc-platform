# Tasks

## 1. Data model

- [ ] 1.1 Migration: table storing the EasyBill invoice reference per upgrade
      payment, keyed by the Stripe payment identifier with a UNIQUE constraint
      (this doubles as the idempotency key). Grants spoken explicitly — new
      tables inherit no privileges.

## 2. EasyBill integration

- [ ] 2.1 Add EasyBill API client + credentials (env only, no secrets in repo)
- [ ] 2.2 On a confirmed upgrade payment with no existing reference, generate a
      §14 UStG-compliant invoice (sequential number, date, issuer USt-IdNr, tax
      rate + amount) and persist its reference keyed to the Stripe payment id
- [ ] 2.3 Return HTTP 200 from the webhook even when invoice generation fails;
      make the missing invoice reconcilable/retryable out of band without
      re-applying the upgrade
- [ ] 2.4 Send only invoice-necessary member fields to EasyBill; keep member PII
      and credentials out of logs (Art. 28 processor boundary)

## 3. Proration

- [ ] 3.1 Configure Stripe subscription proration (`proration_behavior`) on the
      upgrade checkout; do not compute proration in FBC
- [ ] 3.2 Ensure the EasyBill invoice mirrors the amount Stripe actually charged

## 4. Verification

- [ ] 4.1 Test: successful upgrade yields exactly one stored invoice reference
- [ ] 4.2 Test: a retried Stripe event does not create a second invoice (idempotency)
- [ ] 4.3 Test: mid-cycle upgrade charge reflects Stripe proration
- [ ] 4.4 Test: upgrade from a free tier charges the full amount (no credit)
