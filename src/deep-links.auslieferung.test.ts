import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { AASA_MUSTER } from "./lib/deep-links";

/**
 * Die Auslieferung der beiden Verifizierungsdateien (AGE-643, §3).
 *
 * **Jede Prüfung hier liest den Rumpf, keine den Statuscode.** Am 11.09. gegen
 * `app.effbeezee.com` gemessen: beide Adressen antworteten mit **HTTP 200**,
 * `text/html`, 7986 Bytes, zeichengleich mit `/` — der SPA-Fallback. Ein Test
 * auf den Status wäre grün gewesen, bevor es die Dateien gibt.
 *
 * Diese Datei prüft den Baum, nicht das Netz; die Live-Messung steht in
 * Aufgabe 4.6 und gehört gegen die 7986 Bytes gehalten.
 */

const AASA = "public/.well-known/apple-app-site-association";
const ASSETLINKS = "public/.well-known/assetlinks.json";
const HEADERS = "public/_headers";

/** Team-Präfix aus `App.entitlements`, Paketname aus der Xcode-Konfiguration. */
const APP_ID = "WQZJ8649TN.com.effbeezee.app";
const PAKET = "com.effbeezee.app";

function liesJson(pfad: string): unknown {
  expect(existsSync(pfad), `${pfad} fehlt`).toBe(true);
  return JSON.parse(readFileSync(pfad, "utf8"));
}

/**
 * Der Regelblock einer Route aus `public/_headers`.
 *
 * Cloudflare liest eine nicht eingerückte Zeile als Route und alles Eingerückte
 * darunter als ihre Regeln; eine Leerzeile beendet den Block. Kommentarzeilen
 * bleiben drin — der Vermerk zur Fingerabdruck-Lücke ist einer.
 */
function regelblock(route: string): string[] {
  const zeilen = readFileSync(HEADERS, "utf8").split("\n");
  const start = zeilen.findIndex((z) => z.trim() === route);
  if (start === -1) return [];
  const block: string[] = [];
  for (const zeile of zeilen.slice(start + 1)) {
    if (zeile.trim() === "" || !/^\s/.test(zeile)) break;
    block.push(zeile.trim());
  }
  return block;
}

describe("Verifizierungsdateien für Universal Links (AGE-643)", () => {
  it("apple-app-site-association führt die App-Kennung und alle vier Pfade", () => {
    const aasa = liesJson(AASA) as {
      applinks?: { details?: { appIDs?: string[]; components?: Record<string, string>[] }[] };
    };

    const details = aasa.applinks?.details ?? [];
    expect(details.length).toBeGreaterThanOrEqual(1);
    expect(details.flatMap((d) => d.appIDs ?? [])).toContain(APP_ID);

    const muster = details.flatMap((d) => (d.components ?? []).map((k) => k["/"]));
    for (const erwartet of AASA_MUSTER) expect(muster).toContain(erwartet);

    // Ein Doppelpunkt-Platzhalter aus der Routentabelle (`/chat/:threadId`) ist
    // hier wirkungslos und träfe nie zu — Apple kennt nur `*` und `?`.
    expect(muster.join(" ")).not.toMatch(/:/);
  });

  it("assetlinks.json nennt das Paket und trägt mindestens einen Fingerabdruck", () => {
    const eintraege = liesJson(ASSETLINKS) as {
      relation?: string[];
      target?: { namespace?: string; package_name?: string; sha256_cert_fingerprints?: string[] };
    }[];

    expect(Array.isArray(eintraege)).toBe(true);
    const unser = eintraege.find((e) => e.target?.package_name === PAKET);
    expect(unser, `kein Eintrag für ${PAKET}`).toBeDefined();
    expect(unser?.relation).toContain("delegate_permission/common.handle_all_urls");
    expect(unser?.target?.namespace).toBe("android_app");

    // **Mindestens** einer: der Upload-Fingerabdruck steht jetzt drin, Googles
    // aus Play App Signing kommt in AGE-644 dazu (Entwurf, Entscheidung 6).
    const abdruecke = unser?.target?.sha256_cert_fingerprints ?? [];
    expect(abdruecke.length).toBeGreaterThanOrEqual(1);
    for (const abdruck of abdruecke) {
      expect(abdruck).toMatch(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);
    }
  });

  it("_headers weist der endungslosen Datei application/json zu", () => {
    const block = regelblock(`/.well-known/apple-app-site-association`);
    expect(block.length, `keine Regel für ${AASA} in ${HEADERS}`).toBeGreaterThan(0);

    // Ohne den Typ lehnt Apple die Datei ab, und man sieht es ihr nicht an:
    // ausgeliefert wird sie so oder so, nur eben als `text/plain`.
    expect(block.some((z) => /^content-type:\s*application\/json\b/i.test(z))).toBe(true);
  });

  it("_headers trägt den Vermerk über den fehlenden Play-Fingerabdruck", () => {
    // Der Vermerk gehört NICHT in `assetlinks.json` — die Datei ist strikt
    // geparstes JSON, ein Zusatzschlüssel wäre ein Fehler statt eines Hinweises.
    // Er steht deshalb hier, neben der Regel, die nur wegen dieser beiden
    // Dateien existiert (Entwurf, Entscheidung 6).
    const vermerk = regelblock(`/.well-known/apple-app-site-association`)
      .filter((z) => z.startsWith("#"))
      .join(" ");
    expect(vermerk).toMatch(/AGE-644/);
    expect(vermerk).toMatch(/Fingerabdruck/i);
  });
});
