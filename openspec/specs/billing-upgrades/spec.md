# Billing & Upgrades

## Purpose

Defines the Stripe test-mode self-service flow by which a member raises their
membership tier. A client-initiated Checkout session collects payment, and a
signature-verified Stripe webhook is the single authority that writes the new
tier via the `apply_upgrade` RPC. Reconstructed from code as of the OpenSpec
migration. Recurring invoicing (EasyBill), proration, downgrades, and
renewal/cancellation handling are explicitly out of scope and NOT built yet.

## Requirements

### Requirement: Client starts a Stripe subscription checkout

The system SHALL expose an authenticated `create-checkout-session` edge function
that, given a target paid `level` and a billing `interval`, creates a Stripe
Checkout session in subscription mode and returns its redirect `url`. The
function SHALL require a verified user JWT (`verify_jwt=true`) and derive the
user id from the gateway-verified token's `sub` claim.

#### Scenario: Authenticated upgrade request returns a checkout URL

- **WHEN** an authenticated member POSTs `{ level, interval }` for a level above
  their current rank and the server is configured with the Stripe key and price id
- **THEN** the function creates a `mode=subscription` Stripe Checkout session
  carrying `metadata.user_id` and `metadata.level`, and returns `{ url }`

#### Scenario: Unauthenticated request is rejected

- **WHEN** a request arrives without an `authorization` header or with a token
  whose `sub` cannot be read
- **THEN** the function responds `401 unauthorized` and no session is created

### Requirement: Only genuine upgrades are accepted

The system SHALL accept a checkout request only for a paid level
(`discover`, `exchange`, `focus`, `impact`) with interval `month` or `year`
whose `LEVEL_RANK` is strictly greater than the caller's current tier rank, and
SHALL reject any other request with a validation error.

#### Scenario: A same-or-lower level is refused

- **WHEN** the requested level's rank is less than or equal to the caller's
  current rank
- **THEN** the function responds `400 not_an_upgrade` and no session is created

#### Scenario: An unknown level or interval is refused

- **WHEN** `level` is not a known paid level, or `interval` is neither `month`
  nor `year`
- **THEN** the function responds `400 invalid_level` or `400 invalid_interval`

### Requirement: Webhook is the sole authority for tier changes

The system SHALL raise `profiles.tier` only through the `stripe-webhook` edge
function, which on a `checkout.session.completed` event calls the
`apply_upgrade` RPC with the service role. Clients SHALL NOT be able to write
`profiles.tier`; `apply_upgrade` is `SECURITY DEFINER` and executable only by
`service_role` (revoked from `public`, `anon`, `authenticated`).

#### Scenario: Completed payment promotes the member

- **WHEN** `stripe-webhook` receives a valid `checkout.session.completed` event
  carrying `metadata.user_id` and `metadata.level`
- **THEN** it calls `apply_upgrade(p_user_id, p_level)` under the service role,
  which sets `profiles.tier` to the paid level

#### Scenario: A direct client tier write is denied

- **WHEN** a client (anon or authenticated) attempts to execute `apply_upgrade`
  or otherwise set `profiles.tier` directly
- **THEN** the attempt is denied by the function grants and RLS, leaving the tier
  unchanged

### Requirement: Webhook authenticity is enforced by Stripe signature

The system SHALL verify every `stripe-webhook` request against the
`STRIPE_WEBHOOK_SECRET` using the Stripe HMAC-SHA256 signature scheme over
`${t}.${rawBody}` with a timestamp tolerance, and SHALL reject requests whose
signature is missing, malformed, stale, or mismatched. The webhook runs with
`verify_jwt=false` because Stripe carries no user JWT.

#### Scenario: Invalid signature is rejected

- **WHEN** a request to `stripe-webhook` has no `stripe-signature`, an expired
  timestamp, or a signature that does not match the computed HMAC
- **THEN** the function responds `400 Bad signature` and no upgrade is applied

#### Scenario: Non-checkout events are ignored

- **WHEN** a validly signed event has a type other than
  `checkout.session.completed`, or lacks `metadata.user_id`/`metadata.level`
- **THEN** the function responds `200 { skipped: true }` and applies no change

### Requirement: Upgrades never downgrade and are idempotent

The system SHALL, within `apply_upgrade`, raise the tier only when the target
level's `level_rank` is strictly greater than the member's current rank, and
SHALL otherwise leave the tier unchanged and return the effective tier. Concurrent
upgrades of the same user SHALL be serialized (`for update`) so that a delayed or
retried lower event cannot cause a silent downgrade.

#### Scenario: Retried or lower event is a no-op

- **WHEN** `apply_upgrade` is called with a level whose rank is equal to or lower
  than the member's current tier (e.g. a Stripe retry or a late duplicate event)
- **THEN** the tier is left unchanged and the current effective tier is returned

#### Scenario: Unknown level is rejected

- **WHEN** `apply_upgrade` is called with a `p_level` not present in
  `membership_tiers`
- **THEN** it raises an error and makes no change

### Requirement: Invoicing and proration are not implemented

The system SHALL treat recurring invoice generation (EasyBill), proration,
downgrade handling, and renewal/cancellation lifecycle as out of scope for the
current flow; the upgrade path performs a one-time tier promotion in Stripe test
mode only.

#### Scenario: No invoice or proration side effect occurs

- **WHEN** a member completes a checkout and is promoted
- **THEN** the system records only the tier change and produces no EasyBill
  invoice and applies no proration or downgrade logic

### Requirement: The membership page drives self-service upgrades

The system SHALL present the six tiers on the membership page with a
year/month interval toggle, mark the member's current tier, and offer an upgrade
action only on paid tiers ranked above the member's current rank; invoking it
calls `create-checkout-session` and redirects to the returned Stripe URL.

#### Scenario: Only higher paid tiers are upgradeable in the UI

- **WHEN** the membership page renders for a member at a given rank
- **THEN** the upgrade action is enabled only for paid tiers whose rank exceeds
  the member's current rank, and the current tier is shown as such

#### Scenario: Checkout failure surfaces an error

- **WHEN** `create-checkout-session` returns an error or no `url`
- **THEN** the page shows an error toast and does not navigate away
