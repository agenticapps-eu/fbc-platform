import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useChatfenster, type ChatfensterStand } from "./use-chatfenster";

/**
 * Der Zustand der angedockten Chatfenster (AGE-639).
 *
 * Drei Regeln tragen ihn, und alle drei sind hier gemessen statt behauptet:
 *
 * 1. **Höchstens drei.** Ein viertes Gespräch räumt einen Platz — und zwar den
 *    des am längsten UNBERÜHRTEN Fensters, nicht des zuerst geöffneten.
 * 2. **Berühren heisst arbeiten, nicht nur schalten.** Beide Plan-Reviewer haben
 *    unabhängig darauf gezeigt: zählte nur das Klicken auf die Schalter, könnte
 *    ausgerechnet das Fenster geräumt werden, in dem gerade jemand schreibt.
 * 3. **Der Speicher gehört einem Konto.** Ohne die Kennung im Schlüssel
 *    versuchte das nächste Konto am selben Browser, fremde Gespräche
 *    wiederherzustellen (Plan-Review, gemini, HIGH).
 */

const UID = "konto-a";

/** `renderHook` statt einer eigenen Sonde: eine äussere Variable **während des
 *  Renderns** zu beschreiben ist ein Nebeneffekt, und unter Concurrent Rendering
 *  kann ein Anstrich verworfen werden. Die ESLint-Regel `react-hooks/globals`
 *  hat auf die erste Fassung gezeigt, und sie hatte recht. */
let hook: { result: { current: ChatfensterStand } };
const stand = () => hook.result.current;

function montiere(uid: string | null = UID) {
  hook = renderHook(({ u }: { u: string | null }) => useChatfenster(u), {
    initialProps: { u: uid },
  });
  return hook;
}

/** Ein Gespräch, so wie die Unterhaltungsliste es übergibt. */
const g = (id: string, name = `Partner ${id}`) => ({
  id,
  partner: { name, avatarUrl: null },
});

/** Die Threads in der Reihenfolge, in der sie in der Reihe stehen. */
const reihe = () => stand().fenster.map((f) => f.threadId);
const minimiert = () =>
  stand()
    .fenster.filter((f) => f.minimiert)
    .map((f) => f.threadId);

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("useChatfenster — öffnen, minimieren, schliessen", () => {
  it("öffnet ein Fenster aufgezogen und hängt es rechts an", () => {
    montiere();
    act(() => stand().oeffne(g("t1")));
    act(() => stand().oeffne(g("t2")));

    expect(reihe()).toEqual(["t1", "t2"]);
    expect(minimiert()).toEqual([]);
  });

  it("öffnet für ein bereits offenes Gespräch KEIN zweites Fenster", () => {
    montiere();
    act(() => stand().oeffne(g("t1")));
    act(() => stand().minimiere("t1"));
    act(() => stand().oeffne(g("t1")));

    expect(reihe()).toEqual(["t1"]);
    // Und es ist wieder aufgezogen — „auswählen" heisst hier: hol es nach vorn.
    expect(minimiert()).toEqual([]);
  });

  it("minimiert und zieht wieder auf, ohne die Position zu ändern", () => {
    montiere();
    act(() => stand().oeffne(g("t1")));
    act(() => stand().oeffne(g("t2")));
    act(() => stand().minimiere("t1"));

    expect(reihe()).toEqual(["t1", "t2"]);
    expect(minimiert()).toEqual(["t1"]);

    act(() => stand().ziehAuf("t1"));
    expect(reihe()).toEqual(["t1", "t2"]);
    expect(minimiert()).toEqual([]);
  });

  it("schliesst genau eines", () => {
    montiere();
    act(() => stand().oeffne(g("t1")));
    act(() => stand().oeffne(g("t2")));
    act(() => stand().schliesse("t1"));

    expect(reihe()).toEqual(["t2"]);
  });
});

describe("useChatfenster — die Grenze von drei", () => {
  it("räumt beim vierten Gespräch das am längsten unberührte", () => {
    montiere();
    act(() => stand().oeffne(g("t1")));
    act(() => stand().oeffne(g("t2")));
    act(() => stand().oeffne(g("t3")));
    expect(reihe()).toEqual(["t1", "t2", "t3"]);

    act(() => stand().oeffne(g("t4")));

    // t1 war das älteste und wurde nicht angefasst.
    expect(reihe()).toEqual(["t2", "t3", "t4"]);
  });

  it("räumt NICHT das Fenster, in dem gerade gearbeitet wurde", () => {
    // Der Fall, den beide Reviewer beschrieben haben: seit zwei Minuten in t1
    // schreiben, zwischendurch neue Gespräche aufmachen — und t1 fliegt raus,
    // obwohl es das einzige ist, das benutzt wird.
    montiere();
    act(() => stand().oeffne(g("t1")));
    act(() => stand().oeffne(g("t2")));
    act(() => stand().oeffne(g("t3")));

    act(() => stand().beruehre("t1"));
    act(() => stand().oeffne(g("t4")));

    // Jetzt ist t2 das am längsten unberührte, nicht t1.
    expect(reihe()).toEqual(["t1", "t3", "t4"]);
  });

  it("zählt ein Minimieren als Berühren — es ist eine Handlung an diesem Fenster", () => {
    montiere();
    act(() => stand().oeffne(g("t1")));
    act(() => stand().oeffne(g("t2")));
    act(() => stand().oeffne(g("t3")));

    act(() => stand().minimiere("t1"));
    act(() => stand().oeffne(g("t4")));

    expect(reihe()).toEqual(["t1", "t3", "t4"]);
  });

  it("erhöht den Zähler NICHT, wenn dasselbe Fenster erneut berührt wird", () => {
    // Sonst zeichnete jeder Klick in die Sendezeile die ganze Reihe neu.
    montiere();
    act(() => stand().oeffne(g("t1")));
    const vorher = stand().fenster[0].beruehrtAm;

    act(() => stand().beruehre("t1"));
    expect(stand().fenster[0].beruehrtAm).toBe(vorher);
  });

  it("berührt ein unbekanntes Gespräch folgenlos", () => {
    montiere();
    act(() => stand().oeffne(g("t1")));
    act(() => stand().beruehre("gibt-es-nicht"));
    expect(reihe()).toEqual(["t1"]);
  });
});

