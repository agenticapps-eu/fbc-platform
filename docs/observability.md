# Observability — Sentry & Axiom

Two complementary tools, with a hard split of responsibilities:

| Tool       | Responsibility                                       | Surface                                  |
| ---------- | ---------------------------------------------------- | ---------------------------------------- |
| **Sentry** | **Errors & performance** — exceptions, crashes, traces, session replay on error | `@sentry/react` in the browser (`src/instrument.ts`) |
| **Axiom**  | **Structured events & logs** — domain funnels (signup → match → contact → event), and later Cloudflare request logs | Server-side ingest only (`/api/log` + Logpush) |

Rule of thumb: **if it threw, it's Sentry. If it happened, it's Axiom.**
A failed login is a Sentry error; a successful login is an Axiom event.

---

## Why a server-side proxy

The Axiom **ingest token is a write secret** and must never reach the browser
bundle (unlike the Sentry DSN, which is public by design). So client events do
**not** talk to Axiom directly. They POST to a Cloudflare Pages Function that
holds the token in its server-side env and forwards to Axiom:

```
Browser                         Cloudflare Pages Function            Axiom
─────────                       ─────────────────────────            ─────
logEvent("login")  ──POST──►    /api/log                  ──ingest──►  dataset
src/lib/log.ts     (no token)   functions/api/log.ts                  "fbc-platform"
                                (AXIOM_TOKEN from env)
```

- **`src/lib/log.ts`** — `logEvent(name, props?)`. Fire-and-forget, never throws,
  `keepalive: true` so the request survives a redirect (e.g. right after login).
  No token, no PII by default.
- **`functions/api/log.ts`** — `onRequestPost`. Validates the event against an
  allowlist, enriches it server-side (timestamp, Cloudflare country/colo/ray,
  user-agent), and ingests with a **raw `fetch`** to the Axiom EU edge endpoint.
  The token comes from `context.env`, never from the client. If Axiom rejects the
  request it returns **`502`** (not a silent `204`); a missing token/dataset is a
  no-op `204` so client logging never breaks the app.

### Why raw `fetch` and not `@axiomhq/js`

The task originally specified `@axiomhq/js`, but the SDK **does not run in the
Cloudflare Workers/Pages runtime (workerd)**: its `fetch-retry` dependency sets a
`cache` field on the request, which workerd doesn't implement
(`The 'cache' field on 'RequestInitializerDict' is not implemented`). The SDK
catches that internally and silently returns `ingested:0` — so it *appears* to
work but ingests nothing. It works fine under Node, which is the trap. The sister
project **cparx** hit the same wall and uses a raw `fetch` to the edge endpoint;
we do the same.

### EU edge endpoint (important)

The `fbc-platform` dataset lives in Axiom **EU (`eu-central-1`)**. EU datasets
must be ingested via the **edge host and path**, not the API host:

```
api.eu.axiom.co/v1/datasets/:dataset/ingest      → 403 forbidden
eu-central-1.aws.edge.axiom.co/v1/ingest/:dataset → 200 ✓   ← use this
```

The function defaults to `https://eu-central-1.aws.edge.axiom.co`. `AXIOM_URL`
is an **optional override** of that base — you normally don't need to set it.

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

### 1. Axiom dataset + token

1. In Axiom, create a dataset named **`fbc-platform`**
   (Settings → Datasets → New dataset).
2. Create an **API token with the *Ingest* action** scoped to that dataset
   (Settings → API tokens). An ingest token is write-only — it **cannot query**,
   so verify events in the Axiom UI, not with this token.
3. The dataset is in **EU (`eu-central-1`)**; the function already targets the EU
   edge by default, so no region setting is needed. (`AXIOM_URL` only exists as an
   override — see "EU edge endpoint" above.)

### 2. Store the secrets in Infisical

Server-only — **never** prefix with `VITE_`. We have two environments (`dev`,
`prod`); there is no `staging` env (see `docs/secrets.md`).

