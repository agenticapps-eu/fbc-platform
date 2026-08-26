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
  status: full name for self and for any **activated** member; the masked
  "Mitglied" label for everyone else (in practice: anonymous visitors). Applied in the DB read path across **every**
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
- **Reveal threshold is activation, not a tier** (Donald, 26.08.2026). The earlier
  plan set it at `has_level(4)` (`exchange`). AGE-601 makes `members` mean "every
  activated member", which opens the activity feed to exactly the population an
  `exchange` threshold would mask — a full feed in which no author has a name. The
  two are not in technical conflict but in purpose, and the feed's purpose wins.
- The threshold still layers above the row-visibility gate (`level_rank >= 3` for
  directory rows): rows from `discover`, names from activation. Below `discover` a
  caller sees no other member's row at all, so the resolver's effect there is moot.
- Contact fields (email/phone) stay governed by contact-request rules; out of scope here.
