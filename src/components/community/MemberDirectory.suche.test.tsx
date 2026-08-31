import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import MemberDirectory from "./MemberDirectory";
import { fetchDirectoryBaseline, searchDirectory } from "../../lib/directory";

/**
 * Suche und Filter stehen in der rechten Spalte (AGE-629), vorher über der
 * Liste hinter einem eigenen Aufklapper (AGE-566).
 *
 * Was sich damit an der Zusage ändert: die erweiterten Felder sind nicht mehr
 * BEDINGT GERENDERT, sondern immer im Baum und ab `lg` sichtbar. Der Grund für
 * das Einklappen war fehlende Höhe über der Liste — in einer eigenen Spalte
 * gibt es diesen Mangel nicht. Unterhalb von `lg` klappt statt der Felder die
 * ganze Spalte zu, mit EINEM Schalter statt zwei ineinander.
 *
 * Gemockt wird der Datenweg, nicht die Komponente. Wo es ohne Klassennamen
 * geht, wird an sichtbaren Beschriftungen geprüft — beim Zuklappen geht es
 * nicht: jsdom rechnet kein CSS, `hidden lg:block` ist dort beides zugleich.
 * Dieselbe Stelle, dieselbe Begründung wie in `CommunityFeed.flaeche.test.tsx`;
 * der Beleg ist die Sichtprobe bei 375 px, nicht dieser Test.
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

describe("Verzeichnis: Suche und Filter in der rechten Spalte", () => {
  it("stellt die erweiterten Felder ab lg offen hin", async () => {
    renderDirectory();

    expect(await screen.findByLabelText(/Volltextsuche/i)).toBeInTheDocument();
    // Kein Klick nötig: die Felder stehen. Stellvertretend zwei Auswahlfelder
    // und eine Chip-Gruppe.
    expect(screen.getByLabelText(/Branche/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Kompetenz/i)).toBeInTheDocument();
    expect(screen.getByText("Bietet")).toBeInTheDocument();
  });

  it("hat keinen zweiten Aufklapper mehr in der Spalte", async () => {
    renderDirectory();
    await screen.findByLabelText(/Volltextsuche/i);

    // Der Schalter „Erweiterte Suche" ist im Aufklapper der ganzen Spalte
    // aufgegangen. Zwei ineinandergeschachtelte Schalter wären eine Bedienung,
    // die niemand erklären kann.
    expect(screen.queryByRole("button", { name: /Erweiterte Suche/i })).toBeNull();
  });

  it("hält die Spalte auf dem Telefon zusammengeklappt", async () => {
    renderDirectory();
    await screen.findByLabelText(/Volltextsuche/i);

    const schalter = screen.getByRole("button", { name: /^filter$/i });
    const flaeche = document.getElementById(schalter.getAttribute("aria-controls")!);

    expect(schalter).toHaveAttribute("aria-expanded", "false");
    /* `hidden` klappt sie auf dem Telefon zu, `lg:block` holt sie auf breiten
       Schirmen zurück. jsdom rechnet kein CSS — die Zusage ist über die Klasse,
       der Beleg über die Sichtprobe bei 375 px. */
    expect(flaeche).toHaveClass("hidden", "lg:block");

    fireEvent.click(schalter);
    expect(schalter).toHaveAttribute("aria-expanded", "true");
    expect(flaeche).not.toHaveClass("hidden");
  });

  /**
   * Ein Suchbegriff aus der Kopfzeile ist KEIN erweiterter Filter. Vor der
   * Trennung von `hasAdvancedFilters` hätte er das Panel aufgerissen und
   * zusätzlich behauptet, es seien erweiterte Filter aktiv.
   */
  it("bleibt bei einem Suchbegriff aus der Adresszeile zusammengeklappt", async () => {
    renderDirectory("/mitglieder?q=meier");

    await screen.findByLabelText(/Volltextsuche/i);
    expect(screen.getByRole("button", { name: /^filter$/i })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.queryByText(/Erweiterte Filter sind aktiv/i)).toBeNull();
  });

  /**
   * Der Weg, den jemand auf dem Telefon wirklich geht: aufklappen, filtern,
   * zuklappen. Der Hinweis gehört an den Spalten-Schalter, denn er ist es, der
   * die Filter verbirgt — ein aktiver, aber unsichtbarer Filter erklärt sonst
   * eine kurze Trefferliste nicht.
   *
   * Er sitzt im `lg:hidden`-Block: ab `lg` verbirgt niemand etwas, und ein
   * Hinweis auf Verborgenes wäre dort schlicht falsch.
   */
  it("sagt es, wenn zusammengeklappt gefiltert wird", async () => {
    renderDirectory();
    await screen.findByLabelText(/Volltextsuche/i);
    const schalter = screen.getByRole("button", { name: /^filter$/i });

    fireEvent.click(schalter);
    expect(schalter).toHaveAttribute("aria-expanded", "true");
    expect(screen.queryByText(/Erweiterte Filter sind aktiv/i)).toBeNull();

    const branche = screen.getByLabelText(/Branche/i);
    fireEvent.change(branche, { target: { value: "" } });
    fireEvent.click(screen.getByText("Kapital & Beteiligungen"));

    fireEvent.click(schalter);
    expect(schalter).toHaveAttribute("aria-expanded", "false");
    expect(await screen.findByText(/Erweiterte Filter sind aktiv/i)).toBeInTheDocument();
  });
});
