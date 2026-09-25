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

/**
 * Der Textblock **eines** Schritts, ueber die Einrueckung geschnitten.
 *
 * Warum nicht `INHALT.indexOf(...)`: Der Dateikopf erklaert die verworfenen
 * Wege im Fliesstext. Eine Zusage ueber den ganzen Dateitext faende den
 * Kommentar statt den Schritt. Und warum die Einrueckung: der gemini-Review hat
 * die reine Textpruefung zu Recht „sproede" genannt — `\n {6}- ` bindet den
 * Schnitt wenigstens an die Schrittebene und nicht an ein beliebiges Vorkommen.
 */
function schrittBlock(yaml: string, name: string): string {
  const start = yaml.indexOf(`- name: ${name}`);
  if (start === -1) return "";
  const rest = yaml.slice(start + 1);
  const ende = rest.search(/\n {6}- (?:name|uses):/);
  return ende === -1 ? rest : rest.slice(0, ende);
}

/** Ein Schrittblock ohne seine Kommentarzeilen. */
function ohneKommentare(block: string): string {
  return block
    .split("\n")
    .filter((z) => !z.trim().startsWith("#"))
    .join("\n");
}

/** Die **aktive** `if:`-Zeile. Eine auskommentierte zaehlt nicht. */
function ifBedingung(block: string): string {
  const zeile = block
    .split("\n")
    .map((z) => z.trim())
    .find((z) => z.startsWith("if:"));
  return zeile ? zeile.slice("if:".length).trim() : "";
}

