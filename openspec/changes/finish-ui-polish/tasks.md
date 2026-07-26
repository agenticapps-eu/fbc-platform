# Tasks

## 1. Tiered name resolution (AGE-291, spec-relevant)

- [ ] 1.1 Define the tier-to-visibility rule (which viewer tiers reveal a full name vs a masked label)
- [ ] 1.2 Resolve the displayed name in the database (directory read path) so the masked label is returned to below-threshold and anonymous viewers regardless of client
- [ ] 1.3 Render the resolved name in the directory/author surfaces (full name or masked label as returned)

## 2. Mein-Bereich inline accordion (AGE-292, client-only)

- [ ] 2.1 Convert the "Mein Bereich" sections into an inline accordion

## 3. Menu label cleanup (AGE-293, client-only)

- [ ] 3.1 Tidy the navigation menu labels

## 4. Clear React Query cache on logout (AGE-258, client-only)

- [ ] 4.1 Clear/invalidate the React Query cache on logout so a prior session's data cannot bleed into the next

## 5. Verification

- [ ] 5.1 Test: a viewer whose tier clears the threshold sees another member's full name
- [ ] 5.2 Test: a below-threshold or anonymous viewer sees the masked label, enforced server-side
