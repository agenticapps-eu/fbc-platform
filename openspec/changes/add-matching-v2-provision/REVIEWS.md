## Reviewer: gemini

_generated 2026-07-26T09:03:08Z · timeout 180s_

VERDICT: REQUEST-CHANGES

- **Contradictory Gating Logic:** Requirement 1 gates the "standalone DKRI funnel" behind a paid member rank, while Requirement 3 specifies this funnel must be usable by non-members who have no rank. The spec must clarify which parts of the v2 feature set apply to which user type.
- **Missing Provision Data Model:** The spec doesn't define the schema for a `provision` entry. Key details like commission amount, percentage, currency, and calculation basis are missing.
- **Undefined Lifecycle:** The lifecycle for a provision entry is incomplete. What happens if a "brokered" deal is later cancelled or reverted? Is the provision entry deleted, voided, or amended?
- **Security & Abuse Vector:** The standalone DKRI funnel is described as open to non-members without authentication, creating a significant risk of spam or data-quality abuse. The spec omits any mitigation strategies (e.g., rate limiting, CAPTCHA).
- **PII Handling for Prospects:** The spec does not address how PII from non-FBC prospects will be collected, stored, and managed in compliance with privacy regulations like GDPR.
  Created execution plan for SessionEnd: 2 hook(s) to execute in parallel
  Expanding hook command: CMUX_BIN="${TERMLOOP_BUNDLED_CLI_PATH:-$(command -v termloop)}"; { [ -n "$TERMLOOP_SURFACE_ID" ] || [ -n "$TERMLOOP_WORKSPACE_ID" ]; } && [ "$TERMLOOP_HOOKS_DISABLED" != "1" ] && [ "$TERMLOOP_GEMINI_HOOKS_DISABLED" != "1" ] && [ -n "$CMUX_BIN" ] && [ -x "$CMUX_BIN" ] && { "$CMUX_BIN" gemini-hook session-end >/dev/null 2>/dev/null || true; echo '{}'; } || echo '{}' (cwd: /Users/donald/Sourcecode/factiv/fbc-platform)
Expanding hook command: /Users/donald/.superset/hooks/gemini-hook.sh (cwd: /Users/donald/Sourcecode/factiv/fbc-platform)
Hook execution for SessionEnd: 2 hooks executed successfully, total duration: 15ms
Created execution plan for SessionEnd: 2 hook(s) to execute in parallel
Expanding hook command: CMUX_BIN="${TERMLOOP_BUNDLED_CLI_PATH:-$(command -v termloop)}"; { [ -n "$TERMLOOP_SURFACE_ID" ] || [ -n "$TERMLOOP_WORKSPACE_ID" ]; } && [ "$TERMLOOP_HOOKS_DISABLED" != "1" ] && [ "$TERMLOOP_GEMINI_HOOKS_DISABLED" != "1" ] && [ -n "$CMUX_BIN" ] && [ -x "$CMUX_BIN" ] && { "$CMUX_BIN" gemini-hook session-end >/dev/null 2>/dev/null || true; echo '{}'; } || echo '{}' (cwd: /Users/donald/Sourcecode/factiv/fbc-platform)
  Expanding hook command: /Users/donald/.superset/hooks/gemini-hook.sh (cwd: /Users/donald/Sourcecode/factiv/fbc-platform)
  Hook execution for SessionEnd: 2 hooks executed successfully, total duration: 16ms

## Reviewer: codex

_generated 2026-07-26T09:03:52Z · timeout 180s_

VERDICT: REQUEST-CHANGES

- The paid-tier gate contradicts the standalone funnel: the funnel is defined as a gated v2 feature, but its users have no FBC profile or matching-tier rank. Specify whether it is public, separately paid, or exempt from the rank gate.
- Provision access is inconsistent: one requirement grants access based on paid rank, while another restricts reads to participants/managers. Define the exact intersection, including below-tier participants and manager bypass.
- “Exactly one” needs a database `UNIQUE(match_id)` invariant and atomic creation with the state transition; application-level idempotency alone does not prevent concurrent duplicates.
- Provision data is underspecified for an auditable commission: amount, currency, rate/basis snapshot, payer/payee, tax treatment, timestamps, status, reversals/refunds, reopening, and corrections are missing.
- The authoritative brokered/closed states and permitted transition paths are undefined. Include scenarios for invalid transitions, rollback/failure, retries, and reopened or cancelled deals.
- `SECURITY DEFINER` alone is not a sufficient security design. Require fixed `search_path`, `auth.uid()`-derived identity, authoritative database roles/ranks, restricted `EXECUTE`, least-privilege ownership, and explicit handling of missing or downgraded entitlements.
- Anonymous intake into a shared staff queue creates abuse and data-integrity risks. Require a narrow validated submission function/API, field allowlisting, rate limiting, bot/spam controls, request idempotency, and atomic intake/queue creation.
- PII handling for non-members is absent: specify consent/legal basis, privacy notice, data minimisation, retention/deletion, staff access, log redaction, and how prospects can exercise data-subject rights.
- Add denial scenarios for forged participant IDs, forged roles/ranks, direct table writes, unauthorized provision mutation/deletion, malformed intake, duplicate submissions, and queue-creation failure.

