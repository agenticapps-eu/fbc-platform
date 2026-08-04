# Member Profiles

## Purpose

Defines the member profile: how it is provisioned, which fields are public,
which are gated by membership rank, and which contact/private data is never
disclosed without an explicit action. Visibility is enforced by Postgres RLS on
the base tables, not by the client. Reconstructed from the code as of the
OpenSpec migration; supersedes the legacy 3-tier profile visibility described in
`docs/legacy-planning/`.

## Requirements

### Requirement: Sign-up auto-provisions a profile

The system SHALL create exactly one `profiles` row for every new auth user via
the `SECURITY DEFINER` trigger `handle_new_user`, seeding `name` from the auth
user's metadata (`full_name` or `name`) and `tier = 'basic'`. Clients SHALL NOT
hold INSERT on `profiles`; profile creation is trigger-only.

#### Scenario: A new auth user gets a Basic profile

- **WHEN** a row is inserted into `auth.users`
- **THEN** a matching `profiles` row is created with `tier = 'basic'` and `name`
  copied from the user's `full_name`/`name` metadata

#### Scenario: Client cannot insert a profile directly

- **WHEN** an authenticated client attempts to INSERT into `profiles`
- **THEN** the write is denied (no client INSERT grant/policy; the trigger owns provisioning)

### Requirement: Public profile fields are exposed through a read-only view

The system SHALL expose a fixed public field subset (`id`, `name`, `avatar_url`,
`region`, `company`, `short_bio`, `tier`, `roles`) of `is_public` profiles
through the `profiles_public` view, granting SELECT to `authenticated` only. The
view SHALL be read-only to clients: `anon` and `authenticated` hold no
INSERT/UPDATE/DELETE, and `anon` holds no SELECT.

#### Scenario: Authenticated member reads public fields of any listed profile

- **WHEN** an authenticated member selects from `profiles_public`
- **THEN** the public field subset of every `is_public` profile is returned

#### Scenario: Writes through the view are rejected

- **WHEN** any client issues INSERT/UPDATE/DELETE against `profiles_public`
- **THEN** the write is denied (write privileges were revoked from `anon` and `authenticated`)

#### Scenario: Anonymous visitor cannot read the view

- **WHEN** an anonymous (`anon`) caller selects from `profiles_public`
- **THEN** no rows are returned (SELECT was revoked from `anon`)

### Requirement: Full profile and extended data are gated by membership rank

The system SHALL restrict SELECT of a full `profiles` base-table row (including
`interests`, `competencies`, free-text `goals`, `headline`, `dev_focus`, and
other extended columns) to the profile's owner OR a caller with `level_rank >= 3`
(`discover`), via the policy `profiles_select_self_or_discover` using
`has_level(3)`. The extended sub-tables `profile_theme_scores`,
`profile_interests`, and `profile_badges` SHALL follow the same threshold for
SELECT (own profile OR `has_level(3)`), while `profile_theme_scores` and
`profile_interests` remain client-writable only for the owner and
`profile_badges` has no client write policy (awarded server-side).

#### Scenario: Below Discover a member sees only their own full row

- **WHEN** a `basic`/`connect` member (rank < 3) selects another member's full
  `profiles` row or their extended sub-tables
