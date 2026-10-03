import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchMatchingProfile,
  matchingProfileSchema,
  saveMatchingProfile,
  type MatchingProfileValues,
} from "./matching-profile";

/**
 * Der reiche Suche-&-Biete-Editor als ZWEITER Schreiber auf offers/needs
 * (AGE-494, Task 4.9).
 *
 * Zwei Zusagen hängen hier dran, und beide brechen still, wenn sie brechen:
 * eine chip-erzeugte Zeile (ohne Volumenband) muss sich in diesem Editor öffnen
 * UND speichern lassen, und ihre Herkunft muss den Replace-Durchlauf überleben.
 * Fällt `source` auf 'editor' zurück, verlangt das spätere Abwählen des Chips
 * eine Rückfrage für etwas, das nie von Hand geschrieben wurde.
 */

let rows: Record<string, Record<string, unknown>[]> = {};
let inserted: Record<string, Record<string, unknown>[]> = {};
let fehlerBeimEinfuegen: Record<string, boolean> = {};
const ops: string[] = [];

vi.mock("./supabase", () => ({
  supabase: {
    from: (name: string) => ({
      select: () => ({
        // `eq` ist BEIDES: awaitbar (der Kennungs-Abruf vor dem Einfuegen) und
        // Traeger von `order` (der Formular-Abruf). Ohne das erste waere der
        // neue Weg in `saveMatchingProfile` hier nicht nachstellbar.
        eq: () => {
          const antwort = () => {
            ops.push(`select:${name}`);
            return { data: rows[name] ?? [], error: null };
          };
          const p = Promise.resolve(null).then(antwort);
          return Object.assign(p, { order: async () => antwort() });
        },
      }),
      delete: () => ({
        eq: async () => {
          ops.push(`delete:${name}`);
          return { error: null };
        },
        in: async () => {
          ops.push(`delete:${name}`);
          return { error: null };
        },
      }),
      insert: async (payload: Record<string, unknown>[]) => {
        ops.push(`insert:${name}`);
        if (fehlerBeimEinfuegen[name]) {
          return { error: { code: "42501", message: "new row violates row-level security" } };
        }
        (inserted[name] ??= []).push(...payload);
        return { error: null };
      },
    }),
  },
}));

vi.mock("./matches", () => ({ recomputeMyMatches: vi.fn().mockResolvedValue(undefined) }));

beforeEach(() => {
  rows = { offers: [], needs: [] };
  inserted = {};
  fehlerBeimEinfuegen = {};
  ops.length = 0;
});

/** Eine Zeile, wie der Chip-Block im Profil-Editor sie anlegt: kein Band, source 'chip'. */
const CHIP_NEED_ROW = {
  category: "investoren",
  theme: "haben",
  title: "Investoren",
  description: null,
  tags: null,
  tx_volume_band: null,
  source: "chip",
};

