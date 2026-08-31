import { createPublicKey } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `capacitor.config.ts` ist die einzige Datei des Projekts, deren Inhalt NUR
 * ueber den Store auf ein Geraet kommt. Ein Fehler darin ist einen bis drei Tage
 * lang nicht korrigierbar — der Luftweg tauscht `public/`, und diese Datei liegt
 * daneben (`android/app/src/main/assets/`, `ios/App/App/`). Deshalb dieser
 * Waechter.
 *
 * Er misst drei Dinge, und alle drei scheitern SONST STILL:
 *
 * 1. **Die Endpunkte zeigen auf uns.** Eine fehlende Angabe schaltet den
 *    jeweiligen Weg nicht ab, sondern setzt capgos eigene Vorgabe ein
 *    (`CapacitorUpdaterPlugin.java:98-100`) — samt `device_id` und `app_id`
 *    jedes Geraets an einen Dritten.
 * 2. **Der oeffentliche Schluessel ist PKCS#1 mit genau dieser Kopfzeile.**
 *    `decryptFile` prueft sie woertlich und kehrt sonst ohne Ausnahme zurueck
 *    (`CryptoCipher.java:145`).
 * 3. **Er hat 2048 Bit.** Am 31.08. lag ein 4096-Bit-Schluessel in Infisical und
 *    galt als dreifach belegt; die drei Belege prueften Format, Uebertragung und
 *    Rundlauf — und ein Rundlauf gelingt mit JEDER Schluessellaenge.
 */

const HOST = "https://beispielprojekt.supabase.co";

/**
 * Frisch importieren, nachdem `process.env` gesetzt ist. Ein Import am
 * Dateikopf laeuft VOR jedem `beforeEach` — die Zusagen unten haetten dann den
 * Wert gemessen, den die Umgebung des Entwicklers zufaellig trug.
 */
async function ladeConfig() {
  vi.resetModules();
  return (await import("../capacitor.config")).default;
}

describe("capacitor.config.ts", () => {
  const vorher = process.env.VITE_SUPABASE_URL;

  beforeEach(() => {
    process.env.VITE_SUPABASE_URL = HOST;
  });
  afterEach(() => {
    if (vorher === undefined) delete process.env.VITE_SUPABASE_URL;
    else process.env.VITE_SUPABASE_URL = vorher;
  });

  it("legt alle drei Endpunkte auf den eigenen Host", async () => {
    const plugin = (await ladeConfig()).plugins?.CapacitorUpdater;

    expect(plugin?.updateUrl).toBe(`${HOST}/functions/v1/ota-update`);
    expect(plugin?.channelUrl).toBe(`${HOST}/functions/v1/ota-channel`);
    expect(plugin?.statsUrl).toBe(`${HOST}/functions/v1/ota-stats`);
  });

  it("bricht ab, statt auf capgo zurueckzufallen", async () => {
    // Die eigentliche Zusage dieser Datei. Eine Vorgabe waere hier schlimmer als
    // ein Fehler: `cap sync` liefe durch, und der Abfluss stuende in keinem Diff.
    delete process.env.VITE_SUPABASE_URL;
    await expect(ladeConfig()).rejects.toThrow(/VITE_SUPABASE_URL/);

    process.env.VITE_SUPABASE_URL = "   ";
    await expect(ladeConfig()).rejects.toThrow(/VITE_SUPABASE_URL/);
  });

  it("traegt den oeffentlichen Schluessel als PKCS#1 mit 2048 Bit", async () => {
    const key = (await ladeConfig()).plugins?.CapacitorUpdater?.publicKey;
    expect(typeof key).toBe("string");

    // Woertlich und am Anfang: das Plugin prueft mit `startsWith`.
    expect(key).toMatch(/^-----BEGIN RSA PUBLIC KEY-----\n/);
    expect(key?.trimEnd().endsWith("-----END RSA PUBLIC KEY-----")).toBe(true);

    const geparst = createPublicKey({ key: key as string, format: "pem" });
    expect(geparst.asymmetricKeyType).toBe("rsa");
    // 4096 waere hier die Zeile, die am 31.08. gefehlt hat.
    expect(geparst.asymmetricKeyDetails?.modulusLength).toBe(2048);
  });

  it("laesst das gescheiterte Buendel mit seinem ERROR liegen", async () => {
    // Die Vorgabe ist `true` und macht aus dem Rueckfall eine Endlosschleife:
    // das Loeschen mit `removeInfo: false` ueberschreibt den eben gesetzten
    // Status ERROR mit DELETED (`CapgoUpdater.swift:2325`,
    // `CapgoUpdater.java:1632`), und DELETED ist genau der Zweig, der beim
    // naechsten Start dasselbe Buendel erneut laedt (`.swift:4364-4379`,
    // `.java:4999`) — statt abzubrechen, wie ERROR es taete (`.swift:4391`,
    // `.java:4915`).
    //
    // `undefined` ist hier deshalb KEIN bestandener Test, sondern der
    // Fehlerfall: das Plugin liest dann seine eigene Vorgabe. Darum
    // `toBe(false)` und nicht `toBeFalsy()`.
    expect((await ladeConfig()).plugins?.CapacitorUpdater?.autoDeleteFailed).toBe(false);
  });

  it("stempelt eine semver-foermige Vertragsnummer", async () => {
    // Eine blanke Zahl liesse `currentVersionNative` auf iOS still auf `0.0.0`
    // stehen (`CapacitorUpdaterPlugin.swift:262`).
    expect((await ladeConfig()).plugins?.CapacitorUpdater?.version).toMatch(
      /^(0|[1-9][0-9]{0,3})\.(0|[1-9][0-9]{0,3})\.(0|[1-9][0-9]{0,3})$/,
    );
  });
});
