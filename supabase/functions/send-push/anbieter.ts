// ════════════════════════════════════════════════════════════════════════════
// AGE-641 — die beiden Anbieter: Anfrage bauen, Antwort bewerten
// ════════════════════════════════════════════════════════════════════════════
//
// Change: openspec/changes/push-fundament/. Phase A, Schritt 5.
//
// ══ DIE EINE ENTSCHEIDUNG, DIE HIER ZAEHLT ═════════════════════════════════
//
// `push_zustellung_quittieren` kennt drei Ausgaenge, und der Unterschied
// zwischen den letzten beiden ist der ganze Punkt (Migration
// `20260827240000`): ein 503 ist ein schlechter Moment, ein `Unregistered` ist
// ein Geraet, das es nicht mehr gibt. Wer beides gleich behandelt, verliert
// entweder Zustellungen oder sammelt tote Token.
//
// `dauerhaft` LOESCHT das Token. Darum ist die Vorgabe fuer alles Unbekannte
// `vorlaeufig` und nicht `dauerhaft`: ein Anbieter, der morgen einen neuen
// Fehlercode einfuehrt, soll Zustellungen verzoegern und keine Geraete
// abmelden. Eine Wiederholung kostet einen Versuch, eine faelschlich
// geloeschte Registrierung kostet das Mitglied jeden weiteren Hinweis — bis
// es die App das naechste Mal oeffnet und `claim_push_token` erneut laeuft.
//
// Aus demselben Grund ist ein 401/403 ausdruecklich `vorlaeufig`: das ist ein
// Fehler UNSERER Zugangsdaten und keine Aussage ueber das Geraet. Ein
// abgelaufener APNs-Schluessel duerfte sonst in einem Lauf jedes Token im
// Bestand loeschen.
//
// ══ WARUM DIE ZUGANGSTOKEN HIER ENTSTEHEN UND NICHT IM index.ts ════════════
//
// Beide Anbieter wollen ein kurzlebiges JWT, keinen statischen Schluessel —
// Google eines mit RS256, Apple eines mit ES256. Das ist genug eigene Mechanik,
// um sie neben die Anfragen zu stellen; `index.ts` bleibt damit Verdrahtung.
//
// Ohne fremde Abhaengigkeit: `deno test --frozen` prueft, dass `deno.lock` zum
// Code passt, und eine Base64url-Kodierung ist sechs Zeilen. WebCrypto kann
// beide Signaturen.
//
// Donald, 28.08.2026.
// ════════════════════════════════════════════════════════════════════════════

import type { Auftrag, Benachrichtigung } from "./nachrichten.ts";

/** Die drei Ausgaenge, die `push_zustellung_quittieren` annimmt. */
export type Ergebnis = "zugestellt" | "vorlaeufig" | "dauerhaft";

export interface Bewertung {
  ergebnis: Ergebnis;
  /** Kurzer Grund fuer `letzter_fehler`. Nie der Antwortkoerper — der kann
   *  bei APNs die Geraetekennung spiegeln. */
  grund: string | null;
}

// ── FCM ─────────────────────────────────────────────────────────────────────

export const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";

export function fcmEndpunkt(projektId: string): string {
  return `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projektId)}/messages:send`;
}

/**
 * Der Anfragekoerper fuer FCM v1.
 *
 * `data` traegt nur das Ziel — die App braucht es, um beim Tippen den
 * richtigen Bildschirm zu oeffnen. Kein Typ, kein Name, keine Kennung des
 * Absenders: was nicht mitfaehrt, kann auch nicht aus einem Log fallen.
 */
export function fcmKoerper(auftrag: Auftrag, n: Benachrichtigung): unknown {
  return {
    message: {
      token: auftrag.token,
      notification: { title: n.titel, body: n.text },
      ...(n.ziel ? { data: { ziel: n.ziel } } : {}),
      android: {
        // `high`, weil eine Nachricht ihren Zweck verliert, wenn sie im
        // Doze-Modus bis zum naechsten Wartungsfenster liegen bleibt.
        priority: "high",
        notification: { default_sound: true },
      },
    },
  };
}

/**
 * FCM v1 antwortet im Fehlerfall mit
 * `{error:{status, details:[{errorCode}]}}`. Der `errorCode` ist die genauere
 * Angabe und wird deshalb zuerst gelesen.
 */
