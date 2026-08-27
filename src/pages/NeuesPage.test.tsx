import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * „Neu in der App" (AGE-631, Band 5).
 *
 * **Warum diese Seite eine eigene Zusage braucht.** Sie ist der Ausgleich
 * dafür, dass es für diesen Hinweistyp keinen Opt-out gibt: der Hinweis in der
 * Glocke ist wegklickbar, die Glocke liest nur Ungelesenes und deckelt bei 50.
 * Ohne diese Fläche wäre eine Mitteilung nach einem Klick fort.
 *
 * Und drei Zustände, nicht einer: ein Fehler beim Laden darf nicht als „noch
 * nichts geändert" erscheinen — das wäre eine Aussage über die Anwendung, die
 * wir gar nicht gelesen haben.
 */

type Note = import("../lib/release-notes").ReleaseNote;
const fetchZugestellte = vi.fn<() => Promise<Note[]>>();

vi.mock("../lib/release-notes", async (original) => ({
  ...(await original<typeof import("../lib/release-notes")>()),
  fetchZugestellte: () => fetchZugestellte(),
}));

const { default: NeuesPage } = await import("./NeuesPage");

function note(over: Partial<Note> = {}): Note {
  return {
    id: "n1",
    title: "Nachrichten stehen jetzt im Rahmen",
    body: "Die Unterhaltungsliste steht rechts.",
    entry_slugs: ["2026-08-27-chat"],
    status: "sent",
    created_by: null,
    created_at: "2026-08-27T09:00:00Z",
    sent_at: "2026-08-27T10:00:00Z",
    recipient_count: 74,
    ...over,
  } as Note;
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <NeuesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  fetchZugestellte.mockReset();
});

describe("NeuesPage — drei Zustände", () => {
  it("zeigt eine zugestellte Mitteilung mit Titel, Text und Datum", async () => {
    fetchZugestellte.mockResolvedValue([note()]);
    renderPage();

    expect(await screen.findByText("Nachrichten stehen jetzt im Rahmen")).toBeInTheDocument();
    expect(screen.getByText("Die Unterhaltungsliste steht rechts.")).toBeInTheDocument();
    expect(screen.getByText("27. August 2026")).toBeInTheDocument();
  });

  it("sagt, dass es gescheitert ist — und nennt es NICHT Leere", async () => {
    fetchZugestellte.mockRejectedValue(new Error("keine Verbindung"));
    renderPage();

    expect(await screen.findByText(/nicht erreichbar/)).toBeInTheDocument();
    expect(screen.queryByText(/Noch nichts angekündigt/)).not.toBeInTheDocument();
  });

  it("sagt bei echter Leere, dass noch nichts angekündigt wurde", async () => {
    fetchZugestellte.mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText("Noch nichts angekündigt")).toBeInTheDocument();
  });

  it("fragt nur ZUGESTELLTE ab — Entwürfe gehören niemandem ausser dem Admin", async () => {
    // Die harte Grenze ist `release_notes_read_sent` in der Datenbank; diese
    // Zusage hält fest, dass die Fläche gar nicht erst danach fragt.
    fetchZugestellte.mockResolvedValue([]);
    renderPage();

    await screen.findByText("Noch nichts angekündigt");
    expect(fetchZugestellte).toHaveBeenCalled();
  });
});
