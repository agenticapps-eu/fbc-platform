## Reviewer: gemini

_generated 2026-07-26T09:14:43Z · timeout 180s_

VERDICT: REQUEST-CHANGES

- **Ambiguous Match Schema:** The spec does not define how a `match` is modeled between a `member` and an `acquisition_profile`. It's unclear if the `matches` table is being altered or how this new, polymorphic relationship is stored, which is a critical missing schema detail.
- **Missing PII/Consent Flow:** The spec is silent on how and when a member's PII is shared with Capital-Parks (or staff representing them) after a match is made. The process for member consent before sharing their data with an external ecosystem partner is not defined.
- **Undefined Lifecycle Management:** The lifecycle of an `acquisition_profile` (e.g., how it becomes "active", is deactivated, or archived) and `joint_ventures` (how they are updated or closed) is not specified.
- **Hardcoded Partner Assumption:** The data model appears to hardcode "Capital-Parks" as the only ecosystem partner. The `acquisition_profiles` table should be generic enough to support multiple partners in the future without requiring further schema changes.
- **Missing Traceability:** The `joint_ventures` table lacks a specified foreign key to link it back to the `accepted_match` or `platform_project` from which it originated, making the system's history difficult to audit.
  Created execution plan for SessionEnd: 2 hook(s) to execute in parallel
  Expanding hook command: CMUX_BIN="${TERMLOOP_BUNDLED_CLI_PATH:-$(command -v termloop)}"; { [ -n "$TERMLOOP_SURFACE_ID" ] || [ -n "$TERMLOOP_WORKSPACE_ID" ]; } && [ "$TERMLOOP_HOOKS_DISABLED" != "1" ] && [ "$TERMLOOP_GEMINI_HOOKS_DISABLED" != "1" ] && [ -n "$CMUX_BIN" ] && [ -x "$CMUX_BIN" ] && { "$CMUX_BIN" gemini-hook session-end >/dev/null 2>/dev/null || true; echo '{}'; } || echo '{}' (cwd: /Users/donald/Sourcecode/factiv/fbc-platform)
Expanding hook command: /Users/donald/.superset/hooks/gemini-hook.sh (cwd: /Users/donald/Sourcecode/factiv/fbc-platform)
Hook execution for SessionEnd: 2 hooks executed successfully, total duration: 58ms
Created execution plan for SessionEnd: 2 hook(s) to execute in parallel
Expanding hook command: CMUX_BIN="${TERMLOOP_BUNDLED_CLI_PATH:-$(command -v termloop)}"; { [ -n "$TERMLOOP_SURFACE_ID" ] || [ -n "$TERMLOOP_WORKSPACE_ID" ]; } && [ "$TERMLOOP_HOOKS_DISABLED" != "1" ] && [ "$TERMLOOP_GEMINI_HOOKS_DISABLED" != "1" ] && [ -n "$CMUX_BIN" ] && [ -x "$CMUX_BIN" ] && { "$CMUX_BIN" gemini-hook session-end >/dev/null 2>/dev/null || true; echo '{}'; } || echo '{}' (cwd: /Users/donald/Sourcecode/factiv/fbc-platform)
  Expanding hook command: /Users/donald/.superset/hooks/gemini-hook.sh (cwd: /Users/donald/Sourcecode/factiv/fbc-platform)
  Hook execution for SessionEnd: 2 hooks executed successfully, total duration: 36ms

## Reviewer: codex

_generated 2026-07-26T09:17:07Z · timeout 180s_

VERDICT: REQUEST-CHANGES

- Existing `matches` requires two member profile IDs; RLS, UI, contact requests, and uniqueness all assume member-to-member pairs. Define how a non-member acquisition source is represented and modify those existing requirements.
- Scoring is undefined: acquisition profiles lack the need/category, tier, interests, and competencies required by the six-component engine. Specify complementarity, missing-component handling, score threshold/basis, and volume-band routing semantics.
- Acquisition-profile RLS is incomplete. Specify SELECT/DELETE policies, the exact trusted staff role, `active` lifecycle, and whether commercially sensitive criteria may appear in member-visible match explanations.
- Acquisition-match lifecycle is missing: who can see, request, accept, or decline it; who receives contact requests; and how DKRI queueing works when the other endpoint is not a member.
- Venture formation lacks authorization and integrity rules. Define eligible callers, reject non-accepted sources, derive participants server-side, create venture and participants atomically, and make repeated/concurrent formation idempotent.
- `platform project` is undefined, including its table, eligible state, participant source, and relationship to a venture.
- RLS covers only `joint_ventures`. Members must also be denied INSERT/UPDATE/DELETE on `joint_venture_participants`; otherwise self-enrollment could grant venture access. Participant-roster SELECT must also prevent PII leakage.
- Add scenarios for forged participants, direct participant-table writes, inactive/updated acquisition profiles and stale matches, unauthorized or non-accepted venture sources, duplicate formation, transaction rollback, and non-participant access to the participant roster.

