# Access Control

## Purpose

Captures the cross-cutting security invariants of the FBC community platform — the
codified form of the project's Kernprinzipien. Access is enforced in the database
via Row-Level Security and privilege grants, not merely in the client; visibility
follows membership tier rank; and contact data is never disclosed without explicit,
mutual consent. Reconstructed from code as of the OpenSpec migration
(`supabase/migrations/*`, verified by `supabase/tests/rls_test.sql` and
`grants_test.sql`).

## Requirements

### Requirement: Access is enforced in the database, deny-by-default

The system SHALL enable Row-Level Security on every table and rely on it, not the
frontend, as the security boundary. Any table/role/command without a permissive
policy SHALL be denied; the client is convenience only and its bypass MUST NOT grant
access. `service_role` (edge functions) bypasses RLS by design.

#### Scenario: A table without a matching policy denies the caller

- **WHEN** an authenticated caller attempts an operation on a table for which no
  permissive policy exists for their role
- **THEN** RLS denies the operation (deny-by-default), independent of any client-side
  check

#### Scenario: Interaction rows cannot bypass parent visibility

- **WHEN** a member queries `comments` (or writes `post_likes`/`event_registrations`)
  whose parent post/event they cannot see
- **THEN** the interaction policy delegates to the parent's RLS
  (`exists (select 1 from posts p where p.id = ...)`) and returns/permits nothing,
  so visibility cannot be bypassed through an interaction table

### Requirement: Visibility follows membership tier rank

The system SHALL gate tier-scoped visibility on the caller's numeric tier rank via
`current_tier_rank()` and the derived predicate `is_prime_plus()`, so that a member
below the required rank cannot read a higher-tier resource while a member at or above
it can. The rank comparison — not a client flag — SHALL be the deciding factor.

#### Scenario: Below-threshold member is excluded from the full directory

- **WHEN** a member below the directory threshold selects another member's full
  `profiles` row (extended fields) or their `offers`/`needs`
- **THEN** the tier-gated policy (via `is_prime_plus()`/`current_tier_rank()`) returns
  no row

#### Scenario: At-or-above-threshold member gains access

- **WHEN** a member at or above the threshold reads the same resource
- **THEN** the tier gate permits it (e.g. a `discover`-rank member reads a full foreign
  profile and its extended interests)

### Requirement: Contact data is never implicitly disclosed

The system SHALL keep contact details (`profile_contacts`) invisible to everyone but
the owner until an explicit, mutually accepted contact request exists between the two
members. Disclosure SHALL require a real consented `accepted` state — a member MUST
NOT forge, self-accept, or re-target a request to harvest another member's contacts.

#### Scenario: Contacts released only after an accepted request

- **WHEN** a member selects another member's `profile_contacts`
- **THEN** `contacts_select_self_or_released` returns the row only if the caller is
  the owner or an `accepted` contact request links the two members

#### Scenario: Forged or rewritten requests cannot release contacts

- **WHEN** a recipient tries to rewrite `from_id`/`to_id`/`match_id` or flip a
  non-pending request, or a sender tries to INSERT an already-`accepted` row
- **THEN** the column-level UPDATE grant (`status` only) and the transition-pinning
  policies deny it — only a pending request the recipient owns may move to
  `accepted`/`declined`, with a `match_id` that actually belongs to the pair

### Requirement: SECURITY DEFINER functions are pinned and locked down

The system SHALL define privileged helper and trigger functions as `SECURITY DEFINER`
with a pinned `search_path`, and SHALL grant EXECUTE only to the roles that need it —
revoking the default `PUBLIC`/`anon` grant so these functions are not exposed as
PostgREST `/rest/v1/rpc` endpoints. Trigger-only functions SHALL carry no API-role
EXECUTE grant at all.

#### Scenario: Predicate helpers are not callable by anon

- **WHEN** the `anon` role attempts to call `is_admin()`, `is_prime_plus()`,
  `is_matching_manager()`, or `current_tier_rank()` via PostgREST
- **THEN** EXECUTE is denied (`has_function_privilege('anon', ...)` is false); only
  `authenticated` (and `service_role` where required) may call them

#### Scenario: Trigger-only functions are off the API surface

- **WHEN** any role tries to invoke a trigger helper (e.g. `handle_new_user`,
  `set_updated_at`, `platform_settings_touch`) as an RPC
- **THEN** EXECUTE has been revoked from `public`/`anon`/`authenticated`, while the
  trigger still fires (triggers do not check the caller's EXECUTE privilege)

### Requirement: Privileges are granted explicitly, inherited by nothing

The system SHALL grant table and column privileges explicitly — each grant backed by
a matching policy — and SHALL disarm default privileges so a newly created table
inherits no `anon`/`authenticated` rights. The exact grant matrix SHALL be pinned by
the `grants_test.sql` golden snapshot, which fails whenever the matrix drifts.

#### Scenario: A new table inherits no client privileges

- **WHEN** a migration creates a new table without an explicit grant
- **THEN** `anon`/`authenticated` receive nothing (default privileges are revoked for
  role `postgres`), and access fails closed until a grant is stated

#### Scenario: Grant matrix drift is caught by the snapshot

- **WHEN** the effective table/column grants for `anon`/`authenticated` differ from
  the recorded golden snapshot
- **THEN** `grants_test.sql` fails, forcing the matrix change to be reviewed and the
  snapshot updated

### Requirement: Helper predicates are the single authority for gating

The system SHALL centralise every authorization decision in the server-controlled
predicates `current_tier_rank()`, `is_prime_plus()`, `is_matching_manager()`, and
`is_admin()`, sourced from `membership_tiers`/`profiles.tier` and `staff_roles`.
Policies SHALL call these predicates rather than duplicating thresholds, and elevated
standing SHALL never derive from the member-writable `profiles.roles`.

#### Scenario: Elevated standing is not member-forgeable

- **WHEN** a member sets `profiles.roles` to include `'admin'` or `'matching_manager'`
- **THEN** `is_admin()`/`is_matching_manager()` still return false, because they read
  `staff_roles`, which the client cannot write

#### Scenario: Tier threshold lives in one predicate

- **WHEN** a tier-gated policy needs the Prime+ threshold
- **THEN** it calls `is_prime_plus()` (which encapsulates the `current_tier_rank()`
  comparison) rather than re-encoding the rank, so the threshold cannot drift between
  policies
