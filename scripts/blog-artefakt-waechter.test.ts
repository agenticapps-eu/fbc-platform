import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { RELEASE_AUSGABEN } from "../src/content/release-ausgaben";
import { RELEASE_GESCHICHTEN } from "../src/content/release-geschichten";
import { RELEASE_TUTORIAL } from "../src/content/release-tutorial";
import { pruefeArtefakt } from "./blog-artefakt-waechter";
import { schreibeBlog } from "./build-blog";

/**
 * Der Artefakt-Wächter (AGE-705, 2.4).
 *
 * **Er zählt auf, was ERLAUBT ist, und rötet alles andere.** Eine Verbotsliste
 * benennt, woran jemand gedacht hat, und übersieht jede Gestalt, an die niemand
 * gedacht hat: von den vier hier untergeschobenen wäre eine Suche nach der
 * Zeichenfolge `<script>` an dreien vorbeigelaufen.
 *
 * Und er misst am ERGEBNIS: der letzte Test schreibt den Blog auf die Platte
 * und liest die Dateien zurück. Ein Wächter, der die Eingaben prüft, belegt
 * nicht, was ausgeliefert wurde.
 */

const ordner = mkdtempSync(join(tmpdir(), "fbc-blog-"));
afterAll(() => rmSync(ordner, { recursive: true, force: true }));

const RUMPF = (inhalt: string) => `<!doctype html>
<html lang="de"><head><meta charset="utf-8" /><title>T</title></head>
<body><main>${inhalt}</main></body></html>`;

describe("pruefeArtefakt — vier untergeschobene Gestalten", () => {
  it("rötet ein Skript-Element", () => {
    expect(pruefeArtefakt(RUMPF("<script>alert(1)</script>"))).toMatch(/script/i);
  });

  it("rötet ein Ereignis-Attribut", () => {
    // Kein `<script>` weit und breit — und trotzdem ausführbar.
    expect(pruefeArtefakt(RUMPF('<p onclick="alert(1)">Text</p>'))).toMatch(/onclick/i);
  });

  it("rötet eine Adresse mit ausführbarem Schema", () => {
    expect(pruefeArtefakt(RUMPF('<a href="javascript:alert(1)">Text</a>'))).toMatch(/href/i);
  });

  it("rötet einen Verweis auf eine fremde Herkunft", () => {
    expect(
      pruefeArtefakt(RUMPF('<link rel="stylesheet" href="https://fremde.example/s.css" />')),
    ).toMatch(/link|href/i);
  });

  it("rötet eine fremde Herkunft auch an einem erlaubten Element", () => {
    // Der Fall darüber wird schon von der ELEMENT-Regel gefangen: `<link>`
    // steht ohnehin nicht auf der Liste. Damit wäre die Ursprungsregel für
    // `href` allein durch das `javascript:`-Beispiel belegt — und ein Verweis
    // auf eine fremde Schrift oder ein fremdes Bild ginge an einem `<a>`
    // ungesehen durch.
    expect(pruefeArtefakt(RUMPF('<a href="https://fremde.example/">Text</a>'))).toMatch(/href/i);
  });

  it("lässt genau die Adresse der Anwendung durch", () => {
    // Der einzige Verweis des Blogs nach draussen. Ohne diese Ausnahme wäre er
    // nicht baubar; mit einer aufgeweichten Regel („https: ist erlaubt") wäre
    // jede fremde Herkunft wieder offen.
    expect(pruefeArtefakt(RUMPF('<a href="https://app.effbeezee.com/">Zur App</a>'))).toBeNull();
  });

  it("rötet eine Adresse, die der erlaubten nur ähnelt", () => {
    // Deshalb eine Liste vollständiger Adressen und kein Präfix-Vergleich.
    expect(
      pruefeArtefakt(RUMPF('<a href="https://app.effbeezee.com.beispiel.tld/">Text</a>')),
    ).toMatch(/href/i);
  });

  it("rötet auch eine andere Seite derselben Anwendung", () => {
    // Die Ausnahme ist EINE Adresse, kein Host. Wächst der Bedarf, gehört die
    // neue Adresse auf die Liste — und nicht die Regel gelockert.
    expect(
      pruefeArtefakt(RUMPF('<a href="https://app.effbeezee.com/verzeichnis">Text</a>')),
    ).toMatch(/href/i);
  });

  it("lässt die erlaubte Menge durch", () => {
    // Die Gegenprobe: ohne sie wäre ein Wächter, der alles rötet, grün.
    expect(
      pruefeArtefakt(RUMPF('<h1>Titel</h1><time datetime="2026-09-07">7. September 2026</time>')),
    ).toBeNull();
  });
});

