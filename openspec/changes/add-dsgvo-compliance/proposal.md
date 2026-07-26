# Add DSGVO compliance controls

## Why

The platform enforces access and visibility in the database, but it has no
DSGVO/GDPR machinery: consent is not captured explicitly at signup or at the
actions that process personal data, members cannot obtain an export or deletion
of their data, sensitive data access is not audited, and cold, address-based
outreach can be sent without a documented legal review. Linear: **AGE-260**
(DSGVO package) and **AGE-306** (legal check for cold outreach).

## What Changes

- Capture explicit, recorded consent at signup and at any action that processes
  personal data.
- Provide data-subject rights: a member can export their own data and request
  erasure of it.
- Record an audit log of access to and changes of sensitive member data.
- Gate any cold-outreach / address-based messaging behind a documented legal
  review that must be approved before such messages may be sent.

## Impact

- Affected capability: `access-control`.
- New consent-record and audit-log tables (with owner-only RLS + explicit grants,
  consistent with the deny-by-default model); a legal-review gate applied to the
  outreach path.
- No change to the tier-authority model or to the contact-request consent flow;
  these controls sit alongside them.
