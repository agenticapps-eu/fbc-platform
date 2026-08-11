// redeem-activation — die Kernlogik hinter dem Aktivierungslink (AGE-495 / C3).
//
// Reine Logik, mit `deno test` prüfbar (redeem.test.ts): der `Deno.serve`-Rumpf
// in index.ts erzeugt nur noch die echten Abhängigkeiten (Supabase-RPCs,
// `auth.admin.updateUserById`, `log`) und ruft `redeemActivation` auf. Dasselbe
// Muster wie send-activation (emails.ts) und stripe-webhook (webhook.ts).
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

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Ergebnis, das `index.ts` unverändert an `antwort()` weiterreicht. */
export interface RedeemAntwort {
  status: number;
  body: Record<string, unknown>;
}

/**
 * Die Außenwelt von `redeemActivation`: jeder RPC-Aufruf, `updateUserById` und
 * `log` kommen als Parameter herein, statt sich die Function selbst zu bauen.
 * So lässt sich jeder Teilfehlschlag ohne echte Datenbank oder echtes Netz
 * erzwingen.
 */
export interface RedeemDeps {
  // `PromiseLike`, nicht `Promise`: `supabase.rpc(...)` liefert einen
  // `PostgrestFilterBuilder` (thenable, aber ohne `catch`/`finally`) — dieselbe
  // Signatur, mit der ihn `index.ts` unverändert durchreicht.
  claimActivationToken: (
    tokenHash: string,
  ) => PromiseLike<{ data: unknown; error: { code?: string } | null }>;
  noteFailedActivation: (
    ip: string,
  ) => PromiseLike<{ data: unknown; error: { code?: string } | null }>;
  updateUserById: (
    profileId: string,
    attrs: { password: string },
  ) => Promise<{ error: { status?: number } | null }>;
  revokeSessions: (profileId: string) => PromiseLike<{ error: { code?: string } | null }>;
  markActivated: (profileId: string) => PromiseLike<{ error: { code?: string } | null }>;
  log: (level: "info" | "warn" | "error", event: string, fields?: Record<string, unknown>) => void;
}

export async function redeemActivation(
  token: string,
  password: string,
  ip: string,
  deps: RedeemDeps,
): Promise<RedeemAntwort> {
  // ── 1. Beanspruchen ───────────────────────────────────────────────────────
  const hash = await sha256Hex(token);
  const { data, error } = await deps.claimActivationToken(hash);
  if (error) {
    deps.log("error", "claim_failed", { code: error.code });
    return { body: { status: "error" }, status: 502 };
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
    const { data: eimer, error: drosselFehler } = await deps.noteFailedActivation(ip);
    if (drosselFehler) {
      // Absichtlich fail-open: die Drossel ist ein Zähler mit
      // Missbrauchssignal, weder Lastbremse noch Sicherheitsgrenze (Befund
      // 14.6, entschieden 2026-08-09 — die Spec trägt die Begründung samt
      // ihrem Preis). Sie darf den Einlöseweg nicht mit sich reißen.
      deps.log("error", "throttle_failed", { code: drosselFehler.code });
    } else {
      const eimerZeile = Array.isArray(eimer) ? eimer[0] : eimer;
      if (eimerZeile?.throttled) {
        deps.log("warn", "throttled", { attempts: eimerZeile.attempts });
        return { body: { status: "throttled" }, status: 429 };
      }
    }

    deps.log("info", "not_claimed", { status });
    return { body: { status }, status: 410 };
  }

  const profileId = String(row.profile_id);

  // ── 2. Passwort setzen ────────────────────────────────────────────────────
  const { error: pwFehler } = await deps.updateUserById(profileId, { password });
  if (pwFehler) {
    // Das Token ist verbraucht, das Passwort unverändert. Das Mitglied fordert
    // einen neuen Link an — deshalb sagt die Antwort genau das, statt „schon
    // aktiviert" zu behaupten.
    deps.log("error", "password_failed", { profileId, code: pwFehler.status });
    return { body: { status: "retry_needed" }, status: 502 };
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
  const { error: signOutFehler } = await deps.revokeSessions(profileId);
  if (signOutFehler) {
    deps.log("error", "signout_failed", { profileId, code: signOutFehler.code });
    return { body: { status: "retry_needed" }, status: 502 };
  }

  // ── 4. Aktivieren — der letzte Schritt, er öffnet das Gate ────────────────
  const { error: aktivFehler } = await deps.markActivated(profileId);
  if (aktivFehler) {
    deps.log("error", "activate_failed", { profileId, code: aktivFehler.code });
    return { body: { status: "retry_needed" }, status: 502 };
  }

  deps.log("info", "activated", { profileId });
  return { body: { status: "activated" }, status: 200 };
}
