import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  ADAPTIV_KANTE,
  ADAPTIV_SICHER,
  HINTERGRUND,
  KANTE,
  MARKENANTEIL,
  VORDERGRUND,
  hintergrundXml,
  leseMarke,
  symbolSvg,
  vordergrundSvg,
} from "./app-icons.logic";

/**
 * Das App-Symbol (AGE-642).
 *
 * WAS DIESER TEST WIRKLICH BEWACHT: dass die Marke des Symbols dieselbe bleibt
 * wie die der Web-Fläche. Sie liegt im Repo mehrfach, und die Kopie, die
 * niemand sieht, ist die auf dem Startbildschirm — sie fällt erst auf einem
 * Gerät auf, und dort nur jemandem, der beide nebeneinander hält.
 *
 * Deshalb liest der Test das ECHTE Favicon von der Platte und nicht eine
 * Beispielzeichenkette: eine Vorlage im Test bezeugte nur sich selbst.
 */
// Pfad ab der Wurzel: vitest laeuft von dort, und ein Pfad relativ zu dieser
// Datei traegt in der Transformationsschicht keine `file:`-URL mehr.
const FAVICON = readFileSync("public/brand/compass-favicon.svg", "utf8");

const marke = leseMarke(FAVICON);

/** Holt den Skalierungsfaktor und den Versatz aus dem erzeugten `transform`. */
function lageDerMarke(svg: string): { versatz: number; faktor: number } {
  const m = /translate\(([\d.]+) [\d.]+\) scale\(([\d.]+)\)/.exec(svg);
  if (!m) throw new Error(`kein transform in: ${svg}`);
  return { versatz: Number(m[1]), faktor: Number(m[2]) };
}

describe("Die Marke kommt aus dem Favicon und nicht aus einer Kopie", () => {
  it("liest den Stern wörtlich, so wie er im Favicon steht", () => {
    const imFavicon = /<path[^>]*\sd="([^"]+)"/.exec(FAVICON)![1];
    expect(marke.stern).toBe(imFavicon);
    // Positivkontrolle zur Regex: EIN geschlossener Pfad aus fünf Teilzügen —
    // der achtpunktige Hauptstern und vier Nebenstrahlen mit je vier Punkten
    // (AGE-642). Keine leere Zeichenkette, die alles bestehen liesse.
    expect(marke.stern).toMatch(
      /^M[\d.]+ [\d.]+( L[\d.]+ [\d.]+){7} Z( M[\d.]+ [\d.]+( L[\d.]+ [\d.]+){3} Z){4}$/,
    );
  });

  it("hat keinen Ring mehr, und das Skript zeichnete einen auch nicht mehr mit", () => {
    // Der Ring ist am 29.08. ersatzlos entfallen (AGE-642). Ein <circle>, der
    // sich wieder ins Favicon verirrte, würde von diesem Generator STILL
    // übergangen — das Symbol trüge dann eine andere Marke als der Tab. Also
    // wird er verboten, statt ihn zu ignorieren.
    expect(FAVICON).not.toContain("<circle");
    const mitRing = FAVICON.replace(
      "</svg>",
      '<circle cx="24" cy="24" r="15.5" stroke-width="3.5"/></svg>',
    );
    expect(() => leseMarke(mitRing)).toThrow(/kein <circle> erwartet/);
  });

  it("wirft bei einem zweiten Pfad, statt den ersten zu nehmen", () => {
    // Sonst gewinnt still der erste Treffer: käme im Favicon ein zweiter Pfad
    // dazu, erzeugte dieses Skript weiter das alte Symbol.
    const zwei = FAVICON.replace("</svg>", '<path d="M1 1 L2 2 Z"/></svg>');
    expect(() => leseMarke(zwei)).toThrow(/genau ein <path>/);
  });

  it("wirft bei einem transform, das es nicht liest", () => {
    // Der ehrlichste stille Fall: würde das Favicon seine Form verschoben statt
    // absolut angeben, bliebe der Vergleich oben grün und die Ausgabe wäre
    // falsch platziert. Dieses Skript liest kein `transform` — also sagt es
    // das, statt so zu tun.
    const verschoben = FAVICON.replace("<path", '<path transform="translate(2 2)"');
    expect(() => leseMarke(verschoben)).toThrow(/transform/);
  });

  it("wirft, statt ein halbes Symbol zu erzeugen", () => {
    expect(() => leseMarke("<svg></svg>")).toThrow(/viewBox/);
    expect(() => leseMarke('<svg viewBox="0 0 48 48"></svg>')).toThrow(/path/);
    expect(() => leseMarke('<svg viewBox="0 0 48 60"></svg>')).toThrow(/quadratisch/);
  });
});

describe("Das vollflächige Symbol", () => {
  const svg = symbolSvg(marke);

  it("trägt Navy bis an die Kante und die Marke in Weiss", () => {
    expect(svg).toContain(`<rect width="${KANTE}" height="${KANTE}" fill="${HINTERGRUND}"/>`);
    expect(svg).toContain(`<path d="${marke.stern}" fill="${VORDERGRUND}"/>`);
    // Seit dem Wegfall des Rings ist die Marke eine reine Füllung. Ein
    // stehengebliebenes `stroke` zöge eine Kontur, die die Vorlage nicht hat.
    expect(svg).not.toContain("stroke");
  });

  it("trägt das Blau des Favicons nirgends mehr", () => {
    // Ohne diese Zusage bliebe ein vergessenes `fill` blau auf navy stehen —
    // 1F53B0 auf 081527 sind 1,9:1 und auf dem Telefon praktisch unsichtbar.
    expect(svg.toUpperCase()).not.toContain("#1F53B0");
  });

  it("lässt der Marke Luft, statt sie an die Kante zu setzen", () => {
    const { versatz, faktor } = lageDerMarke(svg);
    expect(faktor * marke.kante).toBeCloseTo(KANTE * MARKENANTEIL, 1);
    expect(versatz).toBeGreaterThan(0);
    expect(versatz * 2 + faktor * marke.kante).toBeCloseTo(KANTE, 1);
  });

  it("ist rund wirklich rund — ohne Rechteck darunter", () => {
    const rund = symbolSvg(marke, { rund: true });
    expect(rund).not.toContain("<rect");
    expect(rund).toContain(`<circle cx="50" cy="50" r="50" fill="${HINTERGRUND}"/>`);
  });
});

describe("Androids adaptiver Vordergrund", () => {
  const svg = vordergrundSvg(marke);

  it("bleibt in der Sicherheitszone", () => {
    const { versatz, faktor } = lageDerMarke(svg);
    const breite = faktor * marke.kante;
    expect(breite).toBeLessThanOrEqual(ADAPTIV_SICHER);
    // Beide Ränder, nicht nur einer: mittig heisst auf beiden Seiten gleich.
    expect(versatz).toBeGreaterThanOrEqual((ADAPTIV_KANTE - ADAPTIV_SICHER) / 2);
    expect(versatz + breite).toBeLessThanOrEqual(
      ADAPTIV_KANTE - (ADAPTIV_KANTE - ADAPTIV_SICHER) / 2,
    );
  });

  it("zeichnet keine eigene Fläche mit", () => {
    // Die Fläche ist dort eine Farbe, kein Bild. Eine mitgezeichnete Fläche
    // wanderte beim Parallax-Effekt der Startbildschirme sichtbar mit.
    expect(svg).not.toContain("<rect");
    expect(svg).not.toContain(HINTERGRUND);
  });

  it("nennt dieselbe Farbe wie die Fläche, aus der Android sie nimmt", () => {
    expect(hintergrundXml()).toContain(HINTERGRUND);
  });
});
