// create-checkout-session — erstellt eine Stripe-Checkout-Session (Subscription,
// Test-Mode) für ein Level-Upgrade. Der Tier wird NICHT hier gesetzt, sondern vom
// stripe-webhook nach checkout.session.completed (Webhook = Wahrheit, AGE-259).
//
// Auth: verify_jwt=true — der Client ruft mit seinem User-JWT. Wir lesen den User
// und seine aktuelle Stufe, validieren, dass es ein Upgrade ist, und erzeugen die
// Session per Stripe-REST (kein SDK, wie Resend in notify-contact-request).
//
// Secrets (Infisical → supabase secrets): STRIPE_SECRET_KEY,
//   STRIPE_PRICE_{DISCOVER,EXCHANGE,FOCUS,IMPACT}_{YEAR,MONTH}, APP_URL.
//   SUPABASE_URL + SUPABASE_ANON_KEY sind plattform-injiziert.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.108.1";
import { parseUpgradeRequest, priceEnvKey } from "./checkout.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const CORS = { ...corsHeaders, "content-type": "application/json" };
const log = (level: "info" | "warn" | "error", event: string, f: Record<string, unknown> = {}) =>
  console[level === "info" ? "log" : level](
    JSON.stringify({ fn: "create-checkout-session", event, ...f }),
  );

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (req.method !== "POST")
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });

  const authHeader = req.headers.get("authorization");
  if (!authHeader)
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: CORS });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { authorization: authHeader } },
  });
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user)
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: CORS });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "bad_request" }), { status: 400, headers: CORS });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("tier, membership_tiers(level_rank)")
    .eq("id", user.id)
    .single();
  if (profileError) {
    log("error", "profile_lookup_failed", { code: profileError.code });
    return new Response(JSON.stringify({ error: "profile_lookup_failed" }), {
      status: 500,
      headers: CORS,
    });
  }
  const currentRank =
    (profile?.membership_tiers as { level_rank?: number } | null)?.level_rank ?? 0;

  const parsed = parseUpgradeRequest(body, currentRank);
  if (!parsed.ok) {
    log("warn", "rejected", { error: parsed.error, currentRank });
    return new Response(JSON.stringify({ error: parsed.error }), { status: 400, headers: CORS });
  }
  const { level, interval } = parsed.value;

  const secretKey = Deno.env.get("STRIPE_SECRET_KEY");
  const priceId = Deno.env.get(priceEnvKey(level, interval));
  const appUrl = Deno.env.get("APP_URL")?.trim() || "http://localhost:5173";
  if (!secretKey || !priceId) {
    log("error", "misconfigured", {
      hasKey: !!secretKey,
      priceEnv: priceEnvKey(level, interval),
      hasPrice: !!priceId,
    });
    return new Response(JSON.stringify({ error: "server_misconfigured" }), {
      status: 500,
      headers: CORS,
    });
  }

  const params = new URLSearchParams();
  params.set("mode", "subscription");
  params.set("line_items[0][price]", priceId);
  params.set("line_items[0][quantity]", "1");
  params.set("success_url", `${appUrl}/mitgliedschaft?status=success`);
  params.set("cancel_url", `${appUrl}/mitgliedschaft?status=cancel`);
  params.set("client_reference_id", user.id);
  params.set("metadata[user_id]", user.id);
  params.set("metadata[level]", level); // Interval fließt NICHT in den Tier ein.

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${secretKey}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: params,
  });
  if (!res.ok) {
    log("error", "stripe_failed", { status: res.status });
    return new Response(JSON.stringify({ error: "stripe_error" }), { status: 502, headers: CORS });
  }
  const session = (await res.json()) as { url?: string };
  log("info", "session_created", { level, interval });
  return new Response(JSON.stringify({ url: session.url }), { status: 200, headers: CORS });
});
