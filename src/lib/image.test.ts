import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  BILD_UNLESBAR,
  MAX_BYTES,
  MAX_KANTE,
  QUALITAET,
  shrinkToWebp,
  zielMasse,
} from "./image";

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

describe("shrinkToWebp — die Grenze des Buckets", () => {
  // Der Browser, nicht unser Code: jsdom hat weder `createImageBitmap` noch
  // einen 2D-Kontext. `zielMasse` und die Schleife laufen echt.
  let qualitaeten: number[] = [];
  let groesse = 0;

  beforeEach(() => {
    qualitaeten = [];
    vi.stubGlobal("createImageBitmap", async () => ({
      width: 4032,
      height: 3024,
      close: () => {},
    }));
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: () => {},
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((rueckruf, _typ, q) => {
      qualitaeten.push(q as number);
      // Jeder Durchgang liefert ein kleineres Bild — wie eine echte Kodierung.
      rueckruf(new Blob([new Uint8Array(Math.round(groesse / (qualitaeten.length * 4)))]));
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("gibt ein Bild unter 1 MiB unverändert zurück, ohne zweiten Durchgang", async () => {
    groesse = 400_000;

    const { blob } = await shrinkToWebp(new Blob(["x"]));

    expect(blob.size).toBeLessThan(MAX_BYTES);
    expect(qualitaeten).toEqual([QUALITAET]);
  });

  it("kodiert ein zu großes Bild mit geringerer Qualität nach, statt es abzuliefern", async () => {
    // Der Bucket lehnt über 1 MiB serverseitig ab. Ohne diese Schleife fällt
    // das erst beim Hochladen auf — also nachdem der Beitrag geschrieben und
    // „Posten" gedrückt ist, als roher Storage-Fehler im Toast.
    groesse = 8_000_000;

    const { blob } = await shrinkToWebp(new Blob(["x"]));

    expect(blob.size).toBeLessThanOrEqual(MAX_BYTES);
    expect(qualitaeten.length).toBeGreaterThan(1);
    expect(qualitaeten[1]).toBeLessThan(qualitaeten[0]);
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