export function bewerteFcm(status: number, koerper: unknown): Bewertung {
  if (status >= 200 && status < 300) return { ergebnis: "zugestellt", grund: null };

  const fehler = (koerper as { error?: { status?: string; details?: unknown[] } })?.error;
  const fcmCode = fcmFehlercode(fehler?.details);
  const grund = fcmCode ?? fehler?.status ?? `HTTP ${status}`;

  // Das Geraet gibt es nicht mehr, oder das Token gehoert nicht zu diesem
  // Projekt. Beides aendert sich nicht durch Wiederholen.
  if (fcmCode === "UNREGISTERED" || fcmCode === "INVALID_ARGUMENT") {
    return { ergebnis: "dauerhaft", grund };
  }
  // `NOT_FOUND` ist FCMs Statuscode fuer dasselbe — abgemeldetes Token.
  if (fehler?.status === "NOT_FOUND") return { ergebnis: "dauerhaft", grund };

  // Alles andere: unser Problem oder Apples/Googles Moment, nicht das Geraet.
  // `SENDER_ID_MISMATCH` faellt bewusst hierunter — es heisst, dass wir gegen
  // das falsche Projekt senden, und dann waere ein Loeschen genau die falsche
  // Reaktion.
  return { ergebnis: "vorlaeufig", grund };
}

function fcmFehlercode(details: unknown): string | null {
  if (!Array.isArray(details)) return null;
  for (const d of details) {
    const code = (d as { errorCode?: unknown })?.errorCode;
    if (typeof code === "string" && code !== "") return code;
  }
  return null;
}

// ── APNs ────────────────────────────────────────────────────────────────────

export const APNS_HOST_PROD = "https://api.push.apple.com";
export const APNS_HOST_SANDBOX = "https://api.sandbox.push.apple.com";

export function apnsEndpunkt(host: string, token: string): string {
  return `${host}/3/device/${encodeURIComponent(token)}`;
}

/**
 * Der APNs-Koerper. `sound: 'default'`, damit eine Nachricht sich meldet;
 * `ziel` liegt neben `aps`, wie es das Protokoll fuer eigene Schluessel
 * vorsieht.
 */
export function apnsKoerper(n: Benachrichtigung): unknown {
  return {
    aps: {
      alert: { title: n.titel, body: n.text },
      sound: "default",
    },
    ...(n.ziel ? { ziel: n.ziel } : {}),
  };
}

export function apnsKopfzeilen(jwt: string, bundleId: string): Record<string, string> {
  return {
    authorization: `bearer ${jwt}`,
    "apns-topic": bundleId,
    "apns-push-type": "alert",
    // 10 = sofort. Bei `alert` ist das der einzige zulaessige Wert neben 5.
    "apns-priority": "10",
  };
}

/**
 * APNs antwortet im Fehlerfall mit `{"reason":"..."}`. Der Status allein
 * genuegt nicht: 400 traegt sowohl `BadDeviceToken` (dauerhaft) als auch
 * `IdleTimeout` (vorlaeufig).
 */
export function bewerteApns(status: number, koerper: unknown): Bewertung {
  if (status >= 200 && status < 300) return { ergebnis: "zugestellt", grund: null };

  const reason = (koerper as { reason?: unknown })?.reason;
  const grund = typeof reason === "string" && reason !== "" ? reason : `HTTP ${status}`;

  // 410 ist bei APNs eindeutig: das Token ist nicht mehr gueltig.
  if (status === 410) return { ergebnis: "dauerhaft", grund };

  // Diese drei sagen etwas ueber das TOKEN und aendern sich nicht durch
  // Wiederholen. `DeviceTokenNotForTopic` gehoert dazu: das Token stammt aus
  // einer anderen App — es wird hier nie zustellbar.
  if (
    grund === "BadDeviceToken" ||
    grund === "Unregistered" ||
    grund === "DeviceTokenNotForTopic"
  ) {
    return { ergebnis: "dauerhaft", grund };
  }

  // 403 (`ExpiredProviderToken`, `InvalidProviderToken`) ist unser Schluessel,
  // nicht das Geraet — sonst loeschte ein abgelaufener `.p8` den ganzen
  // Bestand. Ebenso 429 und alles ab 500.
  return { ergebnis: "vorlaeufig", grund };
}

