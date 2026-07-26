# Add DSGVO compliance controls (consent, DSAR, audit)

## Why

The platform enforces access and visibility in the database, but it has no
DSGVO/GDPR machinery: lawful basis is not recorded per purpose, consent is not
captured or withdrawable, members cannot obtain an access/portability export or
erasure of their data, and sensitive-data access is not audited. Linear:
**AGE-260** (DSGVO package). The cold-outreach legal-review gate (**AGE-306**) is
split out to its own future change (see Out of scope).

## What Changes

- Introduce a dedicated **`privacy`** capability (not access-control) for these controls.
- Record an Art. 6 **lawful basis per purpose**; use consent only where consent is
  the basis (directory, matching, and the audit log run on contract/legitimate interest).
- Capture **versioned, withdrawable** consent; halt dependent processing on
  withdrawal or on a policy-version bump, until re-consent. Consent gates processing,
  not account provisioning.
- Provide **DSAR**: Art. 15 access + Art. 20 portability export (machine-readable,
  own-data only) and erasure (own-data only).
- Bound **erasure against retention duties** — consent/withdrawal evidence, audit
  entries, and issued invoices (HGB/AO) are preserved; erasure also removes
  `auth.users` and revokes sessions.
- Record a **tamper-evident, append-only audit log** (INSERT-only, no UPDATE/DELETE
  for any client role; privileged side is the sole writer).

## Impact

- New capability: `privacy`. No change to the tier-authority model; consent does
  not gate account provisioning.
- New consent-record and audit-log tables. Consent record is owner-readable with
  explicit grants; the audit log is INSERT-only for all client roles (owner-only RLS
  is insufficient for an append-only log).
- Depends on nothing, but interacts with `add-easybill-invoicing`: issued invoices
  are a retention carve-out from erasure.

## Out of scope (named follow-ups)

- **Cold-outreach legal-review gate (AGE-306)** — deferred to its own change; no
  cold-/address-based messaging surface exists yet (today's surface is
  `contact_requests`), and German §7 UWG generally requires prior consent regardless.
- Rectification, restriction, objection, privacy notices, breach-notification, and
  configurable retention policy — separate DSGVO follow-ups.
