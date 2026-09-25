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

/**
 * Der Textblock **eines** Schritts: von seinem Namen bis zum nächsten Schritt.
 *
 * Warum nicht `INHALT.indexOf(…)` wie oben: Der Dateikopf dieses Workflows
 * erklärt seit jeher `xcrun altool --validate-app` im Fließtext, und mit
 * diesem Change erklärt er zusätzlich, warum `./private_keys` verworfen wurde.
 * Eine Zusage, die den ganzen Dateitext absucht, fände also den **Kommentar**
 * und wäre grün, ohne dass der Schritt existiert — beziehungsweise rot, obwohl
 * der Schlüsselpfad stimmt. Der Schnitt auf den Schrittblock trennt die Zusage
 * vom Kommentar über sie.
 */
function schrittBlock(yaml: string, name: string): string {
  const start = yaml.indexOf(`- name: ${name}`);
  if (start === -1) return "";
  const rest = yaml.slice(start + 1);
  const ende = rest.search(/\n {6}- (?:name|uses):/);
  return ende === -1 ? rest : rest.slice(0, ende);
}

/**
 * Ein Schrittblock **ohne** seine Kommentarzeilen.
 *
 * Der Code-Review hat gezeigt, warum das nötig ist: Eine Zusage auf den rohen
 * Blocktext bliebe grün, wenn jemand die Zeile **auskommentiert** statt sie zu
 * entfernen — der Text steht ja weiter da. Genau diese Mutation fehlte in der
 * ersten Gegenprobe, weil sie nur gelöscht und nie auskommentiert hat.
 */
function ohneKommentare(block: string): string {
  return block
    .split("\n")
    .filter((z) => !z.trim().startsWith("#"))
    .join("\n");
}

/** Die **aktive** `if:`-Zeile eines Schritts. Auskommentiert zählt nicht. */
function ifBedingung(block: string): string {
  const zeile = block
    .split("\n")
    .map((z) => z.trim())
    .find((z) => z.startsWith("if:"));
  return zeile ? zeile.slice("if:".length).trim() : "";
}

describe("Der Upload nach TestFlight", () => {
  const validieren = schrittBlock(INHALT, "Nach TestFlight validieren");
  const hochladen = schrittBlock(INHALT, "Nach TestFlight hochladen");

  // Die Selbstprüfung gegen den stillen Leerlauf, dieselbe wie beim
  // Auslöser-Block: fände der Schnitt nichts, wären alle Zusagen darunter
  // grün, ohne etwas gesehen zu haben.
  it("findet ueberhaupt beide Schrittbloecke", () => {
    expect(validieren.trim().length).toBeGreaterThan(0);
    expect(hochladen.trim().length).toBeGreaterThan(0);
  });

  it("laedt mit `altool --upload-app` hoch", () => {
    expect(ohneKommentare(hochladen)).toContain("--upload-app");
    expect(ohneKommentare(hochladen)).toContain("export/App.ipa");
  });

  it("validiert vorher, ohne eine Build-Nummer zu verbrauchen", () => {
    expect(ohneKommentare(validieren)).toContain("--validate-app");
  });

  // ══ DER BEFUND, DER DIESEN BLOCK NOETIG MACHT ═══════════════════════════
  // Der Plan-Review hat gezeigt: `startsWith(github.ref, 'refs/tags/ios-v')`
  // allein hält die Zusage NICHT. GitHubs „Use workflow from" führt auch Tags,
  // ein Handstart auf `ios-v1.0.0` hätte also hochgeladen — bei grünem Lauf.
  //
  // Gemessen wird die **aktive** `if:`-Zeile, nicht der Blocktext: Sonst bliebe
  // die Zusage grün, wenn jemand die Bedingung auskommentiert (Code-Review,
  // HIGH). Und **je Hälfte eine Zusage**, nicht eine über den ganzen Ausdruck,
  // damit auch das Entfernen einer Hälfte auffällt und die Meldung sagt,
  // welcher.
  it("traegt an beiden Schritten ueberhaupt eine aktive Bedingung", () => {
    expect(ifBedingung(validieren)).not.toBe("");
    expect(ifBedingung(hochladen)).not.toBe("");
  });

  it.each([
    ["den Ausloeser", "github.event_name == 'push'"],
    ["die Tag-Referenz", "startsWith(github.ref, 'refs/tags/ios-v')"],
  ])("prueft %s — in der aktiven Bedingung, je Haelfte", (_was, ausdruck) => {
    expect(ifBedingung(validieren)).toContain(ausdruck);
    expect(ifBedingung(hochladen)).toContain(ausdruck);
  });

  it("authentifiziert ueber den Pfad, nicht ueber ein Konventionsverzeichnis", () => {
    // `altool` sucht `AuthKey_<id>.p8` sonst u. a. in `./private_keys` — das
    // läge im ARBEITSBAUM eines öffentlichen Repos. Gemessen am 25.09.:
    // `--p8-file-path` wird von `--upload-app` honoriert.
    //
    // Auch hier der Schnitt ohne Kommentare: Der Schritt DARF `private_keys`
    // im Fließtext erklären — er darf es nur nicht benutzen.
    for (const block of [validieren, hochladen]) {
      const befehl = ohneKommentare(block);
      expect(befehl).toContain('--p8-file-path "$RUNNER_TEMP/asc.p8"');
      expect(befehl).not.toContain("private_keys");
    }
  });
});

describe("Die Reihenfolge, in der etwas nach aussen geht", () => {
  // Zwei Zusagen, zwei verschiedene Fehler:
  //
  //  1. Der Nachweis ist das Tor. Stünde die Übertragung davor, prüfte man ein
  //     Bündel, das Apple schon hat.
  //  2. Das Artefakt muss VOR die Übertragung. GitHub überspringt Folgeschritte
  //     nach einem Fehlschlag — ausgerechnet im Fehlerfall fehlte sonst das
  //     geprüfte `.ipa`. (Plan-Review, HIGH.)
  const stelle = (marke: string) => INHALT.indexOf(marke);

  it("nennt alle vier Marken genau einmal", () => {
    for (const marke of [
      "- name: Signatur und Profil nachweisen",
      "actions/upload-artifact",
      "- name: Nach TestFlight validieren",
      "- name: Nach TestFlight hochladen",
    ]) {
      expect(INHALT.split(marke)).toHaveLength(2);
    }
  });

  it("legt erst nach dem Nachweis ab und uebertraegt zuletzt", () => {
    const nachweis = stelle("- name: Signatur und Profil nachweisen");
    const artefakt = stelle("actions/upload-artifact");
    const validieren = stelle("- name: Nach TestFlight validieren");
    const hochladen = stelle("- name: Nach TestFlight hochladen");

    expect(nachweis).toBeLessThan(artefakt);
    expect(artefakt).toBeLessThan(validieren);
    expect(validieren).toBeLessThan(hochladen);
  });
});

describe("Der Web-Deploy baut weiterhin nicht nativ", () => {
  const deploy = readFileSync(".github/workflows/deploy.yml", "utf8");

  it("kennt weder xcodebuild noch den ASC-Schluessel", () => {
    expect(deploy).not.toContain("xcodebuild");
    expect(deploy).not.toContain("ASC_KEY_P8");
  });
});
