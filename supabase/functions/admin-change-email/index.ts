// admin-change-email — ein Admin setzt die LOGIN-Adresse eines Mitglieds neu
// (AGE-498, C6). Spec: openspec/changes/profile-cover-and-admin-edit/.
//
// ══ WOFÜR ══════════════════════════════════════════════════════════════════
// Der Fallback zum Bestätigungsweg aus C3. Kommt ein Mitglied nicht mehr an das
// Postfach, an das sein Aktivierungslink ging, ist es ohne diesen Weg DAUERHAFT
// ausgesperrt: der Link erreicht es nicht, und einen zweiten Nachweis kennt das
// System nicht. Nach dem Import (C10) ist das kein Randfall.
//
// ══ WARUM EINE EDGE FUNCTION UND KEINE SQL-FUNKTION ════════════════════════
// Die Adresse steht in `auth.users` und wird von GoTrue verwaltet. Ein direktes
// `update auth.users set email = …` — auch aus einer SECURITY-DEFINER-Funktion —
// ließe `auth.identities` zurück, wo dieselbe Adresse ein zweites Mal in
// `identity_data` steht. Das Konto bliebe in einem Zustand, den der
// Anmeldedienst nicht kennt: im besten Fall Anmeldung mit der alten Adresse, im
// schlechteren gar keine. Der einzige unterstützte Weg ist die Admin-API, und
// die braucht service_role.
//
// ══ WARUM DIE KENNUNG AUS DEM TOKEN KOMMT ══════════════════════════════════
// verify_jwt=true: das Gateway verifiziert das (ES256-)Token vollständig, bevor
// dieser Handler läuft. Unter den asymmetrischen Signaturschlüsseln der
// Produktion sind `getUser()` (liefert null) und `getClaims()` (scheitert am
// JWKS-Fetch) hier unbrauchbar — gemessen in AGE-259. Deshalb `sub` aus dem
// bereits verifizierten Token, wie create-checkout-session es tut.
//
// ══ WARUM email_confirm: true ══════════════════════════════════════════════
// Die neue Adresse gilt SOFORT, ohne Bestätigungsmail. Eine Bestätigung ginge
// an das Postfach, an das das Mitglied gerade nicht herankommt, und verfehlte
// den Zweck. Genau deshalb ist der Weg Admins vorbehalten.
//
// ══ WAS revoke_sessions NICHT LEISTET ══════════════════════════════════════
// Gelöscht werden Sitzung und Refresh-Token — die Erneuerung ist damit weg. Ein
// bereits ausgegebener Access-Token ist zustandslos und bleibt bis `jwt_expiry`
// gültig (derzeit 3600 s); die Funktion sagt das in ihrem eigenen Kopf
// (20260806080200:210). Die Zusage lautet also „keine neue Anmeldung mit der
// alten Adresse", nicht „sofort abgemeldet". Benannte Restfläche.
//
// ══ WAS DIESE FUNCTION NICHT ANFASST ═══════════════════════════════════════
// `profile_contacts.email`. Das ist die KONTAKT-Adresse, nicht die
// Login-Adresse, und notify-contact-request schickt dorthin. Sie wird über
// admin_update_profile geändert, bewusst getrennt: ein Mitglied darf sich unter
// einer Adresse anmelden und unter einer anderen erreichbar sein. Die
// Oberfläche zeigt beide nebeneinander, damit der Unterschied sichtbar ist.
//
// Secrets: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (plattform-injiziert).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.108.1";
import { jwtSub } from "../create-checkout-session/checkout.ts";
import { parseChangeEmailRequest, summarizeOutcome } from "./change-email.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const JSON_CORS = { ...CORS, "content-type": "application/json" };

const log = (level: "info" | "warn" | "error", event: string, f: Record<string, unknown> = {}) =>
  console[level === "info" ? "log" : level](
    JSON.stringify({ fn: "admin-change-email", event, ...f }),
  );

const antwort = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: JSON_CORS });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: CORS });

  const authHeader = req.headers.get("authorization");
  if (!authHeader) return antwort({ error: "unauthorized" }, 401);

  const actor = jwtSub(authHeader.replace(/^Bearer\s+/i, ""));
  if (!actor) return antwort({ error: "unauthorized" }, 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return antwort({ error: "bad_request" }, 400);
  }
  const eingabe = parseChangeEmailRequest(body);
  if (!eingabe) return antwort({ error: "bad_request" }, 400);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // Die Admin-Eigenschaft wird SERVERSEITIG geprüft, gegen staff_roles — nicht
  // aus einer im Aufruf mitgeschickten Kennung und nicht aus profiles.roles
  // (die ist mitglieds-schreibbar, siehe 20260614120000:15).
  //
  // ÜBER EINE RPC, NICHT ÜBER DIE TABELLE: service_role hält seit AGE-312 auf
  // keiner Tabelle in `public` ein SELECT. Ein direktes `.from("staff_roles")`
  // lief in „permission denied" — gefunden bei der Sichtprobe, nicht im Test.
  const { data: istAdmin, error: rollenFehler } = await admin.rpc("is_admin_uid", {
    p_profile_id: actor,
  });
  if (rollenFehler) {
    log("error", "role_lookup_failed", { message: rollenFehler.message });
    return antwort({ error: "server_error" }, 500);
  }
  if (!istAdmin) {
    log("warn", "forbidden", { actor });
    return antwort({ error: "forbidden" }, 403);
  }

  // Reihenfolge ist Teil der Zusage: erst die Adresse, dann die Sitzungen.
  // Umgekehrt entstünde ein Fenster, in dem die Sitzungen weg sind und die alte
  // Adresse noch gilt.
  const { error: updateFehler } = await admin.auth.admin.updateUserById(eingabe.target, {
    email: eingabe.email,
    email_confirm: true,
  });
  if (updateFehler) {
    log("error", "update_failed", { target: eingabe.target, message: updateFehler.message });
    return antwort({ error: "update_failed", detail: updateFehler.message }, 400);
  }

  const { error: revokeFehler } = await admin.rpc("revoke_sessions", {
    p_profile_id: eingabe.target,
  });

  // Die Spur entsteht auch dann, wenn das Widerrufen scheitert — die Adresse
  // ist ja geändert, und genau das muss nachvollziehbar bleiben.
  const { error: auditFehler } = await admin.rpc("log_admin_action", {
    p_actor: actor,
    p_action: "change_login_email",
    p_target: eingabe.target,
    p_payload: { email: eingabe.email, sessions_revoked: !revokeFehler },
  });
  if (auditFehler) log("error", "audit_failed", { message: auditFehler.message });

  const ergebnis = summarizeOutcome(revokeFehler?.message ?? null, auditFehler?.message ?? null);
  log("info", "changed", { actor, target: eingabe.target, outcome: ergebnis.status });
  return antwort(ergebnis, 200);
});
