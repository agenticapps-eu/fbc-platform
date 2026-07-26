## Reviewer: gemini

_generated 2026-07-26T09:05:17Z · timeout 180s_

VERDICT: REQUEST-CHANGES

- **PII Exposure:** The spec authorizes returning full "member rows" and a "contact list" to admins. This is too broad and risks exposing sensitive PII unnecessarily. The requirements should be scoped to return only the specific data fields essential for the task, adhering to the principle of least privilege.
- **Email Compliance Gaps:** The bulk-email feature lacks a mandatory unsubscribe mechanism, which is a legal requirement (CAN-SPAM/GDPR). Additionally, the newsletter feature doesn't specify the default subscription state (it should be opt-out by default) or mention a global unsubscribe list that must always be honored.
- **Missing Audit Trails:** Accessing the entire member database and sending bulk emails are highly sensitive operations. The spec is missing a requirement for immutable audit logs to track which admin performed these actions, on what data, and when.
- **Abuse Vectors:** The bulk email feature lacks any mention of rate limiting, content review, or an "oops" cancelation mechanism. This creates a significant risk of spam or abuse from a compromised admin account.
- **Oversimplified Access Control:** The spec relies entirely on a single, monolithic `is_admin()` gate. This is a brittle, all-or-nothing security model. The design should use granular permissions (e.g., `can_list_members`, `can_send_bulk_email`) to support different admin roles and responsibilities in the future.
  Created execution plan for SessionEnd: 2 hook(s) to execute in parallel
  Expanding hook command: CMUX_BIN="${TERMLOOP_BUNDLED_CLI_PATH:-$(command -v termloop)}"; { [ -n "$TERMLOOP_SURFACE_ID" ] || [ -n "$TERMLOOP_WORKSPACE_ID" ]; } && [ "$TERMLOOP_HOOKS_DISABLED" != "1" ] && [ "$TERMLOOP_GEMINI_HOOKS_DISABLED" != "1" ] && [ -n "$CMUX_BIN" ] && [ -x "$CMUX_BIN" ] && { "$CMUX_BIN" gemini-hook session-end >/dev/null 2>/dev/null || true; echo '{}'; } || echo '{}' (cwd: /Users/donald/Sourcecode/factiv/fbc-platform)
Expanding hook command: /Users/donald/.superset/hooks/gemini-hook.sh (cwd: /Users/donald/Sourcecode/factiv/fbc-platform)
Hook execution for SessionEnd: 2 hooks executed successfully, total duration: 16ms
Created execution plan for SessionEnd: 2 hook(s) to execute in parallel
Expanding hook command: CMUX_BIN="${TERMLOOP_BUNDLED_CLI_PATH:-$(command -v termloop)}"; { [ -n "$TERMLOOP_SURFACE_ID" ] || [ -n "$TERMLOOP_WORKSPACE_ID" ]; } && [ "$TERMLOOP_HOOKS_DISABLED" != "1" ] && [ "$TERMLOOP_GEMINI_HOOKS_DISABLED" != "1" ] && [ -n "$CMUX_BIN" ] && [ -x "$CMUX_BIN" ] && { "$CMUX_BIN" gemini-hook session-end >/dev/null 2>/dev/null || true; echo '{}'; } || echo '{}' (cwd: /Users/donald/Sourcecode/factiv/fbc-platform)
  Expanding hook command: /Users/donald/.superset/hooks/gemini-hook.sh (cwd: /Users/donald/Sourcecode/factiv/fbc-platform)
  Hook execution for SessionEnd: 2 hooks executed successfully, total duration: 14ms

## Reviewer: codex

_generated 2026-07-26T09:07:04Z · timeout 180s_

VERDICT: REQUEST-CHANGES

- The delta only adds requirements; it never removes the existing normative “SHALL NOT provide” member-list/mass-mail requirement. Add an explicit `REMOVED` requirement—Impact prose does not resolve the contradiction.
- Topic-newsletter sending has no admin authorization requirement or unauthorized-send scenario. Any callable send path must enforce `is_admin()` server-side.
- Bulk mail targets the segment regardless of consent, conflicting with newsletter opt-outs. Define transactional versus marketing mail and require send-time filtering by topic consent, global suppression/unsubscribe, account status, and valid email.
- Subscription semantics are incomplete: define missing-record/default behavior, migration for existing members, own-row RLS for every operation, and how opt-outs during queued delivery are honored.
- The client-selected “segment” is a trust-boundary flaw. Recipients must be resolved server-side from an authorized, validated segment definition—not accepted as client-supplied addresses or IDs.
- Mass delivery lacks recipient-confidentiality, idempotency, and audit requirements. Require individualized/BCC-safe delivery, retry-safe campaign/outbox keys, and a PII-minimized record of actor, audience definition, exclusions, and delivery results.
- CRM authorization covers reads but not non-admin INSERT/UPDATE/DELETE. Specify database enforcement for all contact/outreach mutations, exact exposed PII fields, and hardened `SECURITY DEFINER` behavior and grants.
- “Replacing Odoo” is not captured: there are no requirements for migration scope, deduplication, reconciliation, retention, or cutover, so the proposed CRM cannot verifiably replace the existing workflow.

