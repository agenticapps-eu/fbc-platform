# create-checkout-session

Creates a Stripe **Checkout Session** (subscription, test-mode) for a
membership-level upgrade — AGE-259.

`POST /functions/v1/create-checkout-session`, body `{ level, interval }`
(`interval: "month" | "year"`) → `{ url }`. The client redirects the browser
to that URL.

This function does **not** set the member's tier. It only validates the
requested change is an upgrade and asks Stripe to open a session; the tier is
written later by `stripe-webhook` after `checkout.session.completed`
(webhook = source of truth).

## Auth

`verify_jwt = true` — the client calls with its own user JWT. The function
reads the caller's current tier (`profiles.tier` → `membership_tiers.level_rank`)
and rejects the request (400) if the target level is not a paid level above
the caller's current rank, is unknown, or the interval isn't `month`/`year`.

## Secrets / deploy

Secrets come from Infisical → `supabase secrets set` (see
[`docs/secrets.md`](../../../docs/secrets.md)):

- `STRIPE_SECRET_KEY`
- `STRIPE_PRICE_DISCOVER_YEAR`, `STRIPE_PRICE_DISCOVER_MONTH`
- `STRIPE_PRICE_EXCHANGE_YEAR`, `STRIPE_PRICE_EXCHANGE_MONTH`
- `STRIPE_PRICE_FOCUS_YEAR`, `STRIPE_PRICE_FOCUS_MONTH`
- `STRIPE_PRICE_IMPACT_YEAR`, `STRIPE_PRICE_IMPACT_MONTH`
- `APP_URL` (optional, falls back to `http://localhost:5173`)

`SUPABASE_URL` / `SUPABASE_ANON_KEY` are platform-injected. Missing key or
price env fails closed (500 `server_misconfigured`).

Deploy: `supabase functions deploy create-checkout-session`.

## Tests

Pure logic (`parseUpgradeRequest`, `priceEnvKey`) is unit-tested; `index.ts`
is the integration shell (auth + Stripe REST via `fetch`, no SDK) and has no
network unit test.

```bash
cd supabase/functions/create-checkout-session
deno test          # 6 tests
deno check index.ts
```
