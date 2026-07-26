# Add admin console: member list, bulk mail, CRM and topic newsletters

## Why

The built admin surface is limited to the platform-settings toggle, the
matching-manager routing queue, and the read-only feedback view; the member-list
and mass-mail capability is explicitly not implemented (`admin`). Staff still run
outreach out of Odoo. Phase 2 replaces that with an in-platform admin console:
a filterable member list, bulk email to segments, an in-platform CRM, and
topic-based newsletters with honored opt-in/opt-out. Linear: **AGE-304** (member
list, bulk mail, newsletter actions), **AGE-301** (in-platform CRM replacing
Odoo) and **AGE-305** (topic newsletter opt-in/out).

## What Changes

- Add an admin member-list view (filters, `is_admin()`-gated) that returns
  **non-contact** fields only — no email/phone.
- Add a bulk-email action whose recipients are resolved **server-side** from a
  validated segment definition, honouring the shared suppression list, individualised
  delivery, campaign idempotency, and a step-up + rate-limit on mass-send.
- Add an in-platform CRM surface (contact list, filters, outreach) whose outreach is
  written to the **shared privacy audit log**, not a parallel log.
- Add topic newsletters that default to **opt-out**, apply the per-topic filter
  server-side at send, and carry an unsubscribe link.

## Impact

- Affected capability: `admin`.
- **Depends on** `add-dsgvo-compliance` (privacy audit log) and
  `add-lifecycle-notifications` (suppression list): one audit log and one suppression
  list, not parallel stores.
- Removes the "Admin member management is not implemented" requirement (explicit
  `## REMOVED` block in the delta).
- New tables: CRM contacts/outreach and a per-`(member, topic)` subscription record;
  explicit grants; all mutations DB-enforced.

## Out of scope (named follow-up)

- **Odoo data migration / cutover** (part of AGE-301) — importing/deduplicating
  existing Odoo contacts and the cutover are a separate change; this delivers the
  CRM surface only.
- Granular per-action admin permissions — future; a single `is_admin()` gate plus
  mass-send step-up is used now.