describe("useChatfenster — der Speicher gehört einem Konto", () => {
  const schluessel = (uid: string) => `fbc.chatFenster.${uid}`;

  it("schreibt unter der Kennung des Kontos", () => {
    montiere();
    act(() => stand().oeffne(g("t1")));
    act(() => stand().minimiere("t1"));

    expect(JSON.parse(localStorage.getItem(schluessel(UID))!)).toEqual([
      { id: "t1", min: true, name: "Partner t1", avatar: null },
    ]);
    // Und NICHT unter einem gemeinsamen Schlüssel.
    expect(localStorage.getItem("fbc.chatFenster")).toBeNull();
  });

  it("stellt beim Montieren wieder her — samt Namen für die Titelzeile", () => {
    // Der Name muss mitkommen: nach einem Neuladen liegt der Thread womöglich
    // nicht in der geladenen Unterhaltungsliste (eine Seite trägt zwanzig), und
    // ein Fenster ohne Beschriftung wäre nicht zuzuordnen.
    localStorage.setItem(
      schluessel(UID),
      JSON.stringify([
        { id: "t1", min: false, name: "Anna Berger", avatar: "a.jpg" },
        { id: "t2", min: true, name: "Chris Mai", avatar: null },
      ]),
    );
    montiere();

    expect(reihe()).toEqual(["t1", "t2"]);
    expect(minimiert()).toEqual(["t2"]);
    expect(stand().fenster.map((f) => f.name)).toEqual(["Anna Berger", "Chris Mai"]);
    expect(stand().fenster[0].avatarUrl).toBe("a.jpg");
  });

  it("frischt Namen und Bild beim erneuten Öffnen auf", () => {
    localStorage.setItem(
      schluessel(UID),
      JSON.stringify([{ id: "t1", min: true, name: "Alter Name", avatar: null }]),
    );
    montiere();
    expect(stand().fenster[0].name).toBe("Alter Name");

    act(() => stand().oeffne(g("t1", "Neuer Name")));
    expect(stand().fenster[0].name).toBe("Neuer Name");
  });

  it("fällt auf ein Ersatzwort zurück, wenn im Speicher kein Name steht", () => {
    // Dasselbe Ersatzwort wie `mapThreadRow`, wenn ein Profil fehlt. Betrifft
    // Einträge aus einer Sitzung vor dieser Zeile.
    localStorage.setItem(schluessel(UID), JSON.stringify([{ id: "t1", min: false }]));
    montiere();
    expect(stand().fenster[0].name).toBe("Mitglied");
  });

  it("stellt einem ANDEREN Konto nichts her", () => {
    localStorage.setItem(schluessel(UID), JSON.stringify([{ id: "t1", min: false }]));
    montiere("konto-b");

    expect(reihe()).toEqual([]);
    // Positivkontrolle: unter der eigenen Kennung stünde es sehr wohl da.
    expect(localStorage.getItem(schluessel(UID))).not.toBeNull();
  });

  it("kappt einen überfüllten Speicher auf drei", () => {
    localStorage.setItem(
      schluessel(UID),
      JSON.stringify([
        { id: "t1", min: false },
        { id: "t2", min: false },
        { id: "t3", min: false },
        { id: "t4", min: false },
      ]),
    );
    montiere();

    expect(reihe()).toEqual(["t2", "t3", "t4"]);
  });

  it("überlebt einen Speicher, der wirft", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    montiere();

    act(() => stand().oeffne(g("t1")));
    // Die Fenster funktionieren — sie merken sich nur nichts.
    expect(reihe()).toEqual(["t1"]);
  });

  it("entdoppelt beim Wiederherstellen — zwei Fenster auf einen Verlauf gibt es nicht", () => {
    // `oeffne` verhindert das aktiv; ein doppelt gespeicherter Eintrag stellte
    // es über die Hintertür wieder her — samt doppeltem React-`key` und zwei
    // Sendezeilen auf denselben Verlauf (Diff-Review, opencode, LOW).
    localStorage.setItem(
      schluessel(UID),
      JSON.stringify([
        { id: "t1", min: false, name: "Alt", avatar: null },
        { id: "t2", min: false, name: "Chris Mai", avatar: null },
        { id: "t1", min: true, name: "Neu", avatar: null },
      ]),
    );
    montiere();

    expect(reihe()).toEqual(["t1", "t2"]);
    // Der letzte Eintrag gewinnt — er ist der jüngere.
    expect(stand().fenster.find((f) => f.threadId === "t1")!.name).toBe("Neu");
    expect(minimiert()).toEqual(["t1"]);
  });

  it("überlebt Unsinn im Speicher", () => {
    localStorage.setItem(schluessel(UID), "{kein json");
    montiere();
    expect(reihe()).toEqual([]);
  });

  it("greift ohne Kennung gar nicht auf den Speicher zu", () => {
    const lesen = vi.spyOn(Storage.prototype, "getItem");
    montiere(null);
    expect(reihe()).toEqual([]);
    expect(lesen).not.toHaveBeenCalled();
  });
});
