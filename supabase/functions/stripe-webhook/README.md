# stripe-webhook

Stripe's webhook target for the test-mode upgrade flow — AGE-259.

`POST /functions/v1/stripe-webhook` (server-to-server, called by Stripe —
no CORS). On `checkout.session.completed`, calls `apply_upgrade` (service
role) to set the caller's `profiles.tier` from the session's
`metadata.user_id` / `metadata.level`. Other event types, or a
`checkout.session.completed` missing that metadata, are acknowledged as
`{ skipped: true }` (200) without writing anything.

This function is the **source of truth** for the tier: `create-checkout-session`
only opens the Stripe session; the tier is written here, after Stripe confirms
payment.

## Auth

`verify_jwt = false` — Stripe carries no user JWT. The endpoint is protected
by the Stripe **signature** instead: the raw request body is verified against
the `stripe-signature` header using `STRIPE_WEBHOOK_SECRET` (HMAC-SHA256 over
`${timestamp}.${rawBody}`, per Stripe's documented algorithm — no Stripe SDK).
Verification runs **before** the body is parsed as JSON; an invalid or missing
signature returns 400 without touching the payload. Missing `STRIPE_WEBHOOK_SECRET`
fails closed (500).

If `apply_upgrade` errors, the function returns 500 so Stripe retries the
delivery; `apply_upgrade` only ever raises the tier, so a retried or
out-of-order event is a safe no-op.

## Secrets / deploy

Secrets come from Infisical → `supabase secrets set` (see
[`docs/secrets.md`](../../../docs/secrets.md)):

- `STRIPE_WEBHOOK_SECRET`

`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are platform-injected.

Deploy: `supabase functions deploy stripe-webhook`. Register the endpoint
in the Stripe Dashboard (test mode) for the `checkout.session.completed`
event and copy the resulting signing secret into `STRIPE_WEBHOOK_SECRET`.

## Tests

Pure logic (`computeSignature`, `verifyStripeSignature`, `parseCheckoutCompleted`)
is unit-tested; `index.ts` is the integration shell (signature verification +
`apply_upgrade` RPC via `supabase-js`) and has no network unit test.

```bash
cd supabase/functions/stripe-webhook
deno test          # 7 tests
deno check index.ts
```
