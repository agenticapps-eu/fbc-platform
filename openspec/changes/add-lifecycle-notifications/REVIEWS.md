## Reviewer: gemini

_generated 2026-07-26T09:00:58Z · timeout 180s_

VERDICT: REQUEST-CHANGES

- **Missing state tracking for lifecycle mails:** The requirement for sending lifecycle emails "at most once" is not satisfiable as written. The spec is missing a mechanism (e.g., a `sent_mails` table or similar) to track which emails have been sent to which members, making re-runs of the sender unsafe.
- **Ambiguous bell UI behavior:** The spec is unclear on the exact user action that marks a notification as read. Is it opening the bell, clicking a single notification, or a "mark all as read" action? This ambiguity could lead to a frustrating user experience.
- **Undefined nudge cadence and limits:** The condition "due a nudge" is undefined. The spec needs to specify the frequency (e.g., 24 hours after signup, then 3 days later) and a hard limit for sending onboarding nudges to avoid spamming members who never intend to complete the process.
- **Potential lack of unsubscribe/consent mechanism:** The introduction of non-transactional "nudge" emails raises potential compliance issues (e.g., GDPR). The spec does not mention user consent for these emails or provide an unsubscribe path, which is a requirement for non-essential communications.
  Created execution plan for SessionEnd: 2 hook(s) to execute in parallel
  Expanding hook command: CMUX_BIN="${TERMLOOP_BUNDLED_CLI_PATH:-$(command -v termloop)}"; { [ -n "$TERMLOOP_SURFACE_ID" ] || [ -n "$TERMLOOP_WORKSPACE_ID" ]; } && [ "$TERMLOOP_HOOKS_DISABLED" != "1" ] && [ "$TERMLOOP_GEMINI_HOOKS_DISABLED" != "1" ] && [ -n "$CMUX_BIN" ] && [ -x "$CMUX_BIN" ] && { "$CMUX_BIN" gemini-hook session-end >/dev/null 2>/dev/null || true; echo '{}'; } || echo '{}' (cwd: /Users/donald/Sourcecode/factiv/fbc-platform)
Expanding hook command: /Users/donald/.superset/hooks/gemini-hook.sh (cwd: /Users/donald/Sourcecode/factiv/fbc-platform)
Hook execution for SessionEnd: 2 hooks executed successfully, total duration: 14ms
Created execution plan for SessionEnd: 2 hook(s) to execute in parallel
Expanding hook command: CMUX_BIN="${TERMLOOP_BUNDLED_CLI_PATH:-$(command -v termloop)}"; { [ -n "$TERMLOOP_SURFACE_ID" ] || [ -n "$TERMLOOP_WORKSPACE_ID" ]; } && [ "$TERMLOOP_HOOKS_DISABLED" != "1" ] && [ "$TERMLOOP_GEMINI_HOOKS_DISABLED" != "1" ] && [ -n "$CMUX_BIN" ] && [ -x "$CMUX_BIN" ] && { "$CMUX_BIN" gemini-hook session-end >/dev/null 2>/dev/null || true; echo '{}'; } || echo '{}' (cwd: /Users/donald/Sourcecode/factiv/fbc-platform)
  Expanding hook command: /Users/donald/.superset/hooks/gemini-hook.sh (cwd: /Users/donald/Sourcecode/factiv/fbc-platform)
  Hook execution for SessionEnd: 2 hooks executed successfully, total duration: 15ms

## Reviewer: codex

_generated 2026-07-26T09:02:04Z · timeout 180s_

VERDICT: REQUEST-CHANGES

- “Exactly one Resend email” is not achievable as written across retries/crashes. Define a durable send ledger/outbox, unique occurrence key, idempotency behavior, and retry semantics for failed or ambiguous sends.
- “Occurrence,” lifecycle eligibility, scheduling, timezone, cadence, and concrete lifecycle mail types are undefined; “due a nudge” is circular and not testable.
- Onboarding nudges need an initial delay, repeat interval, maximum count, and race handling when onboarding completes after job selection but before sending.
- Email requirements omit verified-address checks, unsubscribe/preferences, suppression/bounce handling, disabled/deleted users, and classification of transactional versus marketing mail.
- The scheduled sender’s authorization is unspecified. Require server-only invocation, least-privilege access, tenant scoping, and protection of recipient PII in logs and send-history retention.
- RLS ownership alone does not restrict which columns an owner may update. Require bell operations to mutate only `read_at`, using a server timestamp, and confirm the existing policy/grants actually permit `SELECT` and constrained `UPDATE`.
- Bell behavior is ambiguous: the title says opening the bell marks notifications read, while the scenario says viewing one notification. Specify whether one item or all visible items are marked, plus failed-update and concurrent-new-notification behavior.
- Referencing AGE-261 as an onboarding “full build” is misleading: the delta assumes an authoritative completion state but neither defines that state nor specifies the onboarding flow.

