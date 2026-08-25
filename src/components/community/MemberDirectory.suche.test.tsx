import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import MemberDirectory from "./MemberDirectory";
import { fetchDirectoryBaseline, searchDirectory } from "../../lib/directory";

/**
 * Die erweiterte Suche ist eingeklappt (AGE-566).
 *
 * Fünf Auswahlfelder und zwölf Chips beim ersten Blick sind ein Formular, keine
 * Suche. Standard ist deshalb nur das Suchfeld; alles Weitere kommt auf Klick.
 *
 * Gemockt wird der Datenweg, nicht die Komponente. Geprüft wird an sichtbaren
 * Beschriftungen: eine Zusage auf Klassennamen bestünde auch, wenn die Felder
 * bloss durchsichtig wären.
 */
vi.mock("../../lib/directory", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/directory")>()),
  searchDirectory: vi.fn(),
  fetchDirectoryBaseline: vi.fn(),
}));


/* AGE-595: `MemberDirectory` liest seit den Reitern die eigene Kennung, um
   die Kontaktmenge zu laden. Ohne diesen Mock wirft `useAuth` „muss innerhalb
   von <AuthProvider> verwendet werden" — die Datei praefte dann gar nichts
   mehr. Ein Konto mit Kennung und ohne Kontakte ist hier der neutrale Fall. */
vi.mock("../../providers/auth-context", () => ({
  useAuth: () => ({ user: { id: "00000000-0000-0000-0000-0000000000aa" } }),
}));

function renderDirectory(pfad = "/mitglieder") {
  vi.mocked(searchDirectory).mockResolvedValue([]);
  vi.mocked(fetchDirectoryBaseline).mockResolvedValue([]);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[pfad]}>
        <MemberDirectory />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(searchDirectory).mockReset();
  vi.mocked(fetchDirectoryBaseline).mockReset();
});

describe("Verzeichnis: einfache Suche als Standard", () => {
  it("zeigt zunächst nur das Suchfeld, nicht die Filter", async () => {
    renderDirectory();

    expect(await screen.findByLabelText(/Volltextsuche/i)).toBeInTheDocument();
    // Die fünf Auswahlfelder bleiben weg — stellvertretend zwei davon.
    expect(screen.queryByLabelText(/Branche/i)).toBeNull();
    expect(screen.queryByLabelText(/Kompetenz/i)).toBeNull();
    // Und die Chip-Gruppen ebenso.
    expect(screen.queryByText("Bietet")).toBeNull();
  });

  it("klappt die Filter auf Klick auf und wieder zu", async () => {
    renderDirectory();
    await screen.findByLabelText(/Volltextsuche/i);

    fireEvent.click(screen.getByRole("button", { name: "Erweiterte Suche" }));

    expect(await screen.findByLabelText(/Branche/i)).toBeInTheDocument();
    expect(screen.getByText("Bietet")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Erweiterte Suche schließen/i }));

    await waitFor(() => expect(screen.queryByLabelText(/Branche/i)).toBeNull());
  });

  /**
   * Ein Suchbegriff aus der Kopfzeile ist KEIN erweiterter Filter. Vor der
   * Trennung von `hasAdvancedFilters` hätte er das Panel aufgerissen und
   * zusätzlich behauptet, es seien erweiterte Filter aktiv.
   */
  it("bleibt bei einem Suchbegriff aus der Adresszeile eingeklappt", async () => {
    renderDirectory("/mitglieder?q=meier");

    await screen.findByLabelText(/Volltextsuche/i);
    expect(screen.queryByLabelText(/Branche/i)).toBeNull();
    expect(screen.queryByText(/Erweiterte Filter sind aktiv/i)).toBeNull();
  });

  it("sagt es, wenn eingeklappt gefiltert wird", async () => {
    renderDirectory();
    await screen.findByLabelText(/Volltextsuche/i);

    fireEvent.click(screen.getByRole("button", { name: "Erweiterte Suche" }));
    const branche = await screen.findByLabelText(/Branche/i);
    fireEvent.change(branche, { target: { value: "" } });
    fireEvent.click(screen.getByText("Kapital & Beteiligungen"));

    fireEvent.click(screen.getByRole("button", { name: /Erweiterte Suche schließen/i }));

    // Ohne diesen Hinweis erklärt eine kurze Trefferliste sich nicht mehr.
    expect(await screen.findByText(/Erweiterte Filter sind aktiv/i)).toBeInTheDocument();
  });
});
