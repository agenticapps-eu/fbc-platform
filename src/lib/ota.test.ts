import { beforeEach, describe, expect, it, vi } from "vitest";

// Die Brücke zum Plugin wird ersetzt, nicht die Entscheidung darüber, OB sie
// gerufen wird. Genau das ist die Zusage dieses Moduls.
const notifyAppReady = vi.fn(async () => ({ bundle: { id: "builtin" } }));
vi.mock("@capgo/capacitor-updater", () => ({ CapacitorUpdater: { notifyAppReady } }));

describe("die Startbestätigung des Luftwegs (AGE-642 D4)", () => {
  beforeEach(() => {
    notifyAppReady.mockReset();
    notifyAppReady.mockResolvedValue({ bundle: { id: "builtin" } });
    // Ohne das liefert der Modul-Zwischenspeicher beim zweiten Test denselben
    // Rumpf aus, ohne ihn erneut auszuwerten — und die Zusage wäre grün,
    // weil nichts mehr lief.
    vi.resetModules();
  });

  // Der Kern. Bleibt sie aus, rollt das Plugin nach `appReadyTimeout` (10 s)
  // auf die vorige Fassung zurück — auch dann, wenn dieses Bündel in Ordnung
  // war. Der Aufruf gehört deshalb in den Rumpf des Moduls und nicht hinter
  // eine Bedingung, die jemand später versehentlich falsch stellt.
  it("geht ab, sobald das Modul ausgewertet ist", async () => {
    await import("./ota");
    expect(notifyAppReady).toHaveBeenCalledTimes(1);
  });

  // jsdom IST der Web-Fall: `Capacitor.isNativePlatform()` steht hier auf
  // `false`. Käme je ein `if (nativ)` davor, fiele genau dieser Test um.
  //
  // Und er soll umfallen: die Web-Umsetzung des Plugins ist ein reines
  // `return { bundle: BUNDLE_BUILTIN }` (`dist/esm/web.js:172`) — sie kostet
  // nichts, warnt nicht und kann nicht scheitern. Eine Plattform-Bedingung
  // spart also nichts und fügt eine Stelle hinzu, an der die Bestätigung
  // ausbleiben kann. Das ist ein schlechter Tausch: ein falsch stehender
  // Wächter bricht JEDES Gerät bis zur nächsten Store-Einreichung.
  it("bestätigt ohne Plattform-Bedingung — auch im Web", async () => {
    await import("./ota");
    expect(notifyAppReady).toHaveBeenCalled();
  });

  // Die Bestätigung darf den Start nicht aufhalten und erst recht nicht
  // abbrechen. Ein `await` im Modulrumpf (top-level await) machte aus einer
  // hakenden Brücke einen Startfehler — und ein Startfehler ist genau das,
  // wogegen dieses Modul schützt.
  it("lässt einen Fehlschlag der Brücke den Start nicht abbrechen", async () => {
    notifyAppReady.mockRejectedValueOnce(new Error("Brücke weg"));
    await expect(import("./ota")).resolves.toBeDefined();
  });
});
