import { describe, expect, it } from "vitest";
import { slotsMitCover, type SerieSlot } from "./event-vorlagen";

/**
 * Die Naht zwischen Vorschau und Erzeugung (AGE-630, 9.2 / 7.7-Clienthälfte).
 *
 * `event_serie_erzeugen` nimmt die Cover-Pfade als ARRAY entgegen und ordnet
 * sie den Terminen **nach Position** zu — der n-te Pfad gehört zum n-ten
 * Termin, und „n-ter" heißt dort: nach `slot_datum` aufsteigend. Die RPC prüft
 * Anzahl, Präfix und Eindeutigkeit (22023), aber nicht, ob die Reihenfolge die
 * ist, die der Client gemeint hat. Genau diese Prüfung kann sie gar nicht
 * anstellen — und genau deshalb steht sie hier.
 *
 * Der Fehler, den das verhindert, ist leise: eine Serie entsteht vollständig,
 * jeder Termin trägt ein Bild, und es ist das Bild eines anderen Datums.
 */

function slot(datum: string): SerieSlot {
  return { slotDatum: datum, startsAt: `${datum}T16:30:00+00:00` };
}

const UID = "11111111-1111-1111-1111-111111111111";

describe("slotsMitCover", () => {
  it("sortiert die Termine nach Datum, egal wie sie hereinkommen", () => {
    // Die Funktion liefert die Slots heute schon sortiert. Sich darauf zu
    // VERLASSEN wäre die Annahme, die beim ersten `order by` weniger bricht.
    const durcheinander = [slot("2026-10-06"), slot("2026-09-01"), slot("2026-11-03")];
    const { slots } = slotsMitCover(UID, durcheinander, true);
    expect(slots.map((s) => s.slotDatum)).toEqual(["2026-09-01", "2026-10-06", "2026-11-03"]);
  });

  it("legt genau einen Pfad je Termin an", () => {
    const { slots, pfade } = slotsMitCover(UID, [slot("2026-09-01"), slot("2026-09-08")], true);
    expect(pfade).toHaveLength(slots.length);
  });

  it("ohne Titelbild wird gar kein Array geschickt, nicht ein leeres", () => {
    // `p_cover_pfade` ist `default null`. Ein leeres Array ist NICHT dasselbe:
    // es hätte die Länge 0 und träfe damit auf die Anzahlprüfung — 22023 bei
    // einer Vorlage, die schlicht kein Bild hat.
    const { pfade } = slotsMitCover(UID, [slot("2026-09-01")], false);
    expect(pfade).toBeNull();
  });

  it("vergibt lauter verschiedene Pfade im eigenen Präfix", () => {
    const viele = Array.from({ length: 52 }, (_, i) =>
      slot(`2026-09-${String((i % 28) + 1).padStart(2, "0")}`),
    );
    const { pfade } = slotsMitCover(UID, viele, true);
    expect(new Set(pfade).size).toBe(52);
    expect(pfade!.every((p) => p.startsWith(`${UID}/`))).toBe(true);
  });

  it("keine Termine, kein Pfad — und kein Absturz", () => {
    const { slots, pfade } = slotsMitCover(UID, [], true);
    expect(slots).toEqual([]);
    expect(pfade).toEqual([]);
  });
});