```bash
infisical secrets set AXIOM_TOKEN=xaat-xxxx      AXIOM_DATASET=fbc-platform --env=dev
infisical secrets set AXIOM_TOKEN=xaat-xxxx      AXIOM_DATASET=fbc-platform --env=prod
# AXIOM_URL is NOT needed (the function defaults to the EU edge). Set it only to
# override the ingest base.
```

### 3. Mirror to the deploy/CI platforms

The Pages Function reads these from the **Cloudflare Pages** project env, not
from Infisical at runtime.

- **Production: done (AGE-253)** — `AXIOM_TOKEN` + `AXIOM_DATASET` are set as
  encrypted secrets on the `fbc-platform` Pages project (Production). They are
  bound to a deployment at deploy time, so a redeploy is required after changing
  them. (`AXIOM_URL` only if overriding the EU edge default.)
- **Preview: not set yet** — preview deploys' `/api/log` is a no-op (returns
  `204`, drops the event) until the same secrets are added to the Preview env.
- GitHub Actions injects the build-time `VITE_*` vars via Infisical; the
  server-only `AXIOM_*` secrets live only on the Pages project, not in CI.

---

## Cloudflare Logpush → Axiom (Function logs)

This covers the **infrastructure** logs (Pages Function invocations, `console.*`
output, exceptions) — separate from the application events above.

**Status: activated via the Axiom app (AGE-253).**

### Finding (AGE-253): no manual Logpush endpoint

The original plan was a Cloudflare-side Logpush job pointing at a dedicated
Axiom dataset (`fbc-platform-cf`). **That path no longer exists**: Axiom has
retired its manual Logpush ingest endpoint — `…/v1/datasets/<ds>/ingest_logpush`
returns `404` on both `api.eu.axiom.co` and the edge host, and the plain
`/v1/datasets/<ds>/ingest` returns `403`. With no endpoint that answers
Cloudflare's **ownership challenge**, a hand-rolled Logpush job cannot validate.

### Supported path: the Axiom Cloudflare Logpush app

Axiom now supports **only** its app-side install (Axiom → Settings → Apps →
Cloudflare Logpush):

1. Create a Cloudflare API token — **Account → Logs: Edit** + **Account
   Settings: Read**, scoped to the account.
2. Install the app with that token; select the account-level **Workers Trace
   Events** dataset. (Skip "HTTP requests" — there is no zone for `*.pages.dev`.)
3. Axiom creates the Logpush job **and manages its own destination dataset**.

Caveats:

- The job is **account-wide** — it captures *all* Workers' trace events (cparx,
  callbot, fx-signal, …), not just this project. Isolate the Pages Functions at
  query time: `where ScriptName contains "9fb4b087"` (the `fbc-platform` Pages
  project id).
- The app does **not** use a hand-made dataset, so the originally-planned
  `fbc-platform-cf` dataset + ingest token are unused and can be deleted.
- App events (`/api/log` → **`fbc-platform`**) stay in their own dataset, so the
  funnels remain clean despite the shared infra-log dataset.
- The `console.*` logs from `functions/api/log.ts` are also visible ad-hoc via
  `wrangler pages deployment tail`.

---

## Verifying it works (Definition of Done)

Pages Functions do **not** run under plain `vite dev`. Use Wrangler or a deploy.

**Local (Wrangler):**

```bash
pnpm build
# inject the dev secrets and serve the built app + functions locally:
infisical run --env=dev -- npx wrangler pages dev dist
```

Then open `/styleguide` → section **Axiom (Dev)** → *„Test-Event an /api/log
senden"*, or:

```bash
curl -X POST http://localhost:8788/api/log \
  -H 'Content-Type: application/json' \
  -d '{"event":"login","props":{"test":true}}'
# → 204 No Content
```

Confirm in the **Axiom UI** (Stream, or the Query tab) — the ingest token is
write-only and can't query from the CLI:

```kusto
['fbc-platform'] | where event == "login" | order by _time desc | take 20
```

A row with `event: "login"`, `source: "web-client"`, `test: true` and a
`request.*` block confirms the path end-to-end. To prove failures aren't
silent: a bad token/endpoint makes `/api/log` return **`502`**, not `204`.

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
