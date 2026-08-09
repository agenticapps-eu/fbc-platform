# Directory & Search

## Purpose

Defines the member directory: the public field projection all members can browse,
the server-side full-text and faceted search, the single visibility flag that
governs whether a member is listed, and the membership-rank gate that controls
access to richer profile data. Visibility is enforced by Postgres RLS, not by the
client. Reconstructed from the code as of the OpenSpec migration.
## Requirements
### Requirement: Server-side directory search with facet filters

The system SHALL provide a `search_directory(...)` RPC that returns a fixed
column set per member (`id`, `name`, `avatar_url`, `region`, `company`,
`short_bio`, `branche`, `tier`, `roles`, `competencies`, `has_offers`,
`has_needs`, `offer_categories`, `need_categories`) with optional full-text
(`p_query`, German `search_doc` tsvector) and facet filters (`p_theme`,
`p_branche`, `p_region`, `p_competency`, `p_offering`, `p_offers`, `p_needs`).
The function SHALL be `SECURITY INVOKER`, so the caller's own RLS decides which
profile rows are returned, and SHALL list only `is_public` members.

`p_offers` and `p_needs` SHALL be `text[]` category filters matching
`offers.category` and `needs.category`. Within one array the categories SHALL be
combined with OR (a member matching any listed category qualifies); the two
arrays SHALL be combined with AND (a member must satisfy both groups when both
are supplied). A null or empty array SHALL mean "no filter" for that group.

`offer_categories` and `need_categories` SHALL carry the caller-visible, distinct,
non-null categories of that member's offers and needs, so the client can render
them without a second round trip. They SHALL NOT replace `has_offers`/`has_needs`:
a row whose `category` is null contributes to the boolean but not to the array, so
the two answer different questions.

Because two `text[]` parameters change the function's argument type list, the
migration SHALL **replace** the function — dropping the previous six-argument
signature explicitly and creating the new one — rather than relying on `create or
replace`, which would register an overload. It SHALL re-issue `revoke`/`grant`
against the new signature, keeping execute limited to `authenticated`.

The category arrays SHALL be built so that a member with no categorised rows
yields an **empty array, never null**: a filtered aggregate over rows whose
`category` is null evaluates to null in Postgres, which is a different value than
the empty array this contract promises and would force every client to handle two
shapes of "nothing".

Returning the categories widens what the directory discloses: it previously
revealed only _that_ a member offers or seeks something, and now reveals _what_ —
commercial intent such as "sucht Investoren". This is deliberate; it is the
feature. It SHALL NOT widen _who_ can see it. The disclosure stays behind exactly
the boundary that already governs the directory — `is_public` plus the base-table
rank gate — and no contact data is disclosed by it, so the platform's rule that
contact details are never released automatically is untouched.

#### Scenario: Full-text query matches the search document

- **WHEN** a caller invokes `search_directory` with `p_query` set
- **THEN** only members whose generated `search_doc` matches
  `websearch_to_tsquery('german', p_query)` are returned, subject to RLS

#### Scenario: Facet filters narrow the result

- **WHEN** a caller passes `p_branche`, `p_region`, `p_competency`, `p_theme`,
  or `p_offering`
- **THEN** results are restricted to members matching each supplied filter
  (a member "active in a theme" via any offer, need, or interest in that theme)

#### Scenario: Categories within one group are combined with OR

- **WHEN** a caller passes `p_offers => array['kapital','mentoring']`
- **THEN** members offering `kapital` **or** `mentoring` are returned

#### Scenario: The two groups are combined with AND

- **WHEN** a caller passes both `p_offers => array['kapital']` and
  `p_needs => array['experten']`
- **THEN** only members who offer `kapital` **and** seek `experten` are returned

#### Scenario: An empty or null category array does not filter

- **WHEN** a caller passes `p_offers => null` or `p_offers => array[]::text[]`
- **THEN** the offer-category filter is not applied and the other filters decide

#### Scenario: The result carries the member's categories

- **WHEN** a member has offers in `kapital` and `kontakte` and a need in `experten`
- **THEN** their row returns `offer_categories = {kapital,kontakte}` and
  `need_categories = {experten}`, each distinct and free of nulls

#### Scenario: A categoryless row still sets the boolean

- **WHEN** a member's only offer row has `category = null`
- **THEN** `has_offers` is true while `offer_categories` is the empty array — not
  null, which is what an unguarded filtered aggregate would return

#### Scenario: A member with no rows at all returns empty arrays

- **WHEN** a member holds neither offers nor needs
- **THEN** `offer_categories` and `need_categories` are both `{}` and neither is null

