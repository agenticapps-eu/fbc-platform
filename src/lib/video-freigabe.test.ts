import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { abonnieren, freigeben, istFreigegeben, widerrufen } from "./video-freigabe";

const SCHLUESSEL = "fbc.video-freigabe";

// Klammern, kein Kurzschluss: der Rueckgabewert einer `beforeEach`-Funktion IST
// der Teardown. `beforeEach(() => localStorage.clear())` gaebe zwar `undefined`
// zurueck und ginge hier gut — aber die Form ist die, die anderswo schon einmal
// eine Attrappe nach JEDEM Test zurueckgesetzt hat.
beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("video-freigabe — die Entscheidung ueberlebt die Seite (AGE-621)", () => {
  it("ist zu Beginn fuer keinen Anbieter erteilt", () => {
    expect(istFreigegeben("youtube")).toBe(false);
    expect(istFreigegeben("vimeo")).toBe(false);
  });

  it("merkt eine Freigabe ueber einen neuen Lesevorgang hinaus", () => {
    freigeben("youtube");
    expect(istFreigegeben("youtube")).toBe(true);
  });

  it("greift NICHT auf den anderen Anbieter ueber", () => {
    // Der ganze Sinn einer Freigabe je Anbieter: wer YouTube erlaubt, hat
    // ueber Vimeo nichts gesagt.
    freigeben("youtube");
    expect(istFreigegeben("vimeo")).toBe(false);
  });

  it("nimmt eine Freigabe einzeln zurueck", () => {
    freigeben("youtube");
    freigeben("vimeo");
    widerrufen("youtube");

    expect(istFreigegeben("youtube")).toBe(false);
    expect(istFreigegeben("vimeo")).toBe(true);
  });

  it("schreibt keine Kennung, nur die Entscheidung", () => {
    freigeben("youtube");
    const roh = localStorage.getItem(SCHLUESSEL) ?? "";

    // Was hier steht, steht auf dem Geraet des Besuchers. Es darf die
    // Entscheidung tragen und sonst nichts — kein Zufallswert, kein Zeitstempel,
    // aus dem sich ein Besuch wiedererkennen liesse.
    expect(roh).toBe("youtube");
  });

  it("meldet einen Wechsel an die uebrigen Flaechen derselben Seite", () => {
    const gerufen = vi.fn();
    const abbestellen = abonnieren(gerufen);

    freigeben("youtube");
    expect(gerufen).toHaveBeenCalled();

    abbestellen();
    gerufen.mockClear();
    widerrufen("youtube");
    expect(gerufen).not.toHaveBeenCalled();
  });

  describe("wenn der Speicher nicht zur Verfuegung steht", () => {
    // Der Zugriff wirft in abgeschotteten Kontexten, und er geschieht beim
    // RENDERN. Ein ungefangener Fehler risse dort die ganze Seite auf, statt
    // nur das Merken zu verlieren.

    it("liest ohne zu werfen und meldet: nicht freigegeben", () => {
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new Error("Zugriff verweigert");
      });

      expect(() => istFreigegeben("youtube")).not.toThrow();
      expect(istFreigegeben("youtube")).toBe(false);
    });

    it("schreibt ohne zu werfen", () => {
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("Kein Platz");
      });

      expect(() => freigeben("youtube")).not.toThrow();
    });

    it("meldet den Wechsel trotzdem, damit die aktuelle Seite reagiert", () => {
      // Das Merken faellt aus, das Tor nicht: wer geklickt hat, soll sein Video
      // sehen. Nur der naechste Aufruf faengt wieder von vorn an.
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("Kein Platz");
      });
      const gerufen = vi.fn();
      abonnieren(gerufen);

      freigeben("youtube");
      expect(gerufen).toHaveBeenCalled();
    });
  });
});
