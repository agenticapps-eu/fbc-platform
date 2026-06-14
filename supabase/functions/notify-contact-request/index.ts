// notify-contact-request — transactional email for the contact-request flow.
// AGE-247, spec: docs/matching-spec.md §7.
//
// Triggered by a Supabase Database Webhook on public.contact_requests
// (INSERT + status UPDATE). For each relevant event it looks up the recipient's
// email + the parties' names with the service role (profile_contacts is RLS-gated)
// and sends one branded mail via Resend:
//   * INSERT            → recipient: "Neue Kontaktanfrage von {Name}"
//   * UPDATE→accepted   → sender:    "Anfrage angenommen" (+ Chat-Link)
//   * UPDATE→declined   → sender:    "abgelehnt" (optional)
//
// IN-APP notifications are NOT written here — the contact_requests_lifecycle DB
// trigger (migration 20260614100000) already inserts the notifications rows for
// every one of these events. Writing them here too would duplicate them.
//
// Auth: this endpoint is registered with verify_jwt=false (a DB webhook carries
// no user JWT, and the public anon key can't gate it). It is protected by a
// shared secret the webhook must send as `Authorization: Bearer <secret>`.
//
// Secrets (set via Infisical → `supabase secrets set`, see docs/secrets.md):
//   RESEND_API_KEY, FROM_EMAIL, CONTACT_WEBHOOK_SECRET, APP_URL (optional).
//   SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are injected by the platform.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.108.1";
import {
  renderAccepted,
  renderDeclined,
  renderNewRequest,
  selectNotification,
  type RenderedEmail,
  type WebhookPayload,
} from "./emails.ts";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

function log(
  level: "info" | "warn" | "error",
  event: string,
  fields: Record<string, unknown> = {},
) {
  console[level === "warn" ? "warn" : level === "error" ? "error" : "log"](
    JSON.stringify({ fn: "notify-contact-request", event, ...fields }),
  );
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // Shared-secret gate. Fail closed: refuse if misconfigured.
  const expected = Deno.env.get("CONTACT_WEBHOOK_SECRET");
  if (!expected) {
    log("error", "missing_webhook_secret");
    return new Response("Server misconfigured", { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${expected}`) {
    log("warn", "unauthorized");
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const decision = selectNotification(payload);
  if (!decision) {
    log("info", "no_email_for_event", { type: payload.type, status: payload.record?.status });
    return new Response(JSON.stringify({ skipped: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }

  const resendKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("FROM_EMAIL");
  if (!resendKey || !fromEmail) {
    log("error", "missing_email_config", { hasKey: !!resendKey, hasFrom: !!fromEmail });
    return new Response("Server misconfigured", { status: 500 });
  }
  const appUrl = Deno.env.get("APP_URL")?.trim() || undefined;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Recipient email + the counterparty's name. Email comes from the RLS-gated
  // profile_contacts (reachable only with the service role); the name shown in
  // the copy is always the OTHER party's.
  const [{ data: recipientContact }, { data: otherProfile }] = await Promise.all([
    supabase
      .from("profile_contacts")
      .select("email")
      .eq("profile_id", decision.recipientId)
      .maybeSingle(),
    supabase.from("profiles").select("name").eq("id", decision.otherId).maybeSingle(),
  ]);

  const toEmail = recipientContact?.email?.trim();
  if (!toEmail) {
    // No address on file is not a retryable error — ack so the webhook stops.
    log("warn", "recipient_has_no_email", {
      kind: decision.kind,
      recipientId: decision.recipientId,
    });
    return new Response(JSON.stringify({ skipped: "no_email" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }

  const otherName = otherProfile?.name ?? "";
  let email: RenderedEmail;
  switch (decision.kind) {
    case "new_request":
      email = renderNewRequest({ fromName: otherName, message: decision.request.message, appUrl });
      break;
    case "accepted":
      email = renderAccepted({ toName: otherName, appUrl });
      break;
    case "declined":
      email = renderDeclined({ toName: otherName });
      break;
  }

  const res = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      authorization: `Bearer ${resendKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [toEmail],
      subject: email.subject,
      html: email.html,
      text: email.text,
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    log("error", "resend_failed", { status: res.status, detail, kind: decision.kind });
    // 5xx so the webhook retries the send.
    return new Response("Email send failed", { status: 502 });
  }

  const { id } = (await res.json().catch(() => ({}))) as { id?: string };
  log("info", "email_sent", { kind: decision.kind, requestId: decision.request.id, resendId: id });
  return new Response(JSON.stringify({ sent: true, id }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
});
