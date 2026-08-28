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
type Hinweis = Awaited<ReturnType<typeof fetchHinweise>>[number];

beforeEach(() => {
  rpc.mockReset();
  from.mockReset();
});

/** Baut die Kette nach, die PostgREST-Aufrufe bilden. Der letzte Aufruf loest
 *  die Zusage aus — deshalb ist das Ende der Kette ein `then`-fähiges Objekt.
 *
 *  Namentlich aufgezaehlt statt in einer Schleife: nur so behalten die Attrappen
 *  ihren Typ. */
function kette(ergebnis: unknown) {
  // Die geschriebenen Werte werden MITGESCHRIEBEN statt ueber
  // `update.mock.calls[0][0]` gelesen. Zwei Gruende: der Zugriff dort waere
  // `unknown`, und ein nur zur Typisierung dastehender Parameter faellt in
  // diesem Repo dem Linter zum Opfer — die Unterstrich-Konvention gilt hier
  // nicht.
  const geschrieben: Record<string, unknown>[] = [];
  const glied = {
    select: vi.fn(() => glied),
    eq: vi.fn(() => glied),
    or: vi.fn(() => glied),
    is: vi.fn(() => glied),
    order: vi.fn(() => glied),
    limit: vi.fn(() => glied),
    update: vi.fn((werte: Record<string, unknown>) => {
      geschrieben.push(werte);
      return glied;
    }),
    geschrieben,
    then: (aufloesen: (w: unknown) => unknown) => Promise.resolve(ergebnis).then(aufloesen),
  };
  return glied;
}

/** Ein Hinweis mit Vorgaben — die Tests nennen nur, worauf es ihnen ankommt. */
function hinweis(teile: Partial<Hinweis> & { id: string }): Hinweis {
  return { type: null, payload: null, created_at: "2026-08-28T10:00:00Z", ...teile };
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

    await markiereHinweisGelesen(hinweis({ id: "hinweis-1", type: "contact_request" }));

    expect(k.update).toHaveBeenCalledTimes(1);
    // Die Policy erlaubt mehr, als die Glocke tun darf. Was sie tut, steht hier.
    expect(Object.keys(k.geschrieben[0])).toEqual(["read_at"]);
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

    await markiereHinweisGelesen(hinweis({ id: "hinweis-1", type: "contact_request" }));

    const wert = k.geschrieben[0].read_at;
    // Eine zweite Uhr im selben Vergleich hat in AGE-583 schon einmal einen
    // Lesestand vor die Nachricht gesetzt. `'now'` ist ein Sonderwert von
    // Postgres und ergibt die Zeit der SERVER-Transaktion — kein `new Date()`,
    // das die Uhr des Besuchers mitschickte.
    expect(wert).not.toBeInstanceOf(Date);
    expect(wert).toBe("now");
  });
});

/**
 * Die andere Haelfte der Entscheidung vom 28.08. (AGE-641). Der Trigger legt
 * seit `20260828200000` eine Zeile JE NACHRICHT an — daran haengt der Push, und
 * eine unterdrueckte Zeile machte das Telefon fuer den Faden dauerhaft stumm.
 * Die Zusammenfassung gehoert damit hierher, in die Anzeige.
 */
