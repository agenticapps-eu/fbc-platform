// resend-activation — der Aktivierungslink für ein EINGELOGGTES Konto
// (AGE-495 / C3, Teil D). Reine Logik in ../send-activation/emails.ts.
//
// ── Warum es diese Function neben send-activation gibt ─────────────────────
// Der Audit vom 2026-08-06 fand an `send-activation` eine Aussperrung: sie ist
// unauthentifiziert, und jede Ausgabe entwertete den ausstehenden Link. Wer die
// Login-Adresse kannte, fordert in fremdem Namen an und macht damit den Link im
// Postfach des Opfers ungültig — bis die Tagesquote leer ist.
//
// Der Hauptweg nach der Rundmail braucht diese Offenheit gar nicht: dort steht
// ein ANGEMELDETES Mitglied vor dem Aktivierungsbildschirm. Deshalb hier
// `verify_jwt = true` und eine RPC ohne Adressparameter — das Subjekt ist
// `auth.uid()`, fremd anfordern ist per Signatur ausgeschlossen.
//
// `send-activation` bleibt für den seltenen Wiederherstellungsfall auf
// `/aktivierung` ohne Sitzung und ist dort seit Teil D hart gedrosselt.
//
// ── Warum sie die User-ID nicht selbst liest ────────────────────────────────
// Sie braucht sie nicht. Der Client trägt das vom Gateway verifizierte Token,
// PostgREST verifiziert es erneut, und `auth.uid()` löst in der RPC auf. Muster
// wie create-checkout-session; `getUser()`/`getClaims()` sind unter ES256
// unbrauchbar.
//
// Secrets (Infisical → `supabase secrets set`, s. docs/secrets.md):
//   RESEND_API_KEY, FROM_EMAIL, APP_URL.
//   SUPABASE_URL + SUPABASE_ANON_KEY + SUPABASE_SERVICE_ROLE_KEY spritzt die
//   Plattform ein. Wozu hier BEIDE Schlüssel gebraucht werden, steht am
//   Service-Rollen-Client weiter unten.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.108.1";
import { activationUrl, renderActivation } from "../send-activation/emails.ts";

const RESEND_ENDPOINT = "https://api.resend.com/emails";
// Siehe send-activation: derselbe Rückkanal, aus demselben Grund fest verdrahtet.
const REPLY_TO = "info@fairbusinessclub.de";

