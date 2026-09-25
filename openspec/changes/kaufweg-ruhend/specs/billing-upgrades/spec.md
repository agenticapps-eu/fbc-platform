## MODIFIED Requirements

### Requirement: The membership page drives self-service upgrades

The membership page SHALL, **when it is rendered**, present the six tiers with a
year/month interval toggle, mark the member's current tier, and offer an upgrade
action only on paid tiers ranked above the member's current rank; invoking it
calls `create-checkout-session` and redirects to the returned Stripe URL.

**No surface SHALL render it.** The route `/mitgliedschaft` SHALL NOT be
reachable: it carries no navigation entry, no surface links or navigates to it,
and the path SHALL redirect to `/`. The page, its pricing cards and the
`create-checkout-session` and `stripe-webhook` functions SHALL remain in the
codebase unchanged, so that restoring the purchase path is the removal of the
redirect plus one navigation entry.

The reason is Apple guideline 3.1.1: a reachable route to an external checkout is
the standard cause of rejection for digital content used in the app. It is also
what V5 wants — paid tiers are granted manually by an administrator, so the
purchase path is currently without function.

#### Scenario: Only higher paid tiers are upgradeable in the UI

- **WHEN** the membership page component renders for a member at a given rank
- **THEN** the upgrade action is enabled only for paid tiers whose rank exceeds
  the member's current rank, and the current tier is shown as such

#### Scenario: Checkout failure surfaces an error

- **WHEN** `create-checkout-session` returns an error or no `url`
- **THEN** the page shows an error toast and does not navigate away

#### Scenario: The route redirects instead of rendering

- **WHEN** a member opens `/mitgliedschaft` by bookmark, by typed address or by
  any other means
- **THEN** the application redirects to `/` and the pricing table is never
  rendered
- **AND** the route appears in no navigation section, collapsed or expanded

#### Scenario: No surface offers a way to the purchase path

- **WHEN** any authenticated surface renders at any membership tier — profile,
  dashboard, settings, account menu, header search, event detail, or a tier wall
- **THEN** it presents no link and no navigation to `/mitgliedschaft`
- **AND** a member whose tier is too low for a gated area is told that higher
  tiers are granted by the club, rather than being offered a purchase

## ADDED Requirements

### Requirement: A member below a gated tier is told who grants the tier

When an authenticated member reaches an area their tier does not cover, the tier
wall SHALL name the required tier and SHALL state that higher tiers are granted
by the Fair Business Club. It SHALL NOT offer a purchase action while the
purchase path is dormant.

This replaces an "Upgrade" button that led to the checkout page. Naming the
required tier without naming a way to obtain it would leave the member with a
dead end and produce the support request the sentence answers.

#### Scenario: A logged-in member with an insufficient tier sees no purchase action

- **WHEN** a member whose rank is below the area's minimum tier reaches the wall
- **THEN** the wall names the required tier, states that the club grants higher
  tiers, and offers only a way back to the start page

#### Scenario: An anonymous visitor is still sent to registration

- **WHEN** a visitor without an account reaches the wall
- **THEN** the wall offers registration, unchanged, because that path involves no
  payment
