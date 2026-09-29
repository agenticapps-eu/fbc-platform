// admin-invite-members — Einladungen für mehrere ausgewählte Mitglieder,
// mit einem Bericht, der die Wahrheit sagt (AGE-927). Reine Logik in
// ./einladung.ts, Mailteile aus ../send-activation/emails.ts.
//
// ── Warum es diese Function neben send-activation gibt ─────────────────────
// `send-activation` antwortet auf JEDEM ihrer vier Rückgabepfade mit
// `202 {accepted: true}`. Das ist Absicht und im dortigen Code begründet:
// „erst antworten, dann senden: sonst dauert eine bestehende Adresse messbar
// länger als eine unbekannte, und die Antwortzeit verrät den Bestand."
//
// Der Aufrufer erfährt damit nicht, ob ein Token erzeugt oder wegen `pending`
// übersprungen wurde, und nicht, ob Resend die Mail annahm. Über sie ist der
// Bericht, den ADR-0007 zur Bedingung der Mehrfachauswahl macht, NICHT
// herstellbar — zwölf Aufrufe, zwölfmal „angenommen", keine Auskunft.
//
// Der Aufzählungsschutz entfällt hier zu Recht: er verbirgt vor einem ANONYMEN
// Aufrufer, ob es eine Adresse gibt. Ein Admin sieht die Mitgliederliste
// ohnehin; ein Schutz, der nur noch die eigene Auskunft verhindert, schützt
// niemanden.
//
// Die Schutzriegel entfallen NICHT. Sie liegen in `issue_activation_token` —
// 60 Sekunden je Profil, fünf pro Tag, und das 24-Stunden-Fenster, in dem ein
// gültiger unbenutzter Link nicht ersetzt wird — und werden hier gerufen, nicht
// nachgebaut.
//
// Vorbild für den Ablauf ist `resend-activation`: dieselbe Kette, nur für ein
// fremdes Profil und für mehrere auf einmal.
//
// Secrets: RESEND_API_KEY, FROM_EMAIL, APP_URL;
//          SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY spritzt die Plattform ein.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.108.1";
import { jwtSub } from "../create-checkout-session/checkout.ts";
import { activationUrl, renderActivation } from "../send-activation/emails.ts";
import {
  type Ausgang,
  ausgangFuer,
  berichtZusammenfassen,
  type Ergebnis,
  parseInviteRequest,
} from "./einladung.ts";

const RESEND_ENDPOINT = "https://api.resend.com/emails";
// Siehe send-activation: derselbe Rückkanal, aus demselben Grund fest verdrahtet.
const REPLY_TO = "info@fairbusinessclub.de";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const JSON_CORS = { ...CORS, "content-type": "application/json" };

