import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { findeMarkup, findePersonenbezug } from "../lib/release-geschichten-pruefung";
import { RELEASE_AUSGABEN } from "./release-ausgaben";
import { RELEASE_GESCHICHTEN } from "./release-geschichten";
import { RELEASE_TUTORIAL } from "./release-tutorial";

/**
 * Die zwei Flächen des Blogs (AGE-705, Block 8).
 *
 * Beide sind von Hand gepflegte Listen von Slugs, und beide zeigen auf dieselbe
 * Menge von Geschichten. Ein Tippfehler in einem Slug ist deshalb der
 * wahrscheinlichste Fehler — er erzeugt keine Ausnahme, sondern eine Ausgabe,
 * die eine Funktion weniger vorstellt, oder ein Tutorial mit einer Lücke im Weg.
 */

const SLUGS = new Set(RELEASE_GESCHICHTEN.map((g) => g.slug));

describe("Ausgaben — die Gliederung des Blogs ist die Zeit", () => {
  it("gibt jeder Ausgabe Datum, Titel, Einleitung und Geschichten", () => {
    for (const a of RELEASE_AUSGABEN) {
      expect(a.datum, `Datum von „${a.titel}“`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(a.titel.trim(), "Titel einer Ausgabe").not.toBe("");
      expect(a.einleitung.trim(), `Einleitung von „${a.titel}“`).not.toBe("");
      expect(a.geschichten.length, `Geschichten in „${a.titel}“`).toBeGreaterThan(0);
    }
  });

  it("zeigt mit jedem Slug auf eine Geschichte, die es gibt", () => {
    for (const a of RELEASE_AUSGABEN) {
      for (const slug of a.geschichten) {
        expect(SLUGS.has(slug), `„${a.titel}“ nennt ${slug}, das es nicht gibt`).toBe(true);
      }
    }
  });

  it("stellt jede Geschichte in genau einer Ausgabe vor", () => {
    // In keiner: sie wäre über den Blog nicht erreichbar. In zweien: zwei
    // Meldungen über denselben Zeitpunkt, und die Leserschaft hat recht, wenn
    // sie das für einen Fehler hält.
    const genannt = RELEASE_AUSGABEN.flatMap((a) => a.geschichten);
    expect(new Set(genannt).size, "eine Geschichte steht in zwei Ausgaben").toBe(genannt.length);
    expect([...SLUGS].filter((s) => !genannt.includes(s))).toEqual([]);
  });

  it("vergibt jedes Ausgabedatum einmal und in aufsteigender Folge", () => {
    // Aufsteigend in der DATEI, absteigend auf der Seite. Ohne diese Zusage
    // stünde die Ordnung nur im Erzeuger, und die Datei läse sich gegenläufig.
    const daten = RELEASE_AUSGABEN.map((a) => a.datum);
    expect(new Set(daten).size).toBe(daten.length);
    expect([...daten].sort()).toEqual(daten);
  });

  it("hält die Einleitung frei von Markup und Personenbezug", () => {
    for (const a of RELEASE_AUSGABEN) {
      expect(findeMarkup(a.einleitung), `Markup in „${a.titel}“`).toBeNull();
      expect(findeMarkup(a.titel), `Markup im Titel von „${a.titel}“`).toBeNull();
      expect(findePersonenbezug(a.einleitung), `Personenbezug in „${a.titel}“`).toBeNull();
    }
  });
});

describe("Tutorial — ein Weg, der jede Geschichte genau einmal berührt", () => {
  const MOTIVE = resolve(process.cwd(), "public/images");
  const kapitel = RELEASE_TUTORIAL.flatMap((e) => e.kapitel);

  it("gibt jeder Etappe Titel, Einleitung, Motiv und Kapitel", () => {
    for (const e of RELEASE_TUTORIAL) {
      expect(e.titel.trim(), "Titel einer Etappe").not.toBe("");
      expect(e.einleitung.trim(), `Einleitung von „${e.titel}“`).not.toBe("");
      expect(e.kapitel.length, `Kapitel in „${e.titel}“`).toBeGreaterThan(0);
    }
  });

  it("zeigt mit jedem Motiv auf eine Datei, die es gibt", () => {
    for (const e of RELEASE_TUTORIAL) {
      expect(e.motiv, `Motiv von „${e.titel}“`).toMatch(/^[a-z0-9-]+\.webp$/);
      expect(existsSync(join(MOTIVE, e.motiv)), `kein Motiv ${e.motiv}`).toBe(true);
    }
  });

  it("führt jede Geschichte genau einmal", () => {
    // Fehlt eine, hat der Weg ein Loch und die Geschichte keine Stelle, an der
    // sie gelesen wird. Steht eine zweimal, kreuzt sich der Weg.
    expect(new Set(kapitel).size, "ein Kapitel steht zweimal").toBe(kapitel.length);
    expect([...SLUGS].filter((s) => !kapitel.includes(s))).toEqual([]);
    expect(kapitel.filter((s) => !SLUGS.has(s))).toEqual([]);
  });

  it("beginnt beim Ankommen", () => {
    // Die Ordnung ist die Zusage — ohne diese Zeile wäre jede Reihenfolge grün,
    // auch die alphabetische.
    expect(RELEASE_TUTORIAL[0].titel).toBe("Ankommen");
    expect(RELEASE_TUTORIAL[0].kapitel[0]).toBe("2026-08-26-password-reset-flow");
  });

  it("hält Titel und Einleitung frei von Markup", () => {
    for (const e of RELEASE_TUTORIAL) {
      expect(findeMarkup(e.einleitung), `Markup in „${e.titel}“`).toBeNull();
      expect(findeMarkup(e.titel), `Markup im Titel von „${e.titel}“`).toBeNull();
    }
  });
});
