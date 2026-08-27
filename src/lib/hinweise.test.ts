import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const from = vi.fn();

vi.mock("./supabase", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpc(...args),
    from: (...args: unknown[]) => from(...args),
  },
}));

const { fetchHinweise, markiereHinweisGelesen, markiereAlleGelesen, hinweiseQueryKey } =
  await import("./hinweise");

beforeEach(() => {
  rpc.mockReset();
  from.mockReset();
});

/** Baut die Kette nach, die PostgREST-Aufrufe bilden. Der letzte Aufruf loest
 *  die Zusage aus — deshalb ist das Ende der Kette ein `then`-fähiges Objekt.
 *
 *  Namentlich aufgezaehlt statt in einer Schleife: nur so behalten die Attrappen
 *  ihren Typ, und nur dann faellt ein `k.update.mock.calls[0][0]` im Typecheck
 *  auf, statt als `unknown` durchzurutschen. */
function kette(ergebnis: unknown) {
  const glied = {
    select: vi.fn(() => glied),
    eq: vi.fn(() => glied),
    is: vi.fn(() => glied),
    order: vi.fn(() => glied),
    limit: vi.fn(() => glied),
    update: vi.fn((_werte: Record<string, unknown>) => glied),
    then: (aufloesen: (w: unknown) => unknown) => Promise.resolve(ergebnis).then(aufloesen),
  };
  return glied;
}

describe("hinweise — Datenschicht der Glocke (AGE-620)", () => {
  it("der Query-Schluessel haengt an der Kennung", () => {
    // Sonst zeigte nach einem Kontowechsel der Zaehler des Vorgaengers weiter.
    expect(hinweiseQueryKey("a")).not.toEqual(hinweiseQueryKey("b"));
  });

  it("laedt nur ungelesene Zeilen und begrenzt die Menge", async () => {
    const k = kette({ data: [], error: null });
    from.mockReturnValue(k);

    await fetchHinweise();

    expect(from).toHaveBeenCalledWith("notifications");
    // `is(read_at, null)` — ungelesen. Ohne das zoege die Glocke die ganze
    // Historie und zaehlte sie mit.
    expect(k.is).toHaveBeenCalledWith("read_at", null);
    // Eine Grenze gehoert in die ERSTE Fassung jeder listenden Flaeche, nicht
    // in die zweite.
    expect(k.limit).toHaveBeenCalled();
  });

  it("wirft den Fehler weiter, statt ihn zu verschlucken", async () => {
    from.mockReturnValue(kette({ data: null, error: { message: "kaputt" } }));

    // Ein stiller Fehler saehe aus wie „nichts ungelesen" — genau die Sorte
    // Fehlanzeige, die niemandem auffaellt.
    await expect(fetchHinweise()).rejects.toBeTruthy();
  });

  it("markiert genau eine Zeile und setzt NUR read_at", async () => {
    const k = kette({ data: null, error: null });
    from.mockReturnValue(k);

    await markiereHinweisGelesen("hinweis-1");

    expect(k.update).toHaveBeenCalledTimes(1);
    const geschrieben = k.update.mock.calls[0][0] as Record<string, unknown>;
    // Die Policy erlaubt mehr, als die Glocke tun darf. Was sie tut, steht hier.
    expect(Object.keys(geschrieben)).toEqual(["read_at"]);
    expect(k.eq).toHaveBeenCalledWith("id", "hinweis-1");
  });

  it("markiert alle offenen Zeilen in EINEM Aufruf", async () => {
    const k = kette({ data: null, error: null });
    from.mockReturnValue(k);

    await markiereAlleGelesen();

    // Nicht n Aufrufe: bei 69 Hinweisen der ersten Woche waeren das 69 Runden.
    expect(k.update).toHaveBeenCalledTimes(1);
    expect(k.is).toHaveBeenCalledWith("read_at", null);
  });

  it("setzt beim Markieren keine Client-Uhr", async () => {
    const k = kette({ data: null, error: null });
    from.mockReturnValue(k);

    await markiereHinweisGelesen("hinweis-1");

    const wert = (k.update.mock.calls[0][0] as { read_at: unknown }).read_at;
    // Eine zweite Uhr im selben Vergleich hat in AGE-583 schon einmal einen
    // Lesestand vor die Nachricht gesetzt. `'now'` ist ein Sonderwert von
    // Postgres und ergibt die Zeit der SERVER-Transaktion — kein `new Date()`,
    // das die Uhr des Besuchers mitschickte.
    expect(wert).not.toBeInstanceOf(Date);
    expect(wert).toBe("now");
  });
});