const log = (level: "info" | "warn" | "error", event: string, f: Record<string, unknown> = {}) =>
  console[level === "info" ? "log" : level](
    JSON.stringify({ fn: "admin-invite-members", event, ...f }),
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

  // `sub` aus dem Token, nicht `getUser()`: unter ES256-Signing-Keys liefert
  // das nichts Brauchbares. Muster wie admin-change-email.
  const actor = jwtSub(authHeader.replace(/^Bearer\s+/i, ""));
  if (!actor) return antwort({ error: "unauthorized" }, 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return antwort({ error: "bad_request" }, 400);
  }
  const eingabe = parseInviteRequest(body);
  if (!eingabe) return antwort({ error: "bad_request" }, 400);

  const resendKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("FROM_EMAIL");
  const appUrl = Deno.env.get("APP_URL");
  if (!resendKey || !fromEmail || !appUrl) {
    log("error", "misconfigured", {
      hasKey: !!resendKey, hasFrom: !!fromEmail, hasApp: !!appUrl,
    });
    return antwort({ error: "server_error" }, 500);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // Die Admin-Eigenschaft wird SERVERSEITIG geprüft, gegen staff_roles — über
  // eine RPC und nicht über die Tabelle: service_role hält seit AGE-312 auf
  // keiner Tabelle in `public` ein SELECT.
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

  const ergebnisse: Ergebnis[] = [];

  // NACHEINANDER, nicht nebenläufig. `issue_activation_token` nimmt eine
  // Zeilensperre auf das Profil und serialisiert ohnehin; parallel gestartet
  // liefen die Aufrufe nur in dieselbe Sperre. Und der 60-Sekunden-Riegel gilt
  // je Profil, nicht global — verschiedene Mitglieder behindern sich nicht.
  for (const id of eingabe.ids) {
    let name: string | null = null;

    try {
      // Die Adresse wird aus der KENNUNG aufgelöst und nicht aus dem Aufruf
      // übernommen. Derselbe Grundsatz wie in send-activation („immer die
      // hinterlegte Adresse, nie die mitgegebene"): der Aufruf sagt, WELCHES
      // Mitglied gemeint ist; wohin geschrieben wird, entscheidet der Server.
      const { data: nutzer, error: nutzerFehler } = await admin.auth.admin.getUserById(id);
      const adresse = nutzer?.user?.email;
      if (nutzerFehler || !adresse) {
        log("warn", "unbekannte_kennung", { id });
        ergebnisse.push({ id, name: null, ausgang: "nicht_einladbar" });
        continue;
      }

      const token = neuesToken();
      const hash = await sha256Hex(token);

      // Ausgeben, entwerten und ratenbegrenzen in EINER Datenbankoperation.
      const { data, error } = await admin.rpc("issue_activation_token", {
        p_email: adresse,
        p_token_hash: hash,
      });
      if (error) {
        log("error", "issue_failed", { id, code: error.code });
        ergebnisse.push({ id, name: null, ausgang: "fehlgeschlagen" });
        continue;
      }

      const row = Array.isArray(data) ? data[0] : data;
      const status = row?.status as string | undefined;
      name = row?.display_name ? String(row.display_name) : null;

      // Kein Versand — der Ausgang steht damit schon fest.
      if (status !== "issued" && status !== "issued_reset") {
        const ausgang: Ausgang = ausgangFuer(status, false);
        if (ausgang === "fehlgeschlagen") {
          // Ein Status, den diese Function nicht kennt, ist ein Betriebsfehler
          // und kein Normalfall: er entsteht, wenn Function und Migration
          // auseinanderlaufen. Dieselbe Begründung wie in status.ts.
          log("error", "unerwarteter_status", { id, status });
        } else {
          log("info", "kein_versand", { id, status });
        }
        ergebnisse.push({ id, name, ausgang });
        continue;
      }

      const mail = renderActivation({
        name: name ?? "",
        url: activationUrl(appUrl, token),
      });
      const empfaenger = String(row.login_email);

      // Anders als send-activation wird hier GEWARTET. Das ist der ganze Zweck
      // dieser Function: ohne das Warten gäbe es keinen Ausgang zu berichten.
      const res = await fetch(RESEND_ENDPOINT, {
        method: "POST",
        headers: {
          authorization: `Bearer ${resendKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          reply_to: REPLY_TO,
          to: [empfaenger],
          subject: mail.subject,
          html: mail.html,
          text: mail.text,
        }),
      });

      if (!res.ok) {
        // Eine Ablehnung: es ging nichts raus, das Token ist wertlos. Dann darf
        // es nicht gültig liegen bleiben — sonst antwortete
        // `issue_activation_token` bis zu 24 h lang `pending`, und niemand
        // käme mehr an eine Mail. Dieselbe Behandlung wie in send-activation.
        //
        // Nur bei einer ABLEHNUNG, nicht bei einem Wurf: ein Wurf trifft auch
        // den Fall, dass die ANTWORT verlorengeht, nachdem Resend die Mail
        // bereits zugestellt hat. Ein zugestellter Link ist mehr wert als ein
        // geschlossenes Schutzfenster.
        const errName = await res.json()
          .then((j) => (j as { name?: string })?.name)
          .catch(() => undefined);
        log("error", "resend_failed", { id, status: res.status, error: errName });
        const { error: entwertFehler } = await admin.rpc("invalidate_activation_token", {
          p_token_hash: hash,
        });
        if (entwertFehler) log("error", "invalidate_failed", { id, code: entwertFehler.code });
        ergebnisse.push({ id, name, ausgang: "fehlgeschlagen" });
        continue;
      }

      log("info", "mail_sent", { id });
      ergebnisse.push({ id, name, ausgang: "verschickt" });
    } catch (e) {
      // Ein Wurf — hier wird BEWUSST NICHT entwertet, siehe oben.
      log("warn", "versand_wurf", { id, error: e instanceof Error ? e.name : "unknown" });
      ergebnisse.push({ id, name, ausgang: "fehlgeschlagen" });
    }
  }

  const bericht = berichtZusammenfassen(ergebnisse);
  log("info", "fertig", { zahlen: bericht.zahlen });
  return antwort(bericht, 200);
});
