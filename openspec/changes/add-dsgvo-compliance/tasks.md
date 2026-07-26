# Tasks

## 1. Lawful basis & consent

- [ ] 1.1 Enumerate processing purposes with their Art. 6 lawful basis; mark which
      require consent (directory/matching/audit are contract/legitimate-interest, not consent)
- [ ] 1.2 Consent-record table (member, purpose, policy_version, affirmative-act
      evidence, granted_at, withdrawn_at) — owner-readable RLS, explicit grants
- [ ] 1.3 Capture consent for consent-based purposes; gate only the dependent
      processing, not account provisioning
- [ ] 1.4 Withdrawal flow (as easy as granting) that halts dependent processing;
      re-consent required on policy-version bump

## 2. Data-subject rights

- [ ] 2.1 Enumerate the tables holding a member's personal data (profiles,
      profile_contacts, contact_requests, messages, feed posts, event_registrations,
      consent rows, …)
- [ ] 2.2 Art. 15 access + Art. 20 portability export in a common machine-readable
      format, own-data only
- [ ] 2.3 Erasure that deletes/anonymises app data AND removes `auth.users` +
      revokes sessions, own-data only

## 3. Retention boundary

- [ ] 3.1 Define retention carve-outs (consent/withdrawal evidence, audit entries,
      issued invoices under HGB/AO); erasure preserves these while removing the rest

## 4. Audit log

- [ ] 4.1 Enumerate the sensitive fields placed under audit
- [ ] 4.2 Append-only audit-log table: INSERT-only grants, no UPDATE/DELETE for any
      client role including the subject and `authenticated`
- [ ] 4.3 Privileged side (`service_role` / edge functions) is the sole writer;
      assert integrity on the privileged surface, not only the authenticated one

## 5. Verification

- [ ] 5.1 Test: a consent-based purpose is blocked without consent; a
      contract-based purpose is not gated
- [ ] 5.2 Test: withdrawal halts dependent processing; a superseded policy version
      forces re-consent
- [ ] 5.3 Test: export returns own data (portable format) across the enumerated
      tables, never another member's
- [ ] 5.4 Test: erasure anonymises/deletes app data + removes `auth.users`, but
      retains invoices/audit/consent evidence
- [ ] 5.5 Test: no client role (including the subject) can UPDATE or DELETE audit rows

## Out of scope (named follow-ups)

- Cold-outreach legal-review gate (**AGE-306**) — to be proposed as its own change
  once a real outreach surface exists (today's surface is `contact_requests`).
- Rectification, restriction, objection, privacy notices, breach-notification, and
  configurable retention policy — separate DSGVO follow-ups.
