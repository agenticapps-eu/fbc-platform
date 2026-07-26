# Tasks

## 1. Ecosystem acquisition profiles (staff source)

- [ ] 1.1 `acquisition_profiles` table referencing a generic ecosystem `partner`,
      with criteria (theme, branche, region, acquirer `tx_volume_band`, tags) and an
      `active` flag; staff-only RLS, explicit grants; no member read/write
- [ ] 1.2 Server-controlled, staff-only ingest to create/update/deactivate a profile;
      keep free-text criteria free of member-identifying PII

## 2. Acquisition matches (server-computed)

- [ ] 2.1 `acquisition_matches` table keyed `(member, acquisition_profile)`;
      server-written only; members cannot write it
- [ ] 2.2 Extend the match generator to score member offers against active
      acquisition profiles; do not apply member-side tier/completeness weights to the
      acquisition source; a missing acquisition component scores zero
- [ ] 2.3 Routing: large acquirer volume band → `dkri`; otherwise staff review;
      `matches` stays member-to-member (table unchanged)

## 3. Staff-mediated disclosure

- [ ] 3.1 Surface acquisition matches to matching managers for brokering; RLS lets
      the matched member read only their own rows
- [ ] 3.2 Do not disclose member identity/contact to the acquiring partner until the
      member consents (consent precedes sharing)

## 4. Verification

- [ ] 4.1 Test: a member offer complementary to an active acquisition profile yields
      a scored `acquisition_matches` row; an inactive profile yields none
- [ ] 4.2 Test: no non-member row is written to `matches`
- [ ] 4.3 Test: an ordinary member cannot read/write `acquisition_profiles`, cannot
      write `acquisition_matches`, and reads only their own
- [ ] 4.4 Test: a large-volume acquisition match routes `dkri`
- [ ] 4.5 Test: the acquiring partner cannot read a matched member before consent

## Out of scope (named follow-up)

- **Joint ventures from platform projects (AGE-308)** — its own change under a new
  `ventures` capability: requires defining "platform project", venture lifecycle
  (draft/active/completed), atomic idempotent formation, and participant-table RLS
  that blocks member self-insert (the privilege-escalation guard reviewers flagged).
