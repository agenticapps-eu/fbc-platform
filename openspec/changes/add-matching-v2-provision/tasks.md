# Tasks

## 1. Paid matching-tier gate

- [ ] 1.1 Define the paid matching tier as a rank threshold above the Prime+ gate
- [ ] 1.2 Add a `SECURITY DEFINER` predicate that resolves the caller's matching-tier rank
- [ ] 1.3 Gate the Matching v2 features (provision + standalone funnel access) on the predicate via RLS

## 2. Provision / commission logic

- [ ] 2.1 Add a provision table keyed to a match, written only by the server on a brokered deal
- [ ] 2.2 On a match reaching the brokered/closed state, create exactly one provision entry (idempotent per match)
- [ ] 2.3 Restrict reading provision entries to the deal participants and matching managers via RLS

## 3. Standalone DKRI funnel

- [ ] 3.1 Add a DKRI intake path that accepts a non-FBC prospect without a `profiles` tier
- [ ] 3.2 Route standalone DKRI intakes into the existing `routing_queue` for staff triage
- [ ] 3.3 Ensure the funnel neither reads nor requires FBC membership state

## 4. Verification

- [ ] 4.1 Test: a member below the paid matching rank cannot reach v2 provision features
- [ ] 4.2 Test: a brokered match yields exactly one provision entry, re-brokering does not duplicate it
- [ ] 4.3 Test: a DKRI prospect without an FBC membership enters the queue