## Reviewer: opencode

_generated 2026-07-26T09:04:51Z · timeout 180s_

VERDICT: REQUEST-CHANGES

- **"brokered/closed state" is undefined.** The current schema's `matches.status` enum is `suggested/requested/accepted/declined` (`supabase/migrations/20260612065636_matching.sql:41`). The change never says whether `brokered`/`closed` is a new enum value, a separate column, or a status on a different table, nor what triggers the transition, who triggers it (manager? edge function?), or how it interacts with `accepted`. The spec reads as if the state already exists.

- **Internal contradiction between Req. 1 and Req. 3.** Req. 1 gates "the Matching v2 feature set (provision entries **and the standalone DKRI funnel**)" behind a paid matching-tier rank. Req. 3 says the standalone DKRI funnel MUST NOT read `profiles` tier or any FBC membership state. A non-FBC prospect by definition has no tier rank, so the funnel cannot both be tier-gated and tier-independent. The v2 gate and the DKRI funnel gate must be separated.

- **Provision RLS conflicts with v2 gate.** Req. 2 lets the deal's "two participants" read the provision entry; Req. 1 denies below-threshold members any v2 row. If one participant is below the paid matching rank, do they read their own deal's provision or not? Unspecified.

- **`routing_queue` schema cannot accept standalone intakes.** `routing_queue` has `constraint routing_queue_unique_match unique (match_id)` and is populated only by a trigger on `contact_requests` (`20260614120000_volume_routing_queue.sql:79, 157`). A standalone DKRI intake has no `match_id` (no FBC profiles, no match row), and routing_queue has no client INSERT grant. The change doesn't address the schema/constraint/trigger addition needed.

- **Non-FBC prospect has no representation.** `matches.a_profile_id`/`b_profile_id` are FKs to `profiles`. The spec says provision is "keyed to the match" but the DKRI funnel produces prospects with no `profiles` row. How is a provision keyed to a DKRI deal that has no match row? Unspecified.

- **`Prime+` terminology is stale.** Migration `20260715150000_six_level_model.sql:319` dropped `is_prime_plus()` and replaced it with `has_level(min_rank)`; the `membership-tiers` spec defines only `basic/connect/discover/exchange/focus/impact`. The proposal's "paid matching tier expressed as a rank threshold above the existing Prime+ gate" references a gate that no longer exists. The delta should phrase the new threshold as a `has_level(N)` rank.

- **Audit/PII gap on the DKRI funnel.** The funnel accepts a non-FBC prospect with no membership check. The access-control Kernprinzip says contact data is never implicitly disclosed; routing_queue managers reading prospect-supplied contact details (name, company, email) bypass the consent-based `profile_contacts` model. No scenario covers PII minimisation, consent, retention, or what fields the intake may collect.

- **No anti-abuse scenario.** An unauthenticated/unverified intake that feeds a staff queue with no membership, rate-limit, captcha, or verification scenario is an obvious spam/injection vector. The `tasks.md` also lacks any task for it.

- **Provision table shape unspecified.** "Auditable provision entry" but no scenario for monetary value, currency, VAT, payee (platform vs broker), immutability, clawback on deal failure, or retention. "Exactly one entry per match" handles idempotent creation but not reversal.

- **No scenario for deal failure/cancellation.** Only happy-path (brokered/closed) and re-brokering idempotency. What happens to the provision entry if a brokered deal is later unwound is not addressed.

- **"Written only by the server" mechanism unpinned.** Access-control spec requires trigger-only functions to carry no API-role EXECUTE grant. The change doesn't say whether the provision writer is a trigger on `matches.status` transition or an edge function under `service_role`, leaving the grant surface undefined.

- **Verification tasks are weaker than the spec scenarios.** Task 4.2 omits the "non-participant cannot read" scenario from Req. 2; task 4.1 covers only "provision features," not the standalone funnel gate; task 4.3 doesn't assert the negative case (intake acceptance does not read `profiles.tier`). Each spec scenario should have a matching verification task.

- **Spec delta is additive only.** `specs/matching/spec.md` Purpose still says "Matching v2 provisioning and the paid contact gate are only partially in place … deferred to a later level." Adding v2 requirements without a MODIFIED entry on the Purpose paragraph leaves the spec internally contradictory after archive.
