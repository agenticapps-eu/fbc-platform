# Tasks

## 1. Tiered name resolution (AGE-291, spec-relevant)

- [ ] 1.1 Add a shared `resolve_display_name` predicate/function keyed off the
      caller's own tier (`auth.uid()` → rank), returning the full name for self and
      `has_level(4)` callers, else the "Mitglied" masked label
- [ ] 1.2 Make `profiles_public.name` (and `search_directory`) return the resolved
      name so a below-`exchange` or anonymous caller never receives another member's
      full name; ensure ordering/full-text search do not leak it
- [ ] 1.3 Route every name-bearing surface (directory, feed, events, matching,
      profile views) through the shared resolver
- [ ] 1.4 Render whichever name value the server returns; never derive the full name
      client-side

## 2. Logout cache isolation (AGE-258, spec-relevant)

- [ ] 2.1 Clear (not just invalidate) the React Query cache on logout / principal
      change so a prior session's data cannot bleed into the next

## 3. Mein-Bereich inline accordion (AGE-292, client-only)

- [ ] 3.1 Convert the "Mein Bereich" sections into an inline accordion

## 4. Menu label cleanup (AGE-293, client-only)

- [ ] 4.1 Tidy the navigation menu labels

## 5. Verification

- [ ] 5.1 Test: an `exchange`+ viewer sees another member's full name; a below-`exchange`
      viewer and `anon` see "Mitglied", enforced server-side
- [ ] 5.2 Test: a member always sees their own full name
- [ ] 5.3 Test: the full name does not leak via directory search/ordering for a
      below-threshold caller
- [ ] 5.4 Test: after logout, the previous principal's cached data is not returned to
      the next principal
