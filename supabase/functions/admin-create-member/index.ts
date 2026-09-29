// admin-create-member — ein einzelnes Mitglied von Hand anlegen (AGE-927).
// Reine Logik in ./anlegen.ts, Mailteile aus ../send-activation/emails.ts.
//
// ── Der Weg, und warum er so verläuft ──────────────────────────────────────
// Detlev legt nach der Zahlung über Odoo das Mitglied hier an. Das Konto muss
// in `auth.users` entstehen, und dorthin reicht keine Policy — deshalb die
// Admin-API mit `service_role` und nicht eine RPC.
//
// Das Konto entsteht OHNE Passwort und OHNE unmittelbare Aktivierung: das
// Mitglied bestätigt selbst über den Link. Ein vom Admin gesetztes Passwort
// wäre ein Zugang, den zwei Menschen kennen; „direkt aktivieren" hat in
// AGE-604 schon einmal jemanden dauerhaft ausgesperrt.
//
// ── Die Reihenfolge ist Teil der Zusage ────────────────────────────────────
// Konto → Name und Stufe → Mail. Scheitert ein späterer Schritt, IST das
// Konto angelegt, und die Antwort sagt es (`teilweise`). Ein Rückbau ist
// ausgeschlossen: er nähme dem Admin die einzige Spur. Bei
// `stufe_nicht_gesetzt` steht das Konto auf der Vorgabestufe in Schritt ①
// Angelegt und ist über „Stufe setzen" zu berichtigen — sichtbar, nicht
// versteckt.
//
// Secrets: RESEND_API_KEY, FROM_EMAIL, APP_URL;
//          SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY spritzt die Plattform ein.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.108.1";
import { jwtSub } from "../create-checkout-session/checkout.ts";
import { activationUrl, renderActivation } from "../send-activation/emails.ts";
import { parseCreateRequest, zusammenfassen } from "./anlegen.ts";

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const REPLY_TO = "info@fairbusinessclub.de";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const JSON_CORS = { ...CORS, "content-type": "application/json" };

const log = (level: "info" | "warn" | "error", event: string, f: Record<string, unknown> = {}) =>
  console[level === "info" ? "log" : level](
    JSON.stringify({ fn: "admin-create-member", event, ...f }),
  );

const antwort = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: JSON_CORS });

function neuesToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: CORS });
  }

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
  const eingabe = parseCreateRequest(body);
  if (!eingabe) return antwort({ error: "bad_request" }, 400);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

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

  // ── Gehört die Adresse schon jemandem? ───────────────────────────────────
  // Vergleicht über `lower(email)`, weil der Unique-Index auf
  // `auth.users(email)` partiell UND schreibungsempfindlich ist. Das ist eine
  // BEQUEMLICHKEIT und kein Schutz: zwei gleichzeitige Anlagen liefen beide
  // durch. Den Schutz leistet der Index — für die exakte Schreibung —, und die
  // Antwort auf seinen Fehler steht weiter unten.
  const { data: bestand, error: suchFehler } = await admin.rpc("admin_adresse_nachschlagen", {
    p_email: eingabe.email,
  });
  if (suchFehler) {
    log("error", "lookup_failed", { code: suchFehler.code });
    return antwort({ error: "server_error" }, 500);
  }
  const vorhanden = Array.isArray(bestand) ? bestand[0] : bestand;
  if (vorhanden) {
    log("info", "adresse_vergeben", { target: vorhanden.profile_id });
    // Entfernt oder deaktiviert wird ausdrücklich gesagt: sonst verweist die
    // Antwort auf ein Mitglied, das der Admin in keiner sichtbaren Liste
    // findet. Der wiederkehrende Bewerber ist der realistische Fall.
    return antwort({
      error: "adresse_vergeben",
      mitglied: {
        id: vorhanden.profile_id,
        name: vorhanden.anzeigename,
        deaktiviert: vorhanden.deaktiviert,
        geloescht: vorhanden.geloescht,
      },
    }, 409);
  }

  // ── 1. Das Konto ─────────────────────────────────────────────────────────
  // `email_confirm: true` und KEIN Passwort im Rumpf. Genau der Weg, der für
  // das Store-Prüferkonto schon dokumentiert ist.
  const { data: neu, error: anlageFehler } = await admin.auth.admin.createUser({
    email: eingabe.email,
    email_confirm: true,
  });
  const neueId = neu?.user?.id;
  if (anlageFehler || !neueId) {
    // Auch der Rennfall landet hier: der partielle Unique-Index wirft, wenn
    // zwei Anlagen sich überholt haben. Dann ist die Vorprüfung oben überholt,
    // und das ist kein Fehler dieser Function, sondern ihr Normalfall.
    log("error", "create_failed", { message: anlageFehler?.message });
    return antwort({
      ...zusammenfassen({
        kontoAngelegt: false, profilGesetzt: false,
        mailSenden: eingabe.mailSenden, versandOk: false,
      }),
    }, 502);
  }

  // ── 2. Name, Stufe, Firma, Telefon — und die Spur ────────────────────────
  let profilGesetzt = true;
  const { error: einrichtFehler } = await admin.rpc("admin_mitglied_einrichten", {
    p_actor: actor,
    p_target: neueId,
    p_name: eingabe.name,
    p_tier: eingabe.plan,
    p_firma: eingabe.firma,
    p_telefon: eingabe.telefon,
  });
  if (einrichtFehler) {
    // Das Konto BLEIBT. Es steht dann auf der Vorgabestufe in Schritt ①
    // Angelegt und ist über „Stufe setzen" zu berichtigen.
    log("error", "einrichten_failed", { target: neueId, code: einrichtFehler.code });
    profilGesetzt = false;
  }

  // ── 3. Die Bestätigungsmail, wenn gewünscht ──────────────────────────────
  let versandOk = false;
  if (eingabe.mailSenden && profilGesetzt) {
    versandOk = await bestaetigungsmail(admin, eingabe.email, eingabe.name);
  }

  const ergebnis = zusammenfassen({
    kontoAngelegt: true,
    profilGesetzt,
    mailSenden: eingabe.mailSenden,
    versandOk,
  });
  log("info", "fertig", { target: neueId, ...ergebnis });
  return antwort({ ...ergebnis, id: neueId }, ergebnis.status === "ok" ? 201 : 207);
});

