# Add EasyBill invoicing and proration

## Why

Members can upgrade their tier via Stripe today (`billing-upgrades`), but the
platform does not issue legally-correct invoices, and a mid-cycle upgrade is not
prorated. Phase 2 requires correct invoices incl. proration (ROADMAP success
criterion 2.2). Linear: **AGE-298**.

## What Changes

- Generate an EasyBill invoice for every completed upgrade payment.
- Prorate the charge when a member upgrades mid-cycle.

## Impact

- Affected capability: `billing-upgrades`.
- New outbound integration (EasyBill API); a document/PDF reference stored per payment.
- No change to the tier-authority model (the Stripe webhook remains the sole writer of `profiles.tier`).
