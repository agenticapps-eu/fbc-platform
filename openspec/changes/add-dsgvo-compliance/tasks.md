# Tasks

## 1. Consent capture

- [ ] 1.1 Add a consent-record table (member, purpose, version, timestamp) with owner-only RLS and explicit grants
- [ ] 1.2 Record explicit consent at signup and block progress until it is given
- [ ] 1.3 Record consent at each action that processes personal data, referencing the purpose

## 2. Data-subject rights

- [ ] 2.1 Provide a self-service export of a member's own data
- [ ] 2.2 Provide an erasure request that deletes/anonymises the member's data

## 3. Audit log

- [ ] 3.1 Add an append-only audit-log table for access to and changes of sensitive data
- [ ] 3.2 Write audit entries server-side so a member cannot forge or suppress them

## 4. Cold-outreach legal gate

- [ ] 4.1 Require a documented, approved legal review before any cold / address-based messaging
- [ ] 4.2 Block the outreach path when no approved review exists

## 5. Verification

- [ ] 5.1 Test: signup without recorded consent cannot complete
- [ ] 5.2 Test: export returns the member's data; erasure removes it
- [ ] 5.3 Test: a sensitive-data change writes an audit entry the member cannot delete
- [ ] 5.4 Test: outreach without an approved legal review is rejected
