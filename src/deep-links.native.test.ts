import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { DEEP_LINK_HOST, DEEP_LINK_PRAEFIXE } from "./lib/deep-links";

/**
 * Die Anmeldung der Domain an beiden Plattformen (AGE-643, §5).
 *
 * Beide Dateien sind nativ, keine von ihnen reist über den OTA-Weg, und ein
 * Fehler daran fällt frühestens am Gerät auf — dort aber als „Deep Links gehen
 * nicht", nicht als fehlende Zeile. Diese Datei hält deshalb beide Seiten
 * gegen dieselbe Pfadmenge aus `src/lib/deep-links.ts`.
 *
 * **Die teuerste Zusage ist die Symmetrie.** Ohne `pathPrefix` beansprucht
 * Android jede Adresse des Hosts, während AASA auf vier Pfade einschränkt: ein
 * Passwort-Link öffnete dann auf Android die App und auf iOS den Browser.
 */

// Aus der Quelle, NICHT abgeschrieben (Diff-Review AGE-643, opencode, MITTEL).
// `deep-links.ts` sagt zu, diese Datei halte Entitlements und Manifest gegen
// den dort ausgesprochenen Host. Mit einem eigenen Literal hielte sie beide
// gegen sich selbst: wer nur die Konstante aendert, haette den Router auf der
// neuen und die Auslieferung auf der alten Domain — und alles bliebe gruen.
const HOST = DEEP_LINK_HOST;

const ENTITLEMENTS = readFileSync("ios/App/App/App.entitlements", "utf8");
const MANIFEST = readFileSync("android/app/src/main/AndroidManifest.xml", "utf8");

/** Der Rumpf des einen Filters mit `autoVerify` — oder `null`. */
function appLinkFilter(): string | null {
  const treffer = [
    ...MANIFEST.matchAll(
      /<intent-filter[^>]*android:autoVerify="true"[^>]*>([\s\S]*?)<\/intent-filter>/g,
    ),
  ];
  // Genau einer. Ein zweiter wäre die naheliegende Art, die Einschränkung
  // später wieder aufzuweichen, ohne eine bestehende Zeile anzufassen.
  expect(treffer.length).toBe(1);
  return treffer[0]?.[1] ?? null;
}

describe("Domain-Anmeldung auf beiden Plattformen (AGE-643)", () => {
  it("iOS führt applinks auf der Domain", () => {
    expect(ENTITLEMENTS).toContain("com.apple.developer.associated-domains");
    expect(ENTITLEMENTS).toContain(`<string>applinks:${HOST}</string>`);
  });

  it("Android nennt die vier Pfade und nicht die ganze Domain", () => {
    const filter = appLinkFilter() ?? "";

    for (const kategorie of [
      "android.intent.action.VIEW",
      "android.intent.category.DEFAULT",
      "android.intent.category.BROWSABLE",
    ]) {
      expect(filter).toContain(kategorie);
    }

    const daten = [...filter.matchAll(/<data\b([^>]*)\/>/g)].map((m) => m[1]);
    expect(daten.length).toBeGreaterThan(0);

    for (const element of daten) {
      expect(element).toContain('android:scheme="https"');
      expect(element).toContain(`android:host="${HOST}"`);
      // **Die Gegenprobe.** Android verschmilzt alle `data`-Elemente eines
      // Filters: ein einziges ohne jede Pfadangabe beansprucht den ganzen
      // Host, und die drei anderen Zeilen sähen weiter richtig aus.
      expect(element, `data-Element ohne Pfadangabe: ${element.trim()}`).toMatch(
        /android:path(Prefix)?="/,
      );
    }

    // **Die Art der Angabe gehört zur Zusage, nicht nur ihr Wert**
    // (Diff-Review AGE-643, opencode, MITTEL). Ein Pfad ohne `/` am Ende ist
    // eine einzelne Route und muss `android:path` sein; `pathPrefix` träfe
    // dort auch `/aktivierungsfeier`, während die AASA daneben exakt bleibt.
    // Ein Vergleich der blossen Strings sähe diesen Unterschied nie.
    const gemessen = daten
      .map((e) => /android:(path|pathPrefix)="([^"]+)"/.exec(e))
      .map((m) => `${m?.[1]}:${m?.[2]}`);
    const erwartet = DEEP_LINK_PRAEFIXE.map(
      (pfad) => `${pfad.endsWith("/") ? "pathPrefix" : "path"}:${pfad}`,
    );
    expect(gemessen.sort()).toEqual([...erwartet].sort());
  });
});
