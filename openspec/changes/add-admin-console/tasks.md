# Tasks

## 1. Admin member list

- [ ] 1.1 Add a `SECURITY DEFINER` RPC that returns members with filterable fields, gated on `is_admin()`
- [ ] 1.2 Build the admin member-list UI with filters under `/admin`

## 2. Bulk / mass email

- [ ] 2.1 Add a bulk-mail action that targets a selected member segment
- [ ] 2.2 Gate the send on `is_admin()` and record which segment was sent to

## 3. In-platform CRM

- [ ] 3.1 Add an admin-only CRM contact list with filters (replacing Odoo)
- [ ] 3.2 Record outreach against a contact, readable only to admins

## 4. Topic newsletters

- [ ] 4.1 Add a per-member, per-topic subscription record the member can opt in/out of
- [ ] 4.2 On a topic newsletter send, include only members opted in to that topic

## 5. Verification

- [ ] 5.1 Test: a non-admin cannot read the member list or CRM
- [ ] 5.2 Test: a bulk mail targets only the selected segment
- [ ] 5.3 Test: a member opted out of a topic is excluded from that topic's newsletter
