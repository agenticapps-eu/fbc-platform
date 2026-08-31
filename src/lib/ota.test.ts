import { readFileSync } from "node:fs";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Die Brücke zum Plugin wird ersetzt, nicht die Entscheidung darüber, OB und
// WANN sie gerufen wird. Genau das ist die Zusage dieses Moduls.
const notifyAppReady = vi.fn(async () => ({ bundle: { id: "builtin" } }));
vi.mock("@capgo/capacitor-updater", () => ({ CapacitorUpdater: { notifyAppReady } }));

/** Das Zeichen, auf das das Modul wartet: der erste Element-Knoten unter `#root`. */
function rendere(): void {
  document.getElementById("root")!.appendChild(document.createElement("div"));
}

/** Ein Durchlauf des MutationObserver — jsdom stellt ihn in eine Mikroaufgabe. */
const tick = () => new Promise((fertig) => setTimeout(fertig, 0));

describe("die Startbestätigung des Luftwegs (AGE-642 D4)", () => {
  beforeEach(() => {
    notifyAppReady.mockReset();
    notifyAppReady.mockResolvedValue({ bundle: { id: "builtin" } });
    document.body.innerHTML = '<div id="root"></div>';
    // Ohne das liefert der Modul-Zwischenspeicher beim zweiten Test denselben
    // Rumpf aus, ohne ihn erneut auszuwerten — und die Zusage wäre grün,
    // weil nichts mehr lief.
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock("@capacitor/core");
  });

  // DER KERN, und der Grund für die Umarbeitung in Runde 6. Bis dahin stand der
  // Aufruf blank im Modulrumpf und ging ab, bevor irgendetwas gerendert war —
  // ein Bündel, das lädt und dann WEISS BLEIBT, war damit bereits als
  // erfolgreich gestempelt und fiel nie zurück. Genau das Szenario, für das es
  // den Rückweg gibt.
  it("bestätigt nicht, solange der Bildschirm leer bleibt", async () => {
    await import("./ota");
    await tick();
    expect(notifyAppReady).not.toHaveBeenCalled();
  });

  // Und die Gegenrichtung: steht ein Bild, geht sie ab. Bleibt SIE aus, rollt
  // das Plugin nach `appReadyTimeout` zurück — auch ein heiles Bündel.
  it("bestätigt, sobald das erste Bild steht", async () => {
    await import("./ota");
    rendere();
    await tick();
    expect(notifyAppReady).toHaveBeenCalledTimes(1);
  });

  // Der Zweig für den Fall, dass beim Auswerten schon ein Bild steht. Heute
  // unerreichbar, weil dieses Modul vor `createRoot` läuft — aber ohne ihn
  // bliebe die Bestätigung für immer aus, sobald der Import nach hinten rutscht.
  it("bestätigt sofort, wenn schon ein Bild steht", async () => {
    rendere();
    await import("./ota");
    expect(notifyAppReady).toHaveBeenCalledTimes(1);
  });

  // Der Test darüber läuft in jsdom, und dort meldet sich die Plattform als
  // Web. Er allein schlägt deshalb nur bei `if (nativ)` an — die umgekehrte
  // Fassung `if (!nativ)` wäre grün und bestätigte auf JEDEM Gerät nie. Erst
  // dieser hier, in dem die Plattform sich als nativ meldet, schliesst auch
  // diese Richtung aus. Die beiden zusammen sind die Zusage.
  it("bestätigt auch, wenn die Plattform sich als nativ meldet", async () => {
    vi.doMock("@capacitor/core", () => ({
      Capacitor: { isNativePlatform: () => true, getPlatform: () => "ios" },
    }));
    rendere();
    await import("./ota");
    expect(notifyAppReady).toHaveBeenCalledTimes(1);
  });

  // Die Bestätigung darf den Start nicht abbrechen.
  it("lässt einen Fehlschlag der Brücke den Start nicht abbrechen", async () => {
    notifyAppReady.mockRejectedValueOnce(new Error("Brücke weg"));
    rendere();
    await expect(import("./ota")).resolves.toBeDefined();
  });

  // Und sie darf ihn nicht AUFHALTEN — die eigentliche Zusage hinter „kein
  // top-level await". Der Test darüber deckt sie NICHT ab: ein
  // `await CapacitorUpdater.notifyAppReady().catch(…)` löst bei einer
  // abgelehnten Brücke weiterhin auf und liefe grün durch (am 31.08. so
  // gemessen). Rot wird er erst an einer Brücke, die weder auflöst noch
  // ablehnt — genau der Zustand, den der Kommentar in `ota.ts` „hakend" nennt.
  it("lässt eine hakende Brücke den Start nicht aufhalten", async () => {
    notifyAppReady.mockReturnValue(new Promise(() => {}));
    rendere();
    await expect(import("./ota")).resolves.toBeDefined();
  });

  // Und die teuerste Lücke zuletzt: alle Zusagen darüber importieren `./ota`
  // selbst. Nähme jemand die Zeile aus `main.tsx` heraus oder schöbe sie hinter
  // etwas, das vorher wirft, bliebe hier alles grün — und jedes Gerät fiele bei
  // jedem Bündel zurück. Der Import IST der Aufruf, also ist die Stelle des
  // Imports die Zusage.
  it("wird von `main.tsx` als zweiter Import eingebunden", () => {
    const importe = [...readFileSync("src/main.tsx", "utf8").matchAll(/^import\s+(?:.*?\s+from\s+)?"([^"]+)"/gm)].map(
      (treffer) => treffer[1],
    );
    expect(importe.slice(0, 2)).toEqual(["./instrument", "./lib/ota"]);
  });
});
