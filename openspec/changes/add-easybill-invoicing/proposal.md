# Add EasyBill invoicing and proration

## Why

Members can upgrade their tier via Stripe today (`billing-upgrades`), but the
platform does not issue legally-correct invoices, and a mid-cycle upgrade is not
prorated. Phase 2 requires correct invoices incl. proration (ROADMAP success
criterion 2.2). Linear: **AGE-298**.

## What Changes

- Generate a §14 UStG-compliant EasyBill invoice (FBC is USt-pflichtig) for every
  completed upgrade payment, idempotent per Stripe payment id.
- Prorate mid-cycle upgrades via **Stripe-native** subscription proration
  (`proration_behavior`); FBC does not compute proration itself.
- Retire the existing `billing-upgrades` requirement that declared invoicing/proration
  out of scope (removed in the spec delta).
- Refunds / disputes / credit notes (Stornorechnung) are **explicitly out of scope** —
  named follow-up.

## Impact

- Affected capability: `billing-upgrades`.
- New outbound integration (EasyBill API), an external processor under an Art. 28
  GDPR DPA; only invoice-necessary member fields are transmitted.
- New data-model delta: a table storing the invoice reference per upgrade payment,
  keyed uniquely by the Stripe payment id (the idempotency key).
- No change to the tier-authority model (the Stripe webhook remains the sole writer
  of `profiles.tier`); the webhook returns HTTP 200 even when invoicing fails.
