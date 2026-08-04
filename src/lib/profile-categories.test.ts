import { describe, expect, it } from "vitest";
import {
  categoryOptionsForSide,
  chipRowFor,
  planReconciliation,
  type CategoryRow,
} from "./profile-categories";
import { NEED_CATEGORIES, OFFER_CATEGORIES } from "../config/matching";

/**
 * Kategorie-Chips im Profil-Editor (AGE-494) — die reine Logik.
 *
 * Der Abgleich ist der heikelste Teil des Changes: DREI Oberflächen schreiben in
 * `offers`/`needs`, und der reiche Editor folgt dem Replace-Collection-Muster.
 * Übernähme der Chip-Picker das, vernichtete jede Profil-Speicherung die
 * Beschreibungen, Tags und Volumenbänder aus dem Suche-&-Biete-Editor.
 */

function row(over: Partial<CategoryRow> = {}): CategoryRow {
  return { id: crypto.randomUUID(), category: "kapital", source: "chip", ...over };
}

describe("planReconciliation", () => {
  it("legt für eine neu gewählte Kategorie genau eine Zeile an", () => {
    const plan = planReconciliation([], ["kapital"]);
    expect(plan.insert).toEqual(["kapital"]);
    expect(plan.deleteIds).toEqual([]);
  });

  it("lässt eine Kategorie unangetastet, die bereits Zeilen hat", () => {
    const bestehend = [row({ category: "kapital", source: "editor" })];
    const plan = planReconciliation(bestehend, ["kapital"]);
    expect(plan.insert).toEqual([]);
    expect(plan.deleteIds).toEqual([]);
  });

  it("löscht beim Abwählen ALLE Zeilen der Kategorie, auch reiche", () => {
    const a = row({ category: "kontakte", source: "chip" });
    const b = row({ category: "kontakte", source: "editor" });
    const plan = planReconciliation([a, b], []);
    expect(plan.deleteIds.sort()).toEqual([a.id, b.id].sort());
    expect(plan.insert).toEqual([]);
  });

  it("rührt andere Kategorien beim Abwählen nicht an", () => {
    const weg = row({ category: "kontakte" });
    const bleibt = row({ category: "kapital", source: "editor" });
    const plan = planReconciliation([weg, bleibt], ["kapital"]);
    expect(plan.deleteIds).toEqual([weg.id]);
  });

  /* Der Grund für die Herkunfts-Spalte: strukturelles Raten („description und
     tags sind leer, also unwichtig") löschte eine reiche Zeile, die nur aus einem
     eigenen Titel oder einem Volumenband besteht. */
  it("meldet nur Kategorien zur Rückfrage, die eine NICHT-Chip-Zeile enthalten", () => {
    const nurChips = [row({ category: "kontakte", source: "chip" })];
    expect(planReconciliation(nurChips, []).confirmRequired).toEqual([]);

    const mitReicher = [
      row({ category: "kontakte", source: "chip" }),
      row({ category: "kontakte", source: "editor" }),
    ];
    expect(planReconciliation(mitReicher, []).confirmRequired).toEqual(["kontakte"]);
  });

  it("verlangt keine Rückfrage, solange nichts abgewählt wurde", () => {
    const bestehend = [row({ category: "kapital", source: "editor" })];
    expect(planReconciliation(bestehend, ["kapital", "kontakte"]).confirmRequired).toEqual([]);
  });

  it("ignoriert Zeilen ohne Kategorie — sie gehören keinem Chip", () => {
    const ohne = row({ category: null, source: "editor" });
    const plan = planReconciliation([ohne], []);
    expect(plan.deleteIds).toEqual([]);
    expect(plan.confirmRequired).toEqual([]);
  });
});

describe("chipRowFor", () => {
  it("nimmt Titel und Thema aus dem Matching-Vokabular, nicht aus dem Kompass", () => {
    // `compass.ts` nennt die Kategorie „Kapital & Beteiligungen" — als Titel wäre
    // das falsch, denn `beteiligungen` ist in `matching.ts` eine EIGENE Kategorie.
    const r = chipRowFor("offer", "kapital");
    expect(r.title).toBe("Kapital");
    expect(r.theme).toBe("haben");
    expect(r.source).toBe("chip");
  });

  it("setzt das Thema, statt es null zu lassen", () => {
    // Sonst sind chip-erzeugte Zeilen für den `p_theme`-Facettenfilter unsichtbar,
    // während reiche Zeilen es nicht sind.
    for (const side of ["offer", "need"] as const) {
      for (const o of categoryOptionsForSide(side)) {
        expect(chipRowFor(side, o.value).theme).toBeTruthy();
      }
    }
  });
});

/* Ohne diese Zusicherung schriebe der Chip-Picker Schlüssel, die der reiche
   Editor per zod ablehnt — die beiden Vokabulare sind nicht deckungsgleich. */
describe("Vokabular-Deckung", () => {
  it("jede Kompass-Kategorie existiert in config/matching.ts auf ihrer Seite", () => {
    const offerKeys = new Set(OFFER_CATEGORIES.map((c) => c.key));
    const needKeys = new Set(NEED_CATEGORIES.map((c) => c.key));

    for (const o of categoryOptionsForSide("offer")) {
      expect(offerKeys, `Offer-Kategorie ${o.value} fehlt in matching.ts`).toContain(o.value);
    }
    for (const o of categoryOptionsForSide("need")) {
      expect(needKeys, `Need-Kategorie ${o.value} fehlt in matching.ts`).toContain(o.value);
    }
  });

  it("führt je Seite sechs Kategorien", () => {
    expect(categoryOptionsForSide("offer")).toHaveLength(6);
    expect(categoryOptionsForSide("need")).toHaveLength(6);
  });
});