describe("hinweise — die Glocke fasst Nachrichten je Faden zusammen (AGE-641)", () => {
  const nachricht = (id: string, faden: string, wann: string) =>
    hinweis({ id, type: "message", payload: { thread_id: faden }, created_at: wann });

  it("dampft mehrere Nachrichten desselben Fadens auf die neueste ein", async () => {
    from
      .mockReturnValueOnce(kette({ data: [], error: null }))
      .mockReturnValueOnce(
        kette({
          data: [
            nachricht("n3", "faden-1", "2026-08-28T12:00:00Z"),
            nachricht("n2", "faden-1", "2026-08-28T11:00:00Z"),
            nachricht("n1", "faden-1", "2026-08-28T10:00:00Z"),
          ],
          error: null,
        }),
      );

    const liste = await fetchHinweise();

    // Zwanzig Nachrichten am Stueck sind ein Anlass. Die neueste vertritt sie:
    // sie traegt den juengsten Zeitpunkt und damit den richtigen Platz.
    expect(liste.map((h) => h.id)).toEqual(["n3"]);
  });

  it("haelt verschiedene Faeden auseinander und ordnet nach Zeit", async () => {
    from
      .mockReturnValueOnce(
        kette({
          data: [hinweis({ id: "k1", type: "contact_request", created_at: "2026-08-28T11:30:00Z" })],
          error: null,
        }),
      )
      .mockReturnValueOnce(
        kette({
          data: [
            nachricht("b2", "faden-b", "2026-08-28T12:00:00Z"),
            nachricht("a2", "faden-a", "2026-08-28T11:00:00Z"),
            nachricht("a1", "faden-a", "2026-08-28T10:00:00Z"),
          ],
          error: null,
        }),
      );

    const liste = await fetchHinweise();

    // Die Gegenprobe zum Eindampfen: es fasst NUR gleiche Faeden zusammen. Ein
    // Eindampfen ueber alle Nachrichten saehe im ersten Test genauso aus.
    expect(liste.map((h) => h.id)).toEqual(["b2", "k1", "a2"]);
  });

  it("holt Nachrichten in einer EIGENEN Abfrage, damit ein Faden die uebrigen Typen nicht verdraengt", async () => {
    const andere = kette({ data: [], error: null });
    const nachrichten = kette({ data: [], error: null });
    from.mockReturnValueOnce(andere).mockReturnValueOnce(nachrichten);

    await fetchHinweise();

    // DER Haken an dieser Zusammenfassung: die Grenze greift VOR dem
    // Eindampfen. Laegen beide Sorten in einer Abfrage, koennte ein einziger
    // vielbeschriebener Faden eine Kontaktanfrage von gestern aus der Liste
    // draengen — und niemandem fiele auf, dass sie je da war.
    expect(andere.or).toHaveBeenCalledWith("type.neq.message,type.is.null");
    expect(nachrichten.eq).toHaveBeenCalledWith("type", "message");
    // `neq` allein liesse Zeilen ohne Typ fallen: in SQL ist `null <> 'message'`
    // nicht wahr, sondern null.
    expect(andere.eq).not.toHaveBeenCalledWith("type", "message");
  });

  it("markiert bei einer Nachricht ALLE ungelesenen Zeilen des Fadens", async () => {
    const k = kette({ data: null, error: null });
    from.mockReturnValue(k);

    await markiereHinweisGelesen(nachricht("n3", "faden-1", "2026-08-28T12:00:00Z"));

    // Ohne das taucht der eingedampfte Eintrag sofort wieder auf — mit der
    // naechstaelteren Zeile desselben Fadens. Die Glocke liesse sich dann
    // Nachricht fuer Nachricht abarbeiten, obwohl sie eine Zeile zeigt.
    expect(k.eq).toHaveBeenCalledWith("payload->>thread_id", "faden-1");
    expect(k.is).toHaveBeenCalledWith("read_at", null);
    expect(k.eq).not.toHaveBeenCalledWith("id", "n3");
  });

  it("markiert bei allen anderen Typen weiterhin genau die eine Zeile", async () => {
    const k = kette({ data: null, error: null });
    from.mockReturnValue(k);

    // Die Positivkontrolle zur vorigen Zusage: waere die Fadenregel
    // bedingungslos, faende dieser Test es nicht heraus — ein `contact_request`
    // traegt gar kein `thread_id`.
    await markiereHinweisGelesen(hinweis({ id: "k1", type: "contact_request" }));

    expect(k.eq).toHaveBeenCalledWith("id", "k1");
    expect(k.is).not.toHaveBeenCalled();
  });
});
