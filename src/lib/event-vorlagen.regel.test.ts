import { describe, expect, it } from "vitest";
import {
  regelVollstaendig,
  serienCoverPfade,
  WIEDERHOLUNG_OPTIONS,
  type VorlageRegel,
} from "./event-vorlagen";

/**
 * Diese Datei ist der Wächter über `event_vorlagen_regelform` — den CHECK aus
 * 20260906090000_event_vorlagen_und_serientermine.sql:99. Er sagt je Regelform,
 * welche der drei Felder gesetzt sein MÜSSEN und welche null sein müssen:
 *
 *   woechentlich              → wochentag,          Rest null
 *   monatlich_tag             → tag_im_monat,       Rest null
 *   monatlich_n_ter_wochentag → wochentag + position, tag_im_monat null
 *
 * Ohne diese Prüfung im Client scheitert ein unvollständiges Formular erst am
 * `insert`, mit 23514 und einem Constraint-Namen im Toast — weit weg von dem
 * Feld, das schuld ist. Dasselbe Muster wie die zwei Pflichtfelder in
 * `EventForm` (AGE-531).
 */

const leer: VorlageRegel = {
  wiederholung: null,
  wochentag: null,
  tagImMonat: null,
  wochentagPosition: null,
};

describe("WIEDERHOLUNG_OPTIONS", () => {
  it("bietet nur Werte an, die der CHECK kennt", () => {
    // Die Wahrheit steht in der Migration:
    //   check (wiederholung in ('woechentlich','monatlich_tag','monatlich_n_ter_wochentag'))
    // Eine Option, die die Constraint nicht kennt, ist ein Speichern-Fehler in Prod.
    expect(WIEDERHOLUNG_OPTIONS.map((o) => o.value).sort()).toEqual([
      "monatlich_n_ter_wochentag",
      "monatlich_tag",
      "woechentlich",
    ]);
  });
});

describe("regelVollstaendig", () => {
  it("eine Vorlage ohne Regel ist vollständig — sie ist einfach keine Serie", () => {
    // Der `else`-Zweig des CHECK verlangt, dass dann ALLE drei null sind.
    expect(regelVollstaendig(leer)).toBe(true);
  });

  it("ohne Regel, aber mit gesetztem Wochentag: unvollständig", () => {
    // Genau der `else`-Zweig. Passiert real beim Umschalten der Auswahl
    // zurück auf „keine Wiederholung", wenn das Feld stehen bleibt.
    expect(regelVollstaendig({ ...leer, wochentag: 2 })).toBe(false);
  });

  it("wöchentlich braucht den Wochentag", () => {
    expect(regelVollstaendig({ ...leer, wiederholung: "woechentlich" })).toBe(false);
    expect(regelVollstaendig({ ...leer, wiederholung: "woechentlich", wochentag: 2 })).toBe(true);
  });

  it("wöchentlich duldet kein Monatsfeld daneben", () => {
    expect(
      regelVollstaendig({
        ...leer,
        wiederholung: "woechentlich",
        wochentag: 2,
        tagImMonat: 15,
      }),
    ).toBe(false);
  });

  it("monatlich_tag braucht den Tag im Monat und sonst nichts", () => {
    expect(regelVollstaendig({ ...leer, wiederholung: "monatlich_tag" })).toBe(false);
    expect(regelVollstaendig({ ...leer, wiederholung: "monatlich_tag", tagImMonat: 15 })).toBe(true);
    expect(
      regelVollstaendig({
        ...leer,
        wiederholung: "monatlich_tag",
        tagImMonat: 15,
        wochentag: 2,
      }),
    ).toBe(false);
  });

  it("monatlich_n_ter_wochentag braucht BEIDE Wochentag-Felder", () => {
    const basis = { ...leer, wiederholung: "monatlich_n_ter_wochentag" as const };
    expect(regelVollstaendig({ ...basis, wochentag: 2 })).toBe(false);
    expect(regelVollstaendig({ ...basis, wochentagPosition: 1 })).toBe(false);
    expect(regelVollstaendig({ ...basis, wochentag: 2, wochentagPosition: 1 })).toBe(true);
  });

  it("monatlich_n_ter_wochentag duldet keinen Tag im Monat daneben", () => {
    expect(
      regelVollstaendig({
        ...leer,
        wiederholung: "monatlich_n_ter_wochentag",
        wochentag: 2,
        wochentagPosition: 1,
        tagImMonat: 15,
      }),
    ).toBe(false);
  });
});

describe("serienCoverPfade", () => {
  // Die RPC prüft Anzahl, Präfix und Eindeutigkeit und weist Abweichungen mit
  // 22023 ab (20260907110000_event_serie_cover.sql). Sie kann die Namen aber
  // nicht VERGEBEN — das passiert hier, vor dem Aufruf.

  it("erzeugt genau so viele Pfade wie Termine", () => {
    expect(serienCoverPfade("11111111-1111-1111-1111-111111111111", 5)).toHaveLength(5);
  });

  it("legt jeden Pfad ins eigene Präfix", () => {
    const uid = "11111111-1111-1111-1111-111111111111";
    for (const pfad of serienCoverPfade(uid, 3)) {
      expect(pfad.startsWith(`${uid}/`)).toBe(true);
    }
  });

  it("vergibt lauter verschiedene Namen", () => {
    // `cover_path` ist unique. Zwei gleiche Namen wären ein 23505 mitten in
    // einer Erzeugung von 52 Terminen.
    const pfade = serienCoverPfade("11111111-1111-1111-1111-111111111111", 52);
    expect(new Set(pfade).size).toBe(52);
  });

  it("null Termine sind null Pfade, nicht ein leerer Name", () => {
    expect(serienCoverPfade("11111111-1111-1111-1111-111111111111", 0)).toEqual([]);
  });
});