## Reviewer: opencode

_generated 2026-07-26T09:02:42Z · timeout 180s_

VERDICT: REQUEST-CHANGES

- **"Completed onboarding" is never defined.** The only related concept in the schema is `profiles.profile_completion` (an int, 0–100, server-managed). The delta uses "completed onboarding" / "not completed onboarding" as if it were a boolean, but no threshold, field, or definition is introduced. Task 3.1 ("track onboarding completion state per member") has no corresponding ADDED Requirement, so the spec delta does not actually capture the tracking mechanism. Define it (threshold on `profile_completion`, or a new `onboarded_at`/`onboarding_state` field) and add a Requirement for how it is computed and who can mutate it.
- **Nudge cadence is undefined.** "is due a nudge" is circular. There is no Requirement specifying when/how often nudges fire (initial delay, repeat interval, max count, quiet hours, timezone), so the "stop once complete" scenario is the only constraint. Without a cadence Requirement the system can spam a member daily and still satisfy the spec.
- **Idempotency mechanism is unspecified.** The Requirement says "at most once per member per occurrence" but never introduces a persistence record for that fact (no `lifecycle_mails` / `notification_log` table, no unique key on `(member_id, lifecycle_type, occurrence)`). The scenario asserts the behaviour; the Requirement does not state how it is enforced, so the delta does not capture intent for the implementation or a reviewer.
- **No Requirement for the scheduled sender's privilege boundary.** A scheduled lifecycle sender must enumerate all members and their email addresses server-side, which is a new SECURITY-DEFINER / service-role path that bypasses the owner-only `notifications_own` RLS the capability currently rests on. The Impact claim "no RLS change" understates this: the delta adds a privileged reader of member PII with no Requirement covering its scoping, audit logging, or least-privilege execution.
- **No bounce/failure/retry semantics.** Resend can fail, rate-limit, or bounce. There is no Requirement distinguishing "logged as sent" vs "successful delivery," no dead-letter / retry / backoff, and the "sent once" scenario silently breaks if a send fails after the idempotency row is written (or vice versa).
- **No consent / unsubscribe / marketing-classification Requirement.** Lifecycle and onboarding nudges are non-transactional and likely qualify as marketing under GDPR/DSGVO (the repo already has `add-dsgvo-compliance` running). There is no Requirement tying sends to consent state, no suppression-list / unsubscribe handling, and no scenario for opted-out members. This is a PII/legal gap.
- **No scenario for members without an email.** The existing transactional requirement explicitly handles "recipient without an email is skipped"; the new lifecycle/onboarding Requirements have no equivalent, so behaviour for email-less profiles is unspecified.
- **Naming collision with the existing Requirement.** The current spec already has "Transactional lifecycle email" (contact-request). The new Requirement is titled "Lifecycle mails are sent via Resend beyond the transactional email," reusing "lifecycle" for a different mechanism (scheduled bulk vs per-event transactional). Disambiguate the terminology (e.g., "scheduled lifecycle mails" vs "transactional contact-request email") so the two do not blur in the same capability.
- **Bell scenarios are underspecified / ambiguous.** "Opening the bell marks notifications read" conflates opening the bell with viewing a single notification — unclear whether it is auto-mark-all-on-open or per-item. Missing scenarios: empty state (zero notifications), a member with no `notifications` rows at all, and the RLS-rejection path when something tries to mark another member's row. Also no Requirement for how the unread count is kept fresh (poll vs realtime subscription) — relevant because the bell "reflects unread" is a live invariant, not a one-shot read.
- **No Requirement that the sender skips deleted / suspended / non-member profiles.** `profiles` cascade handles FK, but there is no scenario for soft-deleted or disabled accounts, so the sender could attempt to email former members.
- **PII logging minimization missing.** Lifecycle mail systems commonly log recipients/bodies. There is no Requirement that logs exclude email addresses, payload contents, or Resend message IDs surfaced to clients — relevant given the new privileged path.
- **Tasks ↔ delta mismatch.** Task 3.1 ("track onboarding completion state per member") and Task 2.2 ("define nudge eligibility … not re-sent repeatedly") describe mechanisms (state field + idempotency log) that have no corresponding ADDED Requirements. The delta currently captures only observable behaviour, not the data-model changes that make it enforceable.