describe("matchingProfileSchema", () => {
  it("akzeptiert ein Need OHNE Volumenband", () => {
    // Chips und der geführte Kompass legen bandlose Zeilen an. Ein Pflichtfeld
    // machte jede davon im reichen Editor unspeicherbar.
    const result = matchingProfileSchema.safeParse({
      offers: [],
      needs: [
        {
          category: "investoren",
          theme: "haben",
          title: "Investoren",
          description: "",
          tags: [],
          tx_volume_band: "",
          source: "chip",
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("weist ein UNBEKANNTES Volumenband weiterhin ab", () => {
    const result = matchingProfileSchema.safeParse({
      offers: [],
      needs: [
        {
          category: "investoren",
          theme: "haben",
          title: "Investoren",
          description: "",
          tags: [],
          tx_volume_band: "eine_fantastilliarde",
          source: "editor",
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});

describe("fetchMatchingProfile", () => {
  it("übersetzt eine bandlose Chip-Zeile in schema-gültige Formularwerte", async () => {
    rows.needs = [CHIP_NEED_ROW];

    const values = await fetchMatchingProfile("u1");

    expect(values.needs[0].tx_volume_band).toBe("");
    expect(values.needs[0].source).toBe("chip");
    // Der entscheidende Punkt: was aus der DB kommt, muss durch das Schema passen —
    // sonst ist das Formular für dieses Mitglied nicht absendbar.
    expect(matchingProfileSchema.safeParse(values).success).toBe(true);
  });

  it("liest eine Zeile ohne source als 'editor'", async () => {
    rows.offers = [
      {
        category: "mentoring",
        theme: "sein",
        title: "Mentoring",
        description: null,
        tags: null,
        source: null,
      },
    ];

    const values = await fetchMatchingProfile("u1");
    expect(values.offers[0].source).toBe("editor");
  });
});

describe("saveMatchingProfile", () => {
  it("trägt die Herkunft 'chip' durch den Replace-Durchlauf", async () => {
    rows.needs = [CHIP_NEED_ROW];
    // Laden → nichts ändern → speichern. Genau der Weg aus Task 4.9.
    const loaded = await fetchMatchingProfile("u1");
    await saveMatchingProfile("u1", loaded);

    expect(inserted.needs).toHaveLength(1);
    expect(inserted.needs[0]).toMatchObject({
      profile_id: "u1",
      category: "investoren",
      source: "chip",
      // Leeres Band geht als NULL zurück, nicht als "" — die Spalte ist nullable
      // und "" wäre kein gültiger Bandwert.
      tx_volume_band: null,
    });
  });

  /**
   * DIESE ZUSAGE IST UMGEDREHT (AGE-1000, Befund des Diff-Reviews, CRITICAL).
   *
   * Sie hiess „löscht vor dem Einfügen (Replace-Collection)" und beschrieb den
   * Ist-Zustand, den der Funktionskopf selbst als Schwäche benannte: „schlägt
   * ein Insert nach dem Delete fehl, bleibt die Sammlung leer". Seit AGE-1000
   * ist das kein hypothetischer Fall mehr, sondern der Normalfall für ein
   * DISCOVER-Konto — `offers_insert_own` verlangt `darf('suche_biete')`, der
   * DELETE braucht nur Eigentum. Löschen gelingt, Einfügen wird mit 42501
   * abgewiesen, und die Einträge des Mitglieds sind UNWIEDERBRINGLICH fort.
   *
   * Deshalb wird jetzt zuerst eingefügt und danach gelöscht, und zwar gezielt
   * die vorher gelesenen Kennungen. Ein `delete … eq(profile_id)` am Ende
   * nähme die eben eingefügten Zeilen mit.
   */
  it("fügt VOR dem Löschen ein — ein abgelehnter Insert darf nichts vernichten", async () => {
    rows.needs = [CHIP_NEED_ROW];
    const loaded = await fetchMatchingProfile("u1");
    await saveMatchingProfile("u1", loaded);

    expect(ops.indexOf("insert:needs")).toBeLessThan(ops.indexOf("delete:needs"));
  });

  it("löscht GAR NICHT, wenn der Insert abgewiesen wird", async () => {
    // Der Fall, der ohne diese Reihenfolge Daten vernichtet: ein Konto ohne
    // `suche_biete` speichert. Die RLS lehnt den Insert ab — und der Bestand
    // muss unangetastet bleiben.
    rows.needs = [CHIP_NEED_ROW];
    const loaded = await fetchMatchingProfile("u1");
    fehlerBeimEinfuegen.needs = true;

    await expect(saveMatchingProfile("u1", loaded)).rejects.toMatchObject({ code: "42501" });
    expect(ops).not.toContain("delete:needs");
    expect(ops).not.toContain("delete:offers");
  });

  it("setzt für eine im Editor angelegte Zeile 'editor'", async () => {
    const values: MatchingProfileValues = {
      offers: [
        {
          category: "mentoring",
          theme: "sein",
          title: "Mentoring",
          description: "",
          tags: [],
          source: "editor",
        },
      ],
      needs: [],
    };

    await saveMatchingProfile("u1", values);
    expect(inserted.offers[0]).toMatchObject({ source: "editor" });
  });
});
