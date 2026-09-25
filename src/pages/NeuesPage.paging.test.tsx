import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * „Neu in der App" — die Fläche lädt nach (AGE-905).
 *
 * ══ WARUM DIE VORRICHTUNG 23 MITTEILUNGEN TRÄGT UND NICHT 2 ═══════════════
 * Die Seitengrösse ist 20. Eine Vorrichtung mit 20 oder weniger Mitteilungen
 * liefe **auch dann grün, wenn es das Nachladen gar nicht gäbe**: die Liste
 * käme nie über die erste Seite hinaus, und der Test bestätigte sich selbst.
 * Genau diese Bauart hat den Mangel bis heute verdeckt — solange null
 * Mitteilungen zugestellt waren, war er unsichtbar.
 *
 * 23 ist nicht willkürlich: das ist die Zahl der Geschichten, die AGE-905
 * nachträgt, und damit der Bestand, ab dem die Fläche zum ersten Mal mehr als
 * eine Seite trägt.
 *
 * ══ WARUM EINE EIGENE DATEI ═══════════════════════════════════════════════
 * `NeuesPage.test.tsx` mockt `fetchZugestellte` ohne Argumente
 * (`() => fetchZugestellte()`) und kann `offset` deshalb nicht sehen. Diese
 * Datei braucht genau das. Den bestehenden Mock umzubauen hiesse, 13 fremde
 * Zusagen anzufassen, die mit dem Seiten-Verhalten nichts zu tun haben.
 */

type Note = import("../lib/release-notes").ReleaseNote;

const SEITE = 20;
const GESAMT = 23;

const fetchZugestellte = vi.fn<(a?: { limit?: number; offset?: number }) => Promise<Note[]>>();
const fetchEineNote = vi.fn<(id: string) => Promise<Note | null>>();

vi.mock("../lib/release-notes", async (original) => ({
  ...(await original<typeof import("../lib/release-notes")>()),
  fetchZugestellte: (a?: { limit?: number; offset?: number }) => fetchZugestellte(a),
  fetchEineNote: (id: string) => fetchEineNote(id),
}));

vi.mock("../content/release-bilder", () => ({ RELEASE_BILDER: {} }));

const { default: NeuesPage } = await import("./NeuesPage");

/** 23 Mitteilungen, die jüngste zuerst — wie die Fläche sie bekommt. */
const BESTAND: Note[] = Array.from({ length: GESAMT }, (_, i) => ({
  id: `n${i + 1}`,
  title: `Mitteilung ${i + 1}`,
  body: `Text der Mitteilung ${i + 1}.`,
  entry_slugs: [`slug-${i + 1}`],
  status: "sent",
  created_by: null,
  created_at: "2026-08-01T07:00:00Z",
  sent_at: "2026-08-01T07:00:00Z",
  recipient_count: 0,
})) as Note[];

/** Der Server, wie er wirklich antwortet: eine Scheibe ab `offset`. */
function seitenweise(a?: { limit?: number; offset?: number }): Promise<Note[]> {
  const offset = a?.offset ?? 0;
  const limit = a?.limit ?? SEITE;
  return Promise.resolve(BESTAND.slice(offset, offset + limit));
}

function renderPage(adresse = "/neues") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[adresse]}>
        <NeuesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  fetchZugestellte.mockReset();
  fetchEineNote.mockReset();
  fetchZugestellte.mockImplementation(seitenweise);
  fetchEineNote.mockImplementation((id) =>
    Promise.resolve(BESTAND.find((n) => n.id === id) ?? null),
  );
});

describe("Die Fläche lädt nach", () => {
  it("zeigt zuerst eine Seite — und die 21. Mitteilung steht NICHT da", async () => {
    renderPage();

    expect(await screen.findByText("Mitteilung 1")).toBeInTheDocument();
    expect(screen.getByText(`Mitteilung ${SEITE}`)).toBeInTheDocument();
    // Die Zusage, um die es geht. Ohne Nachladen endete die Fläche hier still.
    expect(screen.queryByText(`Mitteilung ${SEITE + 1}`)).not.toBeInTheDocument();
  });

  it("holt die restlichen drei auf Knopfdruck", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Ältere laden" }));

    expect(await screen.findByText(`Mitteilung ${GESAMT}`)).toBeInTheDocument();
    // Und die erste Seite bleibt stehen — nachladen heisst anhängen, nicht
    // ersetzen.
    expect(screen.getByText("Mitteilung 1")).toBeInTheDocument();
  });

  it("fragt die zweite Seite mit dem richtigen offset ab", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Ältere laden" }));
    await screen.findByText(`Mitteilung ${GESAMT}`);

    expect(fetchZugestellte).toHaveBeenNthCalledWith(1, { offset: 0 });
    expect(fetchZugestellte).toHaveBeenNthCalledWith(2, { offset: SEITE });
  });

  it("bietet kein Nachladen mehr an, wenn alles geladen ist", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Ältere laden" }));
    await screen.findByText(`Mitteilung ${GESAMT}`);

    expect(screen.queryByRole("button", { name: "Ältere laden" })).not.toBeInTheDocument();
  });

  it("bietet gar kein Nachladen an, wenn eine Seite reicht", async () => {
    fetchZugestellte.mockImplementation(() => Promise.resolve(BESTAND.slice(0, 3)));
    renderPage();

    await screen.findByText("Mitteilung 1");
    expect(screen.queryByRole("button", { name: "Ältere laden" })).not.toBeInTheDocument();
  });
});

describe("Ein Tiefenlink findet auch die 23. Mitteilung", () => {
  it("öffnet eine Mitteilung, die NICHT auf der ersten Seite steht", async () => {
    // Der Fall, den die Release-Karte im Feed und die Glocke bauen. Vor AGE-905
    // öffnete dieser Verweis nichts — ununterscheidbar von einem toten Knopf.
    renderPage(`/neues?note=n${GESAMT}`);

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(`Text der Mitteilung ${GESAMT}.`)).toBeInTheDocument();
    expect(fetchEineNote).toHaveBeenCalledWith(`n${GESAMT}`);
  });

  it("holt NICHT einzeln nach, was ohnehin auf der Seite steht", async () => {
    renderPage("/neues?note=n1");

    await screen.findByRole("dialog");
    expect(fetchEineNote).not.toHaveBeenCalled();
  });

  it("öffnet bei unbekannter Kennung nichts — und die Fläche bleibt bedienbar", async () => {
    // Eine Mitteilung kann gelöscht sein, während der Hinweis noch in der
    // Glocke steht. Ein leeres Modal wäre schlechter als keines.
    renderPage("/neues?note=gibtesnicht");

    expect(await screen.findByText("Mitteilung 1")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
