import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * AGE-642 B3, iOS-Hälfte — dieselbe Zusage wie auf der Android-Seite: ein
 * nativer Bau läuft nur, wenn er angefordert wird.
 *
 * Die Begründung für die Form steht ausführlich in
 * `scripts/android-release.workflow.test.ts` und wird hier nicht wiederholt:
 * eine Verneinung ist am laufenden System kaum zu belegen, am Auslöser-Block
 * dagegen strukturell. Textschnitt statt YAML-Parser aus demselben Grund — eine
 * neue Node-Abhängigkeit macht den Deno-Job rot.
 *
 * Was hier ZUSÄTZLICH geprüft wird, sind die drei Stellen, an denen die
 * iOS-Hälfte still danebengehen kann. Alle drei sind am 07.09. lokal gemessen
 * worden, nicht angenommen.
 */
const WORKFLOW = ".github/workflows/ios-release.yml";
const INHALT = readFileSync(WORKFLOW, "utf8");

/** Alles zwischen `on:` und dem nächsten Schlüssel auf Spalte 0. */
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

  // Die Selbstprüfung gegen den stillen Leerlauf: fände der Schnitt nichts,
  // wären alle Zusagen darunter grün, ohne etwas gesehen zu haben.
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

  it("haengt am geschuetzten Environment", () => {
    expect(INHALT).toContain("environment: ios-release");
  });
});

describe("Die drei Stellen, an denen die iOS-Haelfte still danebenginge", () => {
  // Gemessen am 07.09.: der Archivlauf meldet `Signing Identity: "Apple
  // Development: …"` und endet mit ARCHIVE SUCCEEDED. Erst der Export signiert
  // mit `Apple Distribution` neu. Ein Nachweis auf dem Archiv prüfte also die
  // falsche Datei — deshalb muss der Prüfschritt das `.ipa` auspacken.
  it("prueft die Signatur am `.ipa`, nicht am Archiv", () => {
    const schritt = INHALT.slice(INHALT.indexOf("Signatur und Profil nachweisen"));
    expect(schritt).toContain("export/App.ipa");
    expect(schritt).toContain("Authority=Apple Distribution");
    // Die Gegenprobe zur Gegenprobe: stünde hier `xcarchive`, prüfte der
    // Schritt das dev-signierte Zwischenergebnis.
    expect(schritt.slice(0, schritt.indexOf("upload-artifact"))).not.toContain("xcarchive");
  });

  // Ein Entwickler- oder Ad-hoc-Profil trägt eine Geräteliste, ein Store-Profil
  // nicht; und `aps-environment` entscheidet, ob der Push der Store-App Apples
  // Produktions-Host oder die Sandbox anspricht.
  it("verlangt ein Store-Profil mit produktivem Push", () => {
    expect(INHALT).toContain("ProvisionedDevices");
    expect(INHALT).toContain("aps-environment");
    expect(INHALT).toContain("production");
  });

  // `CURRENT_PROJECT_VERSION` auf der Kommandozeile ist wirkungslos, wenn das
  // Projekt eine andere Einstellung führt. Der Nachweis vergleicht deshalb die
  // Build-Nummer im Artefakt mit der Lauf-Nummer.
  it("belegt, dass die Build-Nummer aus der Lauf-Nummer kommt", () => {
    expect(INHALT).toContain("CURRENT_PROJECT_VERSION=${{ github.run_number }}");
    expect(INHALT).toContain("CFBundleVersion");
  });
});

describe("Der Schluessel bleibt aus dem Arbeitsbaum", () => {
  // Das Repo ist öffentlich, und `scripts/native-secrets-guard.ts` prüft den
  // Baum. Ein `.p8` darunter wäre ein Schlüssel im Klartext für jeden Leser.
  it("legt den ASC-Schluessel unter RUNNER_TEMP ab", () => {
    expect(INHALT).toContain('"$RUNNER_TEMP/asc.p8"');
    expect(INHALT).not.toMatch(/-authenticationKeyPath\s+(?!"\$RUNNER_TEMP)/);
  });

  // Ein Verzeichnis als Upload-Pfad ist die Sorte Fehler, die man genau einmal
  // macht. Der Pfad nennt genau die eine Datei.
  it("laedt genau eine Datei hoch, kein Verzeichnis", () => {
    const upload = INHALT.slice(INHALT.indexOf("upload-artifact"));
    expect(upload).toContain("path: ${{ runner.temp }}/export/App.ipa");
    expect(upload).toContain("if-no-files-found: error");
  });
});

describe("Der Web-Deploy baut weiterhin nicht nativ", () => {
  const deploy = readFileSync(".github/workflows/deploy.yml", "utf8");

  it("kennt weder xcodebuild noch den ASC-Schluessel", () => {
    expect(deploy).not.toContain("xcodebuild");
    expect(deploy).not.toContain("ASC_KEY_P8");
  });
});
