# Add ecosystem acquisition profiles as a matching source

## Why

Phase 4 (Ökosystem) extends matching beyond member-to-member complementarity: an
ecosystem partner's acquisition profile (starting with Capital-Parks — what it is
looking to acquire) should be ingested as a matching source so members' offers can
be scored against its criteria. Today `matching` only pairs members. Linear:
**AGE-307**. Joint ventures from platform projects (**AGE-308**) are split out (see
Out of scope) — that construct needs its own capability and a defined "platform project".

## What Changes

- Store ecosystem acquisition profiles under a **generic partner** model (Capital-Parks
  first), staff-ingested and `active`-flagged; ordinary members never read/write them.
- Score member offers against active acquisition profiles with the existing
  server-side engine, recording results in a **separate `acquisition_matches` table**
  keyed `(member, acquisition_profile)` — `matches` stays strictly member-to-member.
- Keep it **staff-mediated**: acquisition matches surface to matching managers; the
  member's identity/contact is not disclosed to the acquirer until the member consents.

## Impact

- Affected capability: `matching`.
- New tables: `acquisition_profiles` (staff-only) and `acquisition_matches`
  (server-written). No change to `matches` (member-to-member invariant preserved),
  contact-request rules, or member-side scoring.
- Member-side weights (tier/completeness) are not applied to the non-member source.
- Consistent with "contact data is never implicitly disclosed": no member PII reaches
  the acquiring partner without consent.

## Out of scope (named follow-up)

- **Joint ventures from platform projects (AGE-308)** — its own change under a new
  `ventures` capability: define "platform project", venture lifecycle, atomic
  idempotent formation, and participant-table RLS that blocks member self-insert.
