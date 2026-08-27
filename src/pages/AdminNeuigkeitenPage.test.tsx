import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Die Release-Notes-Fläche (AGE-631, Band 4).
 *
 * Vier Zusagen, und die letzte ist die, die ein Reviewer sucht:
 *
 *  1. Nur was noch **nicht angekündigt** wurde steht zur Auswahl — und ein
 *     liegen gelassener ENTWURF versteckt nichts.
 *  2. Aus mehreren Auswahlen wird **ein** Entwurf, nicht einer je Eintrag.
 *  3. Zugestellt wird der **geänderte** Text, nicht der vorgeschlagene.
 *  4. Es gibt **keine Empfängerauswahl** — das ist die Zusage aus
 *     `specs/admin`, die AGE-304 seit je hält.
 */

type Note = import("../lib/release-notes").ReleaseNote;

const fetchEntwuerfe = vi.fn<() => Promise<Note[]>>();
const fetchZugestellte = vi.fn<() => Promise<Note[]>>();
const speichereEntwurf = vi.fn();
const stelleZu = vi.fn<(id: string) => Promise<number>>();

vi.mock("../lib/release-notes", async (original) => ({
  ...(await original<typeof import("../lib/release-notes")>()),
  fetchEntwuerfe: () => fetchEntwuerfe(),
  fetchZugestellte: () => fetchZugestellte(),
  speichereEntwurf: (e: unknown) => speichereEntwurf(e),
  stelleZu: (id: string) => stelleZu(id),
}));

vi.mock("../content/release-entries.generated", () => ({
  RELEASE_EINTRAEGE: [
    {
      slug: "2026-08-27-glocke",
      datum: "2026-08-27",
      titel: "Glocke verdrahtet",
      linear: "AGE-620",
      aenderungen: ["Vier Hinweistypen"],
    },
    {
      slug: "2026-08-26-feed",
      datum: "2026-08-26",
      titel: "Feed blättert",
      linear: null,
      aenderungen: ["Seitenweise laden"],
    },
  ],
}));

const { default: AdminNeuigkeitenPage } = await import("./AdminNeuigkeitenPage");
const { ToastProvider } = await import("../components/ui/Toast");
const { AuthFixture, authAsTier } = await import("../test/auth-fixtures");

function note(over: Partial<Note>): Note {
  return {
    id: "n1",
    title: "Neu in der App",
    body: "Text",
    entry_slugs: [],
    status: "draft",
    created_by: null,
    created_at: "2026-08-27T10:00:00Z",
    sent_at: null,
    recipient_count: null,
    ...over,
  } as Note;
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <AuthFixture value={authAsTier("impact")}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter>
            <AdminNeuigkeitenPage />
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    </AuthFixture>,
  );
}

beforeEach(() => {
  fetchEntwuerfe.mockReset().mockResolvedValue([]);
  fetchZugestellte.mockReset().mockResolvedValue([]);
  speichereEntwurf.mockReset().mockResolvedValue(note({ id: "gespeichert" }));
  stelleZu.mockReset().mockResolvedValue(74);
});

describe("Was zur Auswahl steht", () => {
  it("listet die noch nicht angekündigten Änderungen", async () => {
    renderPage();
    expect(await screen.findByText("Glocke verdrahtet")).toBeInTheDocument();
    expect(screen.getByText("Feed blättert")).toBeInTheDocument();
  });

  it("lässt aus, was eine ZUGESTELLTE Note schon abdeckt", async () => {
    fetchZugestellte.mockResolvedValue([
      note({ id: "n9", status: "sent", entry_slugs: ["2026-08-27-glocke"] }),
    ]);
    renderPage();

    expect(await screen.findByText("Feed blättert")).toBeInTheDocument();
    expect(screen.queryByText("Glocke verdrahtet")).not.toBeInTheDocument();
  });

  it("lässt NICHTS aus, was nur in einem Entwurf steht", async () => {
    // Sonst verschwände eine Änderung für immer, sobald jemand sie in einen
    // Entwurf gezogen und den Entwurf liegen gelassen hat.
    fetchEntwuerfe.mockResolvedValue([
      note({ id: "n8", status: "draft", entry_slugs: ["2026-08-27-glocke"] }),
    ]);
    renderPage();

    expect(await screen.findByText("Glocke verdrahtet")).toBeInTheDocument();
  });
});

describe("Aus mehreren Änderungen wird EINE Nachricht", () => {
  it("fasst die Auswahl zu einem Entwurf zusammen", async () => {
    renderPage();
    fireEvent.click(await screen.findByLabelText(/Glocke verdrahtet/));
    fireEvent.click(screen.getByLabelText(/Feed blättert/));
    fireEvent.click(screen.getByRole("button", { name: /Entwurf machen/ }));

    const feld = screen.getByLabelText(/Text — so, wie ein Mitglied/) as HTMLTextAreaElement;
    expect(feld.value).toContain("Glocke verdrahtet");
    expect(feld.value).toContain("Feed blättert");
    // EIN Titel für die ganze Nachricht.
    expect((screen.getByLabelText("Titel") as HTMLInputElement).value).toBe("Neu in der App");
  });

  it("stellt den GEÄNDERTEN Text zu, nicht den vorgeschlagenen", async () => {
    renderPage();
    fireEvent.click(await screen.findByLabelText(/Glocke verdrahtet/));
    fireEvent.click(screen.getByRole("button", { name: /Entwurf machen/ }));

    fireEvent.change(screen.getByLabelText(/Text — so, wie ein Mitglied/), {
      target: { value: "Von Hand geschrieben." },
    });
    fireEvent.change(screen.getByLabelText("Titel"), { target: { value: "Eigener Titel" } });
    fireEvent.click(screen.getByRole("button", { name: "Entwurf speichern" }));

    await waitFor(() =>
      expect(speichereEntwurf).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Eigener Titel", body: "Von Hand geschrieben." }),
      ),
    );
  });
});

describe("Zustellen", () => {
  it("geht erst nach dem Speichern", async () => {
    renderPage();
    const knopf = await screen.findByRole("button", { name: /zustellen/ });
    expect(knopf).toBeDisabled();

    // `findBy`, nicht `getBy`: der Zustell-Knopf steht sofort da, die Liste der
    // Änderungen kommt erst mit der Abfrage. Ein `getBy` misst hier den
    // Ladezustand und nicht die Fläche.
    fireEvent.click(await screen.findByLabelText(/Glocke verdrahtet/));
    fireEvent.click(screen.getByRole("button", { name: /Entwurf machen/ }));
    fireEvent.click(screen.getByRole("button", { name: "Entwurf speichern" }));

    await waitFor(() => expect(knopf).not.toBeDisabled());
    fireEvent.click(knopf);
    await waitFor(() => expect(stelleZu).toHaveBeenCalledWith("gespeichert"));
  });

  it("bietet KEINE Empfängerauswahl an — die Zusage aus specs/admin", async () => {
    renderPage();
    await screen.findByText("Glocke verdrahtet");

    // Die einzigen Auswahlkästchen auf dieser Fläche sind die der Änderungen.
    // Ein Kästchen mit einem Mitgliedsnamen daran wäre genau die Fläche, die
    // AGE-304 verboten hat.
    const kaesten = screen.getAllByRole("checkbox");
    expect(kaesten).toHaveLength(2);
    expect(screen.queryByText(/Empfänger/)).not.toBeInTheDocument();
    // Positivkontrolle: der Kreis wird trotzdem benannt, nur nicht gewählt.
    expect(screen.getByRole("button", { name: /alle aktivierten Mitglieder/ })).toBeInTheDocument();
  });
});
