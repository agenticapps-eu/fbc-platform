import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CompassStep } from "../config/compass";
import { emptyDraft, saveCompass } from "./compass";

/**
 * `saveCompass` darf offers/needs NICHT mehr leeren (AGE-494).
 *
 * Bis zu diesem Change stand `offers` und `needs` in derselben Lösch-Schleife wie
 * `compass_responses`. Ein Kompass-Neulauf über `/onboarding` — die Route bleibt
 * erreichbar — vernichtete damit jede Beschreibung, jedes Tag und jedes
 * Volumenband aus dem Suche-&-Biete-Editor und alle Chip-Zeilen aus dem
 * Profil-Editor.
 *
 * Der Test protokolliert die abgesetzten Operationen statt Daten zu prüfen: die
 * Aussage ist „auf diesen beiden Tabellen findet KEIN delete statt", und die liest
 * man am Protokoll direkter ab als an einem Endzustand.
 */

const ops: string[] = [];
const inserted: Record<string, unknown[]> = {};
/** Was `select` je Tabelle liefern soll — steuert den Additiv-Pfad. */
let existing: Record<string, unknown[]> = {};

function tableApi(name: string) {
  return {
    delete: () => {
      ops.push(`delete:${name}`);
      return { eq: async () => ({ error: null }) };
    },
    insert: async (rows: unknown[]) => {
      ops.push(`insert:${name}`);
      (inserted[name] ??= []).push(...rows);
      return { error: null };
    },
    update: () => {
      ops.push(`update:${name}`);
      return { eq: async () => ({ error: null }) };
    },
    select: () => {
      const result = { data: existing[name] ?? [], error: null };
      return {
        eq: () =>
          Object.assign(Promise.resolve(result), {
            single: async () => ({
              data: { profile_completion: 40, potential_score: 12, dev_focus: "sein" },
              error: null,
            }),
          }),
      };
    },
  };
}

vi.mock("./supabase", () => ({
  supabase: {
    from: (name: string) => tableApi(name),
    rpc: async () => ({ error: null }),
  },
}));
vi.mock("./matches", () => ({ recomputeMyMatches: async () => {} }));

const STEPS: CompassStep[] = [
  {
    id: "offers",
    kind: "chips",
    target: "offers",
    title: "Ich biete",
    prompt: "?",
    options: [
      { value: "kapital", label: "Kapital & Beteiligungen", theme: "haben", category: "kapital" },
      { value: "expertise", label: "Expertise & Know-how", theme: "tun", category: "know_how" },
    ],
  },
  {
    id: "needs",
    kind: "chips",
    target: "needs",
    title: "Ich suche",
    prompt: "?",
    options: [
      { value: "experten", label: "Experten & Berater", theme: "tun", category: "experten" },
    ],
  },
];

beforeEach(() => {
  ops.length = 0;
  for (const k of Object.keys(inserted)) delete inserted[k];
  existing = {};
});

describe("saveCompass ist additiv (AGE-494)", () => {
  it("löscht offers/needs nicht mehr — nur compass_responses", async () => {
    const draft = { ...emptyDraft(), chips: { offers: ["kapital"], needs: ["experten"] } };
    await saveCompass("u1", STEPS, draft);

    expect(ops).toContain("delete:compass_responses");
    expect(ops).not.toContain("delete:offers");
    expect(ops).not.toContain("delete:needs");
  });

  it("legt für eine schon belegte Kategorie keine zweite Zeile an", async () => {
    existing = { offers: [{ category: "kapital" }], needs: [] };
    const draft = { ...emptyDraft(), chips: { offers: ["kapital", "expertise"], needs: [] } };
    await saveCompass("u1", STEPS, draft);

    const kategorien = (inserted.offers ?? []).map((r) => (r as { category: string }).category);
    expect(kategorien).toEqual(["know_how"]);
  });

  it("schreibt den Titel aus dem Matching-Vokabular, nicht die Kompass-Beschriftung", async () => {
    const draft = { ...emptyDraft(), chips: { offers: ["kapital"], needs: [] } };
    await saveCompass("u1", STEPS, draft);

    const zeile = (inserted.offers ?? [])[0] as { title: string; theme: string; source: string };
    // Der Kompass nennt die Kategorie „Kapital & Beteiligungen" — als Titel wäre
    // das falsch, denn `beteiligungen` ist in matching.ts eine EIGENE Kategorie.
    expect(zeile.title).toBe("Kapital");
    expect(zeile.theme).toBe("haben");
    expect(zeile.source).toBe("chip");
  });
});
