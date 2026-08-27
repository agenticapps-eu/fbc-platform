import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
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

vi.mock("../content/release-bilder", () => ({
  RELEASE_BILDER: {
    "2026-08-27-chat": [
      {
        src: "/release/chat-leiste.png",
        alt: "Die Nachrichtenleiste am rechten Rand",
        width: 1200,
        height: 750,
      },
    ],
  },
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

describe("Eine Note öffnet sich mittig (AGE-632)", () => {
  beforeEach(() => {
    fetchZugestellte.mockResolvedValue([note()]);
  });

  it("öffnet auf Klick ein Modal mit dem vollen Text", async () => {
    renderPage();
    fireEvent.click(
      await screen.findByRole("button", { name: /Nachrichten stehen jetzt im Rahmen/ }),
    );

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Die Unterhaltungsliste steht rechts.")).toBeInTheDocument();
  });

  it("hängt das Overlay an document.body, NICHT in die Kartenliste", async () => {
    // Die Falle, die diese Anwendung zweimal stellt: `.fbc-card:hover` trägt
    // ein `transform`, der Seitenkopf ein `backdrop-filter`. Beide erzeugen
    // einen Bezugsrahmen, in dem `fixed` nicht mehr am Viewport hängt — das
    // Overlay säße dann IM Kasten. jsdom sieht davon nichts, also wird hier
    // der Elternknoten geprüft und nicht die Optik.
    const { container } = renderPage();
    fireEvent.click(
      await screen.findByRole("button", { name: /Nachrichten stehen jetzt im Rahmen/ }),
    );

    const dialog = screen.getByRole("dialog");
    expect(container.contains(dialog)).toBe(false);
    expect(document.body.contains(dialog)).toBe(true);
  });

  it("schliesst mit Escape", async () => {
    renderPage();
    fireEvent.click(
      await screen.findByRole("button", { name: /Nachrichten stehen jetzt im Rahmen/ }),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("steht offen, wenn die Adresse die Note nennt — der Weg aus der Glocke", async () => {
    renderPage("/neues?note=n1");
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("bleibt geschlossen, wenn die Adresse eine unbekannte Note nennt", async () => {
    // Eine Note kann geloescht sein, waehrend der Hinweis noch in der Glocke
    // steht. Ein leeres Modal waere schlechter als keines.
    renderPage("/neues?note=gibtesnicht");
    await screen.findByText("Nachrichten stehen jetzt im Rahmen");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("zeigt die Bilder der abgedeckten Änderungen, mit Abmessungen", async () => {
    renderPage("/neues?note=n1");
    const bild = await within(await screen.findByRole("dialog")).findByRole("img", {
      name: "Die Nachrichtenleiste am rechten Rand",
    });
    // Ohne Abmessungen im Markup rutscht der Text nach unten, sobald das Bild
    // eintrifft — auf einem langsamen Anschluss genau dann, wenn jemand liest.
    expect(bild).toHaveAttribute("width", "1200");
    expect(bild).toHaveAttribute("height", "750");
  });

  it("zeigt bei einer Note ohne Bilder gar keine Bildfläche", async () => {
    fetchZugestellte.mockResolvedValue([note({ entry_slugs: ["2026-08-01-ohne-bild"] })]);
    renderPage("/neues?note=n1");

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByRole("img")).not.toBeInTheDocument();
  });
});
