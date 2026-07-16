// stripe-webhook — Wahrheit für den Tier-Upgrade (AGE-259). verify_jwt=false: Stripe
// trägt kein User-JWT. Schutz ist die Stripe-SIGNATUR (STRIPE_WEBHOOK_SECRET), NICHT
// ein Shared-Secret. Auf checkout.session.completed → apply_upgrade per Service-Role.
// Idempotent (apply_upgrade ist nur-höher); 400 bei ungültiger Signatur.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.108.1";
import { parseCheckoutCompleted, verifyStripeSignature } from "./webhook.ts";

const log = (level: "info" | "warn" | "error", event: string, f: Record<string, unknown> = {}) =>
  console[level === "info" ? "log" : level](JSON.stringify({ fn: "stripe-webhook", event, ...f }));

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!secret) {
    log("error", "missing_webhook_secret");
    return new Response("Server misconfigured", { status: 500 });
  }

  const rawBody = await req.text(); // Roh-Body für die Signaturprüfung — NICHT vorher parsen.
  const valid = await verifyStripeSignature(rawBody, req.headers.get("stripe-signature"), secret);
  if (!valid) {
    log("warn", "bad_signature");
    return new Response("Bad signature", { status: 400 });
  }

  let event: unknown;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const upgrade = parseCheckoutCompleted(event);
  if (!upgrade)
    return new Response(JSON.stringify({ skipped: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data, error } = await supabase.rpc("apply_upgrade", {
    p_user_id: upgrade.userId,
    p_level: upgrade.level,
  });
  if (error) {
    log("error", "apply_upgrade_failed", { code: error.code, level: upgrade.level });
    return new Response("Upgrade failed", { status: 500 }); // Stripe retryt; apply_upgrade ist idempotent.
  }
  log("info", "upgraded", { level: upgrade.level, effective: data });
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
});