#### Scenario: Anonymous callers cannot execute the new signature

- **WHEN** an `anon` caller invokes the eight-argument `search_directory`
- **THEN** execution is denied, because the grant was re-issued to `authenticated`
  only and no privilege was inherited by the new signature

#### Scenario: A below-rank caller learns no other member's categories

- **WHEN** a caller below the directory's rank gate filters on `p_offers`
- **THEN** the base-table RLS still yields at most their own row, so neither the
  returned arrays nor the filtered result set reveals another member's categories

#### Scenario: The previous signature is gone, not shadowed

- **WHEN** the migration has run and a caller invokes `search_directory()` with no
  arguments
- **THEN** exactly one function resolves and the call succeeds (no
  "function is not unique" ambiguity from a leftover six-argument overload)

#### Scenario: Opted-out members are never listed

- **WHEN** a member has `is_public = false`
- **THEN** `search_directory` does not return them for any caller

### Requirement: Public field projection is members-only and read-only

The system SHALL expose the directory's public field subset through the
`profiles_public` view (`id`, `name`, `avatar_url`, `region`, `company`,
`short_bio`, `tier`, `roles`) of `is_public` profiles. The view SHALL grant
SELECT to `authenticated` only, deny SELECT to `anon`, and hold no client write
privileges, so no client can mutate the directory.

A session alone SHALL NOT suffice. The view SHALL return rows only to a caller
whose own account is **activated**, and SHALL return only those profiles whose
**owner** is activated. "Every logged-in member can browse the base directory
fields" therefore reads: every logged-in **and activated** member. Because the
view runs with its owner's rights and bypasses the base table's policies, this
condition SHALL sit in the view body itself, not only in the policies behind it.

#### Scenario: Logged-in member browses base directory fields

- **WHEN** an authenticated, activated member selects from `profiles_public`
- **THEN** the public field subset of all `is_public` profiles **whose owner is
  activated** is returned regardless of the member's tier

#### Scenario: Logged-in but unconfirmed member sees no directory

- **WHEN** an authenticated member whose account is not yet activated selects
  from `profiles_public`
- **THEN** no rows are returned

#### Scenario: Anonymous visitor is denied the directory

- **WHEN** an `anon` caller selects from `profiles_public`
- **THEN** no rows are returned

### Requirement: Richer profile fields are gated by membership rank

The system SHALL reserve full profile rows and extended data (beyond the
`profiles_public` subset) for the profile's owner OR a caller with
`level_rank >= 3` (`discover`), enforced by the base-table policy
`profiles_select_self_or_discover` (`has_level(3)`). Because `search_directory`
runs as `SECURITY INVOKER`, a below-Discover or anonymous caller SHALL see at
most their own full row through it.

#### Scenario: Below-Discover caller sees at most their own full row

- **WHEN** a member with `level_rank < 3` invokes `search_directory`
- **THEN** the base-table RLS yields only their own row (no other members' full rows)

#### Scenario: Discover-and-above caller sees the full directory

- **WHEN** a member with `level_rank >= 3` invokes `search_directory`
- **THEN** all `is_public` members' rows are returned

### Requirement: Directory visibility has a single source of truth

The system SHALL govern whether a member appears in the directory solely by
`profiles.is_public`. The former duplicate flag `member_settings.visible_in_directory`
SHALL NOT exist; it was reconciled into `is_public` and dropped, so no second
copy can drift out of sync.

#### Scenario: Toggling visibility uses one flag

- **WHEN** a member changes their directory visibility
- **THEN** the change is written to `profiles.is_public`, which every directory
  path (`profiles_public`, `search_directory`) reads

#### Scenario: The removed duplicate flag is absent

- **WHEN** any code references `member_settings.visible_in_directory`
- **THEN** the column does not exist (it was dropped by the single-source migration)

### Requirement: Author name masking is only partially resolved

The system SHALL mask author identity for anonymous readers, falling back to the
literal name "Mitglied" when the caller cannot read a profile (e.g. the
anonymous feed via `fetchAuthors`). Tier-dependent name resolution (AGE-291)
SHALL be treated as NOT yet implemented: anonymous masking exists, but graduated
name reveal by the viewer's tier is pending and is not present in the code.

#### Scenario: Anonymous reader sees a masked author name

- **WHEN** an anonymous caller cannot read an author's profile row
- **THEN** the name renders as the fallback "Mitglied" rather than failing

#### Scenario: Tiered name resolution is not yet in effect

- **WHEN** the current behavior is inspected for graduated, tier-based name reveal
- **THEN** none exists beyond the RLS full-row gate and anonymous masking (tiered resolution remains a pending follow-up)

