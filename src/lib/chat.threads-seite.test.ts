import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Die Unterhaltungsliste lädt eine begrenzte Seite (AGE-627, Band 2).
 *
 * Gemockt ist nur der Rand zur Datenbank — der Query-Builder zeichnet auf, was
 * `fetchThreads` wirklich anfragt. Gemessen wird an den ARGUMENTEN der
 * Attrappe, nicht am Ergebnis: ein Ergebnis kann auch dann stimmen, wenn der
 * Client die ganze Tabelle geholt und selbst gekürzt hat — und genau das ist
 * der Zustand, den diese Änderung abschafft.
 *
 * Die schärfste Zusage hier ist eine ABWESENHEIT: `messages` wird für die Liste
 * gar nicht mehr angefasst. Sie braucht die Positivkontrolle daneben, sonst
 * wäre sie von „die Attrappe zeichnet nichts auf" nicht zu unterscheiden.
 */

interface Aufruf {
  table: string;
  select?: string;
  order: { spalte: string; ascending?: boolean; nullsFirst?: boolean }[];
  range?: [number, number];
  in?: [string, unknown[]];
}

let aufrufe: Aufruf[] = [];
let threadZeilen: Record<string, unknown>[] = [];
let profilZeilen: Record<string, unknown>[] = [];

vi.mock("./supabase", () => ({
  supabase: {
    from: (table: string) => {
      const eintrag: Aufruf = { table, order: [] };
      aufrufe.push(eintrag);
      const daten = () =>
        table === "message_threads" ? threadZeilen : table === "profiles" ? profilZeilen : [];
      const kette = {
        select: (spalten: string) => {
          eintrag.select = spalten;
          return kette;
        },
        order: (spalte: string, opts?: { ascending?: boolean; nullsFirst?: boolean }) => {
          eintrag.order.push({
            spalte,
            ascending: opts?.ascending,
            nullsFirst: opts?.nullsFirst,
          });
          return kette;
        },
        range: (von: number, bis: number) => {
          eintrag.range = [von, bis];
          return kette;
        },
        in: (spalte: string, werte: unknown[]) => {
          eintrag.in = [spalte, werte];
          return kette;
        },
        then: (auf: (r: { data: unknown; error: null }) => unknown, ab?: (e: unknown) => unknown) =>
          Promise.resolve({ data: daten(), error: null }).then(auf, ab),
      };
      return kette;
    },
  },
}));

import { THREADS_SEITE, fetchThreads } from "./chat";

const ICH = "11111111-1111-1111-1111-111111111111";
const PARTNER = "22222222-2222-2222-2222-222222222222";

function threadZeile(id: string, over: Record<string, unknown> = {}) {
  return {
    id,
    a_profile_id: ICH,
    b_profile_id: PARTNER,
    created_at: "2026-08-01T09:00:00Z",
    last_message_at: "2026-08-01T10:00:00Z",
    last_message_body: "Hallo",
    last_message_sender_id: PARTNER,
    ...over,
  };
}

const threadsAufruf = () => aufrufe.find((a) => a.table === "message_threads")!;

beforeEach(() => {
  aufrufe = [];
  threadZeilen = [];
  profilZeilen = [];
});

