# Tasks

## 1. Admin member list

- [ ] 1.1 `SECURITY DEFINER` RPC returning filterable non-contact fields, gated on
      `is_admin()` (fixed `search_path`, `auth.uid()` identity, `EXECUTE` to API roles);
      excludes email/phone
- [ ] 1.2 Build the admin member-list UI with filters under `/admin`

## 2. Bulk / mass email

- [ ] 2.1 Represent a segment as a server-side **segment definition**; resolve the
      recipient set server-side (never from client-supplied ids/addresses)
- [ ] 2.2 Consult the shared suppression list (add-lifecycle-notifications); exclude
      suppressed/invalid-email members; individualised delivery; idempotent per campaign key
- [ ] 2.3 Require step-up confirmation + rate-limit on mass-send; gate on `is_admin()`
- [ ] 2.4 Write an audit entry (actor, segment, exclusions, result) to the privacy
      audit log (add-dsgvo-compliance)
- [ ] 2.5 Handle Resend bounces/complaints; a hard bounce flags the member globally

## 3. In-platform CRM

- [ ] 3.1 Admin-only CRM contact list with filters; enforce read AND mutation
      (INSERT/UPDATE/DELETE) in the database
- [ ] 3.2 Record outreach against a contact into the shared privacy audit log
      (not a separate parallel log)

## 4. Topic newsletters

- [ ] 4.1 One row per `(member, topic)`, own-row RLS, default **opted-out**
      (missing record = opted-out)
- [ ] 4.2 Topic send gated on `is_admin()`, per-topic filter applied server-side,
      suppressed members excluded, unsubscribe link included; empty send is a no-op
- [ ] 4.3 Unsubscribe-link path sets the member's topic subscription to opted-out

## 5. Verification

- [ ] 5.1 Test: a non-admin cannot read the member list, CRM, or mutate CRM rows
- [ ] 5.2 Test: the member-list RPC never returns email/phone
- [ ] 5.3 Test: a bulk send resolves recipients server-side, excludes suppressed
      members, and is idempotent per campaign key
- [ ] 5.4 Test: a member opted out of a topic (or with no record) is excluded from
      that topic's newsletter; an empty send is a no-op

## Out of scope (named follow-up)

- **Odoo data migration / cutover (part of AGE-301)** — importing, deduplicating,
  and reconciling existing Odoo contacts, and the cutover itself, are a separate
  change; this change delivers the in-platform CRM surface only.
- Granular per-action admin permissions (`can_list_members`, `can_send_bulk_email`,
  …) — future; this change uses a single `is_admin()` gate plus mass-send step-up.
