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
`has_needs`) with optional full-text (`p_query`, German `search_doc` tsvector)
and facet filters (`p_theme`, `p_branche`, `p_region`, `p_competency`,
`p_offering`). The function SHALL be `SECURITY INVOKER`, so the caller's own RLS
decides which profile rows are returned, and SHALL list only `is_public` members.

#### Scenario: Full-text query matches the search document

- **WHEN** a caller invokes `search_directory` with `p_query` set
- **THEN** only members whose generated `search_doc` matches
  `websearch_to_tsquery('german', p_query)` are returned, subject to RLS

#### Scenario: Facet filters narrow the result

- **WHEN** a caller passes `p_branche`, `p_region`, `p_competency`, `p_theme`,
  or `p_offering`
- **THEN** results are restricted to members matching each supplied filter
  (a member "active in a theme" via any offer, need, or interest in that theme)

#### Scenario: Opted-out members are never listed

- **WHEN** a member has `is_public = false`
- **THEN** `search_directory` does not return them for any caller

### Requirement: Public field projection is members-only and read-only

The system SHALL expose the directory's public field subset through the
`profiles_public` view (`id`, `name`, `avatar_url`, `region`, `company`,
`short_bio`, `tier`, `roles`) of `is_public` profiles. The view SHALL grant
SELECT to `authenticated` only, deny SELECT to `anon`, and hold no client write
privileges, so every logged-in member can browse the base directory fields while
no client can mutate them.

#### Scenario: Logged-in member browses base directory fields

- **WHEN** an authenticated member selects from `profiles_public`
- **THEN** the public field subset of all `is_public` profiles is returned regardless of the member's tier

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