## Reviewer: opencode

_generated 2026-07-26T09:07:48Z · timeout 180s_

VERDICT: REQUEST-CHANGES

- **Collides with the parallel DSGVO change.** `add-dsgvo-compliance` (AGE-306) introduces a documented legal-review gate for any cold, address-based outreach, plus a consent/audit-log machinery. This change adds a bulk/segment mass-email action and an in-platform CRM for "outreach" with **no reference** to that gate, no consent check, no audit log, no legal-basis field. The two changes are specified as if the other didn't exist. The Impact section must call out the dependency and the bulk-send requirement must be subordinate to the DSGVO legal-review gate (or be explicitly scoped to _opted-in_ segments only), otherwise this change ships a DSGVO violation.

- **Bulk-email requirement ignores per-recipient opt-out.** Only the _topic newsletter_ requirement honors opt-in/opt-out. The "Bulk email to a member segment" requirement says the send is delivered "only to the members in the chosen segment" — there is no scenario where a member who has globally unsubscribed / not consented is excluded, and no per-recipient suppression list. A member in the segment who opted out of all marketing must still be excluded. Add a scenario + a "global do-not-email" predicate that the bulk path MUST consult.

- **PII exposure in the member list is unspecified.** The member-list RPC returns "member rows" but says nothing about whether it bypasses `profile_contacts` / `member_settings` / `goals` RLS, what columns it returns, or whether email/phone are included. Per `member-profiles` spec, contact data is owner-only until contact-request acceptance — a `SECURITY DEFINER` RPC that returns emails to admins would silently override that invariant. State explicitly which columns are exposed and that contact data is NOT included (or that explicit admin-read consent exists).

- **CRM outreach entries vs. DSGVO audit log are conflated.** "Outreach recorded against a contact" is exactly the sort of sensitive-data access the DSGVO audit-log requirement covers. The CRM should write to the same audit log, not a separate parallel record; otherwise you get two competing outreach logs.

- **"Replaces the external Odoo workflow" is unverified.** The Impact claims the CRM supersedes Odoo, but no migration/data-ingest requirement, no cutover, and no scenario covers what happens to existing Odoo contacts. Either state explicitly that the Odoo cutover is out of scope for this change, or add a migration requirement + task.

- **`is_admin()` is necessary but not sufficient for bulk send.** Tier authority (`membership-tiers` `current_tier_rank()`) is not relevant here, but an admin sending bulk email is acting on _others'_ data — the spec should state the action also requires a confirmed-identity / MFA/step-up check for mass-send specifically (a CSRF/stolen-key caution), since a leaked admin session becomes a platform-wide email blast. At minimum add a rate-limit + confirmation scenario.

- **Resend provider + bounce/handling not specified.** The `notifications` spec uses Resend for transactional email. Bulk send has delivery, bounce, spam-complaint, and suppression-list obligations (Resend suppresses hard bounces automatically). No requirement covers bounces/complaints, and a bounce on a member should arguably flag them globally. Add a scenario.

- **Topic subscription table is unspecified at the schema level.** "recorded against that topic for their own profile only" — but is it one row per (member, topic)? Does it default to opted-in or opted-out? Per GDPR default must be opt-out (no pre-ticked boxes) — the spec should state the default state and that the member may opt out at any time, plus an unsubscribe link in every newsletter (legal requirement, not optional). Missing scenario: member subscribes via the email's unsubscribe-link path.

- **Missing scenario: admin excludes an opted-out member from a send.** The newsletter requirement has a scenario only for the member side and a generic "only opted-in receive it" assertion; no scenario asserts that an admin who selects "all members" and a topic sees the opted-out members automatically removed from the recipient set (the per-topic predicate must be applied server-side in the send, not just trusted from a UI checkbox).

- **Missing negative scenario: empty/null topic list.** What happens when a topic newsletter is sent but zero members are subscribed (or all opted out)? Send must complete as a no-op without error, and there should be a scenario for it.

- **Archive note is contradictory.** Impact says the "Admin member management is not implemented" requirement "is expected to be removed on archive" — but this is a spec delta (ADD only); there is no MODIFIED or REMOVED block on that requirement in the delta shown. OpenSpec deltas must explicitly remove it; otherwise the archived change leaves a contradiction with the new "Admin member list with filters" requirement. Add a `## REMOVED Requirements` block referencing the existing requirement.

- **No task linkage to spec deltas for the CRM/outreach audit trail.** If CRM outreach must write to the DSGVO audit log, the tasks file should reflect that dependency; otherwise the change is internally consistent but violates the sibling change's invariant.
