# ADR-0002: Staff-role authorization and the DKRI routing queue

**Status**: Accepted  **Date**: 2026-06-14  **Linear**: AGE-249

## Context

matching-spec §8 requires that large-volume (`dkri`) matches/requests be placed
into a manager/deal queue visible only to a `matching_manager`/`admin` role, instead
of going straight to direct contact release. Two things had no home in the schema:

1. **An authorization source for "staff".** The only role-like field is
   `profiles.roles` (`text[]`), but it is member-writable (`grant update(roles) to
   authenticated`, migration `20260613073842`) and exists purely to render
   professional chips ("Unternehmer · Investor · Deal Keeper"). A member could set
   their own `roles` to `admin`. It cannot gate access.
2. **A place to hold routed large-volume cases** with a manageable status.

The match engine (AGE-245) already derives `matches.routing` from the driving need's
`tx_volume_band`, and `src/config/matching.ts` already holds the configurable
threshold (`DKRI_VOLUME_BANDS` / `routingForBand`). This ADR covers the remaining
authorization + queue decisions.

## Decision

- **`staff_roles(profile_id, role)`** — a dedicated, server-controlled table.
  Provisioned out of band (service_role / admin SQL); the client gets `SELECT` on its
  **own row only** and no write grant. A `is_matching_manager()` SECURITY DEFINER
  helper (mirroring `is_prime_plus()`) backs both the RLS policies and the manager
  view's UI gating.
- **`routing_queue(match_id, need_id, volume_band, routing, status, assigned_to)`** —
  a thin queue, RLS-restricted to managers for `SELECT` and `UPDATE(status,
  assigned_to)`. Rows are inserted **only** by the existing contact-request lifecycle
  trigger (SECURITY DEFINER), never the client. `unique(match_id)` makes enqueue
  idempotent.
- **Enqueue at request time, additively.** A `dkri` row is created when a contact
  request is sent on a `dkri` match — the moment a member actually wants the deal —
  not when the engine merely suggests a match. The normal accept→thread release is
  left **unchanged**: Phase 1 is queue/visibility only. Gating the release behind
  manager action is the Phase-2 DKRI deal workflow (task item 4: "hier nur
  Queue/Sichtbarkeit").
- **`contact_requests.routing`** is stamped from the linked match by a BEFORE INSERT
  trigger, so each request carries its lane.

## Alternatives Rejected

- **Reuse `profiles.roles` for authz.** Rejected: member-writable → trivial privilege
  escalation. Kept strictly as a display descriptor.
- **`is_staff` boolean / role column on `profiles`.** Rejected: `profiles` has a broad
  Prime+ select policy and a public view; staff status would risk leaking, and a
  dedicated enum table models `matching_manager` vs `admin` more cleanly.
- **Populate the queue from the match engine** (when a `dkri` match is generated).
  Rejected: creates queue noise for matches nobody acted on and contradicts "statt
  direkter Freigabe" (release happens at request time).
- **DB settings table for the threshold.** Deferred: §8 explicitly allows the
  threshold to live in `src/config/matching.ts`, which already exists and is the
  single source for the frontend. A DB knob is over-engineering for Phase 1 (final
  threshold still to be confirmed with Detlev).

## Consequences

- Granting someone manager access is a deliberate, server-side `insert into
  staff_roles` — no UI, by design, for Phase 1.
- The queue accumulates one row per `dkri` match that received a request; status
  (`open → in_review → forwarded`) and `assigned_to` are the only manager-mutable
  fields. The actual deal handling (forwarding to DKRI, gating release) is Phase 2.
- `is_matching_manager()` is the single gate; the manager route and queue RLS both
  use it, so UI and DB cannot drift.