function log(
  level: "info" | "warn" | "error",
  event: string,
  fields: Record<string, unknown> = {},
) {
  console[level === "warn" ? "warn" : level === "error" ? "error" : "log"](
    JSON.stringify({ fn: "resend-activation", event, ...fields }),
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

// Der Aufruf kommt aus dem Browser über `supabase.functions.invoke`, das
// `content-type: application/json` setzt — damit ist der Preflight Pflicht.
// Ohne diese Header scheitert er, und der Aufruf erreicht die Function nie
// (gemessen 07.08., Review 8.7: OPTIONS → 405 ohne Access-Control-*). Muster
// aus create-checkout-session.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST")
    return new Response("Method Not Allowed", { status: 405, headers: CORS });

  const authHeader = req.headers.get("authorization");
  if (!authHeader) return new Response("Unauthorized", { status: 401, headers: CORS });

  const resendKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("FROM_EMAIL");
  const appUrl = Deno.env.get("APP_URL")?.trim();
  if (!resendKey || !fromEmail || !appUrl) {
    log("error", "missing_config", {
      hasKey: !!resendKey,
      hasFrom: !!fromEmail,
      hasAppUrl: !!appUrl,
    });
    return new Response("Server misconfigured", { status: 500, headers: CORS });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { authorization: authHeader } },
  });

  const token = neuesToken();
  const hash = await sha256Hex(token);

  const { data, error } = await supabase.rpc("request_own_activation_token", {
    p_token_hash: hash,
  });

  if (error) {
    log("error", "issue_failed", { code: error.code });
    return new Response("Issue failed", { status: 502, headers: CORS });
  }

  const row = Array.isArray(data) ? data[0] : data;
  const status = row?.status as string | undefined;

  // Der Aufrufer ist sein eigenes Konto — hier ist ein ehrlicher Status kein
  // Orakel, sondern die Information, die der Bildschirm braucht. Die Adresse
  // selbst wird trotzdem nie protokolliert.
  if (status !== "issued") {
    log("info", "no_mail", { status });
    return new Response(JSON.stringify({ status }), {
      status: 200,
      headers: { ...CORS, "content-type": "application/json" },
    });
  }

  const mail = renderActivation({
    name: String(row.display_name ?? ""),
    url: activationUrl(appUrl, token),
  });
  const empfaenger = String(row.login_email);

  // Hat Resend den Versand ABGELEHNT, darf das soeben ausgegebene Token nicht
  // gültig liegen bleiben (Befund E2 aus Review 8.7). Der Schaden trifft nicht
  // diesen Weg — `request_own_activation_token` hat kein Schutzfenster, hier
  // wirkt nur die 60-s-Sperre —, sondern den ANDEREN: das offene Token sieht
  // das Schutzfenster von `issue_activation_token` (20260806090000:190-201),
  // und der sitzungsfreie Rückfallweg auf `/aktivierung` antwortet darauf bis
  // zu 24 Stunden lang `pending`. Kein Versand, kein neues Token — und die
  // Oberfläche meldet dabei dasselbe Grün wie im Erfolgsfall. Ein Fehlversand
  // auf dem angemeldeten Weg sperrt also den anonymen zu. Gemessen gegen DEV
  // am 2026-08-08 mit `scripts/probe-e2-resend-fehlversand.ts`.
  //
  // WAS DAS NICHT HEILT, ausdrücklich: der überholte Link im Postfach bleibt
  // tot. `request_own_activation_token` entwertet ihn, bevor überhaupt gesendet
  // wird, und der Klartext des neuen ist mit diesem Aufruf verschwunden. Ihn
  // zurückzuholen hieße, `invalidated_at` wieder auf `null` zu setzen — eine
  // Zustandsumkehr, die es im System sonst nirgends gibt. Entscheidung Donald,
  // 2026-08-08: der stille Schaden wird geschlossen, der laute bleibt benannt.
  //
  // Zwei Clients, nicht einer, und beides mit Absicht: der obere trägt das
  // User-JWT, weil `auth.uid()` in `request_own_activation_token` auflösen
  // muss. `invalidate_activation_token` ist dagegen `service_role`-only
  // (20260807190000:75-77) — für `authenticated` aufrufbar wäre das Entwerten
  // selbst der Aussperrungsweg, den das Schutzfenster zumacht.
  //
  // Aufgerufen wird das NUR bei einer Ablehnung, nicht bei einem Wurf — die
  // Begründung steht am `catch` unten.
  const entwerten = async () => {
    const dienst = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data, error } = await dienst.rpc("invalidate_activation_token", {
      p_token_hash: hash,
    });
    // Ohne diese Zeile wäre die Behebung eines stillen Fehlschlags selbst einer.
    if (error) log("error", "invalidate_failed", { code: error.code });
    else log("info", "token_invalidated", { getroffen: data });
  };

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: { authorization: `Bearer ${resendKey}`, "content-type": "application/json" },
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
      // Nur Name und Status — Resends Fehlertext echot die Empfängeradresse.
      const errName = await res
        .json()
        .then((j) => (j as { name?: string })?.name)
        .catch(() => undefined);
      log("error", "resend_failed", { status: res.status, error: errName });
      await entwerten();
      return new Response(JSON.stringify({ status: "send_failed" }), {
        status: 502,
        headers: { ...CORS, "content-type": "application/json" },
      });
    }
    const { id } = (await res.json().catch(() => ({}))) as { id?: string };
    log("info", "mail_sent", { resendId: id });
  } catch (e) {
    // HIER wird BEWUSST NICHT entwertet — anders als im Zweig darüber, und aus
    // demselben Grund wie in send-activation (dort ausführlich am `catch`):
    // ein `!res.ok` ist eine Ablehnung, es ging nichts raus. Ein Wurf trifft
    // auch den Fall, dass die ANTWORT verlorengeht, nachdem Resend die Mail
    // angenommen und zugestellt hat — dort hielte das Mitglied eine echte Mail
    // in der Hand, deren Link „überholt" meldet. Ein zugestellter Link ist mehr
    // wert als ein geschlossenes Schutzfenster.
    //
    // Der Preis ist benannt: für diesen selteneren Fall bleibt E2 bestehen.
    log("error", "resend_threw", { error: e instanceof Error ? e.name : "unknown" });
    return new Response(JSON.stringify({ status: "send_failed" }), {
      status: 502,
      headers: { ...CORS, "content-type": "application/json" },
    });
  }

  // Anders als send-activation wird hier NICHT vorab geantwortet: es gibt kein
  // Zeitkanal-Problem, wenn der Aufrufer ohnehin weiß, dass es sein Konto gibt.
  return new Response(JSON.stringify({ status: "issued" }), {
    status: 200,
    headers: { ...CORS, "content-type": "application/json" },
  });
});