describe("fetchThreads — eine begrenzte, serverseitig sortierte Seite", () => {
  it("ordnet serverseitig nach last_message_at, leere Threads zuletzt", async () => {
    threadZeilen = [threadZeile("t1")];
    await fetchThreads(ICH);

    // `nullsFirst: false` ist keine Kosmetik: `desc` ist in Postgres
    // `nulls first`, ein Thread OHNE Nachricht stünde sonst ganz oben — und der
    // Index (`… desc nulls last`) käme nicht zum Zug.
    expect(threadsAufruf().order).toEqual([
      { spalte: "last_message_at", ascending: false, nullsFirst: false },
    ]);
  });

  it("holt eine Seite über range, nicht die ganze Tabelle", async () => {
    threadZeilen = [threadZeile("t1")];
    await fetchThreads(ICH);
    expect(threadsAufruf().range).toEqual([0, THREADS_SEITE - 1]);
  });

  it("versetzt die Seite über offset", async () => {
    threadZeilen = [threadZeile("t1")];
    await fetchThreads(ICH, { offset: THREADS_SEITE });
    expect(threadsAufruf().range).toEqual([THREADS_SEITE, THREADS_SEITE * 2 - 1]);
  });

  it("liest die Vorschauzeile aus der Thread-Zeile", async () => {
    threadZeilen = [threadZeile("t1")];
    await fetchThreads(ICH);
    const spalten = threadsAufruf().select ?? "";
    expect(spalten).toContain("last_message_at");
    expect(spalten).toContain("last_message_body");
    expect(spalten).toContain("last_message_sender_id");
  });

  it("fragt `messages` gar nicht mehr ab", async () => {
    threadZeilen = [threadZeile("t1"), threadZeile("t2")];
    await fetchThreads(ICH);

    expect(aufrufe.map((a) => a.table)).not.toContain("messages");
    // Positivkontrolle: die Attrappe zeichnet sehr wohl auf — sonst wäre die
    // Abwesenheit oben von einem stummen Mock nicht zu trennen.
    expect(aufrufe.map((a) => a.table)).toContain("message_threads");
    expect(aufrufe.map((a) => a.table)).toContain("profiles");
  });

  it("meldet den nächsten Versatz, solange die Seite voll war", async () => {
    threadZeilen = Array.from({ length: THREADS_SEITE }, (_, i) => threadZeile(`t${i}`));
    const voll = await fetchThreads(ICH);
    expect(voll.nextOffset).toBe(THREADS_SEITE);

    aufrufe = [];
    threadZeilen = [threadZeile("t1")];
    const rest = await fetchThreads(ICH);
    expect(rest.nextOffset).toBeNull();
  });

  it("gibt die Threads in der Reihenfolge des Servers zurück", async () => {
    // Der Server hat sortiert. Sortierte der Client nach, wäre die Ordnung auf
    // die geladene Seite beschränkt — und eine Seite, die nach dem Schneiden
    // sortiert wird, kann nur noch das ordnen, was der Schnitt schon gewählt hat.
    threadZeilen = [
      threadZeile("alt", { last_message_at: "2026-08-01T08:00:00Z" }),
      threadZeile("neu", { last_message_at: "2026-08-01T12:00:00Z" }),
    ];
    const seite = await fetchThreads(ICH);
    expect(seite.threads.map((t) => t.id)).toEqual(["alt", "neu"]);
  });

  it("trägt die Vorschauzeile und `fromMe` aus der Thread-Zeile", async () => {
    threadZeilen = [threadZeile("t1", { last_message_sender_id: ICH })];
    const seite = await fetchThreads(ICH);
    expect(seite.threads[0].lastMessage).toEqual({
      body: "Hallo",
      createdAt: "2026-08-01T10:00:00Z",
      fromMe: true,
    });
  });

  it("lässt einen Thread ohne Nachricht ohne Vorschauzeile", async () => {
    threadZeilen = [
      threadZeile("t1", {
        last_message_at: null,
        last_message_body: null,
        last_message_sender_id: null,
      }),
    ];
    const seite = await fetchThreads(ICH);
    expect(seite.threads[0].lastMessage).toBeNull();
    expect(seite.threads[0].lastActivityAt).toBe("2026-08-01T09:00:00Z");
  });

  it("fragt ohne Threads gar kein Profil ab", async () => {
    threadZeilen = [];
    const seite = await fetchThreads(ICH);
    expect(seite.threads).toEqual([]);
    expect(seite.nextOffset).toBeNull();
    expect(aufrufe.map((a) => a.table)).not.toContain("profiles");
  });
});
