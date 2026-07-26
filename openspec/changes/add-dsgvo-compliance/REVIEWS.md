## Reviewer: gemini

_generated 2026-07-26T08:58:14Z · timeout 180s_

VERDICT: REQUEST-CHANGES

- **Vague Definitions:** Key terms like "personal data," "sensitive member data," and "cold outreach" are not defined, leaving the implementation scope ambiguous. The spec should link to or provide concrete data classifications.
- **Missing Consent Lifecycle:** The spec correctly requires consent to be recorded, but fails to specify the mandatory processes for consent withdrawal and for re-obtaining consent after a policy update.
- **Incomplete Erasure Process:** The data erasure requirement omits critical exceptions, such as legal holds or the requirement to retain financial records, and doesn't specify if erasure requests are propagated to third-party services.
- **Under-specified Data Export:** The data export requirement doesn't specify that the export must be provided in a common, machine-readable format (e.g., JSON), which is a core part of the right to data portability.
- **Ambiguous Legal Review:** The "legal review" for cold outreach is an abstract concept. The spec needs to define the workflow: who can create, approve, or revoke a review, and how is a specific outreach campaign tied to a specific, approved review record?
  Created execution plan for SessionEnd: 2 hook(s) to execute in parallel
  Expanding hook command: CMUX_BIN="${TERMLOOP_BUNDLED_CLI_PATH:-$(command -v termloop)}"; { [ -n "$TERMLOOP_SURFACE_ID" ] || [ -n "$TERMLOOP_WORKSPACE_ID" ]; } && [ "$TERMLOOP_HOOKS_DISABLED" != "1" ] && [ "$TERMLOOP_GEMINI_HOOKS_DISABLED" != "1" ] && [ -n "$CMUX_BIN" ] && [ -x "$CMUX_BIN" ] && { "$CMUX_BIN" gemini-hook session-end >/dev/null 2>/dev/null || true; echo '{}'; } || echo '{}' (cwd: /Users/donald/Sourcecode/factiv/fbc-platform)
Expanding hook command: /Users/donald/.superset/hooks/gemini-hook.sh (cwd: /Users/donald/Sourcecode/factiv/fbc-platform)
Hook execution for SessionEnd: 2 hooks executed successfully, total duration: 15ms
Created execution plan for SessionEnd: 2 hook(s) to execute in parallel
Expanding hook command: CMUX_BIN="${TERMLOOP_BUNDLED_CLI_PATH:-$(command -v termloop)}"; { [ -n "$TERMLOOP_SURFACE_ID" ] || [ -n "$TERMLOOP_WORKSPACE_ID" ]; } && [ "$TERMLOOP_HOOKS_DISABLED" != "1" ] && [ "$TERMLOOP_GEMINI_HOOKS_DISABLED" != "1" ] && [ -n "$CMUX_BIN" ] && [ -x "$CMUX_BIN" ] && { "$CMUX_BIN" gemini-hook session-end >/dev/null 2>/dev/null || true; echo '{}'; } || echo '{}' (cwd: /Users/donald/Sourcecode/factiv/fbc-platform)
  Expanding hook command: /Users/donald/.superset/hooks/gemini-hook.sh (cwd: /Users/donald/Sourcecode/factiv/fbc-platform)
  Hook execution for SessionEnd: 2 hooks executed successfully, total duration: 14ms

## Reviewer: codex

_generated 2026-07-26T08:59:29Z · timeout 180s_

VERDICT: REQUEST-CHANGES

