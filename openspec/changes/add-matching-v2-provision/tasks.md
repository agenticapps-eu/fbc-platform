# Tasks

## 1. Paid matching-tier gate

- [ ] 1.1 Define the paid matching tier as a minimum rank in the six-level model
      (`has_level(N)`); pin N together with `membership-tiers`
- [ ] 1.2 `SECURITY DEFINER` predicate over `has_level(N)`: fixed `search_path`,
      identity from `auth.uid()`, `EXECUTE` restricted to the API roles
- [ ] 1.3 Gate the v2 provision surface on the predicate via RLS

## 2. Brokered-deal record

- [ ] 2.1 `brokered_deals` table referencing the match, `UNIQUE(match_id)` for an
      open deal; lifecycle brokered/closed/unwound; explicit grants
- [ ] 2.2 Server-only broker/close/unwind transitions (`SECURITY DEFINER`, no
      API-role `EXECUTE`); never member-writable

## 3. Provision / commission

- [ ] 3.1 `provision` table keyed to the deal, `UNIQUE(deal_id)`; rate × deal-value
      snapshot, currency, payer/payee, timestamp; immutable rows
- [ ] 3.2 Create exactly one provision entry atomically with the close transition
- [ ] 3.3 Unwind writes a linked reversal/voiding entry; never delete/mutate the original
- [ ] 3.4 RLS: read limited to the two participants + matching managers
      (`staff_roles`); a participant read is not gated on current tier

## 4. Verification

- [ ] 4.1 Test: a below-threshold member cannot reach the v2 provision surface;
      a forged rank / direct write is denied
- [ ] 4.2 Test: a closed deal yields exactly one provision entry; re-close does not duplicate
- [ ] 4.3 Test: unwind writes a reversal entry and leaves the original immutable
- [ ] 4.4 Test: a participant reads their own provision even below the paid tier;
      a non-participant reads none

## 5. Spec housekeeping

- [ ] 5.1 On archive, update the `matching` Purpose so it no longer says provisioning
      is "deferred to a later level" (provisioning is now implemented)

## Out of scope (named follow-up)

- **Standalone DKRI matching funnel autark vom FBC (AGE-303)** — its own change:
  needs a prospect/intake table (no `profiles` row), anti-abuse
  (rate-limit / captcha / field allowlist), prospect-PII consent + retention, and a
  routing path that does not reuse `routing_queue`'s `match_id`-keyed schema.
