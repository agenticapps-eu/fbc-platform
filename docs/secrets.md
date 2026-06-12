# Secret Management (Infisical)

All secrets for the FBC platform are managed centrally in
[Infisical](https://infisical.com). The repo contains **no real secret values** —
only placeholders (`.env.example`) and the project reference (`.infisical.json`,
which holds an ID, not a secret).

At runtime, `infisical run` fetches the secrets for the chosen environment and
injects them as environment variables into the wrapped command. That is why the
`dev`, `db:push`, and `build:prod` scripts in `package.json` are wrapped in
`infisical run --env=<env> -- …`.

`build` itself is **not** wrapped — it stays a plain `tsc && vite build` so CI
(and any environment without the Infisical CLI) can compile and bundle. Real
production `VITE_*` values are injected at the deploy platform (Cloudflare Pages
build env). Use `build:prod` for a local build with prod secrets pulled from
Infisical.

## Environments

One Infisical project (`fbc-platform`) with two environments mirroring our
deployment stages:

| Environment | Slug   | Used by                                |
| ----------- | ------ | -------------------------------------- |
| Development | `dev`  | `pnpm dev`, `pnpm db:push`, local work |
| Production  | `prod` | `pnpm build:prod`, production deploys  |

> On the free tier, per-environment access control isn't available. Splitting
> `dev`/`prod` into separate projects (for restricted prod visibility) is a
> later, paid-plan concern — for the prototype, two environments in one project
> is enough.

## First-time setup

The repo already ships `.infisical.json` (the project reference — an ID, not a
secret), so a new contributor only needs to authenticate:

1. Install the CLI: `brew install infisical/get-cli/infisical`.
2. Log in: `infisical login` (opens the browser; select the org that owns the
   `fbc-platform` project).
3. Verify: `pnpm dev` should start Vite with secrets injected, even while the app
   is still empty.

## Where each secret belongs

> **Rule:** anything prefixed `VITE_` is compiled into the **public** browser
> bundle. Never give a `VITE_` prefix to a value that must stay private.

### Client-exposed (`VITE_*`)

Stored in Infisical **and** later mirrored into the Cloudflare Pages build
environment, because Vite inlines them at build time.

| Key                     | Purpose                                  |
| ----------------------- | ---------------------------------------- |
| `VITE_SUPABASE_URL`     | Supabase project URL                     |
| `VITE_SUPABASE_ANON_KEY`| Supabase anon (public) key — RLS-gated   |
| `VITE_SENTRY_DSN`       | Sentry DSN for browser error reporting   |
| `VITE_ENVIRONMENT`      | `dev` / `staging` / `prod` runtime label |

### Server-only (never `VITE_`)

Stored in Infisical and consumed only by Pages Functions, Supabase, or CI. These
must **never** reach the client.

| Key                         | Purpose                                       |
| --------------------------- | --------------------------------------------- |
| `SUPABASE_SERVICE_ROLE_KEY` | Full-access Supabase key (bypasses RLS)       |
| `AXIOM_TOKEN`               | Axiom ingest token (events via `/api/log`)    |
| `AXIOM_DATASET`             | Axiom dataset name (`fbc-platform`)           |
| `AXIOM_URL` _(optional)_    | Override of the ingest edge base (defaults to EU edge) |
| `SENTRY_AUTH_TOKEN`         | Sentry CI token (source-map upload)           |
| `CLOUDFLARE_API_TOKEN`      | Cloudflare API token (Pages deploy)           |
| `RESEND_API_KEY`            | Transactional email — added in a later phase  |

## Setting and reading secrets

```bash
# Set a secret in a specific environment
infisical secrets set VITE_SUPABASE_URL=https://xyz.supabase.co --env=dev

# Set a server-only secret
infisical secrets set SUPABASE_SERVICE_ROLE_KEY=sk_xxx --env=prod

# List the secrets available in an environment (values masked unless you pass --plain)
infisical secrets --env=dev

# Run any command with secrets injected
infisical run --env=dev -- <command>
```

## Rules

- **Never commit real values.** Only `.env.example` (placeholders) and
  `.infisical.json` (project reference) are tracked. `.env` / `.env.*` are
  gitignored.
- **One source of truth.** Add a new secret in Infisical first, document the key
  here and in `.env.example`, then mirror it to Cloudflare Pages / CI only if it
  is needed there.
- **Respect the `VITE_` boundary** — see the rule above.
