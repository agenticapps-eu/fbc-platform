import { describe, expect, it } from "vitest";

import { BILD_UNLESBAR, MAX_KANTE, QUALITAET, shrinkToWebp, zielMasse } from "./image";

/**
 * Die Zielmaße sind bewusst eine reine Funktion (AGE-528, Task 5.1): jsdom hat
 * keinen 2D-Kontext, ein Canvas-Test könnte also nur behaupten, dass nichts
 * wirft. Geprüft wird deshalb die Rechnung, nicht das Zeichnen.
 */
describe("zielMasse", () => {
  it("verkleinert die lange Kante auf die Maximalkante und behält das Seitenverhältnis", () => {
    expect(zielMasse(4032, 3024, 1600)).toEqual({ width: 1600, height: 1200 });
  });

  it("hochkant ist die Höhe die lange Kante", () => {
    expect(zielMasse(3024, 4032, 1600)).toEqual({ width: 1200, height: 1600 });
  });

  it("vergrößert ein kleineres Bild NICHT", () => {
    expect(zielMasse(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });

  it("lässt auch bei extremem Seitenverhältnis keine 0-Kante entstehen", () => {
    // 16000×3 skaliert auf 0,1 → 0,3 px Höhe. Ein Canvas mit Höhe 0 wirft beim
    // Zeichnen, deshalb ist die Untergrenze 1 px.
    expect(zielMasse(16000, 3, 1600)).toEqual({ width: 1600, height: 1 });
  });

  it("nennt die Grenzen aus design.md: 1600 px und Qualität 0,82", () => {
    expect(MAX_KANTE).toBe(1600);
    expect(QUALITAET).toBe(0.82);
  });
});

describe("shrinkToWebp", () => {
  it("wirft bei einem unlesbaren Bild eine benennbare Meldung, keinen nackten Absturz", async () => {
    // Task 5.1a: der Fehler muss SOFORT und konkret sein. Ohne das läuft der
    // Nutzer erst am 1-MiB-Limit des Buckets in einen späten Serverfehler.
    // jsdom hat weder `createImageBitmap` noch einen 2D-Kontext — genau der
    // Zweig, den diese Zusicherung festhält.
    await expect(shrinkToWebp(new Blob(["kein bild"], { type: "text/plain" }))).rejects.toThrow(
      BILD_UNLESBAR,
    );
  });
});