describe("pruefeArtefakt — über den erzeugten Dateien", () => {
  it("lässt jede geschriebene Datei durch", () => {
    // Die Freigabe wird hier gesetzt, nicht abgewartet: der Wächter misst die
    // GESTALT des Markups, nicht die redaktionelle Entscheidung. Sonst bliebe
    // die Einzelseite ungemessen, solange noch nichts abgenommen ist — und
    // gemessen würde ausgerechnet, wenn niemand mehr hinsieht.
    const geschrieben = schreibeBlog(ordner, {
      geschichten: RELEASE_GESCHICHTEN.map((g) => ({ ...g, freigegeben: true })),
      ausgaben: RELEASE_AUSGABEN,
      etappen: RELEASE_TUTORIAL,
    });
    const dateien = readdirSync(ordner).filter((d) => d.endsWith(".html"));
    // Ohne diese Zeile wäre der Test auch dann grün, wenn gar nichts entstünde.
    expect(dateien.length).toBe(geschrieben.length);
    // Und die Bilder liegen daneben — eine Seite mit totem Bildverweis wäre
    // grün geprüft und im Browser eine leere Fläche. Je Geschichte eine
    // Aufnahme, dazu die Motive der Etappen und der beiden Übersichten.
    const bilder = readdirSync(join(ordner, "bilder"));
    expect(bilder.filter((b) => b.endsWith(".png"))).toHaveLength(RELEASE_GESCHICHTEN.length);
    expect(bilder.filter((b) => b.endsWith(".webp")).length).toBeGreaterThan(0);
    // Jede Bildadresse im Markup zeigt auf eine Datei, die wirklich dort liegt.
    for (const datei of dateien) {
      const html = readFileSync(join(ordner, datei), "utf8");
      for (const treffer of html.matchAll(/src="\/bilder\/([^"]+)"/g)) {
        expect(bilder, `${datei} verweist auf ${treffer[1]}`).toContain(treffer[1]);
      }
    }
    for (const datei of dateien) {
      const html = readFileSync(join(ordner, datei), "utf8");
      expect(pruefeArtefakt(html), `${datei} trägt etwas Unerlaubtes`).toBeNull();
    }
  });
});

describe("pruefeArtefakt — das Bild kommt in die Erlaubnisliste, die Zusage nicht heraus", () => {
  // Die Menge wächst um `img`. Damit das keine Aufweichung ist, gehen `src` und
  // `href` durch DIESELBE Ursprungsregel — und die drei Tests hier sind rot,
  // solange das nicht so ist: der zweite und der dritte verlangen, dass die
  // Meldung `src` bzw. `onerror` benennt und nicht bloss „Element <img>“.
  it("lässt ein Bild aus eigener Herkunft durch", () => {
    expect(
      pruefeArtefakt(RUMPF('<img src="/bilder/glocke.png" alt="Die Glocke" width="1" height="1" />')),
    ).toBeNull();
  });

  it("rötet ein Bild von fremder Herkunft", () => {
    // Ein Bild von aussen ist eine Anfrage NACH dem Laden — und damit ein Weg,
    // auf dem jemand mitliest, wer die Seite liest.
    expect(pruefeArtefakt(RUMPF('<img src="https://fremde.example/x.png" alt="X" />'))).toMatch(
      /src/i,
    );
  });

  it("rötet ein Ereignis-Attribut am Bild", () => {
    expect(
      pruefeArtefakt(RUMPF('<img src="/bilder/x.png" alt="X" onerror="alert(1)" />')),
    ).toMatch(/onerror/i);
  });
});
