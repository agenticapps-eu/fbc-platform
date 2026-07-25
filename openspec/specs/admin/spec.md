# Admin

## Purpose

Defines the platform's staff/administration surface: the server-controlled staff
roles that grant elevated capability, the admin-only platform settings, the
matching-manager routing queue, and the admin feedback view. Reconstructed from
code as of the OpenSpec migration. Elevated capability is provisioned out of band
(never from the client) and is enforced in the database via `is_admin()` /
`is_matching_manager()`, with the frontend acting only as convenience gating.

## Requirements

### Requirement: Server-controlled staff roles

The system SHALL hold elevated roles in a dedicated `staff_roles` table
(`role in ('matching_manager', 'admin')`), provisioned out of band via
`service_role`/admin SQL. A member MAY read only their own `staff_roles` row and
SHALL have no client write grant, so the member-writable `profiles.roles` chips can
never be used as an authorization source.

#### Scenario: Member reads only their own staff row

- **WHEN** an authenticated member selects from `staff_roles`
- **THEN** RLS (`staff_roles_select_self`) returns only the row where
  `profile_id = auth.uid()`, and no other member's role

#### Scenario: Client cannot grant itself a staff role

- **WHEN** a member attempts to INSERT/UPDATE/DELETE on `staff_roles`
- **THEN** the write is denied — the table carries only a SELECT grant to
  `authenticated`, and staff is provisioned exclusively by `service_role`/admin SQL

### Requirement: Admin capability is gated by is_admin()

The system SHALL expose a `SECURITY DEFINER` predicate `is_admin()` that returns
true only when the caller holds the `admin` role in `staff_roles`, and every
admin-only server rule SHALL gate on this predicate rather than on client-supplied
identity. The `/admin` route gate (`RequireAdmin`) is UI convenience only; the
enforcing boundary is the database.

#### Scenario: Non-admin route access falls through to the DB boundary

- **WHEN** a member without the `admin` staff role navigates to `/admin`
- **THEN** `RequireAdmin` redirects them away, and even if the client were bypassed
  the RLS/`is_admin()` gates would still deny any admin-only write

#### Scenario: is_admin() is server-controlled

- **WHEN** `is_admin()` evaluates for a caller
- **THEN** it returns true only if `staff_roles` has an `admin` row for
  `auth.uid()`, independent of the caller's `profiles.roles`

### Requirement: Admin-only platform settings singleton

The system SHALL store platform-wide settings in a singleton table
`platform_settings` (`id boolean primary key check (id)`, enforcing exactly one
row). Any authenticated member MAY read it (it drives UI and policies), but only
`is_admin()` MAY update it, and `updated_at`/`updated_by` SHALL be set by the server
trigger, never by the client.

#### Scenario: Admin toggles a setting

- **WHEN** an admin updates `platform_settings.open_contact` via `/admin`
- **THEN** the `platform_settings_update_admin` policy permits the write and the
  server trigger stamps `updated_at`/`updated_by`

#### Scenario: Non-admin write changes nothing

- **WHEN** a non-admin member issues an UPDATE on `platform_settings`
- **THEN** the statement does not error but RLS (`using is_admin()`) matches zero
  rows, so the setting is unchanged

### Requirement: Matching managers triage the routing queue

The system SHALL route large-volume (`dkri`) contact requests into a `routing_queue`
table, populated only by the `SECURITY DEFINER` lifecycle trigger. Only a caller
satisfying `is_matching_manager()` MAY read the queue or update a case's `status`
and `assigned_to`; the enriched joined view SHALL be served by the
`list_routing_queue()` RPC, which returns nothing to non-managers.

#### Scenario: Manager sees and advances a case

- **WHEN** a matching manager opens the internal routing page and moves a case to
  `in_review` or assigns it to themselves
- **THEN** `routing_queue_select_staff`/`routing_queue_update_staff` permit the read
  and the `status`/`assigned_to` update (the only client-writable columns)

#### Scenario: Non-manager gets an empty queue

- **WHEN** a member without a `matching_manager`/`admin` staff role calls
  `list_routing_queue()`
- **THEN** the `is_matching_manager()` guard in the WHERE clause returns no rows

### Requirement: Admins review aggregated member feedback

The system SHALL provide a `SECURITY DEFINER` RPC `admin_list_feedback()` that
returns all feedback rows joined to the author's name, gated so it returns rows only
when `is_admin()`. The admin capability over feedback SHALL be read-only — the admin
reviews QM feedback but does not manage it (no admin delete of others' rows).

#### Scenario: Admin reads all feedback with author names

- **WHEN** an admin calls `admin_list_feedback()`
- **THEN** every feedback row is returned with `author_name` resolved past the
  `profiles` RLS (owner-rights join)

#### Scenario: Non-admin (incl. matching manager) gets nothing

- **WHEN** a matching manager or ordinary member calls `admin_list_feedback()`
- **THEN** the `where is_admin()` filter returns zero rows — QM is not the deal queue

### Requirement: Admin member management is not implemented

The system SHALL NOT provide, in the current prototype, an admin member-list view or
a mass-mail/broadcast capability (AGE-304 partial). The built admin surface is
limited to the platform-settings toggle, the matching-manager routing queue, and the
read-only feedback view.

#### Scenario: No member-list or mass-mail surface exists

- **WHEN** an admin looks for a member-management list or a mass-mail action
- **THEN** none is present in the code — only `AdminSettingsPage` (settings toggle),
  the routing queue, and `admin_list_feedback()` are available
