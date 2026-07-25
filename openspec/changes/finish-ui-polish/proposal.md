# Finish UI polish and tiered name resolution

## Why

Several review-driven UI follow-ups are still open, and one of them is a real
visibility behaviour rather than cosmetics: the directory still has no graduated,
tier-based name reveal. Only anonymous masking to the literal "Mitglied" exists
today; whether a viewer sees another member's full name should depend on the
viewer's tier (AGE-291), and that gate must live in the data layer, not the
client. The remaining items are client-side polish.
Linear: **AGE-291** (tiered name resolution), **AGE-292** (mein-bereich inline
accordion), **AGE-293** (menu label cleanup), **AGE-258** (clear React Query cache
on logout).

## What Changes

- Resolve a member's displayed name by the viewer's tier: higher tiers see the
  full name, lower/opted-out viewers see a masked label, enforced by the database
  rather than only the UI (AGE-291).
- (Client-only, no spec delta) Convert the "Mein Bereich" sections to an inline
  accordion (AGE-292), tidy the navigation menu labels (AGE-293), and clear the
  React Query cache on logout so a previous session's data cannot bleed through
  (AGE-258).

## Impact

- Affected capability: `directory-search` (tiered name resolution only).
- The remaining tasks touch only client components and the auth/logout flow; they
  carry no spec change and are listed in tasks.md for tracking.
- No change to directory visibility's single source of truth (`profiles.is_public`)
  or to the membership-rank full-row gate; tiered name resolution layers on top.
