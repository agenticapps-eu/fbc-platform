import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { leseMarke } from "./app-icons.logic";
import {
  AKZENT,
  AUSSCHNITT,
  BAND_ANTEIL,
  CLAIM,
  GEDAEMPFT,
  GRUND,
  INK,
  RAMPE,
  RAMPE_DECKEND_AB,
  SCHRIFTZUG_HOEHE,
  SCHRIFTZUG_OBEN,
  SCHRIFTZUG_SEITENVERHAELTNIS,
  SUBLINE,
  bandSvg,
  bildLage,
  schriftzugSvg,
  verlaufSvg,
} from "./splash.logic";

/**
 * Die Startfläche (AGE-642, B5).
 *
 * WAS DIESER TEST WIRKLICH BEWACHT: dass die Fläche, die vor der Anwendung
 * steht, dieselbe Marke, dieselbe Rampe und dieselben Worte trägt wie das
 * Login-Panel — und dass sie das auf jeder Bildschirmgrösse und in jeder
 * Orientierung tut, ohne dass jemand sie dort nachrechnet.
 *
 * Was er ausdrücklich NICHT kann: sagen, wie es aussieht. Der Beleg dafür ist
 * ein Bildschirmfoto vom Gerät, nach frischer Installation — iOS hält den
 * Startbildschirm sonst aus dem Zwischenspeicher.
 */
const FAVICON = readFileSync("public/brand/compass-favicon.svg", "utf8");
const LOGIN = readFileSync("src/pages/LoginPage.tsx", "utf8");

const marke = leseMarke(FAVICON);

describe("Die Rampe ist die des Login-Panels", () => {
  it("läuft über vier Übergänge aus, nicht über einen", () => {
    // Ein harter Wechsel von deckend auf halbtransparent ergab im Login eine
    // sichtbare Kante bei 26 %. Fünf Stopps, also vier Übergänge — eine
    // Startfläche mit zwei Stopps hätte denselben Fehler, nur an einer Stelle,
    // die niemand aufruft.
    expect(RAMPE).toHaveLength(5);
  });

  it("hat dieselben Offsets und Deckungen wie `LoginPage.tsx`", () => {
    expect(RAMPE).toEqual([
      { offset: 0, deckung: 1 },
      { offset: 0.22, deckung: 1 },
      { offset: 0.32, deckung: 0.7 },
      { offset: 0.44, deckung: 0.25 },
      { offset: 0.58, deckung: 0 },
    ]);
    // Und dieselben Zahlen stehen wirklich im Login-Panel — nicht nur hier.
    for (const anteil of ["22%", "32%", "44%", "58%"]) {
      expect(LOGIN).toContain(anteil);
    }
  });

  it("endet unten in genau der Farbe, auf der der Schriftzug steht", () => {
    const unten = RAMPE.find((s) => s.offset === 0)!;
    expect(unten.deckung).toBe(1);
    expect(GRUND).toBe("#ffffff");
  });

  it("erzeugt einen Verlauf, dessen unterste Zeile deckend ist", () => {
    const svg = verlaufSvg(8, 1024);
    expect(svg).toContain('stop-opacity="1"');
    expect(svg).toContain(`stop-color="${GRUND}"`);
    // Der Verlauf steht als EIGENE Ebene und wird gestreckt, nicht
    // formatfüllend beschnitten. Deshalb darf er kein Foto kennen.
    expect(svg).not.toContain("<image");
  });
});

describe("Die Verhältnis-Invariante trennt den Text von jeder Bildlage", () => {
  /**
   * Das ist die eigentliche Zusage dieser Fläche, und sie ist eine Rechnung,
   * kein Augenmass: der Schriftzug beginnt erst dort, wo die Rampe schon
   * deckend ist. Weil beide Seiten Anteile DERSELBEN Höhe sind, gilt sie für
   * jede Bildschirmgrösse und jede Orientierung zugleich.
   */
  it("beginnt der Schriftzug unterhalb des deckenden Rampenanteils", () => {
    expect(SCHRIFTZUG_OBEN).toBeGreaterThanOrEqual(BAND_ANTEIL * (1 - RAMPE_DECKEND_AB));
  });

  it("bleibt der Schriftzug innerhalb der Fläche", () => {
    expect(SCHRIFTZUG_OBEN + SCHRIFTZUG_HOEHE).toBeLessThan(1);
  });

  it("passt der Schriftzug quer auf ein iPhone", () => {
    // 402 pt Höhe im Querformat (iPhone 17 Pro). Die Invariante oben ist
    // anteilig, also gilt sie hier auch — geprüft wird, dass die Anteile in
    // echten Punkten keine unlesbare Grösse ergeben.
    const querHoehe = 402;
    const zugHoehe = querHoehe * SCHRIFTZUG_HOEHE;
    expect(zugHoehe).toBeGreaterThan(80);
    const zugBreite = zugHoehe * SCHRIFTZUG_SEITENVERHAELTNIS;
    expect(zugBreite + 32).toBeLessThan(874); // Querbreite, plus linker Rand
  });
});

