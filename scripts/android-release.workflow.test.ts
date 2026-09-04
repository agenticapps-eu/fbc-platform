import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * AGE-642 B3 — der native Bau laeuft nur, wenn er angefordert wird.
 *
 * Die Anforderung steht im Delta (`native-shell`: „Ein nativer Bau laeuft nur,
 * wenn er angefordert wird"), und ihr Beleg ist eine **Verneinung**: ein Pull
 * Request, der nur Web-Dateien anfasst, loest den Workflow nicht aus.
 *
 * Eine Verneinung laesst sich am laufenden System schlecht belegen — man sieht,
 * dass nichts passiert ist, und weiss nicht, ob das an der Konfiguration lag
 * oder daran, dass gerade niemand gedrueckt hat. Am Ausloeser-Block ist sie
 * dagegen strukturell: stehen dort nur `workflow_dispatch` und ein Tag-Muster,
 * KANN kein Pull Request und kein Branch-Push ihn starten.
 *
 * Warum als Textschnitt und nicht ueber einen YAML-Parser: der Baum fuehrt
 * keinen, und eine neue Node-Abhaengigkeit macht den Deno-Job rot, bis
 * `deno install --frozen=false` nachgezogen ist. Der Preis ist, dass dieser
 * Test die YAML-Struktur annimmt statt sie zu kennen — deshalb prueft er
 * zuerst, dass er den Block ueberhaupt gefunden hat.
 */
const WORKFLOW = ".github/workflows/android-release.yml";
const INHALT = readFileSync(WORKFLOW, "utf8");

/** Alles zwischen `on:` und dem naechsten Schluessel auf Spalte 0. */
function ausloeserBlock(yaml: string): string {
  const zeilen = yaml.split("\n");
  const start = zeilen.findIndex((z) => /^on:/.test(z));
  if (start === -1) return "";
  const rest = zeilen.slice(start + 1);
  const ende = rest.findIndex((z) => /^[A-Za-z]/.test(z));
  return (ende === -1 ? rest : rest.slice(0, ende)).join("\n");
}

describe(WORKFLOW, () => {
  const block = ausloeserBlock(INHALT);

  // Die Selbstpruefung gegen den stillen Leerlauf: faende der Schnitt nichts,
  // waeren alle Verneinungen unten trivial erfuellt und der Test wertlos.
  it("findet ueberhaupt einen Ausloeser-Block", () => {
    expect(block.trim().length).toBeGreaterThan(0);
  });

  it("laesst sich von Hand ausloesen", () => {
    expect(block).toContain("workflow_dispatch");
  });

  it("laeuft auf ein Tag, nicht auf einen Branch", () => {
    expect(block).toContain("tags:");
    expect(block).not.toContain("branches:");
  });

  it("laeuft NICHT auf Pull Requests", () => {
    expect(block).not.toContain("pull_request");
  });

  /**
   * Die andere Haelfte derselben Zusage: der Web-Deploy darf nicht nativ bauen.
   * Sonst zoege jeder Push auf `main` einen Gradle-Lauf mit — und damit das
   * Signaturmaterial in einen Workflow, der es nicht braucht.
   */
  it("und der Web-Deploy baut weiterhin nicht nativ", () => {
    const deploy = readFileSync(".github/workflows/deploy.yml", "utf8");
    expect(deploy).not.toContain("gradlew");
    expect(deploy).not.toContain("ANDROID_KEYSTORE_BASE64");
  });
});
