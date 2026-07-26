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

- Add an admin member-list view with filters, gated on `is_admin()`.
- Add a bulk/mass-email action that sends to a selected segment of members.
- Add an in-platform CRM surface (contact list, filters, outreach) as an
  admin-only capability, replacing the external Odoo workflow.
- Add topic-based newsletters where each member's per-topic opt-in/opt-out is
  recorded and honored when a topic newsletter is sent.

## Impact

- Affected capability: `admin`.
- New admin-only read surfaces (member list, CRM) gated by `is_admin()` in the
  database, with the frontend acting only as convenience gating.
- New bulk-mail and topic-newsletter send actions plus a per-member,
  per-topic subscription record that members control.
- Supersedes the "Admin member management is not implemented" note in the
  current `admin` spec (that requirement is expected to be removed on archive).
