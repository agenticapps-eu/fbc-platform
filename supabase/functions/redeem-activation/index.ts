// redeem-activation — löst den Aktivierungslink ein (AGE-495 / C3).
//
// ── Warum verify_jwt = false ────────────────────────────────────────────────
// ABSICHT, kein Versehen. Das Token trägt die Identität, nicht die Sitzung —
// nur so funktioniert der Link in einem anderen Browser oder auf einem anderen
// Gerät (AGE-495 §6). Es wird KEIN JWT gelesen; der einzige Nachweis ist das
// 256-Bit-Token.
//
// ── Die Reihenfolge IST die Sicherung ───────────────────────────────────────
// `auth.admin.updateUserById` läuft über GoTrue per HTTP und kann mit einem
// Postgres-Commit nicht klammern — echte Atomarität ist nicht zu haben. Statt
// sie zuzusagen, ist die Reihenfolge festgelegt:
//
//   1. Token atomar beanspruchen (claim_activation_token — EINE Anweisung).
//      Zwei gleichzeitige Einlösungen kämen sonst beide durch und setzten
//      verschiedene Passwörter; das Mitglied wüsste nicht, welches gilt.
//   2. Passwort setzen.
//   3. Alle Sitzungen des Kontos beenden.
//   4. ERST DANACH aktivieren (mark_activated).
//
// Schritt 4 steht am Ende, weil er das Gate öffnet. Alles, was schiefgehen
// kann, geht schief, solange es noch geschlossen ist. Bricht es nach Schritt 2
// ab, steht ein Konto mit NEUEM Passwort und ohne Aktivierung: das Mitglied
// kommt herein, sieht den Aktivierungsbildschirm und fordert einen neuen Link
// an. Die umgekehrte Reihenfolge erzeugte den gefährlichen Zustand — aktiviert,
// aber noch auf dem verteilten Passwort.
//
// Secrets: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (plattform-injiziert).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.108.1";

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

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
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

  // ── 1. Beanspruchen ───────────────────────────────────────────────────────
  const hash = await sha256Hex(token);
  const { data, error } = await supabase.rpc("claim_activation_token", { p_token_hash: hash });
  if (error) {
    log("error", "claim_failed", { code: error.code });
    return antwort({ status: "error" }, 502);
  }

  const row = Array.isArray(data) ? data[0] : data;
  const status = String(row?.status ?? "not_found");

  // `superseded` ist bewusst NICHT `used`: ein durch einen neueren Link
  // entwertetes Token bedeutet nicht, dass das Konto aktiviert ist. Die
  // Oberfläche muss dafür etwas anderes sagen können.
  if (status !== "claimed") {
    // ── Drossel (Task 5.6 / 12.6) ───────────────────────────────────────────
    // Sie steht HIER und nicht oben: gezählt wird nur, was ohnehin abgelehnt
    // wird. Ein gültiges Token hat die Verzweigung längst verlassen und wird
    // nie gedrosselt — das ist die Eigenschaft, an der 12.6 hing (NAT). Die
    // Begründung in voller Länge im Kopf von 20260806110000.
    //
    // Die IP wird nicht protokolliert. Sie ist ein personenbezogenes Datum,
    // und die Drossel braucht sie nur im gleitenden Fenster der Tabelle.
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
    const { data: eimer, error: drosselFehler } = await supabase.rpc("note_failed_activation", {
      p_ip: ip,
    });
    if (drosselFehler) {
      // Absichtlich fail-open: die Drossel ist eine Lastbremse, keine
      // Sicherheitsgrenze. Sie darf den Einlöseweg nicht mit sich reißen.
      log("error", "throttle_failed", { code: drosselFehler.code });
    } else {
      const eimerZeile = Array.isArray(eimer) ? eimer[0] : eimer;
      if (eimerZeile?.throttled) {
        log("warn", "throttled", { attempts: eimerZeile.attempts });
        return antwort({ status: "throttled" }, 429);
      }
    }

    log("info", "not_claimed", { status });
    return antwort({ status }, 410);
  }

  const profileId = String(row.profile_id);

  // ── 2. Passwort setzen ────────────────────────────────────────────────────
  const { error: pwFehler } = await supabase.auth.admin.updateUserById(profileId, { password });
  if (pwFehler) {
    // Das Token ist verbraucht, das Passwort unverändert. Das Mitglied fordert
    // einen neuen Link an — deshalb sagt die Antwort genau das, statt „schon
    // aktiviert" zu behaupten.
    log("error", "password_failed", { profileId, code: pwFehler.status });
    return antwort({ status: "retry_needed" }, 502);
  }

  // ── 3. Sitzungen beenden ──────────────────────────────────────────────────
  // NICHT über `auth.admin.signOut`: die Methode erwartet ein Access-JWT, keine
  // Nutzer-ID (Signatur am 2026-08-06 nachgemessen). Wir haben hier keine
  // Sitzung des Mitglieds, nur seine ID — der Aufruf wäre zur Laufzeit 401
  // gelaufen und hätte jede Aktivierung scheitern lassen.
  //
  // Gemessen: ein Passwortwechsel tötet Access- UND Refresh-Token bereits. Für
  // den Admin-Pfad ist das UNGEMESSEN, deshalb hier ausdrücklich. Vorsicht,
  // nicht Befund. Schlägt es fehl, wird NICHT aktiviert — sonst liefe genau die
  // vorab angelegte Sitzung eines Dritten hinter dem geöffneten Gate weiter.
  const { error: signOutFehler } = await supabase.rpc("revoke_sessions", {
    p_profile_id: profileId,
  });
  if (signOutFehler) {
    log("error", "signout_failed", { profileId, code: signOutFehler.code });
    return antwort({ status: "retry_needed" }, 502);
  }

  // ── 4. Aktivieren — der letzte Schritt, er öffnet das Gate ────────────────
  const { error: aktivFehler } = await supabase.rpc("mark_activated", { p_profile_id: profileId });
  if (aktivFehler) {
    log("error", "activate_failed", { profileId, code: aktivFehler.code });
    return antwort({ status: "retry_needed" }, 502);
  }

  log("info", "activated", { profileId });
  return antwort({ status: "activated" }, 200);
});
