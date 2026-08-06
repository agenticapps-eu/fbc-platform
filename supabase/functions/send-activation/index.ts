// send-activation — verschickt den Aktivierungslink (AGE-495 / C3).
// Muster: notify-contact-request (AGE-247). Reine Logik in emails.ts.
//
// ── Warum verify_jwt = false, und warum sie trotzdem KEIN JWT liest ─────────
// Die Function muss OHNE Sitzung erreichbar sein. Gemessen am 2026-08-05: wer
// das verteilte Passwort hat, kann es über den Anmeldedienst ändern, ohne Token
// und ohne Reauthentifizierung. Das öffnet nichts — das Gate hält —, aber es
// sperrt das echte Mitglied aus: es käme an der Anmeldung nicht vorbei und
// erreichte den Aktivierungsbildschirm nie, von dem aus es seinen Link
// anfordert. Deshalb geht der Weg auch ohne Sitzung, allein über die Adresse.
//
// Genau deshalb liest sie AUCH KEIN JWT. Bei `verify_jwt = false` prüft das
// Gateway nichts; eine daraus gelesene Kennung wäre vom Aufrufer frei wählbar
// und damit ein Weg, sich den Bestätigungslink eines fremden Kontos schicken zu
// lassen. Ein Zweig, nicht zwei — das ist zugleich der einfachere Code.
//
// ── Warum die Antwort immer gleich aussieht ────────────────────────────────
// 202 in jedem Fall, und der Versand läuft NACH der Antwort. Sonst antwortet
// eine bestehende Adresse messbar langsamer als eine unbekannte, und die
// Function ist ein Orakel für Mitgliedsadressen.
//
// Secrets (Infisical → `supabase secrets set`, s. docs/secrets.md):
//   RESEND_API_KEY, FROM_EMAIL, APP_URL.
//   SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY spritzt die Plattform ein.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.108.1";
import { activationUrl, renderActivation } from "./emails.ts";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

function log(
  level: "info" | "warn" | "error",
  event: string,
  fields: Record<string, unknown> = {},
) {
  console[level === "warn" ? "warn" : level === "error" ? "error" : "log"](
    JSON.stringify({ fn: "send-activation", event, ...fields }),
  );
}

/** 32 Byte aus dem CSPRNG → 256 Bit. Der einzige Nachweis, den die Einlösung verlangt. */
function neuesToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Antwortet immer gleich — der Aufrufer erfährt nie, ob es die Adresse gibt. */
const ANGENOMMEN = () =>
  new Response(JSON.stringify({ accepted: true }), {
    status: 202,
    headers: { "content-type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  let email: string;
  try {
    const body = await req.json();
    email = String(body?.email ?? "").trim();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }
  if (!email || !email.includes("@")) return ANGENOMMEN();

  const resendKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("FROM_EMAIL");
  const appUrl = Deno.env.get("APP_URL")?.trim();
  if (!resendKey || !fromEmail || !appUrl) {
    log("error", "missing_config", {
      hasKey: !!resendKey,
      hasFrom: !!fromEmail,
      hasAppUrl: !!appUrl,
    });
    return new Response("Server misconfigured", { status: 500 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const token = neuesToken();
  const hash = await sha256Hex(token);

  // Ausgeben, entwerten und ratenbegrenzen in EINER Datenbankoperation. Zwei
  // Round-Trips ließen zwei gleichzeitige Anforderungen beide passieren.
  const { data, error } = await supabase.rpc("issue_activation_token", {
    p_email: email,
    p_token_hash: hash,
  });

  if (error) {
    log("error", "issue_failed", { code: error.code });
    return new Response("Issue failed", { status: 502 });
  }

  const row = Array.isArray(data) ? data[0] : data;
  const status = row?.status as string | undefined;

  // Kein Versand — aber dieselbe Antwort wie im Erfolgsfall. Die Adresse selbst
  // wird nie protokolliert; sie ist genau das Datum, das wir schützen.
  if (status !== "issued") {
    log("info", "no_mail", { status });
    return ANGENOMMEN();
  }

  const mail = renderActivation({
    name: String(row.display_name ?? ""),
    // Immer die HINTERLEGTE Adresse, nie die mitgegebene.
    url: activationUrl(appUrl, token),
  });
  const empfaenger = String(row.login_email);

  // Erst antworten, dann senden: sonst dauert eine bestehende Adresse messbar
  // länger als eine unbekannte, und die Antwortzeit verrät den Bestand.
  const versand = (async () => {
    try {
      const res = await fetch(RESEND_ENDPOINT, {
        method: "POST",
        headers: { authorization: `Bearer ${resendKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          from: fromEmail,
          to: [empfaenger],
          subject: mail.subject,
          html: mail.html,
          text: mail.text,
        }),
      });
      if (!res.ok) {
        // Nur Name und Status — Resends Fehlertext echot die Empfängeradresse.
        const errName = await res
          .json()
          .then((j) => (j as { name?: string })?.name)
          .catch(() => undefined);
        log("error", "resend_failed", { status: res.status, error: errName });
        return;
      }
      const { id } = (await res.json().catch(() => ({}))) as { id?: string };
      log("info", "mail_sent", { profileId: row.profile_id, resendId: id });
    } catch (e) {
      log("error", "resend_threw", { error: e instanceof Error ? e.name : "unknown" });
    }
  })();

  // Hält die Isolate am Leben, bis der Versand durch ist.
  (
    globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }
  ).EdgeRuntime?.waitUntil?.(versand);

  return ANGENOMMEN();
});
