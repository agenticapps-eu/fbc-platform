// redeem-activation — löst den Aktivierungslink ein (AGE-495 / C3).
//
// ── Warum verify_jwt = false ────────────────────────────────────────────────
// ABSICHT, kein Versehen. Das Token trägt die Identität, nicht die Sitzung —
// nur so funktioniert der Link in einem anderen Browser oder auf einem anderen
// Gerät (AGE-495 §6). Es wird KEIN JWT gelesen; der einzige Nachweis ist das
// 256-Bit-Token.
//
// Die Kernlogik — samt der Begründung, warum ihre Reihenfolge die Sicherung
// ist — steht in redeem.ts und wird dort mit `deno test` geprüft
// (redeem.test.ts). Dieser Rumpf baut nur die echten Abhängigkeiten
// (Supabase-RPCs, `auth.admin.updateUserById`, `log`) und ruft sie auf.
//
// Secrets: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (plattform-injiziert).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.108.1";
import { redeemActivation } from "./redeem.ts";

/** Muss zu `minimum_password_length` in config.toml passen. */
const MIN_PASSWORT = 10;

function log(
  level: "info" | "warn" | "error",
  event: string,
  fields: Record<string, unknown> = {},
) {
  console[level === "warn" ? "warn" : level === "error" ? "error" : "log"](
    JSON.stringify({ fn: "redeem-activation", event, ...fields }),
  );
}

// Der Aufruf kommt aus dem Browser über `supabase.functions.invoke`, das
// `content-type: application/json` setzt — damit ist der Preflight Pflicht.
// Ohne diese Header scheitert er, und der Aufruf erreicht die Function nie
// (gemessen 07.08., Review 8.7: OPTIONS → 405 ohne Access-Control-*). Muster
// aus create-checkout-session.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function antwort(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST")
    return new Response("Method Not Allowed", { status: 405, headers: CORS });

  let token: string;
  let password: string;
  try {
    const body = await req.json();
    token = String(body?.token ?? "");
    password = String(body?.password ?? "");
  } catch {
    return new Response("Bad Request", { status: 400, headers: CORS });
  }

  // Serverseitig prüfen, nicht nur im Formular: die Function ist die Grenze.
  if (password.length < MIN_PASSWORT) {
    return antwort({ status: "weak_password", minLength: MIN_PASSWORT }, 400);
  }
  if (!token) return antwort({ status: "not_found" }, 400);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  const ergebnis = await redeemActivation(token, password, ip, {
    claimActivationToken: (tokenHash) =>
      supabase.rpc("claim_activation_token", { p_token_hash: tokenHash }),
    noteFailedActivation: (ip) => supabase.rpc("note_failed_activation", { p_ip: ip }),
    updateUserById: (profileId, attrs) => supabase.auth.admin.updateUserById(profileId, attrs),
    revokeSessions: (profileId) => supabase.rpc("revoke_sessions", { p_profile_id: profileId }),
    markActivated: (profileId) => supabase.rpc("mark_activated", { p_profile_id: profileId }),
    log,
  });
  return antwort(ergebnis.body, ergebnis.status);
});