/**
 * Derselbe Weg wie „Zugangslink schicken", mit denselben Schutzriegeln — sie
 * liegen in `issue_activation_token` und werden hier gerufen, nicht nachgebaut.
 * Anders als `send-activation` wird auf den Versand GEWARTET: die Antwort soll
 * sagen, was wirklich geschah.
 */
async function bestaetigungsmail(
  // deno-lint-ignore no-explicit-any
  admin: any,
  email: string,
  name: string,
): Promise<boolean> {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("FROM_EMAIL");
  const appUrl = Deno.env.get("APP_URL");
  if (!resendKey || !fromEmail || !appUrl) {
    log("error", "misconfigured", {
      hasKey: !!resendKey, hasFrom: !!fromEmail, hasApp: !!appUrl,
    });
    return false;
  }

  const token = neuesToken();
  const hash = await sha256Hex(token);
  const { data, error } = await admin.rpc("issue_activation_token", {
    p_email: email,
    p_token_hash: hash,
  });
  if (error) {
    log("error", "issue_failed", { code: error.code });
    return false;
  }
  const row = Array.isArray(data) ? data[0] : data;
  const status = row?.status as string | undefined;
  if (status !== "issued" && status !== "issued_reset") {
    // Bei einem frisch angelegten Konto ist das unerwartet — es kann kein
    // offenes Token und keine Tagesgrenze haben. Deshalb `error` und nicht
    // `info`: hier läuft etwas auseinander.
    log("error", "unerwarteter_status", { status });
    return false;
  }

  const mail = renderActivation({ name, url: activationUrl(appUrl, token) });
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: { authorization: `Bearer ${resendKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: fromEmail,
        reply_to: REPLY_TO,
        to: [String(row.login_email)],
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
      }),
    });
    if (!res.ok) {
      // Ablehnung: es ging nichts raus, das Token darf nicht gültig liegen
      // bleiben — sonst antwortete `issue_activation_token` bis zu 24 h
      // `pending` und niemand käme mehr an eine Mail.
      log("error", "resend_failed", { status: res.status });
      const { error: entwertFehler } = await admin.rpc("invalidate_activation_token", {
        p_token_hash: hash,
      });
      if (entwertFehler) log("error", "invalidate_failed", { code: entwertFehler.code });
      return false;
    }
    log("info", "mail_sent", {});
    return true;
  } catch (e) {
    // Ein Wurf trifft auch den Fall, dass die ANTWORT verlorengeht, nachdem
    // Resend zugestellt hat. Deshalb wird hier NICHT entwertet — ein
    // zugestellter Link ist mehr wert als ein geschlossenes Schutzfenster.
    log("warn", "versand_wurf", { error: e instanceof Error ? e.name : "unknown" });
    return false;
  }
}
