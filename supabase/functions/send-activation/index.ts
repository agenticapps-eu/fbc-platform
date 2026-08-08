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
import {
  activationUrl,
  passwordResetUrl,
  renderActivation,
  renderPasswordReset,
} from "./emails.ts";

const RESEND_ENDPOINT = "https://api.resend.com/emails";
// Rückkanal, bewusst fest verdrahtet und nicht aus der Umgebung: er steht
// wörtlich auf dem Aktivierungsbildschirm und im Mailtext. Ein Secret, das
// stillschweigend abweicht, macht beide Texte unwahr, ohne dass es auffällt.
const REPLY_TO = "info@fairbusinessclub.de";

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

// Der Aufruf kommt aus dem Browser über `supabase.functions.invoke`, das
// `content-type: application/json` setzt — damit ist der Preflight Pflicht.
// Ohne diese Header scheitert er, und der Aufruf erreicht die Function nie
// (gemessen 07.08., Review 8.7: OPTIONS → 405 ohne Access-Control-*). Muster
// aus create-checkout-session.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Antwortet immer gleich — der Aufrufer erfährt nie, ob es die Adresse gibt. */
const ANGENOMMEN = () =>
  new Response(JSON.stringify({ accepted: true }), {
    status: 202,
    headers: { ...CORS, "content-type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST")
    return new Response("Method Not Allowed", { status: 405, headers: CORS });

  let email: string;
  try {
    const body = await req.json();
    email = String(body?.email ?? "").trim();
  } catch {
    return new Response("Bad Request", { status: 400, headers: CORS });
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
    return new Response("Server misconfigured", { status: 500, headers: CORS });
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
    return new Response("Issue failed", { status: 502, headers: CORS });
  }

  const row = Array.isArray(data) ? data[0] : data;
  const status = row?.status as string | undefined;

  // Zwei Erfolgsfälle seit AGE-505: `issued` ist eine Aktivierung, `issued_reset`
  // ein vergessenes Passwort. Der Unterschied kommt allein aus dem Kontostand
  // und wird in der Datenbank bestimmt — hier entscheidet er nur noch über Text
  // und Zieladresse.
  const istReset = status === "issued_reset";

  // Kein Versand — aber dieselbe Antwort wie im Erfolgsfall. Die Adresse selbst
  // wird nie protokolliert; sie ist genau das Datum, das wir schützen.
  if (status !== "issued" && !istReset) {
    log("info", "no_mail", { status });
    return ANGENOMMEN();
  }

  const name = String(row.display_name ?? "");
  // Immer die HINTERLEGTE Adresse, nie die mitgegebene.
  const mail = istReset
    ? renderPasswordReset({ name, url: passwordResetUrl(appUrl, token) })
    : renderActivation({ name, url: activationUrl(appUrl, token) });
  const empfaenger = String(row.login_email);

  // Hat Resend den Versand ABGELEHNT, darf kein gültiges Token liegen bleiben:
  // sonst antwortet issue_activation_token bis zu 24 h lang „pending" — kein
  // Versand, kein neues Token —, und /aktivierung meldet dabei dasselbe Grün
  // wie im Erfolgsfall (Befund E1 / Aufgabe 11.6). Der Aufrufer hat längst 202;
  // das Entwerten ist die einzige Stelle, an der dieser Fehlschlag überhaupt
  // noch behandelt werden kann.
  //
  // Aufgerufen wird das NUR bei einer Ablehnung, nicht bei einem Wurf — die
  // Begründung steht am `catch` unten.
  const entwerten = async () => {
    const { data, error } = await supabase.rpc("invalidate_activation_token", {
      p_token_hash: hash,
    });
    // Ohne diese Zeile wäre die Behebung eines stillen Fehlschlags selbst einer.
    if (error) log("error", "invalidate_failed", { code: error.code });
    else log("info", "token_invalidated", { profileId: row.profile_id, getroffen: data });
  };

  // Erst antworten, dann senden: sonst dauert eine bestehende Adresse messbar
  // länger als eine unbekannte, und die Antwortzeit verrät den Bestand.
  const versand = (async () => {
    try {
      const res = await fetch(RESEND_ENDPOINT, {
        method: "POST",
        headers: { authorization: `Bearer ${resendKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          from: fromEmail,
          // Der Absender liegt auf effbeezee.com, der Rückkanal auf der
          // Club-Domain. Das ist kein Schönheitsfehler, sondern die Folge der
          // Absenderentscheidung vom 06.08.2026 — und der Aktivierungsbildschirm
          // sagt dem Mitglied zu, dass eine Antwort ankommt. Ohne dieses Feld
          // ist diese Zusage unwahr.
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
        return;
      }
      const { id } = (await res.json().catch(() => ({}))) as { id?: string };
      // `zweck` mitschreiben: im Protokoll sind die zwei Fälle sonst nicht zu
      // trennen, und genau das ist die Frage, die beim ersten Support-Fall
      // gestellt wird („kam bei ihr eine Reset-Mail an oder eine Aktivierung?").
      log("info", "mail_sent", {
        profileId: row.profile_id,
        resendId: id,
        zweck: istReset ? "reset" : "aktivierung",
      });
    } catch (e) {
      // HIER wird BEWUSST NICHT entwertet — anders als im Zweig darüber.
      //
      // Ein `!res.ok` ist eine Ablehnung: Resend hat die Mail nicht angenommen,
      // es ging nichts raus, das Token ist wertlos. Ein Wurf ist etwas anderes.
      // Er trifft auch den Fall, dass die ANTWORT verlorengeht, nachdem Resend
      // die Mail bereits angenommen und zugestellt hat. Entwerteten wir hier,
      // hielte das Mitglied eine echte Mail in der Hand, deren Link „überholt"
      // meldet — die Auskunft für einen Link, den ein neuerer ersetzt hat, was
      // nicht passiert ist. Ein zugestellter Link ist mehr wert als ein
      // geschlossenes Schutzfenster.
      //
      // Der Preis ist benannt: für diesen selteneren Fall bleibt E1 bestehen,
      // das Token liegt gültig da und der anonyme Weg schweigt bis zu 24 h.
      // Deshalb ist die Logzeile `warn` und nicht `error` — sie ist der einzige
      // Ort, an dem dieser Zustand sichtbar wird.
      log("warn", "resend_threw_token_bleibt", {
        error: e instanceof Error ? e.name : "unknown",
        profileId: row.profile_id,
      });
    }
  })();

  // Hält die Isolate am Leben, bis der Versand durch ist.
  (
    globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }
  ).EdgeRuntime?.waitUntil?.(versand);

  return ANGENOMMEN();
});
