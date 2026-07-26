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

- Gate the Matching v2 feature set behind a paid matching tier expressed as a
  rank threshold, enforced in the database independently of the client.
- Record provision/commission on a successfully brokered match so a completed
  deal produces an auditable provision entry.
- Provide a standalone DKRI matching funnel that a non-FBC prospect can enter
  without an FBC membership, feeding the same staff-managed routing queue.

## Impact

- Affected capability: `matching`.
- New provision/commission records keyed to a match; a paid matching-tier rank
  threshold layered on top of the existing Prime+ tier gate.
- A new intake path for DKRI prospects that does not depend on `profiles` tier
  or FBC membership; it reuses the existing `routing_queue` triage surface.
- No change to the rule that matches are computed server-side only and never
  written by members.
