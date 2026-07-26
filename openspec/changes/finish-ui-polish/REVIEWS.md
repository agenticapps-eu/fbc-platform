## Reviewer: gemini

_generated 2026-07-26T09:11:30Z · timeout 180s_

VERDICT: REQUEST-CHANGES

- **Undefined Threshold**: The spec repeatedly refers to a "reveal threshold" that determines who can see a full name, but never defines what that threshold is. It's impossible to implement or verify this change without a concrete definition of which tiers can see names and which cannot.
- **Undefined Masked Label**: The spec is ambiguous about what the "masked label" should be for a logged-in but below-threshold viewer. It could be interpreted as the existing "Mitglied" fallback, but it should be explicitly stated.
- **Missing Self-View Scenario**: The spec does not describe what happens when a user views their own profile. A user should always be able to see their own full name, and this should be a required scenario.
- **Potentially Misleading Title**: The title "Finish UI polish" buries the lead. The most critical part of this change is the server-side, PII-gating logic for name resolution, which is a security and privacy feature, not UI polish.
- **Narrow Impact Analysis**: The change claims to only affect `directory-search`. Are there other API endpoints or features (e.g., messaging, event details, comments) that expose full names? If so, they must also be subject to this new server-side enforcement, otherwise the PII protection is incomplete.
  Created execution plan for SessionEnd: 2 hook(s) to execute in parallel
  Expanding hook command: CMUX_BIN="${TERMLOOP_BUNDLED_CLI_PATH:-$(command -v termloop)}"; { [ -n "$TERMLOOP_SURFACE_ID" ] || [ -n "$TERMLOOP_WORKSPACE_ID" ]; } && [ "$TERMLOOP_HOOKS_DISABLED" != "1" ] && [ "$TERMLOOP_GEMINI_HOOKS_DISABLED" != "1" ] && [ -n "$CMUX_BIN" ] && [ -x "$CMUX_BIN" ] && { "$CMUX_BIN" gemini-hook session-end >/dev/null 2>/dev/null || true; echo '{}'; } || echo '{}' (cwd: /Users/donald/Sourcecode/factiv/fbc-platform)
Expanding hook command: /Users/donald/.superset/hooks/gemini-hook.sh (cwd: /Users/donald/Sourcecode/factiv/fbc-platform)
Hook execution for SessionEnd: 2 hooks executed successfully, total duration: 14ms
Created execution plan for SessionEnd: 2 hook(s) to execute in parallel
Expanding hook command: CMUX_BIN="${TERMLOOP_BUNDLED_CLI_PATH:-$(command -v termloop)}"; { [ -n "$TERMLOOP_SURFACE_ID" ] || [ -n "$TERMLOOP_WORKSPACE_ID" ]; } && [ "$TERMLOOP_HOOKS_DISABLED" != "1" ] && [ "$TERMLOOP_GEMINI_HOOKS_DISABLED" != "1" ] && [ -n "$CMUX_BIN" ] && [ -x "$CMUX_BIN" ] && { "$CMUX_BIN" gemini-hook session-end >/dev/null 2>/dev/null || true; echo '{}'; } || echo '{}' (cwd: /Users/donald/Sourcecode/factiv/fbc-platform)
  Expanding hook command: /Users/donald/.superset/hooks/gemini-hook.sh (cwd: /Users/donald/Sourcecode/factiv/fbc-platform)
  Hook execution for SessionEnd: 2 hooks executed successfully, total duration: 14ms

## Reviewer: codex

_generated 2026-07-26T09:14:02Z · timeout 180s_

VERDICT: REQUEST-CHANGES

- The delta uses `ADDED` requirements but leaves the existing requirement stating tiered resolution is “not yet implemented.” Modify/remove that requirement and its pending scenario.
- The reveal threshold is undefined. Specify the exact `level_rank`, owner/self behavior, missing-tier behavior, and what “opted-out viewer” means.
- Server enforcement is incomplete: `profiles_public` currently exposes `name` to every authenticated tier and is consumed by feed, events, matching, and profile surfaces. The delta must cover every name-bearing read path and update affected capabilities, including `member-profiles`.
- The below-threshold directory scenario may be unreachable: `/mitglieder` and `search_directory` already gate other members at Discover/rank 3. Define how the new threshold composes with that gate.
- Masking the returned `name` alone can still leak names through full-text search against `search_doc`, raw-name ordering, or other returned free-text fields. Add non-disclosure/oracle scenarios.
- Logout cache isolation is a security requirement, not mere client polish. Add a scenario ensuring user A’s cached data cannot appear after logout or a principal change; “invalidate” is insufficient because it retains cached data.

## Reviewer: opencode

_generated 2026-07-26T09:14:14Z · timeout 180s_

VERDICT: REQUEST-CHANGES

- **Ambiguous reveal threshold**: The spec says "clears the reveal threshold" but never defines which tier that is. The 6-level model (`basic→connect→discover→exchange→focus→impact`) needs an explicit cutoff (e.g., "≥ discover") or the requirement is untestable and implementations will diverge.
- **Undefined masked label**: "masked label" is used everywhere but never specified. Requirement 1's third scenario calls it the "Mitglied" fallback; Requirement 2 just says "only the masked label is returned." Name the literal value and whether it's the same string as the anonymous fallback, or a tier-graduated one (e.g., first name only for mid tiers).
- **Missing self-row exception**: No scenario states a member sees their own full name regardless of tier. Without it, the server-side gate could mask a member viewing their own directory entry, or implementers will special-case it ad hoc.
- **No PII/field-scope statement**: "full name" is undefined — is it `profiles.full_name` only, or does the gate also apply to contact fields (email, phone) already governed by `contact-requests`? The spec should state what is in scope or the delta may be read as covering all PII.
- **Implementation-leak / unverifiable "viewing caller's tier"**: Tier is a property of the requester, but the requirement conflates "viewer" (UI) and "caller" (API). State explicitly that the gate keys off the authenticated token's tier at the read path, not a client-supplied parameter, or the security intent ("MUST NOT be the boundary") is underspecified.
- **Inconsistent threshold term passed-through**: The proposal's "Impact" section claims "no change to … the membership-rank full-row gate" but the spec delta introduces a _name_ sub-gate above the existing _row-visibility_ gate (`profiles.is_public`). The delta should state the precedence/layering: row-visibility gate → name-reveal gate → masked label, so the two gates don't conflict on the `is_public=true / below-threshold` combination.
- **Missing scenario for opted-out viewer**: "lower/opted-out viewers" appears in the proposal prose but there's no scenario or definition for "opted-out." If opt-out is a profile flag, it belongs in the scenarios; if it's just "below threshold," the prose is misleading.
- **Empty `tasks.md` claim is untestable from the change text**: The change asserts the three client items carry "no spec change," but AGE-258 (clear React Query cache on logout) is a security-relevant data-bleed invariant. Consider whether it warrants a small spec delta under `access-control` or `messaging` rather than being left undocumented — otherwise a future change can regress it silently.
