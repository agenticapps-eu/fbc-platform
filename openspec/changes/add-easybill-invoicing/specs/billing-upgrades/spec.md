## REMOVED Requirements

### Requirement: Invoicing and proration are not implemented

**Reason:** This change implements EasyBill invoicing and Stripe-native
proration, superseding the prior out-of-scope declaration.

## ADDED Requirements

### Requirement: Invoice issued for every paid upgrade

The system SHALL create an EasyBill invoice for each successfully completed
upgrade payment and SHALL persist a reference to the issued invoice, keyed to the
Stripe payment identifier (checkout session / payment intent), so it can be
retrieved later. The stored reference SHALL be unique per Stripe payment
identifier, so that a retried or duplicated Stripe event never issues a second
invoice.

The generated invoice SHALL carry the fields required for a §14 UStG-compliant
invoice: a sequential invoice number, the invoice date, the issuer's USt-IdNr,
and the applicable tax rate and tax amount (FBC is USt-pflichtig).

#### Scenario: Successful upgrade produces an invoice

- **WHEN** the Stripe webhook confirms a completed upgrade payment for which no
  invoice reference yet exists
- **THEN** an EasyBill invoice is generated for that member and a reference to it
  is persisted, keyed to the Stripe payment identifier

#### Scenario: Retried Stripe event does not duplicate the invoice

- **WHEN** the Stripe webhook fires again for a payment that already has a stored
  invoice reference
- **THEN** no second EasyBill invoice is created and the existing reference is
  left intact

#### Scenario: Invoice generation failure does not lose the upgrade

- **WHEN** invoice generation fails after the payment succeeded
- **THEN** the tier upgrade is still applied, the webhook still returns HTTP 200
  (so Stripe does not retry the whole webhook), and the missing invoice is
  reconcilable/retryable out of band — the payment is never silently dropped

### Requirement: Member data sent to EasyBill is minimised and processor-governed

The system SHALL transmit to EasyBill only the member fields required to render a
compliant invoice (name, billing address, and — where applicable — USt-IdNr), and
SHALL NOT place EasyBill API credentials or member PII into application logs.
EasyBill is an external processor; the transfer is governed by an Art. 28 GDPR
data processing agreement.

#### Scenario: Only invoice-necessary fields leave the platform

- **WHEN** an invoice is generated
- **THEN** only the fields required for the invoice are sent to EasyBill, and
  neither the payload nor the credentials are written to logs

### Requirement: Mid-cycle upgrades are prorated by Stripe

The system SHALL rely on Stripe subscription proration (`proration_behavior`) to
credit the unused remainder of the lower tier when a member upgrades before the
end of the current billing period; the EasyBill invoice SHALL reflect the amount
Stripe actually charged. FBC SHALL NOT compute proration independently.

#### Scenario: Upgrade halfway through a period

- **WHEN** a member on a lower paid tier upgrades with half the billing period
  elapsed
- **THEN** Stripe applies a proration credit for the unused remainder and the
  amount charged (and shown on the EasyBill invoice) reflects that credit

#### Scenario: Upgrade from a free tier has nothing to credit

- **WHEN** a member on a free tier (no active paid subscription) upgrades
- **THEN** no proration credit applies and the member is charged the full amount

### Requirement: Refunds and credit notes are out of scope

The system SHALL treat refund, dispute, and credit-note (Stornorechnung)
handling as out of scope for this change; a refunded payment does not
automatically produce an EasyBill cancellation. This is a named follow-up.

#### Scenario: Refund produces no automatic credit note

- **WHEN** an upgrade payment is later refunded or disputed
- **THEN** the system takes no automatic EasyBill action (handled manually;
  tracked as a separate change)
