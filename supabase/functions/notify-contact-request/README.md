# notify-contact-request

Transactional email for the contact-request flow — AGE-247, spec
[`docs/matching-spec.md` §7](../../../docs/matching-spec.md).

Invoked by a **Database Webhook** on `public.contact_requests` (Insert + Update).
For each relevant event it sends one branded (schwarz/gold) email via **Resend**:

| Event               | Recipient        | Subject                                             |
| ------------------- | ---------------- | --------------------------------------------------- |
| `INSERT`            | request **to**   | Neue Kontaktanfrage von {Name}                      |
| `UPDATE`→`accepted` | request **from** | Deine Kontaktanfrage wurde angenommen (+ Chat-Link) |
| `UPDATE`→`declined` | request **from** | Deine Kontaktanfrage wurde nicht angenommen         |

**In-app notifications are NOT written here.** The `contact_requests_lifecycle`
DB trigger (migration `20260614100000_contact_request_flow.sql`) already inserts
the `notifications` row for every one of these events; this function only adds
the email channel.

## Auth

`verify_jwt = false` (a DB webhook carries no user JWT, and the public anon key
can't gate it). The function instead requires the webhook to send
`Authorization: Bearer $CONTACT_WEBHOOK_SECRET`.

## Secrets / deploy / webhook wiring

See [`docs/secrets.md`](../../../docs/secrets.md) →
"Supabase Edge Function secrets". Secrets (`RESEND_API_KEY`, `FROM_EMAIL`,
`CONTACT_WEBHOOK_SECRET`, optional `APP_URL`) come from Infisical;
`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are platform-injected.

## Tests

Pure logic (event→email decision, HTML templates, escaping) is unit-tested:

```bash
cd supabase/functions/notify-contact-request
deno test          # 10 tests
deno check index.ts
```
