import { describe, expect, it } from "vitest";

import { KANTE_PX, SCHWELLE_PX, wischtVonRechts } from "./wischgeste";

const BREITE = 390;
const amRand = BREITE - 5;

describe("wischtVonRechts", () => {
  it("erkennt das Ziehen von der rechten Kante nach links", () => {
    expect(wischtVonRechts({ startX: amRand, breite: BREITE, dx: -80, dy: 4 })).toBe(true);
  });

  // Positivkontrolle zur Verneinung: ohne sie wäre eine Funktion, die IMMER
  // true sagt, von einer, die prüft, nicht zu unterscheiden.
  it("erkennt nichts, wenn dieselbe Bewegung MITTEN auf dem Bildschirm beginnt", () => {
    expect(wischtVonRechts({ startX: BREITE / 2, breite: BREITE, dx: -80, dy: 4 })).toBe(false);
  });

  it("lässt das Scrollen in Ruhe, auch wenn es am rechten Rand beginnt", () => {
    // Senkrecht weiter als waagerecht — das ist eine Scrollbewegung, kein
    // Wischen. Ohne diese Regel risse jedes Scrollen am Rand die Leiste auf.
    expect(wischtVonRechts({ startX: amRand, breite: BREITE, dx: -60, dy: 200 })).toBe(false);
  });

  it("löst nicht schon bei einem Wackeln aus", () => {
    expect(wischtVonRechts({ startX: amRand, breite: BREITE, dx: -10, dy: 0 })).toBe(false);
  });

  it("löst nicht aus, wenn nach RECHTS gezogen wird", () => {
    expect(wischtVonRechts({ startX: amRand, breite: BREITE, dx: 120, dy: 0 })).toBe(false);
  });

  it("greift genau ab der Schwelle, nicht davor", () => {
    const knapp = { startX: amRand, breite: BREITE, dy: 0 };
    expect(wischtVonRechts({ ...knapp, dx: -(SCHWELLE_PX - 1) })).toBe(false);
    expect(wischtVonRechts({ ...knapp, dx: -(SCHWELLE_PX + 1) })).toBe(true);
  });

  it("greift genau innerhalb der Kantenbreite, nicht davor", () => {
    const zug = { breite: BREITE, dx: -80, dy: 0 };
    expect(wischtVonRechts({ ...zug, startX: BREITE - KANTE_PX - 1 })).toBe(false);
    expect(wischtVonRechts({ ...zug, startX: BREITE - KANTE_PX + 1 })).toBe(true);
  });
});
