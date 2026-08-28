import { describe, expect, it } from "vitest";

import { gruppiereNachTag, tagesTrennerLabel } from "./tagestrenner";

/** Bezugspunkt für alle Tests: Freitag, 28.08.2026, 12:00 Ortszeit. */
const JETZT = new Date(2026, 7, 28, 12, 0, 0);

function tag(tage: number, stunde = 10): string {
  const d = new Date(2026, 7, 28 - tage, stunde, 0, 0);
  return d.toISOString();
}

describe("tagesTrennerLabel", () => {
  it("nennt heute „Heute“", () => {
    expect(tagesTrennerLabel(tag(0), JETZT)).toBe("Heute");
  });

  it("nennt gestern „Gestern“", () => {
    expect(tagesTrennerLabel(tag(1), JETZT)).toBe("Gestern");
  });

  // Wie im Bild aus WhatsApp: innerhalb der letzten Woche der Wochentag.
  it("nennt die Tage davor beim Wochentag", () => {
    expect(tagesTrennerLabel(tag(2), JETZT)).toBe("Mittwoch");
    expect(tagesTrennerLabel(tag(6), JETZT)).toBe("Samstag");
  });

  it("nennt Älteres beim Datum", () => {
    expect(tagesTrennerLabel(tag(7), JETZT)).toMatch(/^\d{2}\.\d{2}\.\d{4}$/);
    expect(tagesTrennerLabel(tag(400), JETZT)).toMatch(/^\d{2}\.\d{2}\.\d{4}$/);
  });

  // Die Falle, die eine Differenz in Millisekunden stellt: 23:30 gestern und
  // 00:30 heute liegen eine Stunde auseinander, sind aber verschiedene Tage.
  it("zählt Kalendertage, nicht Zeitspannen", () => {
    const kurzNachMitternacht = new Date(2026, 7, 28, 0, 30).toISOString();
    const kurzDavor = new Date(2026, 7, 27, 23, 30).toISOString();
    expect(tagesTrennerLabel(kurzNachMitternacht, JETZT)).toBe("Heute");
    expect(tagesTrennerLabel(kurzDavor, JETZT)).toBe("Gestern");
  });
});

describe("gruppiereNachTag", () => {
  const n = (id: string, tage: number, stunde = 10) => ({ id, createdAt: tag(tage, stunde) });

  it("gibt für nichts nichts zurück", () => {
    expect(gruppiereNachTag([])).toEqual([]);
  });

  it("fasst denselben Kalendertag zu einer Gruppe", () => {
    const gruppen = gruppiereNachTag([n("a", 0, 9), n("b", 0, 11)]);
    expect(gruppen).toHaveLength(1);
    expect(gruppen[0].nachrichten.map((m) => m.id)).toEqual(["a", "b"]);
  });

  it("trennt verschiedene Tage", () => {
    const gruppen = gruppiereNachTag([n("alt", 3), n("gestern", 1), n("heute", 0)]);
    expect(gruppen).toHaveLength(3);
    expect(gruppen.map((g) => g.nachrichten[0].id)).toEqual(["alt", "gestern", "heute"]);
  });

  it("behält die Reihenfolge innerhalb einer Gruppe", () => {
    const gruppen = gruppiereNachTag([n("a", 1, 8), n("b", 1, 9), n("c", 1, 20)]);
    expect(gruppen[0].nachrichten.map((m) => m.id)).toEqual(["a", "b", "c"]);
  });
});
