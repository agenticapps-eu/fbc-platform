# Observability — Sentry & structured event logs

Two complementary surfaces, with a hard split of responsibilities:

| Tool       | Responsibility                                       | Surface                                  |
| ---------- | ---------------------------------------------------- | ---------------------------------------- |
| **Sentry** | **Errors & performance** — exceptions, crashes, traces, session replay on error | `@sentry/react` in the browser (`src/instrument.ts`) |
| **Workers Logs** | **Structured events** — domain funnels (signup → match → contact → event) | Server-side only, via `/api/log` |

Rule of thumb: **if it threw, it's Sentry. If it happened, it's an event log.**
A failed login is a Sentry error; a successful login is a logged event.

---

## Axiom was removed (ADR-0037, 2026-08-10)

This page previously described Axiom as the event/funnel store. That
destination is gone across the whole fleet: it was ingest-priced, and the
structured JSON line every event already produces is captured natively by each
runtime's own log product. There is **no `AXIOM_TOKEN`, no `AXIOM_DATASET`, no
`AXIOM_URL`** any more — nothing to place in Pages, CI, or a secret store.

**Read the tradeoff before relying on this.** Workers Logs is a log store, not
an analytics store. The funnel queries this doc used to describe
(`['fbc-platform'] | where event=="login"`) have no direct equivalent: you get
log search and retention, not aggregation over long windows. If funnel
analysis becomes load-bearing for a decision, that is the point to pick a real
analytics destination — and the `/api/log` endpoint is already the right place
to add one, because every event passes through it.

**Operator action outstanding:** revoke the Axiom ingest token at Axiom itself
and delete `AXIOM_TOKEN` / `AXIOM_DATASET` / `AXIOM_URL` from the Cloudflare
Pages project and from CI. Deleting the code does not invalidate the token.

---

## Why the endpoint still exists

It no longer holds a secret, but `/api/log` still earns its place: it validates
`event` against a server-side allowlist, caps `props` size, and enriches each
record with `cf` fields and a server `_time` that client input cannot
overwrite. Those are server responsibilities and must not move into the client.

```
Browser                         Cloudflare Pages Function       Workers Logs
─────────                       ─────────────────────────       ────────────
logEvent("login")  ──POST──►    /api/log               ──JSON──►  stdout
src/lib/log.ts     (no token)   functions/api/log.ts              (no secret)
```

- **`src/lib/log.ts`** — `logEvent(name, props?)`. Fire-and-forget, never throws,
  `keepalive: true` so the request survives a redirect (e.g. right after login).
  No token, no PII by default.
- **`functions/api/log.ts`** — `onRequestPost`. Validates the event against an
  allowlist, caps `props` size, enriches it server-side (timestamp, Cloudflare
  country/colo/ray, user-agent), and writes one JSON line to stdout. Always
  answers `204` on an accepted event and `400` on a rejected one; there is no
  egress left that could fail, so the `502` path is gone.

### Domain events (the funnel)

The allowlist is defined in **both** `src/lib/log.ts` (`DomainEvent` type) and
`functions/api/log.ts` (`ALLOWED_EVENTS`) — keep them in sync.

| Event                       | Fires when…                          | Wired today?                    |
| --------------------------- | ------------------------------------ | ------------------------------- |
| `signup`                    | `supabase.auth.signUp` succeeds      | ✅ `AuthProvider`               |
| `login`                     | `signInWithPassword` succeeds        | ✅ `AuthProvider`               |
| `match_suggested`           | a match is proposed                  | ⏳ matching feature not built   |
| `contact_request_sent`      | a contact request is sent            | ⏳ contact feature not built    |
| `contact_request_accepted`  | a contact request is accepted        | ⏳ contact feature not built    |
| `event_registered`          | a user registers for an event        | ⏳ events feature not built     |

The four `⏳` events are defined now so the type/allowlist is complete; their
`logEvent(...)` call is added when the corresponding feature lands.

---

## Setup (one-time, external — not in the repo)

### Secrets: none

There is nothing to provision. The endpoint reads no environment variable, so
there is no Infisical entry, no Cloudflare Pages secret, and no CI variable to
mirror. `/api/log` behaves identically on production, preview and local
`wrangler pages dev` — which it previously did not, because preview deploys
never had the Axiom secrets and silently dropped every event.