- **THEN** RLS returns no row for the other member (only the caller's own row is visible)

#### Scenario: Discover-and-above sees full rows and extended data

- **WHEN** a member with `level_rank >= 3` selects other members' `profiles`
  rows, `profile_theme_scores`, `profile_interests`, or `profile_badges`
- **THEN** those rows are returned

#### Scenario: A member cannot self-award a badge

- **WHEN** an authenticated member attempts to INSERT into `profile_badges`
- **THEN** the write is denied (no client write policy; badges are awarded by service_role/admin)

### Requirement: Contact data is disclosed only after an accepted contact request

The system SHALL keep contact details in a separate `profile_contacts` table
(`email`, `phone`, `website`) whose SELECT policy
`contacts_select_self_or_released` returns a row only to its owner OR to a
counterparty that shares an `accepted` row in `contact_requests`. Contact data
SHALL never be exposed through `profiles_public` or the rank-gated profile row.

#### Scenario: Owner reads their own contact data

- **WHEN** a member selects their own `profile_contacts` row
- **THEN** the row is returned

#### Scenario: Contact data stays hidden without acceptance

- **WHEN** a member selects another member's `profile_contacts` row and no
  `accepted` `contact_requests` row links the two
- **THEN** RLS returns no row

#### Scenario: Acceptance reveals contact data

- **WHEN** a `contact_requests` row between the two members reaches
  `status = 'accepted'`
- **THEN** each may thereafter SELECT the other's `profile_contacts` row

### Requirement: Private profile data is strictly owner-only

The system SHALL restrict the `goals` table and the `member_settings` table to
the owning member for both read and write (policies `goals_own` and
`member_settings_own`, keyed on `profile_id = auth.uid()`), never exposing them
to higher tiers or to the public. `member_settings` SHALL hold the member's
notification, contactability and **presentation** preferences (e.g.
`notify_email_requests`, `contactable_by_prime`, `theme`).

The `theme` column SHALL accept only `hell` or `navy` and SHALL default to `hell`.
It carries no access-control meaning: it selects a presentation and SHALL NOT gate
what any member may read or write. It is governed by the existing owner-only policy
and the table's existing grants — the column adds no new policy and no new grant.

Owner-only describes the stored row. The same choice is additionally mirrored into
device-local `localStorage`, because the server value cannot arrive before the first
paint; that copy is readable by anything running on the device and is deliberately
not account-scoped. This is stated rather than fixed: the theme reveals nothing
about the member, and the alternative — no local copy — costs every member a visible
theme flash on every load.

#### Scenario: Goals are invisible to everyone but the owner

- **WHEN** any member other than the owner selects the owner's `goals` rows
- **THEN** RLS returns no row, regardless of the caller's tier

#### Scenario: A member manages only their own settings

- **WHEN** a member reads or writes `member_settings`
- **THEN** only the row where `profile_id = auth.uid()` is accessible; writes to
  another member's row are denied

#### Scenario: A member's theme choice is private to them

- **WHEN** a member writes `theme` on their own `member_settings` row
- **THEN** the write succeeds, and no other member can read or change that value

#### Scenario: An unsupported theme value is rejected

- **WHEN** a write sets `theme` to any value other than `hell` or `navy`
- **THEN** the write is rejected by the database, not merely by the client

### Requirement: Profile media is stored and gated per member

The system SHALL store avatars in a public `avatars` storage bucket where writes
are restricted to the caller's own `{uid}/…` folder (policies
`avatars_insert_own` / `avatars_update_own` / `avatars_delete_own`), and SHALL
store an ordered `profiles.videos text[]` of provider URLs whose visibility
follows the existing `profiles` RLS (no separate access path).

#### Scenario: A member uploads only into their own avatar folder

- **WHEN** an authenticated member uploads an object to the `avatars` bucket
  under a first path segment equal to their `auth.uid()`
- **THEN** the write is permitted; a write under any other member's folder is denied

#### Scenario: Profile videos inherit profile visibility

- **WHEN** a caller can read a given `profiles` row under RLS
- **THEN** that row's `videos` array is visible to them, and to no one who cannot read the row

### Requirement: Completion and potential scores are server-maintained

The system SHALL compute `profiles.profile_completion` on every profile
insert/update via the `set_profile_completion` trigger (12 equally weighted
fields → 0–100), and SHALL expose potential-score recomputation only through the
`SECURITY DEFINER` RPC `recompute_potential_score(profile_id)`, which a member
may invoke only for their own profile. Neither `profile_completion` nor
`potential_score` SHALL be in the client UPDATE grant.

#### Scenario: Completion recomputes on write

- **WHEN** a member updates their profile row
- **THEN** `profile_completion` is recomputed by the trigger from the row's fields, not from a client-supplied value

#### Scenario: A member cannot recompute another member's score

- **WHEN** an authenticated member calls `recompute_potential_score` for a
  `profile_id` other than their own
- **THEN** the function raises an authorization error (errcode 42501)