// ── Zugangstoken ────────────────────────────────────────────────────────────

export interface Dienstkonto {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

/**
 * Google will ein RS256-JWT und tauscht es gegen ein Zugangstoken. Der
 * Rueckgabewert traegt seine eigene Ablaufzeit, damit der Aufrufer ihn ueber
 * mehrere Auftraege desselben Laufs wiederverwenden kann.
 */
export async function googleZugangstoken(
  konto: Dienstkonto,
  jetzt: number = Math.floor(Date.now() / 1000),
): Promise<string> {
  const tokenUri = konto.token_uri ?? "https://oauth2.googleapis.com/token";
  const jwt = await signiereJwt(
    { alg: "RS256", typ: "JWT" },
    {
      iss: konto.client_email,
      scope: FCM_SCOPE,
      aud: tokenUri,
      iat: jetzt,
      exp: jetzt + 3600,
    },
    await importierePkcs8(konto.private_key, {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    }),
    { name: "RSASSA-PKCS1-v1_5" },
  );

  const res = await fetch(tokenUri, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) {
    // Kein Antwortkoerper ins Log: er spiegelt bei Fehlkonfiguration die
    // Dienstkonto-Adresse.
    throw new Error(`google_token_${res.status}`);
  }
  const daten = (await res.json()) as { access_token?: string };
  if (!daten.access_token) throw new Error("google_token_ohne_access_token");
  return daten.access_token;
}

export interface ApnsSchluessel {
  p8: string;
  keyId: string;
  teamId: string;
}

/** Apple will ein ES256-JWT, das bis zu einer Stunde gilt. */
export function apnsJwt(
  schluessel: ApnsSchluessel,
  jetzt: number = Math.floor(Date.now() / 1000),
): Promise<string> {
  return importierePkcs8(schluessel.p8, { name: "ECDSA", namedCurve: "P-256" }).then((key) =>
    signiereJwt(
      { alg: "ES256", kid: schluessel.keyId },
      { iss: schluessel.teamId, iat: jetzt },
      key,
      { name: "ECDSA", hash: "SHA-256" },
    ),
  );
}

// ── JWT-Handwerk ────────────────────────────────────────────────────────────

/**
 * Base64url ohne Fuellzeichen. Exportiert, weil die Tests damit die Teile
 * eines JWT wieder auseinandernehmen — eine Signatur laesst sich pruefen,
 * ein falscher `aud` nur lesen.
 */
export function base64url(daten: Uint8Array | string): string {
  const bytes = typeof daten === "string" ? new TextEncoder().encode(daten) : daten;
  let roh = "";
  for (const b of bytes) roh += String.fromCharCode(b);
  return btoa(roh).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function signiereJwt(
  kopf: Record<string, unknown>,
  nutzlast: Record<string, unknown>,
  schluessel: CryptoKey,
  algorithmus: AlgorithmIdentifier | EcdsaParams,
): Promise<string> {
  const zuSignieren = `${base64url(JSON.stringify(kopf))}.${base64url(JSON.stringify(nutzlast))}`;
  const signatur = await crypto.subtle.sign(
    algorithmus,
    schluessel,
    new TextEncoder().encode(zuSignieren),
  );
  return `${zuSignieren}.${base64url(new Uint8Array(signatur))}`;
}

/**
 * PEM nach `CryptoKey`. Beide Schluessel liegen als PKCS#8 vor — Googles
 * `private_key` mit `\n` in der JSON-Zeichenkette, Apples `.p8` als Datei.
 * Die Zeilenumbrueche werden deshalb grosszuegig entfernt und nicht erwartet.
 */
async function importierePkcs8(
  pem: string,
  algorithmus: RsaHashedImportParams | EcKeyImportParams,
): Promise<CryptoKey> {
  const roh = pem
    .replace(/-----BEGIN [^-]+-----/, "")
    .replace(/-----END [^-]+-----/, "")
    .replace(/\s+/g, "");
  const bytes = Uint8Array.from(atob(roh), (c) => c.charCodeAt(0));
  return await crypto.subtle.importKey("pkcs8", bytes, algorithmus, false, ["sign"]);
}