**Decommission checklist (operator, once):**

1. Revoke the `fbc-platform` ingest token in Axiom.
2. `infisical secrets delete AXIOM_TOKEN AXIOM_DATASET --env=dev` (and `prod`).
3. Delete `AXIOM_TOKEN` / `AXIOM_DATASET` / `AXIOM_URL` from the Cloudflare
   Pages project (Production **and** Preview), then redeploy — Pages binds env
   at deploy time.
4. Delete the Axiom dataset if you do not want to retain the historical events.


## Cloudflare Logpush → Axiom — DECOMMISSION (was: infrastructure logs)

This covered **infrastructure** logs (Pages Function invocations, `console.*`
output, exceptions) via Axiom's Cloudflare Logpush app, separate from the
application events above.

**Status: to be decommissioned.** ADR-0037 removed Axiom from the fleet, and
this is the last thing still shipping to it — and the one that keeps the bill
alive even with every `AXIOM_TOKEN` deleted, because the Logpush job is
configured **account-side in the Axiom app**, not in this repo. Nothing in a
code change can turn it off.

**Operator steps (Axiom + Cloudflare dashboards):**

1. Axiom → Settings → Apps → **Cloudflare Logpush** → uninstall. This deletes
   the Logpush job it created and the dataset it manages.
2. Cloudflare → Account → API Tokens → revoke the token issued for that app
   (**Logs: Edit** + **Account Settings: Read**).
3. Delete any leftover datasets (`fbc-platform`, and `fbc-platform-cf` if it
   was ever created) once you no longer need the history.

**Read this before uninstalling — it is account-wide.** The job captured *all*
Workers trace events across the account (cparx, callbot, fx-signal-agent, …),
not just this project. Removing it removes that view for **every** repo in the
fleet, not only `fbc-platform`. Nothing in this repo depended on it, but
confirm the same for the others before you pull it.

**What replaces it:** `wrangler pages deployment tail` for live output, and
Cloudflare **Workers Logs** (`[observability] enabled = true`) for retained,
queryable logs per project — native to the runtime, no external ingest.

---

## Verifying it works (Definition of Done)

Pages Functions do **not** run under plain `vite dev`. Use Wrangler or a deploy.

**Local (Wrangler):**

```bash
pnpm build
# no secrets to inject any more — serve the built app + functions locally:
npx wrangler pages dev dist
```

Then open `/styleguide` → section **Event-Log (Dev)** → *„Test-Event an
/api/log senden"*, or:

```bash
curl -X POST http://localhost:8788/api/log \
  -H 'Content-Type: application/json' \
  -d '{"event":"login","props":{"test":true}}'
# → 204 No Content
```

The record is a JSON line in the Wrangler output (and, when deployed, in
Workers Logs / `wrangler pages deployment tail`):

```json
{"test":true,"_time":"…","event":"login","source":"web-client","request":{…}}
```

`event: "login"`, `source: "web-client"`, `test: true` and a `request.*` block
confirm the path end-to-end. Note this now works **identically** in preview and
local dev — previously both silently dropped events because only production had
the Axiom secrets.

---

## Files

| File                      | Role                                                |
| ------------------------- | --------------------------------------------------- |
| `src/lib/log.ts`          | Client logger — `logEvent()`, fire-and-forget       |
| `functions/api/log.ts`    | Server proxy — validates, enriches, ingests to Axiom|
| `functions/tsconfig.json` | Workers-types typecheck for Pages Functions         |
| `src/instrument.ts`       | Sentry init (errors/performance) — unrelated to Axiom|

## Open follow-ups

- Add `pnpm typecheck:functions` to the CI `verify` job so the Function can't
  rot untyped (not wired yet to keep this change surgical).
- No rate-limiting on `/api/log` — only a payload-size cap and event allowlist.
  Add abuse protection (e.g. Turnstile / per-IP limit) before heavy public use.
- `@axiomhq/js` is intentionally **not** a dependency (incompatible with workerd —
  see above). Revisit only if Axiom ships a Workers-safe build.
