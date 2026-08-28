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
  or: string[];
  order: { spalte: string; ascending?: boolean }[];
  limit?: number;
}

/**
 * Wertet den `or`-Ausdruck aus, den `fetchMessages` baut — genau die eine Form,
 * nicht die ganze PostgREST-Sprache.
 *
 * Ohne diese Auswertung wäre die Zusage zum Gleichstand ein Vakuumtest: die
 * Attrappe gäbe alle Zeilen zurück, und der Test bliebe auch mit einem Cursor
 * auf `created_at` allein grün. Gemessen — genau daran ist die erste Fassung
 * dieses Tests aufgefallen.
 */
function erfuellt(zeile: Record<string, unknown>, ausdruck: string): boolean {
  const m = ausdruck.match(
    /^created_at\.lt\."(.+?)",and\(created_at\.eq\."(.+?)",id\.lt\."(.+?)"\)$/,
  );
  if (!m) throw new Error(`unerwarteter or-Ausdruck: ${ausdruck}`);
  const [, grenzeZeit, gleichZeit, grenzeId] = m;
  const zeit = String(zeile.created_at);
  const id = String(zeile.id);
  return zeit < grenzeZeit || (zeit === gleichZeit && id < grenzeId);
}

let aufrufe: Aufruf[] = [];
let zeilen: Record<string, unknown>[] = [];

vi.mock("./supabase", () => ({
  supabase: {
    from: (table: string) => {
      const eintrag: Aufruf = { table, eq: [], or: [], order: [] };
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
        or: (ausdruck: string) => {
          eintrag.or.push(ausdruck);
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
        // Der Cursor wird WIRKLICH angewendet, nicht nur aufgezeichnet. Ohne das
        // wäre die Zusage zum Gleichstand ein Vakuumtest: sie bliebe mit `lt`
        // genauso grün, weil die Attrappe alle Zeilen zurückgäbe.
        then: (
          auf: (r: { data: unknown; error: null }) => unknown,
          ab?: (e: unknown) => unknown,
        ) => {
          const gefiltert = zeilen.filter((z) => eintrag.or.every((a) => erfuellt(z, a)));
          return Promise.resolve({ data: gefiltert, error: null }).then(auf, ab);
        },
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
    // Absteigend, sonst schnitte die Grenze das ÄLTESTE Ende ab. Und mit `id`
    // als zweitem Schlüssel, weil `created_at` allein keine totale Ordnung ist.
    expect(anfrage.order).toEqual([
      { spalte: "created_at", ascending: false },
      { spalte: "id", ascending: false },
    ]);
    // Die Sonde: eine Zeile mehr als die Seite, um „gibt es noch ältere" zu
    // beantworten, ohne zu raten.
    expect(anfrage.limit).toBe(VERLAUF_SEITE + 1);
  });

  it("gibt die Nachrichten chronologisch zurück, obwohl der Server absteigend liefert", async () => {
    zeilen = serverZeilen(3);

    const { messages } = await fetchMessages(THREAD);

    expect(messages.map((m) => m.id)).toEqual(["m001", "m002", "m003"]);
  });

  // Der Cursor geht über ZWEI Spalten — Befund aus der Diff-Review (opencode
  // MEDIUM, codex HOCH). `created_at` allein ist keine totale Ordnung: teilen
  // sich zwei Nachrichten einen Zeitstempel und liegt die Seitengrenze zwischen
  // ihnen, überspränge ein Cursor auf `created_at` allein die Geschwister der
  // Grenzzeile — DAUERHAFT, weil die Neuabfrage nur das jüngste Ende abdeckt.
  //
  // Und Gleichstände sind nicht exotisch: `now()` ist innerhalb einer
  // Transaktion stabil, ein Import erzeugt sie der Bauart nach.
  it("setzt einen zusammengesetzten Cursor über `(created_at, id)`", async () => {
    zeilen = serverZeilen(1);

    await fetchMessages(THREAD, { before: { createdAt: "2026-08-28T12:00:00.000Z", id: "m042" } });

    expect(aufrufe[0].or).toHaveLength(1);
    const [ausdruck] = aufrufe[0].or;
    // „echt älter" ODER „gleich alt, aber in der zweiten Ordnung davor".
    expect(ausdruck).toBe(
      'created_at.lt."2026-08-28T12:00:00.000Z",and(created_at.eq."2026-08-28T12:00:00.000Z",id.lt."m042")',
    );
    // Der zweite Schlüssel muss auch in der ORDNUNG stehen: ein Cursor ist nur
    // so verlässlich wie die Ordnung, aus der er stammt.
    expect(aufrufe[0].order).toEqual([
      { spalte: "created_at", ascending: false },
      { spalte: "id", ascending: false },
    ]);
  });

  it("fragt ohne Grenze auch nicht nach einem Cursor", async () => {
    zeilen = serverZeilen(1);

    await fetchMessages(THREAD);

    expect(aufrufe[0].or).toEqual([]);
  });

  it("holt bei gleichem Zeitstempel die Geschwister der Grenzzeile mit", async () => {
    // Vier Zeilen mit IDENTISCHEM `created_at`. Der Cursor steht auf „m3" —
    // ein Cursor auf `created_at` allein liefe entweder ins Leere (`lt`) oder
    // holte auch „m4" zurück, das schon geladen ist (`lte`). Der zusammengesetzte
    // trifft genau die beiden davor.
    const gleich = "2026-08-28T12:00:00.000Z";
    zeilen = ["m4", "m3", "m2", "m1"].map((id) => ({
      id,
      thread_id: THREAD,
      sender_id: SENDER,
      body: `Gleichstand ${id}`,
      created_at: gleich,
    }));

    const { messages } = await fetchMessages(THREAD, {
      before: { createdAt: gleich, id: "m3" },
      limit: 10,
    });

    expect(messages.map((m) => m.id)).toEqual(["m1", "m2"]);
  });
});

describe('fetchMessages — die Sonde beantwortet „gibt es noch ältere"', () => {
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
