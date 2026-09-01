// deno test --allow-none  (aus supabase/functions/send-push/)
//
// Der Schwerpunkt liegt auf `bewerte*`. Diese beiden Funktionen entscheiden,
// ob ein Gerätetoken GELOESCHT wird — `dauerhaft` laesst
// `push_zustellung_quittieren` die Zeile aus `push_tokens` entfernen. Eine
// falsche Einstufung meldet ein Mitglied still von allen Hinweisen ab.
import { assertEquals, assertNotEquals, assertStringIncludes } from "jsr:@std/assert@1";
import {
  APNS_HOST_PROD,
  APNS_HOST_SANDBOX,
  apnsEndpunkt,
  apnsJwt,
  apnsKoerper,
  apnsKopfzeilen,
  apnsMitHostErkennung,
  base64url,
  bewerteApns,
  bewerteFcm,
  fcmEndpunkt,
  fcmKoerper,
} from "./anbieter.ts";
import { baueBenachrichtigung, type Auftrag } from "./nachrichten.ts";

/**
 * Ein Koerper, wie ihn der Anbieter saehe: einmal durch JSON und zurueck.
 * Der Umweg ist kein Zierrat — er belegt, dass die Felder die Serialisierung
 * ueberhaupt erreichen, und faengt ein `undefined` ab, das im Objekt noch
 * aussaehe wie ein Wert.
 *
 * `any` ist hier Absicht. `fcmKoerper` und `apnsKoerper` geben bewusst
 * `unknown` zurueck — der Anbieter-Koerper hat ausserhalb dieser Zusagen keine
 * Form, die jemand anfassen soll —, und dies ist die eine Stelle, die ihn zum
 * Pruefen aufmacht. Ein Generic `<T>(wert: T): T` genuegt nicht: es reicht
 * `unknown` durch, und `deno check` faellt dann mit neun Fehlern.
 *
 * Die Unterdrueckung gilt ESLint und nicht deno lint, denn nur ESLint laeuft
 * in CI (`pnpm lint` = `eslint .`, und das liest `supabase/functions/` mit).
 * Hier stand vorher `deno-lint-ignore` — also die Unterdrueckung fuer den
 * Linter, der gar nicht prueft, waehrend der pruefende rot wurde. Zwei
 * Direktiven uebereinander helfen nicht: beide gelten der NAECHSTEN Zeile,
 * also kann nur eine direkt ueber dem Code stehen.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const durchJson = (wert: unknown): any => JSON.parse(JSON.stringify(wert));

const auftrag: Auftrag = {
  notification_id: "hinweis-1",
  token_id: "token-1",
  token: "geraetetoken",
  plattform: "android",
  typ: "message",
  wer: "Bodo Bauer",
  ziel_id: "faden-7",
};

// ── FCM: Antworten einstufen ────────────────────────────────────────────────

const fcmFehler = (status: string, errorCode?: string) => ({
  error: {
    status,
    ...(errorCode
      ? { details: [{ "@type": "type.googleapis.com/…FcmError", errorCode }] }
      : {}),
  },
});

Deno.test("FCM 200 ist zugestellt", () => {
  assertEquals(bewerteFcm(200, { name: "projects/x/messages/1" }).ergebnis, "zugestellt");
});

Deno.test("FCM UNREGISTERED ist dauerhaft — das Geraet gibt es nicht mehr", () => {
  // So sieht die echte Antwort aus: 404, Status NOT_FOUND, dazu der genauere
  // `errorCode`. Beide Zweige treffen zu — deshalb steht die Zusage darunter.
  const b = bewerteFcm(404, fcmFehler("NOT_FOUND", "UNREGISTERED"));
  assertEquals(b.ergebnis, "dauerhaft");
  assertEquals(b.grund, "UNREGISTERED");
});

Deno.test("der errorCode allein traegt die Entscheidung, ohne NOT_FOUND", () => {
  // Ohne diese Zusage waere der `UNREGISTERED`-Zweig gar nicht gemessen: der
  // Fall darueber wird bereits von `status === 'NOT_FOUND'` erfasst, und ein
  // Entfernen der errorCode-Pruefung bliebe unbemerkt. Aufgefallen bei der
  // Gegenprobe — die Verfaelschung kam gruen durch.
  assertEquals(bewerteFcm(400, fcmFehler("INVALID_ARGUMENT", "UNREGISTERED")).ergebnis, "dauerhaft");
});

Deno.test("FCM INVALID_ARGUMENT ist dauerhaft — das Token passt nicht zum Projekt", () => {
  assertEquals(bewerteFcm(400, fcmFehler("INVALID_ARGUMENT", "INVALID_ARGUMENT")).ergebnis, "dauerhaft");
});

Deno.test("FCM NOT_FOUND ohne details ist ebenfalls dauerhaft", () => {
  assertEquals(bewerteFcm(404, fcmFehler("NOT_FOUND")).ergebnis, "dauerhaft");
});

Deno.test("FCM 429 und 5xx sind vorlaeufig — ein schlechter Moment", () => {
  assertEquals(bewerteFcm(429, fcmFehler("RESOURCE_EXHAUSTED")).ergebnis, "vorlaeufig");
  assertEquals(bewerteFcm(503, fcmFehler("UNAVAILABLE")).ergebnis, "vorlaeufig");
  assertEquals(bewerteFcm(500, fcmFehler("INTERNAL")).ergebnis, "vorlaeufig");
});

Deno.test("FCM 401 ist vorlaeufig — unser Schluessel, nicht das Geraet", () => {
  // Waere das `dauerhaft`, loeschte ein abgelaufenes Dienstkonto in einem
  // einzigen Lauf jedes Token im Bestand.
  assertEquals(bewerteFcm(401, fcmFehler("UNAUTHENTICATED")).ergebnis, "vorlaeufig");
  assertEquals(bewerteFcm(403, fcmFehler("PERMISSION_DENIED")).ergebnis, "vorlaeufig");
});

Deno.test("FCM SENDER_ID_MISMATCH ist vorlaeufig — wir senden gegen das falsche Projekt", () => {
  assertEquals(bewerteFcm(403, fcmFehler("PERMISSION_DENIED", "SENDER_ID_MISMATCH")).ergebnis, "vorlaeufig");
});

Deno.test("ein unbekannter FCM-Fehler loescht kein Token", () => {
  assertEquals(bewerteFcm(418, fcmFehler("WAS_AUCH_IMMER", "NEUER_CODE_VON_MORGEN")).ergebnis, "vorlaeufig");
  assertEquals(bewerteFcm(400, null).ergebnis, "vorlaeufig");
  assertEquals(bewerteFcm(500, "kein JSON").ergebnis, "vorlaeufig");
});

// ── APNs: Antworten einstufen ───────────────────────────────────────────────

Deno.test("APNs 200 ist zugestellt", () => {
  assertEquals(bewerteApns(200, null).ergebnis, "zugestellt");
});

Deno.test("APNs 410 ist dauerhaft", () => {
  assertEquals(bewerteApns(410, { reason: "Unregistered" }).ergebnis, "dauerhaft");
});

Deno.test("APNs BadDeviceToken und DeviceTokenNotForTopic sind dauerhaft", () => {
  assertEquals(bewerteApns(400, { reason: "BadDeviceToken" }).ergebnis, "dauerhaft");
  assertEquals(bewerteApns(400, { reason: "DeviceTokenNotForTopic" }).ergebnis, "dauerhaft");
});

Deno.test("APNs 400 IdleTimeout ist vorlaeufig — derselbe Status, andere Bedeutung", () => {
  // Genau hier reicht der Statuscode allein nicht: 400 traegt beides.
  assertEquals(bewerteApns(400, { reason: "IdleTimeout" }).ergebnis, "vorlaeufig");
});

Deno.test("APNs 403 ist vorlaeufig — ein abgelaufener .p8 leert sonst den Bestand", () => {
  assertEquals(bewerteApns(403, { reason: "ExpiredProviderToken" }).ergebnis, "vorlaeufig");
  assertEquals(bewerteApns(403, { reason: "InvalidProviderToken" }).ergebnis, "vorlaeufig");
});

Deno.test("APNs 429 und 5xx sind vorlaeufig", () => {
  assertEquals(bewerteApns(429, { reason: "TooManyRequests" }).ergebnis, "vorlaeufig");
  assertEquals(bewerteApns(500, { reason: "InternalServerError" }).ergebnis, "vorlaeufig");
  assertEquals(bewerteApns(503, { reason: "ServiceUnavailable" }).ergebnis, "vorlaeufig");
});

Deno.test("ein unbekannter APNs-Grund loescht kein Token", () => {
  assertEquals(bewerteApns(400, { reason: "NeuerGrundVonMorgen" }).ergebnis, "vorlaeufig");
  assertEquals(bewerteApns(400, null).ergebnis, "vorlaeufig");
});

Deno.test("der Grund ist der Anbieter-Code, nie der ganze Antwortkoerper", () => {
  // Ein APNs-Koerper kann die Geraetekennung spiegeln; `letzter_fehler` steht
  // in der Datenbank und wird gelesen.
  const b = bewerteApns(400, { reason: "BadDeviceToken", "apns-id": "geraetetoken" });
  assertEquals(b.grund, "BadDeviceToken");
  assertEquals(b.grund?.includes("geraetetoken"), false);
});

// ── Die Anfragekoerper ──────────────────────────────────────────────────────

Deno.test("der FCM-Koerper traegt Token, Satz und Ziel — und sonst nichts", () => {
  const n = baueBenachrichtigung(auftrag);
  const roh = JSON.stringify(fcmKoerper(auftrag, n));
  const k = durchJson(fcmKoerper(auftrag, n));

  assertEquals(Object.keys(k), ["message"]);
  assertEquals(k.message.token, "geraetetoken");
  assertEquals(k.message.notification, { title: "Neue Nachricht", body: "Bodo Bauer hat Ihnen geschrieben." });
  assertEquals(k.message.data, { ziel: "/chat/faden-7" });
  assertEquals(k.message.android.priority, "high");
  // Weder Hinweis- noch Token-Kennung fahren mit.
  assertEquals(roh.includes("hinweis-1"), false);
  assertEquals(roh.includes("token-1"), false);
});

Deno.test("ohne Ziel traegt der FCM-Koerper kein leeres data-Feld", () => {
  const n = baueBenachrichtigung({ ...auftrag, typ: "contact_request" });
  const k = durchJson(fcmKoerper(auftrag, n));
  assertEquals("data" in k.message, false);
});

Deno.test("der APNs-Koerper legt das Ziel neben aps, nicht hinein", () => {
  const n = baueBenachrichtigung(auftrag);
  const k = durchJson(apnsKoerper(n));
  assertEquals(k.aps.alert, { title: "Neue Nachricht", body: "Bodo Bauer hat Ihnen geschrieben." });
  assertEquals(k.aps.sound, "default");
  assertEquals(k.ziel, "/chat/faden-7");
});

Deno.test("die APNs-Kopfzeilen nennen Thema, Art und Dringlichkeit", () => {
  const h = apnsKopfzeilen("jwt-hier", "eu.fairbusinessclub.app");
  assertEquals(h.authorization, "bearer jwt-hier");
  assertEquals(h["apns-topic"], "eu.fairbusinessclub.app");
  assertEquals(h["apns-push-type"], "alert");
  assertEquals(h["apns-priority"], "10");
});

Deno.test("die Endpunkte kodieren, was aus der Datenbank kommt", () => {
  assertStringIncludes(fcmEndpunkt("mein projekt"), "/v1/projects/mein%20projekt/messages:send");
  assertStringIncludes(apnsEndpunkt("https://h", "a/b"), "/3/device/a%2Fb");
});

// ── JWT ─────────────────────────────────────────────────────────────────────

Deno.test("base64url fuellt nicht auf und nutzt keine Schraegstriche", () => {
  const b = base64url(new Uint8Array([251, 255, 190, 255]));
  assertEquals(b.includes("="), false);
  assertEquals(b.includes("+"), false);
  assertEquals(b.includes("/"), false);
  assertEquals(b, "-_--_w");
});

Deno.test("apnsJwt signiert mit ES256 — und die Signatur haelt der Pruefung stand", async () => {
  // Ein echter Schluessel, kein Attrappen-Ergebnis: haette `importierePkcs8`
  // den PEM-Rumpf falsch geschnitten, faende es nur dieser Weg.
  const paar = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ]);
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", paar.privateKey));
  const pem = `-----BEGIN PRIVATE KEY-----\n${
    (base64url(pkcs8).replace(/-/g, "+").replace(/_/g, "/") + "===").slice(
      0,
      Math.ceil(pkcs8.length / 3) * 4,
    )
  }\n-----END PRIVATE KEY-----`;

  const jwt = await apnsJwt({ p8: pem, keyId: "KEY123", teamId: "TEAM456" }, 1_700_000_000);
  const [kopf, nutzlast, signatur] = jwt.split(".");
  assertEquals(jwt.split(".").length, 3);

  const entziffert = (t: string) =>
    JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(t.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0))));
  assertEquals(entziffert(kopf), { alg: "ES256", kid: "KEY123" });
  assertEquals(entziffert(nutzlast), { iss: "TEAM456", iat: 1_700_000_000 });

  const sigBytes = Uint8Array.from(
    atob(signatur.replace(/-/g, "+").replace(/_/g, "/")),
    (c) => c.charCodeAt(0),
  );
  const gueltig = await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    paar.publicKey,
    sigBytes,
    new TextEncoder().encode(`${kopf}.${nutzlast}`),
  );
  assertEquals(gueltig, true);

  // Gegenkontrolle: ein veraenderter Kopf darf NICHT durchgehen — sonst
  // belegte die Zusage oben nur, dass `verify` „true" sagt.
  const boese = await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    paar.publicKey,
    sigBytes,
    new TextEncoder().encode(`${kopf}x.${nutzlast}`),
  );
  assertNotEquals(boese, true);
});

// ── Host-Erkennung aus dem Input (AGE-641) ──────────────────────────────────
//
// Ein Geraetetoken gehoert entweder zur Sandbox oder zur Produktion, und dem
// Token sieht man das NICHT an. Bis zum 31.08. entschied `APNS_SANDBOX` den
// Host fest — und ein Token der jeweils anderen Umgebung bekam
// `BadDeviceToken`, was `bewerteApns` als `dauerhaft` einstuft: das Token wird
// GELOESCHT. Ein Entwicklungsbuild gegen PROD meldete sich damit still von
// allen Hinweisen ab (gemessen am 31.08. auf PROD).
//
// Deshalb entscheidet jetzt die Antwort, nicht die Konfiguration.

Deno.test("Host-Erkennung: gelingt der erste Versuch, gibt es keinen zweiten", async () => {
  const gesehen: string[] = [];
  const b = await apnsMitHostErkennung(APNS_HOST_PROD, (host) => {
    gesehen.push(host);
    return Promise.resolve({ ergebnis: "zugestellt", grund: null } as const);
  });
  assertEquals(b.ergebnis, "zugestellt");
  // Die Zusage ist die LAENGE. Ohne sie bliebe ein Ausweichversuch auf jedem
  // Erfolg unbemerkt — doppelter Verkehr zu Apple bei jedem Hinweis.
  assertEquals(gesehen, [APNS_HOST_PROD]);
});

Deno.test("Host-Erkennung: BadDeviceToken weicht auf den anderen Host aus (PROD -> Sandbox)", async () => {
  const gesehen: string[] = [];
  const b = await apnsMitHostErkennung(APNS_HOST_PROD, (host) => {
    gesehen.push(host);
    return Promise.resolve(
      host === APNS_HOST_SANDBOX
        ? ({ ergebnis: "zugestellt", grund: null } as const)
        : bewerteApns(400, { reason: "BadDeviceToken" }),
    );
  });
  assertEquals(gesehen, [APNS_HOST_PROD, APNS_HOST_SANDBOX]);
  // Das Ergebnis des ZWEITEN Versuchs gilt — sonst bliebe `dauerhaft` stehen
  // und das Token waere trotz erfolgreicher Zustellung geloescht.
  assertEquals(b.ergebnis, "zugestellt");
});

Deno.test("Host-Erkennung: weicht auch in der Gegenrichtung aus (Sandbox -> PROD)", async () => {
  const gesehen: string[] = [];
  const b = await apnsMitHostErkennung(APNS_HOST_SANDBOX, (host) => {
    gesehen.push(host);
    return Promise.resolve(
      host === APNS_HOST_PROD
        ? ({ ergebnis: "zugestellt", grund: null } as const)
        : bewerteApns(400, { reason: "BadDeviceToken" }),
    );
  });
  assertEquals(gesehen, [APNS_HOST_SANDBOX, APNS_HOST_PROD]);
  assertEquals(b.ergebnis, "zugestellt");
});

Deno.test("Host-Erkennung: kennt KEIN Host das Token, bleibt es dauerhaft", async () => {
  const gesehen: string[] = [];
  const b = await apnsMitHostErkennung(APNS_HOST_PROD, (host) => {
    gesehen.push(host);
    return Promise.resolve(bewerteApns(400, { reason: "BadDeviceToken" }));
  });
  assertEquals(gesehen.length, 2);
  // Hier ist Loeschen richtig: das Token ist in BEIDEN Umgebungen unbekannt.
  assertEquals(b.ergebnis, "dauerhaft");
  assertEquals(b.grund, "BadDeviceToken");
});

Deno.test("Host-Erkennung: andere dauerhafte Gruende weichen NICHT aus", async () => {
  // `Unregistered` und `DeviceTokenNotForTopic` sagen etwas ueber das Token,
  // das am anderen Host genauso gilt. Ein zweiter Versuch verdoppelte nur den
  // Verkehr fuer wirklich tote Tokens.
  for (const [status, grund] of [[410, "Unregistered"], [400, "DeviceTokenNotForTopic"]] as const) {
    const gesehen: string[] = [];
    const b = await apnsMitHostErkennung(APNS_HOST_PROD, (host) => {
      gesehen.push(host);
      return Promise.resolve(bewerteApns(status, { reason: grund }));
    });
    assertEquals(gesehen, [APNS_HOST_PROD], grund);
    assertEquals(b.ergebnis, "dauerhaft", grund);
  }
});

Deno.test("Host-Erkennung: vorlaeufige Fehler weichen NICHT aus", async () => {
  // 503 ist Apples Problem, nicht das des Tokens. Ausweichen hiesse, den
  // Ausfall am anderen Host ein zweites Mal abzuwarten.
  const gesehen: string[] = [];
  const b = await apnsMitHostErkennung(APNS_HOST_PROD, (host) => {
    gesehen.push(host);
    return Promise.resolve(bewerteApns(503, { reason: "ServiceUnavailable" }));
  });
  assertEquals(gesehen, [APNS_HOST_PROD]);
  assertEquals(b.ergebnis, "vorlaeufig");
});

Deno.test("Verdrahtung: `ueberApns` benutzt die Host-Erkennung wirklich", async () => {
  // Ohne diese Zusage waere die Funktion tot und alles gruen: `deno test`
  // typprueft nur, was ein Test importiert, und das ist `index.ts` gerade
  // nicht. Dieselbe Falle wie bei `src/lib/ota.ts` (AGE-642, Runde 6).
  const quelle = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  // Auf den AUFRUF geprueft, nicht auf den blossen Namen. Die erste Fassung
  // dieser Zusage suchte "apnsMitHostErkennung" — und blieb gruen, als die
  // Mutations-Gegenprobe den Aufruf durch eine anonyme Funktion ersetzte: der
  // Name stand ja noch im Import und im Kommentar daneben. Gemessen, nicht
  // vermutet (31.08.).
  //
  // Leerraum eingeebnet, damit ein Umbruch durch `deno fmt` die Zusage nicht
  // roetet — die Zusage gilt dem Aufruf, nicht seiner Formatierung.
  const kompakt = quelle.replace(/\s+/g, " ");
  assertStringIncludes(kompakt, "apnsMitHostErkennung(ersterHost,");

  // Und der zweite Versuch muss den Host auch BENUTZEN. Ohne diese Zeile
  // koennte `apnsEndpunkt` weiter auf `ersterHost` zeigen: die Erkennung liefe,
  // waere aber wirkungslos — und keine Zusage an der reinen Funktion saehe es,
  // denn die kennt `apnsEndpunkt` gar nicht.
  assertStringIncludes(kompakt, "apnsEndpunkt(host,");
});
