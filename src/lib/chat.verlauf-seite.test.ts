import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Der Nachrichtenverlauf lädt eine begrenzte Seite (AGE-655).
 *
 * Gemockt ist nur der Rand zur Datenbank — der Query-Builder zeichnet auf, was
 * `fetchMessages` wirklich anfragt. Gemessen wird an den ARGUMENTEN der
 * Attrappe, nicht am Ergebnis: eine richtige Liste beweist nicht, dass der
 * Client sie nicht selbst gekürzt hat, und genau das ist der Zustand, den diese
 * Änderung abschafft.
 *
 * Dieselbe Bauart wie `chat.threads-seite.test.ts` — dort für die Liste der
 * Gespräche, hier für den Verlauf innerhalb eines Gesprächs.
 */

interface Aufruf {
  table: string;
  select?: string;
  eq: [string, unknown][];
  lt: [string, unknown][];
  order: { spalte: string; ascending?: boolean }[];
  limit?: number;
}

let aufrufe: Aufruf[] = [];
let zeilen: Record<string, unknown>[] = [];

vi.mock("./supabase", () => ({
  supabase: {
    from: (table: string) => {
      const eintrag: Aufruf = { table, eq: [], lt: [], order: [] };
      aufrufe.push(eintrag);
      const kette = {
        select: (spalten: string) => {
          eintrag.select = spalten;
          return kette;
        },
        eq: (spalte: string, wert: unknown) => {
          eintrag.eq.push([spalte, wert]);
          return kette;
        },
        lt: (spalte: string, wert: unknown) => {
          eintrag.lt.push([spalte, wert]);
          return kette;
        },
        order: (spalte: string, opts?: { ascending?: boolean }) => {
          eintrag.order.push({ spalte, ascending: opts?.ascending });
          return kette;
        },
        limit: (n: number) => {
          eintrag.limit = n;
          return kette;
        },
        then: (auf: (r: { data: unknown; error: null }) => unknown, ab?: (e: unknown) => unknown) =>
          Promise.resolve({ data: zeilen, error: null }).then(auf, ab),
      };
      return kette;
    },
  },
}));

import { VERLAUF_SEITE, fetchMessages } from "./chat";

const THREAD = "33333333-3333-3333-3333-333333333333";
const SENDER = "11111111-1111-1111-1111-111111111111";

/** Erzeugt `anzahl` Zeilen, ABSTEIGEND nach `created_at` — so antwortet der Server. */
function serverZeilen(anzahl: number): Record<string, unknown>[] {
  return Array.from({ length: anzahl }, (_, i) => ({
    id: `m${String(anzahl - i).padStart(3, "0")}`,
    thread_id: THREAD,
    sender_id: SENDER,
    body: `Nachricht ${anzahl - i}`,
    // Absteigend: der erste Eintrag ist der jüngste.
    created_at: new Date(Date.UTC(2026, 7, 28, 12, 0, anzahl - i)).toISOString(),
  }));
}

beforeEach(() => {
  aufrufe = [];
  zeilen = [];
});

describe("fetchMessages — Seitengrenze", () => {
  it("fragt begrenzt an und ordnet absteigend, damit die Grenze das jüngste Ende trifft", async () => {
    zeilen = serverZeilen(3);

    await fetchMessages(THREAD);

    expect(aufrufe).toHaveLength(1);
    const [anfrage] = aufrufe;
    expect(anfrage.table).toBe("messages");
    expect(anfrage.eq).toEqual([["thread_id", THREAD]]);
    // Absteigend, sonst schnitte die Grenze das ÄLTESTE Ende ab.
    expect(anfrage.order).toEqual([{ spalte: "created_at", ascending: false }]);
    // Die Sonde: eine Zeile mehr als die Seite, um „gibt es noch ältere" zu
    // beantworten, ohne zu raten.
    expect(anfrage.limit).toBe(VERLAUF_SEITE + 1);
  });

  it("gibt die Nachrichten chronologisch zurück, obwohl der Server absteigend liefert", async () => {
    zeilen = serverZeilen(3);

    const { messages } = await fetchMessages(THREAD);

    expect(messages.map((m) => m.id)).toEqual(["m001", "m002", "m003"]);
  });

  it("setzt den Cursor auf `created_at` der übergebenen Grenze", async () => {
    zeilen = serverZeilen(1);

    await fetchMessages(THREAD, { before: "2026-08-28T12:00:00.000Z" });

    expect(aufrufe[0].lt).toEqual([["created_at", "2026-08-28T12:00:00.000Z"]]);
  });

  it("fragt ohne Grenze auch nicht nach einem Cursor", async () => {
    zeilen = serverZeilen(1);

    await fetchMessages(THREAD);

    expect(aufrufe[0].lt).toEqual([]);
  });
});

describe("fetchMessages — die Sonde beantwortet „gibt es noch ältere\"", () => {
  // Beide Richtungen, sonst belegt die eine nichts: „erschoepft ist true" wäre
  // von „die Funktion gibt immer true zurück" nicht zu unterscheiden.

  it("liefert der Server limit+1 Zeilen, ist der Verlauf NICHT erschöpft — und die Sonde fällt weg", async () => {
    zeilen = serverZeilen(4);

    const { messages, erschoepft } = await fetchMessages(THREAD, { limit: 3 });

    expect(erschoepft).toBe(false);
    // Genau `limit`, nicht `limit + 1`: die Sonde ist eine Frage, keine Nachricht.
    expect(messages).toHaveLength(3);
  });

  it("liefert der Server höchstens limit Zeilen, ist der Verlauf erschöpft", async () => {
    zeilen = serverZeilen(3);

    const { messages, erschoepft } = await fetchMessages(THREAD, { limit: 3 });

    expect(erschoepft).toBe(true);
    expect(messages).toHaveLength(3);
  });

  it("gibt die JÜNGSTEN limit Zeilen zurück, nicht die ältesten der Antwort", async () => {
    // Der Server liefert absteigend; die überzählige Sonde ist damit die
    // ÄLTESTE Zeile und muss wegfallen.
    zeilen = serverZeilen(4);

    const { messages } = await fetchMessages(THREAD, { limit: 3 });

    expect(messages.map((m) => m.id)).toEqual(["m002", "m003", "m004"]);
  });
});
