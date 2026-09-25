import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * AGE-907: `ITSAppUsesNonExemptEncryption` = `false` in `ios/App/App/Info.plist`.
 *
 * Ohne den Schluessel fragt App Store Connect bei JEDEM Upload nach einer
 * Exportangabe, und der Build bleibt bis zur Antwort in „Missing Compliance"
 * stehen — er erscheint in TestFlight gar nicht. Das ist kein Fehler, den man
 * im Log sieht; es ist ein Build, der einfach nicht auftaucht.
 *
 * `false` ist hier die richtige Angabe, weil die App keine eigene
 * Verschluesselung mitbringt: sie spricht HTTPS, und das ist die Ausnahme, auf
 * die sich der Schluessel bezieht. Wer hier spaeter eigene Kryptografie
 * einbaut — ein verschluesselter lokaler Speicher etwa —, muss diesen Wert und
 * die Exportangabe neu bewerten, nicht diesen Test anpassen.
 *
 * Der Waechter liest die Datei als Text und nicht ueber einen plist-Parser:
 * `Info.plist` traegt `$(…)`-Platzhalter, die kein Parser aufloesen kann, ohne
 * Xcode-Einstellungen zu kennen.
 */

const PLIST = "ios/App/App/Info.plist";

function plist(): string {
  return readFileSync(PLIST, "utf8");
}

describe("ios/App/App/Info.plist — Exportangabe (AGE-907)", () => {
  it("fuehrt ITSAppUsesNonExemptEncryption", () => {
    expect(plist()).toContain("<key>ITSAppUsesNonExemptEncryption</key>");
  });

  it("setzt den Wert auf false, nicht auf true", () => {
    // Der Schluessel allein genuegt nicht: `true` verlangt eine
    // Exportgenehmigung und ist die teurere Falschangabe von beiden.
    //
    // Gemessen wird das Element UNMITTELBAR hinter dem Schluessel, nicht ein
    // Textfenster dahinter. Die erste Fassung nahm 120 Zeichen und schlug fehl,
    // weil sie bis in das `<true/>` von `LSRequiresIPhoneOS` reichte — ein
    // roter Lauf bei richtiger Datei.
    const treffer = plist().match(
      /<key>ITSAppUsesNonExemptEncryption<\/key>\s*<(true|false)\s*\/>/,
    );
    expect(treffer?.[1]).toBe("false");
  });

  it("Positivkontrolle: der Leser sieht die Datei wirklich", () => {
    // Ohne diese Zusage waere ein leerer oder falsch benannter Pfad ein
    // gruener Lauf mit zwei stillen Verneinungen.
    expect(plist()).toContain("<key>CFBundleIdentifier</key>");
  });
});