- Consent is incorrectly treated as the universal lawful basis. GDPR Article 6 permits several bases; mandatory signup consent may not be “freely given.” Specify a lawful basis per purpose and require consent only where that is the chosen basis. [GDPR Articles 6–7](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32016R0679)
- Consent lacks withdrawal, revocation timestamps, purpose granularity, proof of the affirmative act, policy-text evidence, and behavior after withdrawal.
- Rights are limited to authenticated members, excluding prospects, deleted-account users, and other non-member data subjects whose information the platform holds.
- “Export” conflates Article 15 access with Article 20 portability. Define identity verification, secure delivery, statutory response timing, applicable format, and required metadata such as purposes, recipients, sources, and retention periods.
- Erasure is too unconditional. Specify Article 17 exceptions, legal holds, irreversible anonymisation, processor/recipient propagation, backups, deadlines, and how append-only audit evidence survives erasure.
- Audit coverage is ambiguous: the scenario covers only “privileged paths,” leaving ordinary reads, background jobs, exports, direct database access, and failed attempts unaddressed. Define sensitive fields, actor/subject/purpose/result, retention, authorized readers, and tamper evidence.
- “Owner-only RLS” conflicts with server-written audit logs and legitimate DPO/security access. Explicitly define member, service, auditor, legal-reviewer, and administrator permissions.
- Legal-review approval alone does not make outreach lawful. Bind approval to campaign, channel, audience, jurisdiction, source, purpose, expiry, and approver; enforce opt-outs and send-time revalidation across queues, retries, bulk sends, and third parties. German electronic outreach generally requires prior consent unless the narrow §7(3) exception applies. [UWG §7](https://www.gesetze-im-internet.de/uwg_2004/__7.html)
- The `access-control` delta does not fully capture the stated “DSGVO package”: it omits rectification, restriction, objection, privacy notices, retention/minimisation, processor handling, and breach obligations—or must explicitly narrow its compliance claim.

## Reviewer: opencode

_generated 2026-07-26T09:00:36Z · timeout 180s_

VERDICT: REQUEST-CHANGES

- **Erasure contradicts the retention duties the same change introduces.** "Erasure SHALL remove or anonymise the member's data" would delete the consent record (Art. 7 evidence) and audit-log entries (Art. 30 / legitimising trail) that GDPR _requires_ be retained. No carve-out is specified, so the two requirements are mutually inconsistent. Add a retention-vs-erasure boundary with explicit in-scope/out-of-scope tables and storage-limitation periods per Art. 5(1)(e).

- **No withdrawal of consent.** Art. 7(3) makes withdrawal as easy as granting. `policy_version` is in the schema but no scenario covers re-consent on a policy bump, nor revocation after grant. Requirement is materially incomplete.

- **`policy_version` column is dead weight.** It's stored but never used in any scenario: there's no "processing that relied on an old version MUST halt until re-consent." Without that scenario the column is just documentation.

- **Audit-log tamper-resistance is mis-modeled in RLS terms.** The impact section promises "owner-only RLS" for both new tables. For an append-only audit log, owner-only RLS does nothing to stop the owner deleting their own rows — you need INSERT-only grants with no UPDATE/DELETE for _anyone_ (including the owner, including `authenticated`). The described model is wrong for the audit table; it conflates the consent-record (owner-readable) and audit-log (member-readable, not member-writable) access models.

- **`service_role` bypass is unaddressed for audit integrity.** The existing spec notes `service_role` bypasses RLS; edge functions and admin paths then _can_ forge or suppress audit entries. The "written server-side so a member cannot forge" guarantee holds only on the `authenticated` surface. No scenario asserts privileged-side integrity.

- **"Sensitive member data" is undefined.** No enumeration of columns/tables, so the requirement is untestable and the audit trigger surface is unspecified. Also, RLS SELECT reads don't naturally emit a write side-effect; capturing reads server-side implies a PostgREST bypass / view + function funnel with perf cost the change never acknowledges.

- **Lawful basis is collapsed into consent.** GDPR Art. 6 lists six bases; consent is one. Directory visibility, contact-request matching, and the audit log itself cannot all lawfully run on "consent." The requirement over-extends consent into processing where contract/legitimate-interest is the correct basis — that is itself a correctness problem.

- **Export and erasure scope is undefined.** "Personal data held for that member" must enumerate the canonical tables (profiles, profile_contacts, contact_requests from/to ids, messages, feed posts, event_registrations, audit entries, consent rows, …), or the requirement is unverifiable. No scenario covers cascade: erasing a member referenced by another member's accepted contact request breaks the counterparty's consented expectation.

- **auth-layer erasure is absent.** Supabase `auth.users` deletion, session/refresh-token revocation, and any external processor data (note: already flagged in `add-easybill-invoicing`) are not mentioned. Erasure that stops at the app tables is not GDPR-complete.

- **Cold-outreach legal-review scope is unspecified.** "Per outreach," per campaign, or per template? Who approves (`is_matching_manager()`? `is_admin()`? external counsel)? Does an approval expire? No revocation/expiry scenario, so the "fail closed" claim is only statically true. Also, the "outreach path" is never named against existing tables — the existing surface is `contact_requests`; "cold / address-based messaging" may be a _new_ capability being smuggled in as a gate, which needs a capability boundary, not just a gate.

- **Self-PII of the audit log.** The audit log stores who/what/when about actors — that is itself personal data subject to the export/erasure requirement just above. The two requirements are circular with no reconciliation.

- **"Account cannot be provisioned" conflates auth with processing.** Existing `handle_new_user` trigger creates the profile at auth time, before contact data exists. Granting signup consent as a hard precondition to account existence vs. to consent-dependent _processing_ are different designs; the requirement doesn't pick one, and the contact-requests capability already has its own accepted-state gate. State the granularity.

- **Spec-delta placement.** Export, erasure, and a legal-review gate are arguably a distinct `privacy` / `ds-gvo` capability, not extensions of `access-control`. Lumping them under access-control and then asserting "no change to tier-authority model" is not obviously true — the outreach approver needs a staff authority that overlaps `is_matching_manager()`, which lives in access-control's authority model today.

- **Tasks list is missing**: withdrawal flow, re-consent on policy bump, retention periods, service_role-side audit integrity, sensitive-data enumeration, export-scope-by-subject enumeration, and auth-layer erasure. The verification tasks (5.1–5.4) therefore cannot fully prove the requirements even if they pass.
