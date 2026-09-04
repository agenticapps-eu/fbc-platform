import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { bilderVonQuelle, entscheideBildauswahl } from "./bildauswahl";

const takePhoto = vi.fn();
const chooseFromGallery = vi.fn();

// Die REIHENFOLGE ist die Zusage, nicht die blosse Zahl der Aufrufe: ein
// Aufschub, der erst nach dem Kamera-Aufruf gesetzt wird, kommt zu spaet — das
// Buendel wird beim `handleOnStart` der RUECKKEHR uebernommen, und bis dahin
// muss er stehen. Ohne dieses Protokoll waere ein Diff, der die beiden Zeilen
// vertauscht, gruen und wirkungslos.
const reihenfolge: string[] = [];
const setMultiDelay = vi.fn(async (o: unknown) => {
  reihenfolge.push("aufschub");
  return o;
});
const cancelDelay = vi.fn(async () => {
  reihenfolge.push("freigabe");
});

vi.mock("@capgo/capacitor-updater", () => ({
  CapacitorUpdater: {
    setMultiDelay: (o: unknown) => setMultiDelay(o),
    cancelDelay: () => cancelDelay(),
  },
}));

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

/**
 * AGE-642 — der Aufschub um den nativen Rundlauf.
 *
 * WOGEGEN ER STEHT, gemessen am 04.09. am Pixel 11 Pro: `capacitor.config.ts`
 * setzt weder `autoUpdate` noch `directUpdate`, es gelten die Vorgaben. Ein
 * geladenes OTA-Buendel wird deshalb beim `handleOnStart` uebernommen — bei der
 * Rueckkehr aus dem GESTOPPTEN Zustand, und die Kamera stoppt uns. Die
 * Uebernahme laedt die WebView neu; das `await` auf die Kamera stirbt mit ihr,
 * ohne Ergebnis und ohne Fehler.
 *
 * WAS HIER NICHT GEPRUEFT WIRD: dass der Aufschub am Geraet wirkt. Das entsteht
 * in jsdom nie und steht als Messung in `tasks.md`. Geprueft wird die Naht —
 * DASS er gesetzt wird, WANN, und dass er auf JEDEM Ausgang wieder faellt.
 */
describe("der OTA-Aufschub um die native Auswahl (AGE-642)", () => {
  beforeEach(() => {
    takePhoto.mockReset();
    chooseFromGallery.mockReset();
    setMultiDelay.mockClear();
    cancelDelay.mockClear();
    reihenfolge.length = 0;
    takePhoto.mockImplementation(async () => {
      reihenfolge.push("kamera");
      return { webPath: "capacitor://foto-1" };
    });
    chooseFromGallery.mockImplementation(async () => {
      reihenfolge.push("mediathek");
      return { results: [{ webPath: "capacitor://a" }] };
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ blob: async () => new Blob(["x"], { type: "image/jpeg" }) })),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("steht VOR dem Kamera-Aufruf und faellt danach", async () => {
    await bilderVonQuelle("kamera", { mehrere: false, limit: 1 });
    expect(reihenfolge).toEqual(["aufschub", "kamera", "freigabe"]);
  });

  it("steht auch um die Mediathek", async () => {
    // Sie ist heute der harmlosere Weg — der Fotos-Picker pausiert die App nur,
    // statt sie zu stoppen. „Heute" ist aber keine Zusage: welcher Waehler
    // erscheint, entscheidet das System, und auf aelteren Faechern ist er
    // Vollbild.
    await bilderVonQuelle("mediathek", { mehrere: true, limit: 4 });
    expect(reihenfolge).toEqual(["aufschub", "mediathek", "freigabe"]);
  });

  it("verschiebt bis zum echten Neustart, nicht bloss um eine Weile", async () => {
    // `kind: "kill"` ist die einzige Bedingung, die keine Frist mitbringt. Eine
    // Zeitspanne waere geraten und liefe in einem langen Rundlauf ab.
    await bilderVonQuelle("kamera", { mehrere: false, limit: 1 });
    expect(setMultiDelay).toHaveBeenCalledWith({ delayConditions: [{ kind: "kill" }] });
  });

  // DIE wichtigste Zusage dieses Abschnitts, und die einzige, deren Bruch man
  // nie bemerkte: der Abbruch ist der HAEUFIGSTE Ausgang. Bliebe der Aufschub
  // dabei stehen, naehme das Geraet ab dem ersten abgebrochenen Bildwaehler
  // ueberhaupt keine Aktualisierung mehr an — bis die App neu gestartet wird.
  it("faellt auch, wenn die Auswahl abgebrochen wird", async () => {
    takePhoto.mockRejectedValue(new Error("User cancelled photos app"));
    await expect(bilderVonQuelle("kamera", { mehrere: false, limit: 1 })).resolves.toEqual([]);
    expect(cancelDelay).toHaveBeenCalledTimes(1);
  });

  it("faellt auch, wenn das Holen der Datei scheitert", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("net::ERR_FAILED");
      }),
    );
    await expect(bilderVonQuelle("kamera", { mehrere: false, limit: 1 })).rejects.toThrow();
    expect(cancelDelay).toHaveBeenCalledTimes(1);
  });

  // Der Aufschub ist eine Vorsichtsmassnahme. Eine, die die Bildauswahl
  // abbricht, erzeugte genau den stummen Ausgang, den sie verhindern soll —
  // `waehlen()` im Hook fuehrt kein `catch`.
  it("laesst die Auswahl laufen, wenn der Aufschub selbst scheitert", async () => {
    setMultiDelay.mockRejectedValueOnce(new Error("not implemented"));
    await expect(bilderVonQuelle("kamera", { mehrere: false, limit: 1 })).resolves.toHaveLength(1);
  });

  it("laesst das Ergebnis stehen, wenn die Freigabe scheitert", async () => {
    cancelDelay.mockRejectedValueOnce(new Error("not implemented"));
    await expect(bilderVonQuelle("kamera", { mehrere: false, limit: 1 })).resolves.toHaveLength(1);
  });
});
