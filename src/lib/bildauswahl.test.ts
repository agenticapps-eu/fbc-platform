import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { bilderVonQuelle, entscheideBildauswahl } from "./bildauswahl";

const takePhoto = vi.fn();
const chooseFromGallery = vi.fn();

vi.mock("@capacitor/camera", () => ({
  Camera: {
    takePhoto: (o: unknown) => takePhoto(o),
    chooseFromGallery: (o: unknown) => chooseFromGallery(o),
  },
  EncodingType: { JPEG: 0, PNG: 1 },
  MediaTypeSelection: { Photo: 0, Video: 1, All: 2 },
}));

describe("entscheideBildauswahl", () => {
  it("nimmt im Web das bestehende Dateifeld", () => {
    expect(entscheideBildauswahl({ nativ: false, mehrere: false, frei: 1 })).toEqual({
      art: "dateifeld",
    });
  });

  // Positivkontrolle zur Verneinung: der andere Zweig existiert und wird
  // getroffen. Ohne sie waere eine Funktion, die IMMER "dateifeld" sagt, von
  // einer, die entscheidet, nicht zu unterscheiden.
  it("fragt nativ nach der Quelle", () => {
    expect(entscheideBildauswahl({ nativ: true, mehrere: false, frei: 1 })).toEqual({
      art: "rueckfrage",
      mehrere: false,
      limit: 1,
    });
  });

  // Im Web bleibt es beim Dateifeld, gleich was sonst gilt — sonst zeigte der
  // Browser eine Rueckfrage, hinter der keine Kamera-API steht.
  it("bleibt im Web beim Dateifeld, auch bei Mehrfachauswahl", () => {
    expect(entscheideBildauswahl({ nativ: false, mehrere: true, frei: 6 })).toEqual({
      art: "dateifeld",
    });
  });

  it("reicht die Mehrfachauswahl samt Rest an die Mediathek durch", () => {
    expect(entscheideBildauswahl({ nativ: true, mehrere: true, frei: 4 })).toEqual({
      art: "rueckfrage",
      mehrere: true,
      limit: 4,
    });
  });

  // DIE Zusage dieses Abschnitts. `MAX_BILDER` ist 6, und `frei` ist der REST.
  // Ohne die Grenze duerfte jemand am Geraet zwanzig Bilder waehlen, von denen
  // `waehleBilder` die meisten stumm verwuerfe — im Web haelt das der
  // Dialog selbst, nativ haelt es niemand.
  it("laesst nie mehr zu, als noch frei ist", () => {
    expect(entscheideBildauswahl({ nativ: true, mehrere: true, frei: 1 })).toEqual({
      art: "rueckfrage",
      mehrere: true,
      limit: 1,
    });
  });

  // Einzelauswahl ist eine Zusage, keine Bequemlichkeit: dahinter haengen
  // Zuschnitt-Flaechen, die genau EINE Datei erwarten.
  it("bleibt bei einem Bild, auch wenn viel frei ist", () => {
    expect(entscheideBildauswahl({ nativ: true, mehrere: false, frei: 6 })).toEqual({
      art: "rueckfrage",
      mehrere: false,
      limit: 1,
    });
  });
});

/**
 * Der Vertrag von `bilderVonQuelle` selbst — geprueft HIER und nicht ueber den
 * Hook, und das ist eine Lehre aus der Gegenprobe: durch den Hook hindurch war
 * der Abbruch-Zweig **nicht** belegt. Wird aus dem Abbruch ein Fehler, schlaegt
 * dort nichts an, weil die Rueckfrage schon geschlossen ist und eine
 * unbehandelte Rejection im DOM unsichtbar bleibt.
 */
describe("bilderVonQuelle", () => {
  beforeEach(() => {
    takePhoto.mockReset();
    chooseFromGallery.mockReset();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ blob: async () => new Blob(["x"], { type: "image/jpeg" }) })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("macht aus einem Abbruch eine leere Liste, keinen Fehler", async () => {
    takePhoto.mockRejectedValue(new Error("User cancelled photos app"));
    await expect(bilderVonQuelle("kamera", { mehrere: false, limit: 1 })).resolves.toEqual([]);
  });

  it("macht auch aus einem Abbruch in der Mediathek eine leere Liste", async () => {
    chooseFromGallery.mockRejectedValue(new Error("canceled"));
    await expect(bilderVonQuelle("mediathek", { mehrere: true, limit: 4 })).resolves.toEqual([]);
  });

  // Positivkontrolle zu beiden Verneinungen: ohne sie waere eine Funktion, die
  // IMMER [] liefert, von einer, die etwas holt, nicht zu unterscheiden.
  it("liefert aus der Kamera genau eine Datei", async () => {
    takePhoto.mockResolvedValue({ webPath: "capacitor://foto-1" });
    const dateien = await bilderVonQuelle("kamera", { mehrere: false, limit: 1 });
    expect(dateien).toHaveLength(1);
    expect(dateien[0].type).toBe("image/jpeg");
  });

  // HEIC vom iPhone hat am 17.08. ein Mitglied vor eine leere Zuschnittflaeche
  // und einen toten Knopf gesetzt. `EncodingType.JPEG` ist die Gegenmassnahme,
  // und sie ist nur dann eine, wenn sie auch mitgegeben wird.
  it("verlangt von der Kamera ausdruecklich JPEG", async () => {
    takePhoto.mockResolvedValue({ webPath: "capacitor://foto-1" });
    await bilderVonQuelle("kamera", { mehrere: false, limit: 1 });
    expect(takePhoto).toHaveBeenCalledWith(expect.objectContaining({ encodingType: 0 }));
  });

  it("ueberspringt Ergebnisse ohne Pfad, statt an ihnen zu scheitern", async () => {
    chooseFromGallery.mockResolvedValue({ results: [{ webPath: "capacitor://a" }, {}] });
    await expect(bilderVonQuelle("mediathek", { mehrere: true, limit: 4 })).resolves.toHaveLength(
      1,
    );
  });
});
