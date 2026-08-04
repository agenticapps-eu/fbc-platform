import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConfirmationRequiredError, saveCategorySelection } from "./profile-categories";

/**
 * Der Abgleich am Datenrand (AGE-494).
 *
 * `planReconciliation` ist rein und in profile-categories.test.ts geprüft. Hier
 * geht es um die Aussagen, die erst im Zusammenspiel mit der Datenbank entstehen:
 * WELCHE Aufrufe abgesetzt werden, und dass die Rückfrage beim SPEICHERN gegen
 * frisch gelesene Zeilen entschieden wird — nicht gegen den Stand beim Laden.
 */

const ops: string[] = [];
let rows: Record<string, { id: string; category: string | null; source: string }[]> = {};
let deleted: string[] = [];
let inserted: Record<string, unknown[]> = {};

vi.mock("./supabase", () => ({
  supabase: {
    from: (name: string) => ({
      select: () => ({
        eq: async () => {
          ops.push(`select:${name}`);
          return { data: rows[name] ?? [], error: null };
        },
      }),
      delete: () => ({
        in: async (_col: string, ids: string[]) => {
          ops.push(`delete:${name}`);
          deleted.push(...ids);
          return { error: null };
        },
      }),
      insert: async (payload: unknown[]) => {
        ops.push(`insert:${name}`);
        (inserted[name] ??= []).push(...payload);
        return { error: null };
      },
    }),
  },
}));

beforeEach(() => {
  ops.length = 0;
  rows = { offers: [], needs: [] };
  deleted = [];
  inserted = {};
});

describe("saveCategorySelection", () => {
  it("legt für eine neue Kategorie eine Chip-Zeile mit Titel und Thema an", async () => {
    await saveCategorySelection("u1", { offers: ["mentoring"], needs: [] });

    expect(inserted.offers).toEqual([
      {
        profile_id: "u1",
        category: "mentoring",
        theme: "sein",
        title: "Mentoring",
        source: "chip",
      },
    ]);
    expect(deleted).toEqual([]);
  });

  it("lässt eine bereits belegte Kategorie in Ruhe", async () => {
    rows.offers = [{ id: "o1", category: "kapital", source: "editor" }];
    await saveCategorySelection("u1", { offers: ["kapital"], needs: [] });

    expect(ops).not.toContain("insert:offers");
    expect(ops).not.toContain("delete:offers");
  });

  it("entfernt reine Chip-Kategorien ohne Rückfrage", async () => {
    rows.offers = [{ id: "o1", category: "kontakte", source: "chip" }];
    await saveCategorySelection("u1", { offers: [], needs: [] });

    expect(deleted).toEqual(["o1"]);
  });

  it("verweigert das Entfernen einer Kategorie mit reichem Eintrag", async () => {
    rows.offers = [
      { id: "o1", category: "kontakte", source: "chip" },
      { id: "o2", category: "kontakte", source: "editor" },
    ];

    await expect(saveCategorySelection("u1", { offers: [], needs: [] })).rejects.toBeInstanceOf(
      ConfirmationRequiredError,
    );
    // Nichts angefasst, solange nicht bestätigt wurde.
    expect(deleted).toEqual([]);
    expect(ops).not.toContain("delete:offers");
  });

  it("führt es nach Bestätigung aus — und nimmt die Chip-Zeile mit", async () => {
    rows.offers = [
      { id: "o1", category: "kontakte", source: "chip" },
      { id: "o2", category: "kontakte", source: "editor" },
    ];

    await saveCategorySelection("u1", { offers: [], needs: [] }, { confirmed: true });
    expect(deleted.sort()).toEqual(["o1", "o2"]);
  });

  /* Der TOCTOU-Fall: Zwischen dem Laden des Formulars und dem Speichern entsteht
     im reichen Editor ein Eintrag. Bemerkt wird er, weil `saveCategorySelection`
     KEINEN Zeilen-Schnappschuss entgegennimmt — nur die gewünschte Auswahl — und
     die Zeilen selbst liest, bevor es entscheidet. Genau das prüft dieser Test:
     die Reihenfolge. Ein Test, der die reiche Zeile vorher dazulegt, prüft es
     nicht; er wäre byte-gleich zum Fall darüber. */
  it("liest die Zeilen VOR jeder Entscheidung, nicht aus einem Schnappschuss", async () => {
    rows.offers = [
      { id: "o1", category: "kontakte", source: "chip" },
      { id: "o2", category: "kontakte", source: "editor" },
    ];

    await expect(saveCategorySelection("u1", { offers: [], needs: [] })).rejects.toBeInstanceOf(
      ConfirmationRequiredError,
    );
    // Gelesen wurde als Erstes — und danach nichts angefasst.
    expect(ops[0]).toBe("select:offers");
    expect(ops).not.toContain("delete:offers");
  });

  it("behandelt beide Seiten getrennt", async () => {
    rows.offers = [{ id: "o1", category: "kapital", source: "chip" }];
    rows.needs = [{ id: "n1", category: "experten", source: "chip" }];

    await saveCategorySelection("u1", { offers: ["kapital"], needs: [] });
    expect(deleted).toEqual(["n1"]);
  });
});