describe("Der Upload zu Google Play", () => {
  const schluessel = schrittBlock(INHALT, "Play-Schluessel bereitstellen");
  const upload = schrittBlock(INHALT, "Nach Google Play hochladen");

  it("findet ueberhaupt beide Schrittbloecke", () => {
    expect(schluessel.trim().length).toBeGreaterThan(0);
    expect(upload.trim().length).toBeGreaterThan(0);
  });

  // ══ DER BEFUND, DER DIESE ZUSAGE NOETIG MACHT (Plan-Review, MEDIUM) ══════
  // Jede andere Zusage hier misst EINEN Schritt. Wer einen ZWEITEN,
  // ungeschuetzten Upload danebenstellt, erfuellt sie alle und bricht die
  // Zusage trotzdem. Deshalb die Anzahl, nicht die Anwesenheit.
  it("hat GENAU EINEN Schritt, der an einen Store uebertraegt", () => {
    const treffer = INHALT.split("r0adkll/upload-google-play").length - 1;
    expect(treffer).toBe(1);
  });

  it("pinnt die fremde Action auf einen SHA, nicht auf ein Tag", () => {
    expect(ohneKommentare(upload)).toContain(
      "r0adkll/upload-google-play@e738b9dd8f2476ea806d921b64aacd24f34515a5",
    );
  });

  // ══ ZWEI ZUSAGEN AUF DIESELBE BEDINGUNG, UND BEIDE WERDEN GEBRAUCHT ══════
  // Die GLEICHHEIT ist der eigentliche Riegel: Der Code-Review hat gezeigt,
  // dass ein angehaengtes `|| true` beide Teilzeichenketten stehen laesst und
  // die Bedingung trotzdem aushebelt — ein Handstart auf ein Tag wuerde wieder
  // ausliefern. `toContain` allein faengt das nicht.
  //
  // Die beiden Halbzusagen darunter bleiben trotzdem: Sie sagen im Fehlerfall,
  // WELCHE Haelfte fehlt. Die Gleichheit sagt nur, dass etwas nicht stimmt.
  const ERWARTETE_BEDINGUNG =
    "github.event_name == 'push' && startsWith(github.ref, 'refs/tags/android-v')";

  it("die aktive Bedingung ist GENAU der erwartete Ausdruck", () => {
    expect(ifBedingung(schluessel)).toBe(ERWARTETE_BEDINGUNG);
    expect(ifBedingung(upload)).toBe(ERWARTETE_BEDINGUNG);
  });

  it.each([
    ["den Ausloeser", "github.event_name == 'push'"],
    ["die Tag-Referenz", "startsWith(github.ref, 'refs/tags/android-v')"],
  ])("prueft %s — in der AKTIVEN Bedingung, je Haelfte", (_was, ausdruck) => {
    expect(ifBedingung(schluessel)).toContain(ausdruck);
    expect(ifBedingung(upload)).toContain(ausdruck);
  });

  it("uebergibt den Schluessel als DATEI, nicht ueber die Umgebung", () => {
    // Roh-JSON traegt Zeilenumbrueche, und ein Infisical-Wert ist NICHT
    // GitHub-maskiert. Beides faellt weg, wenn nur ein Pfad reist.
    const rein = ohneKommentare(upload);
    expect(rein).toContain("serviceAccountJson:");
    expect(rein).not.toContain("serviceAccountJsonPlainText");
    expect(rein).toContain("play.json");
  });

  it("bricht bei fehlendem Schluessel ab, statt still zu ueberspringen", () => {
    const rein = ohneKommentare(schluessel);
    expect(rein).toContain('"${PLAY_SERVICE_ACCOUNT_JSON:?');
    // Ein `if` auf die Anwesenheit des Secrets waere genau der stille
    // Fehlschlag, den die Zusage verbietet: gruener Tag-Lauf, nichts geliefert.
    expect(rein).not.toContain("PLAY_SERVICE_ACCOUNT_JSON != ''");
  });

  it("laedt NUR das AAB, ueber `releaseFiles` (Plural)", () => {
    const rein = ohneKommentare(upload);
    expect(rein).toContain("releaseFiles:");
    expect(rein).toContain("app-release.aab");
    expect(rein).not.toContain("app-release.apk");
    // `releaseFile` (Einzahl) ist am gepinnten Stand durchgestrichen.
    expect(rein).not.toMatch(/releaseFile:\s/);
  });

  it("nennt Kanal und Paket ausdruecklich", () => {
    const rein = ohneKommentare(upload);
    // `internal` ist Donalds Entscheidung vom 25.09., keine Vermutung — und
    // deshalb darf sie hier stehen. Sie zahlt NICHT auf die 12/14-Testpflicht
    // ein; der Wechsel auf den geschlossenen Kanal aendert diese Zeile.
    expect(rein).toContain("track: internal");
    expect(rein).toContain("packageName: com.effbeezee.app");
  });
});

describe("Die Reihenfolge, in der etwas nach aussen geht (Android)", () => {
  const stelle = (marke: string) => INHALT.indexOf(marke);

  it("nennt alle vier Marken genau einmal", () => {
    for (const marke of [
      "- name: Signatur nachweisen",
      "actions/upload-artifact",
      "- name: Play-Schluessel bereitstellen",
      "- name: Nach Google Play hochladen",
    ]) {
      expect(INHALT.split(marke)).toHaveLength(2);
    }
  });

  it("legt erst nach dem Nachweis ab und uebertraegt zuletzt", () => {
    // Zwei verschiedene Fehler: der Nachweis ist das Tor, und das Artefakt muss
    // VOR die Uebertragung, weil GitHub Folgeschritte nach einem Fehlschlag
    // ueberspringt — sonst fehlte das geprüfte AAB genau dann, wenn man es
    // braucht.
    expect(stelle("- name: Signatur nachweisen")).toBeLessThan(
      stelle("actions/upload-artifact"),
    );
    expect(stelle("actions/upload-artifact")).toBeLessThan(
      stelle("- name: Play-Schluessel bereitstellen"),
    );
    expect(stelle("- name: Play-Schluessel bereitstellen")).toBeLessThan(
      stelle("- name: Nach Google Play hochladen"),
    );
  });
});
