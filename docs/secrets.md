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
| `RESEND_API_KEY`            | Resend API key for transactional email (`notify-contact-request`) |
| `FROM_EMAIL`                | Sender address for transactional email (e.g. `FBC <onboarding@resend.dev>`) |
| `CONTACT_WEBHOOK_SECRET`    | Shared secret the contact-request DB webhook sends as `Authorization: Bearer …` |
| `APP_URL` _(optional)_      | Base URL for the "Zum Chat"/"Anfrage ansehen" link in emails |

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

## Supabase Edge Function secrets (`notify-contact-request`, AGE-247)

The transactional-email function (spec `docs/matching-spec.md` §7) reads its
secrets from the **Supabase Functions secret store**, not from the Vite/Pages
runtime. Push them from Infisical so the values never live in the repo:

```bash
# Push the function secrets from Infisical's dev env into Supabase.
# (--silent keeps the values off your terminal; --plain emits KEY=value pairs.)
infisical export --env=dev --format=dotenv --plain \
  | grep -E '^(RESEND_API_KEY|FROM_EMAIL|CONTACT_WEBHOOK_SECRET|APP_URL)=' \
  > /tmp/fbc-fn.env
supabase secrets set --env-file /tmp/fbc-fn.env
rm -f /tmp/fbc-fn.env

# …or set them one-off, reading each value from Infisical at call time:
infisical run --env=dev -- sh -c \
  'supabase secrets set RESEND_API_KEY="$RESEND_API_KEY" FROM_EMAIL="$FROM_EMAIL" \
     CONTACT_WEBHOOK_SECRET="$CONTACT_WEBHOOK_SECRET" APP_URL="$APP_URL"'
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected into every Edge
Function by the platform — do **not** set them here.

### Deploy + wire the webhook

```bash
supabase functions deploy notify-contact-request   # verify_jwt=false (see config.toml)
```

The webhook is a **`pg_net` trigger** on `public.contact_requests` (Insert +
Update) that POSTs the Supabase-webhook-shaped payload to the function with the
bearer token. It is applied **directly to the live DB, not as a committed
migration**, because the token can't be in git and Supabase Vault writes are
permission-locked on this project (`_crypto_aead_det_noncegen` — owned by
`supabase_admin`). The token therefore lives inline in the trigger function in
the DB, exactly as Supabase's own Dashboard webhooks store their auth header;
it is readable only with DB-admin access. Reapply with the real token swapped in:

```sql
create extension if not exists pg_net;

create or replace function public.notify_contact_request_webhook()
  returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform net.http_post(
    url     := 'https://<project-ref>.supabase.co/functions/v1/notify-contact-request',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer <CONTACT_WEBHOOK_SECRET>'),  -- not in git
    body    := jsonb_build_object(
                 'type', tg_op, 'table', tg_table_name, 'schema', tg_table_schema,
                 'record', to_jsonb(new),
                 'old_record', case when tg_op='UPDATE' then to_jsonb(old) else null end));
  return null;
end; $$;
revoke execute on function public.notify_contact_request_webhook() from public, anon, authenticated;

create trigger contact_requests_email_webhook
  after insert or update on public.contact_requests
  for each row execute function public.notify_contact_request_webhook();
```

The function rejects any request whose bearer doesn't match its
`CONTACT_WEBHOOK_SECRET` (401).

> **Sender domain (open point with Detlev):** until a verified FBC domain with
> DKIM/SPF exists, use a verified **Resend test domain** as `FROM_EMAIL`
> (e.g. `onboarding@resend.dev`). This is a transition — swap in the real domain
> once it's set up.