describe("Der Ausschnitt ist ein Anteil, keine Pixelkoordinate", () => {
  it("bleibt beim Tausch des Quellbildes derselbe Bildbereich", () => {
    const klein = bildLage({ breite: 1600, hoehe: 1067 }, { breite: 1290, hoehe: 1734 });
    const gross = bildLage({ breite: 3200, hoehe: 2134 }, { breite: 1290, hoehe: 1734 });
    // Doppelte Quelle, gleiches Ergebnis auf der Zielfläche: der Ausschnitt
    // hängt an Anteilen, nicht an Pixeln.
    expect(gross.x).toBeCloseTo(klein.x, 1);
    expect(gross.y).toBeCloseTo(klein.y, 1);
    expect(gross.breite).toBeCloseTo(klein.breite, 1);
    expect(gross.hoehe).toBeCloseTo(klein.hoehe, 1);
  });

  it("deckt die Zielfläche vollständig ab", () => {
    const ziel = { breite: 1290, hoehe: 1734 };
    const lage = bildLage({ breite: 1600, hoehe: 1067 }, ziel);
    expect(lage.x).toBeLessThanOrEqual(0);
    expect(lage.y).toBeLessThanOrEqual(0);
    expect(lage.x + lage.breite).toBeGreaterThanOrEqual(ziel.breite);
    expect(lage.y + lage.hoehe).toBeGreaterThanOrEqual(ziel.hoehe);
  });

  it("schneidet oben ab, damit die Gesichter über der Rampe stehen", () => {
    // Der Ausschnitt lässt den oberen Rand des Quellbildes weg. Mit dem
    // Login-Ausschnitt lagen beide Gesichter in der Zone, in der die Rampe
    // einsetzt. Die Zahl ist eine Designentscheidung; geprüft wird nur, dass
    // sie wirkt — sonst wäre sie beim nächsten Bildtausch stumm verschwunden.
    expect(AUSSCHNITT.oben).toBeGreaterThan(0);
    expect(AUSSCHNITT.hoehe).toBeLessThan(1);
  });
});

describe("Die Marke kommt aus dem Favicon, nicht aus einer Kopie", () => {
  it("trägt den Stern wörtlich so, wie er im Favicon steht", () => {
    const svg = schriftzugSvg(marke);
    expect(svg).toContain(marke.stern);
  });

  it("folgt einem geänderten Stern, statt ihn abgeschrieben zu haben", () => {
    // Die Gegenprobe zum Test darüber: dort könnte auch eine zweite Kopie im
    // Skript zufällig dasselbe sagen. Hier wird das Favicon verändert — nur
    // wer es wirklich liest, zieht mit.
    const anders = leseMarke(FAVICON.replace(marke.stern, "M1 1 L9 9 Z"));
    const svg = schriftzugSvg(anders);
    expect(anders.stern).toBe("M1 1 L9 9 Z");
    expect(svg).toContain('d="M1 1 L9 9 Z"');
    expect(svg).not.toContain(marke.stern);
  });

  it("zeichnet die Marke in Ink und nicht im Blau des Favicons", () => {
    // Das Favicon ist `#1F53B0` auf durchsichtig — richtig für einen Tab, dem
    // seine Fläche gehört. Hier steht die Marke auf Weiss neben dunkler
    // Schrift und trägt deren Farbe.
    const svg = schriftzugSvg(marke);
    expect(svg).toContain(INK);
    expect(svg).not.toContain("#1F53B0");
  });
});

describe("Der Schriftzug trägt die Worte und die Schriften des Login-Panels", () => {
  it("setzt die Wortmarke in Inter mit Akzentpunkten", () => {
    const svg = schriftzugSvg(marke);
    expect(svg).toContain('font-family="Inter"');
    expect(svg).toContain(`fill="${AKZENT}"`);
    // Klein geschrieben, nie in Versalien (`Logo.tsx`).
    expect(svg).toContain("eff");
    expect(svg).toContain("bee");
    expect(svg).toContain("zee");
    expect(svg).not.toContain("EFF");
  });

  it("setzt den Claim in Fraunces und die Subline in Inter", () => {
    const svg = schriftzugSvg(marke);
    expect(svg).toContain('font-family="Fraunces"');
    for (const zeile of CLAIM) expect(svg).toContain(zeile);
    expect(svg).toContain(SUBLINE);
    expect(svg).toContain(`fill="${GEDAEMPFT}"`);
  });

  it("nimmt dieselben Worte, die auch das Login-Panel zeigt", () => {
    // Die Startfläche darf nicht etwas anderes versprechen als die Seite, auf
    // der man gleich landet.
    expect(LOGIN).toContain(CLAIM.join(" "));
    expect(LOGIN).toContain(SUBLINE);
  });
});

describe("Das Band ist nur das Foto — der Verlauf liegt darüber", () => {
  it("backt keinen Verlauf ins Bild", () => {
    const svg = bandSvg("/pfad/zum/foto.png", { breite: 1600, hoehe: 1067 });
    expect(svg).toContain("<image");
    // Wäre der Verlauf hier eingebacken, würde er beim formatfüllenden
    // Beschneiden mitbeschnitten — quer läge seine Unterkante mitten im
    // Farbverlauf, und die Kante des Fotos wäre sichtbar.
    expect(svg).not.toContain("linearGradient");
  });
});
