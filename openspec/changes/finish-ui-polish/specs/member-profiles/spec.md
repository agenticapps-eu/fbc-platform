## MODIFIED Requirements

### Requirement: Public profile fields are exposed through a read-only view

The system SHALL expose a fixed public field subset (`id`, `name`, `avatar_url`,
`region`, `company`, `short_bio`, `tier`, `roles`) of `is_public` profiles through
the `profiles_public` view, granting SELECT to `authenticated` only. The `name`
column SHALL be the **tier-resolved display name**: the full name when the caller is
the profile owner or clears `has_level(4)` (`exchange`), otherwise the masked
"Mitglied" label — so a below-threshold caller never receives another member's full
name through the view. The view SHALL be read-only to clients: `anon` and
`authenticated` hold no INSERT/UPDATE/DELETE, and `anon` holds no SELECT.

#### Scenario: Authenticated member reads public fields of any listed profile

- **WHEN** an authenticated member selects from `profiles_public`
- **THEN** the public field subset of every `is_public` profile is returned, with
  `name` resolved to the full name only if the caller is the owner or clears `has_level(4)`

#### Scenario: Below-threshold caller gets masked names

- **WHEN** a caller with `level_rank < 4` selects from `profiles_public`
- **THEN** the `name` column returns "Mitglied" for every profile that is not their own

#### Scenario: Writes through the view are rejected

- **WHEN** any client issues INSERT/UPDATE/DELETE against `profiles_public`
- **THEN** the write is denied (write privileges were revoked from `anon` and `authenticated`)

#### Scenario: Anonymous visitor cannot read the view

- **WHEN** an anonymous (`anon`) caller selects from `profiles_public`
- **THEN** no rows are returned (SELECT was revoked from `anon`)

## ADDED Requirements

### Requirement: Display-name resolution is centralized and tier-gated

The system SHALL resolve a member's shown name through a single shared resolver
keyed off the authenticated caller's own tier (never a client-supplied parameter),
and every name-bearing read surface — directory, community feed, events, matching,
and profile views — SHALL use it. The full name is shown to the profile owner and to
callers who clear `has_level(4)` (`exchange`); all other callers see the masked
"Mitglied" label. "Full name" here means `profiles.name`; contact fields (email,
phone) remain governed by the contact-request disclosure rules and are out of scope
for this resolver.

#### Scenario: All name-bearing surfaces use the shared resolver

- **WHEN** a member's name is shown on the feed, an event, a match, or a profile
- **THEN** the name is produced by the shared resolver using the caller's tier, so
  masking is consistent across every surface

#### Scenario: The gate keys off the token, not client input

- **WHEN** a caller supplies a tier/identity parameter in an attempt to obtain a full name
- **THEN** it is ignored; resolution uses the authenticated token's tier
