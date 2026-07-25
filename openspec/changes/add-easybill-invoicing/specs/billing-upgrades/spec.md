## ADDED Requirements

### Requirement: Invoice issued for every paid upgrade

The system SHALL create an EasyBill invoice for each successfully completed
upgrade payment, and SHALL store a reference to the issued invoice against the
payment so it can be retrieved later.

#### Scenario: Successful upgrade produces an invoice

- **WHEN** the Stripe webhook confirms a completed upgrade payment
- **THEN** an EasyBill invoice is generated for that member and a reference to it
  is persisted with the payment record

#### Scenario: Invoice generation failure does not lose the upgrade

- **WHEN** invoice generation fails after the payment succeeded
- **THEN** the tier upgrade is still applied and the failed invoice is retryable
  (the payment is never silently dropped)

### Requirement: Mid-cycle upgrades are prorated

The system SHALL prorate the amount charged when a member upgrades before the end
of the current billing period, crediting the unused remainder of the lower tier.

#### Scenario: Upgrade halfway through a period

- **WHEN** a member on a lower tier upgrades with half the billing period elapsed
- **THEN** the amount charged reflects a proration credit for the unused remainder
  of the lower tier
