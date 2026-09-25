import { describe, expect, it } from "vitest";

import {
  bewerte,
  differenz,
  hatFehler,
  type GeschichtenStand,
  type Messung,
} from "./mess-905.logic";

/**
 * Die Rechnung hinter der Abnahme von AGE-905.
 *
 * Jede Zusage hier hat eine **Positivkontrolle**: der Fall, in dem sie rot
 * werden muss, steht daneben. Eine Prüfung, die nur den guten Fall kennt,
 * belegt nicht, dass sie den schlechten überhaupt sehen könnte — und genau
 * diese Klasse Fehler soll die Abnahme ja fangen.
 */

const geschichte = (slug: string, beitrag: boolean): GeschichtenStand => ({
  slug,
  note: beitrag,
  zugestellt: beitrag,
  beitrag,
  veroeffentlichtAb: beitrag ? "2026-08-01T07:00:00.000Z" : null,
});

function messung(p: Partial<Messung> = {}): Messung {
  return {
    ziel: "test",
    gemessenAm: "2026-09-25T00:00:00.000Z",
    releaseNotes: [],
    posts: [
      { schluessel: "member", n: 10 },
      { schluessel: "event", n: 7 },
    ],
    notifications: [
      { schluessel: "post_created", n: 130 },
      { schluessel: "contact_request", n: 55 },
    ],
    pushZustellungen: 0,
    geschichten: [geschichte("a", false), geschichte("b", false)],
    ...p,
  };
}

/** Der Sollzustand: zwei Karten entstanden, sonst nichts bewegt. */
function nachDemNachtrag(): Messung {
  return messung({
    posts: [
      { schluessel: "member", n: 10 },
      { schluessel: "event", n: 7 },
      { schluessel: "release", n: 2 },
    ],
    geschichten: [geschichte("a", true), geschichte("b", true)],
  });
}

describe("differenz", () => {
  it("zählt neue Karten an den Slugs, nicht nur an der Summe", () => {
    const d = differenz(messung(), nachDemNachtrag());
    expect(d.releaseBeitraege.delta).toBe(2);
    expect(d.neueKarten).toEqual(["a", "b"]);
    expect(d.verloreneKarten).toEqual([]);
  });

  it("sieht einen Typ, den es VORHER gar nicht gab", () => {
    // Der Fall, um den es geht: `release_note` taucht neu auf. Wer über die
    // Schlüssel der ersten Messung iteriert, sieht ihn nie — und meldete Ruhe.
    const nachher = messung({
      notifications: [
        { schluessel: "post_created", n: 130 },
        { schluessel: "contact_request", n: 55 },
        { schluessel: "release_note", n: 26 },
      ],
    });
    const d = differenz(messung(), nachher);
    const neu = d.notificationsJeTyp.find((x) => x.schluessel === "release_note");
    expect(neu).toEqual({ schluessel: "release_note", vorher: 0, nachher: 26, delta: 26 });
    expect(d.notificationsGesamt.delta).toBe(26);
  });

  it("meldet eine verlorene Karte", () => {
    const d = differenz(nachDemNachtrag(), messung());
    expect(d.verloreneKarten).toEqual(["a", "b"]);
    expect(d.releaseBeitraege.delta).toBe(-2);
  });
});

describe("bewerte", () => {
  it("ist still, wenn der Nachtrag genau seine Karten erzeugt", () => {
    const befunde = bewerte(differenz(messung(), nachDemNachtrag()), 2);
    expect(hatFehler(befunde)).toBe(false);
  });

  it("ist still beim ZWEITEN Lauf — 0 erwartete Karten, 0 entstanden", () => {
    const a = nachDemNachtrag();
    const b = nachDemNachtrag();
    expect(hatFehler(bewerte(differenz(a, b), 0))).toBe(false);
  });

  // ── Positivkontrollen ────────────────────────────────────────────────────

  it("schlägt an, wenn ein Hinweis entsteht", () => {
    const nachher = nachDemNachtrag();
    nachher.notifications = [
      { schluessel: "post_created", n: 130 },
      { schluessel: "contact_request", n: 55 },
      { schluessel: "release_note", n: 26 },
    ];
    const befunde = bewerte(differenz(messung(), nachher), 2);
    expect(hatFehler(befunde)).toBe(true);
    expect(befunde.some((b) => b.text.includes("release_note"))).toBe(true);
  });

  it("schlägt an, wenn zwei Hinweis-Typen sich in der SUMME aufheben", () => {
    // Die teuerste Fehlerklasse: die Gesamtzahl steht still und sieht nach
    // Ruhe aus, während in Wahrheit 26 Zeilen kamen und 26 andere gingen.
    const nachher = nachDemNachtrag();
    nachher.notifications = [
      { schluessel: "post_created", n: 104 },
      { schluessel: "contact_request", n: 55 },
      { schluessel: "release_note", n: 26 },
    ];
    const d = differenz(messung(), nachher);
    expect(d.notificationsGesamt.delta).toBe(0);
    expect(hatFehler(bewerte(d, 2))).toBe(true);
  });

  it("schlägt an, wenn ein Push entsteht", () => {
    const nachher = nachDemNachtrag();
    nachher.pushZustellungen = 3;
    expect(hatFehler(bewerte(differenz(messung(), nachher), 2))).toBe(true);
  });

  it("schlägt an, wenn der zweite Lauf doch etwas anlegt", () => {
    const a = nachDemNachtrag();
    const b = messung({
      posts: [
        { schluessel: "member", n: 10 },
        { schluessel: "event", n: 7 },
        { schluessel: "release", n: 3 },
      ],
      geschichten: [geschichte("a", true), geschichte("b", true), geschichte("c", true)],
    });
    expect(hatFehler(bewerte(differenz(a, b), 0))).toBe(true);
  });

  it("schlägt an, wenn der Nachtrag einen Mitgliedsbeitrag anfasst", () => {
    const nachher = nachDemNachtrag();
    nachher.posts = [
      { schluessel: "member", n: 9 },
      { schluessel: "event", n: 7 },
      { schluessel: "release", n: 2 },
    ];
    const befunde = bewerte(differenz(messung(), nachher), 2);
    expect(hatFehler(befunde)).toBe(true);
    expect(befunde.some((b) => b.text.includes("posts[member]"))).toBe(true);
  });

  it("schlägt an, wenn die Zahl stimmt, aber die Slugs getauscht sind", () => {
    // Eine Karte verschwindet, eine andere entsteht: `releaseBeitraege.delta`
    // bleibt bei 0 und sähe nach einem sauberen zweiten Lauf aus.
    const a = messung({
      posts: [
        { schluessel: "member", n: 10 },
        { schluessel: "event", n: 7 },
        { schluessel: "release", n: 1 },
      ],
      geschichten: [geschichte("a", true), geschichte("b", false)],
    });
    const b = messung({
      posts: [
        { schluessel: "member", n: 10 },
        { schluessel: "event", n: 7 },
        { schluessel: "release", n: 1 },
      ],
      geschichten: [geschichte("a", false), geschichte("b", true)],
    });
    const d = differenz(a, b);
    expect(d.releaseBeitraege.delta).toBe(0);
    expect(hatFehler(bewerte(d, 0))).toBe(true);
  });
});
