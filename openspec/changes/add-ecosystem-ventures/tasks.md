# Tasks

## 1. Capital-Parks acquisition profile as a matching source

- [ ] 1.1 Add an `acquisition_profiles` table capturing Capital-Parks acquisition criteria (theme, branche, region, volume band, tags) with RLS + grants
- [ ] 1.2 Provide a staff-only ingest path to create/update an acquisition profile (members cannot write it)
- [ ] 1.3 Extend `generate_matches_for` so member offers are scored against active acquisition profiles as candidate sources
- [ ] 1.4 Preserve existing routing: an acquisition match with a large-volume driver still routes `dkri`

## 2. Joint ventures from platform projects

- [ ] 2.1 Add `joint_ventures` and `joint_venture_participants` tables (linking an accepted match/project to its participating members) with RLS + grants
- [ ] 2.2 Provide a server-controlled action that forms a joint venture from an accepted match/project
- [ ] 2.3 Restrict reading a joint venture to its participants (and staff), enforced by RLS

## 3. Verification

- [ ] 3.1 Test: a member offer complementary to an active acquisition profile produces a scored match
- [ ] 3.2 Test: forming a joint venture from an accepted match records its participants
- [ ] 3.3 Test: a non-participant cannot read a joint venture
