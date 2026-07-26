# Add Matching v2: paid matching tier gate and provision logic

## Why

The matching engine computes matches and routes large-volume opportunities to a
staff queue today (`matching`), but the monetisation layer is missing: there is
no paid matching tier that unlocks the v2 features, no provision/commission
recorded on a brokered deal, and the DKRI matching funnel is not usable
independently of FBC membership. Phase 2 requires the paid gate and provision
logic, plus a standalone DKRI funnel. Linear: **AGE-302** (paid matching-tier
gate + provision logic) and **AGE-303** (standalone DKRI matching funnel autark
vom FBC).

## What Changes

- Gate the Matching v2 **provision** surface behind a paid matching tier expressed
  as a minimum rank (`has_level(N)` in the six-level model), enforced in the
  database via a hardened `SECURITY DEFINER` predicate.
- Represent a **brokered deal** as a first-class record referencing the match
  (lifecycle brokered/closed/unwound, `UNIQUE(match_id)` for an open deal),
  server-written only.
- Record **provision/commission** as a rate × deal-value snapshot on a closed deal
  (`UNIQUE(deal_id)`), immutable; an unwind writes a linked reversal entry rather
  than deleting.
- Limit provision reads to the two participants + matching managers; a participant
  can read their own deal's provision regardless of current tier.

The standalone DKRI funnel (**AGE-303**) is split out to its own change (see Out of
scope) — it is what created the paid-gate ↔ tier-independence contradiction.

## Impact

- Affected capability: `matching`.
- New tables: `brokered_deals` (references the match) and `provision` (keyed to the
  deal). Explicit grants; server-only writers with no API-role `EXECUTE`.
- The paid gate uses `has_level(N)` — **not** the removed `is_prime_plus()` gate.
- No change to the rule that matches are computed server-side only and never
  written by members.

## Out of scope (named follow-up)

- **Standalone DKRI matching funnel autark vom FBC (AGE-303)** — its own change:
  public prospect intake with no `profiles` row, anti-abuse, prospect-PII consent,
  and a routing path that does not reuse `routing_queue`'s `match_id`-keyed schema.