## Reviewer: opencode

_generated 2026-07-26T09:17:28Z · timeout 180s_

## Adversarial Review

**VERDICT: REQUEST-CHANGES**

Concrete issues:

**Correctness / spec completeness**

- The acquisition-profile scenarios never specify _how an ordinary member even sees_ acquisition-profile matches. Matching currently pairs member offers (seeker/offerer sides). If an acquisition profile is a "candidate source," is it a seeker, an offerer, or a third role? The delta avoids stating this, leaving the engine integration ambiguous.
- No scenario covers what happens when an acquisition profile matches **zero** members or when it should be deactivated (`active` flag exists implicitly but no scenario exercises deactivation/expiry). A "first-class source" that can't be retired is a correctness gap.
- "Staff" is referenced repeatedly but the spec never defines the staff role/invariant here. The `access-control` capability defines membership-tier rights, not staff mechanics — is staff RPC/authn assumed from elsewhere? Should be cited or reused, not silently assumed.
- `joint_ventures` formation: "accepted match or platform project" — but "platform project" is not defined anywhere in `matching` specs cited. If platform projects aren't an existing construct, this is circular/forward-reference; if they exist elsewhere, they must be cited as a dependency.
- No scenario defines the initial _state_ a new venture is in (draft/active/completed) nor any lifecycle transitions. "Turns into a tracked joint venture" implies tracking over time, but the delta captures only creation, no state evolution.
- No scenario defines what happens to the underlying match/project after venture formation (matched again? marked consumed? closed?). Without this, double-counting (same match → multiple ventures) is possible.

**Missing scenarios**

- Large-volume routing scenario covers `dkri` but doesn't handle the **inverse**: what `routing` does a _non_-large acquisition-profile match get? `fbc`? Something acquisition-specific? The scenario punts.
- No scenario for **PII exposure**: an acquisition profile (Capital-Parks entity) scored against member offers necessarily surfaces "this member matches your acquisition criteria" to the acquiring entity. The Impact claim "carries no access to member contact data beyond what matching already exposes" needs a scenario asserting the cap (and whether the acquiring entity can see member identity vs. just an aggregate count) — currently unverified.
- No scenario for **participants beyond the two matched members** (multi-party JV, staff added later, members leaving a JV). `joint_venture_participants` is append-only in the scenarios.
- No scenario for **deletion/archival** of ventures or acquisition profiles (retention/PII minimisation).
- No scenario asserting the **acquisition profile content itself** isn't PII-laden (free-text criteria could store member-targeted descriptions referencing individuals).

**Wrong assumptions**

- Assumes the rule-based engine can score against a _profile_ the same way as against a _member offer_. Member offers are structured by `sein/tun/haben/wirken`; an acquisition profile duplicates those fields — but the matching scoring function may rely on member-side invariants (e.g., membership tier weights, completeness) that don't apply to a non-member source. Not addressed.
- "Volume-based FBC/DKRI routing is unchanged" — but the existing routing is about _member_ transaction volume. Applying member-volume bands (`tx_volume_band`) to an acquirer is a semantic stretch: whose volume — the acquirer's target size or the matched member's actual volume? The scenario says "driven by a large-volume band" without saying whose band.

**Security / RLS**

- `acquisition_profiles` RLS: the requirement says writable "only through a server-controlled, staff-only ingest path." That's a positive statement but provides no negative scenario confirming **ordinary members can't even read** acquisition profiles (they must be readable for matching, but read scope is unspecified — all members? staff only? matched members only?). Read policy is a hole.
- No scenario asserting members cannot **UPDATE/DELETE** `joint_venture_participants` to add/remove themselves (a member could self-insert to gain read access to a venture they weren't party to, defeating the participant-only read RLS). Self-insert into participants is the classic RLS privilege-escalation and is unguarded in the scenarios.
- No scenario for staff override path audit logging on venture formation / acquisition-profile ingest (PII-relevant actions executed under staff role typically need an audit trail; spec is silent).

**Delta vs intent**

- The Why mentions "spin a joint venture out of an accepted match / platform project" and "venture-formation step" as a _platform capability_, but the delta only adds it under the `matching` capability. If ventures have their own lifecycle/visibility/state semantics, they likely belong in a new or adjacent capability (e.g., `ventures` or `ecosystem-jv`), not folded into matching where the rest is server-computed pair scoring. Coupling venture lifecycle to matching risks a malformed capability boundary.
- The "platform joint ventures" framing in the title promises more (venture tracking, deliverables, members, outcomes) than the delta delivers (two tables, three create/read scenarios). The delta's scope is narrower than the Why; either narrow the Why/title or expand the delta.
