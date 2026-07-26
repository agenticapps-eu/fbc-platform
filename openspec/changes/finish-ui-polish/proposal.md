# Tiered name resolution, logout isolation, and UI polish

## Why

The headline item is a PII/security behaviour, not cosmetics: whether a viewer sees
another member's full name should depend on the viewer's tier (AGE-291), enforced in
the data layer. Today only anonymous masking to "Mitglied" exists, and `profiles_public`
hands the full `name` to every authenticated tier. A second security item —
clearing the client cache on logout (AGE-258) — is a data-bleed invariant, not
polish. Two genuinely cosmetic items round out the change.
Linear: **AGE-291** (tiered name resolution), **AGE-258** (logout cache isolation),
**AGE-292** (mein-bereich inline accordion), **AGE-293** (menu label cleanup).

## What Changes

- Resolve display names through a **single shared resolver** keyed off the caller's
  tier: full name for self and `has_level(4)` (`exchange`) and above; the masked
  "Mitglied" label otherwise. Applied in the DB read path across **every**
  name-bearing surface (directory, feed, events, matching, profiles), so masking
  can't be bypassed via another surface.
- **Clear** (not just invalidate) the client query cache on logout / principal
  change (AGE-258) — specified as a data-isolation invariant.
- (Client-only, no spec delta) Inline "Mein Bereich" accordion (AGE-292) and menu
  label cleanup (AGE-293).

## Impact

- Affected capabilities: `directory-search`, `member-profiles` (the `profiles_public`
  `name` column becomes tier-resolved), and `access-control` (logout cache invariant).
- Removes the "Author name masking is only partially resolved" requirement; modifies
  the `profiles_public` public-view requirement so `name` is masked below the reveal tier.
- Reveal threshold is `has_level(4)`; it layers above the existing row-visibility gate
  (`level_rank >= 3` for directory rows) — rows visible from discover, full names from exchange.
- Contact fields (email/phone) stay governed by contact-request rules; out of scope here.
