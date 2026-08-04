import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MemberDirectory from "./MemberDirectory";
import type { DirectoryMember } from "../../lib/directory";

/**
 * Kompass-Filter über der Mitgliederliste (AGE-494).
 *
 * Gemockt wird ausschließlich die RPC-GRENZE (`supabase.rpc`) — nicht die
 * Filterlogik und nicht die Komponente selbst. Sonst prüfte der Test seine
 * eigenen Mocks: die interessante Aussage ist, WELCHE Argumente die Auswahl
 * erzeugt, und die entsteht in `filtersToArgs` und im Klick-Handler.
 */
const rpc = vi.fn();
vi.mock("../../lib/supabase", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpc(...args),
  },
}));

function member(overrides: Partial<DirectoryMember> = {}): DirectoryMember {
  return {
    id: crypto.randomUUID(),
    name: "Anna Beispiel",
    avatar_url: null,
    region: null,
    company: null,
    short_bio: null,
    branche: null,
    tier: "impact",
    roles: null,
    competencies: null,
    has_offers: true,
    has_needs: true,
    offer_categories: ["kapital"],
    need_categories: ["experten"],
    ...overrides,
  };
}

function renderDirectory() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <MemberDirectory />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Die zuletzt an `search_directory` übergebenen Argumente. */
function lastArgs(): Record<string, unknown> {
  const call = rpc.mock.calls.at(-1);
  return (call?.[1] ?? {}) as Record<string, unknown>;
}

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({ data: [member()], error: null });
});
afterEach(() => vi.clearAllMocks());

describe("Kompass-Filter (AGE-494)", () => {
  it("schickt ohne Auswahl keine Kategorie-Argumente", async () => {
    renderDirectory();
    await waitFor(() => expect(rpc).toHaveBeenCalled());

    expect(lastArgs().p_offers).toBeUndefined();
    expect(lastArgs().p_needs).toBeUndefined();
  });

  it("sammelt mehrere Chips einer Gruppe in EIN Argument (ODER-Verknüpfung)", async () => {
    renderDirectory();
    await waitFor(() => expect(rpc).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: "Kapital & Beteiligungen" }));
    fireEvent.click(screen.getByRole("button", { name: "Mentoring & Sparring" }));

    await waitFor(() => expect(lastArgs().p_offers).toEqual(["kapital", "mentoring"]));
    // Die andere Gruppe bleibt unberührt — sonst wäre aus ODER ein UND geworden.
    expect(lastArgs().p_needs).toBeUndefined();
  });

  it("führt beide Gruppen getrennt (UND zwischen ihnen)", async () => {
    renderDirectory();
    await waitFor(() => expect(rpc).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: "Kapital & Beteiligungen" }));
    fireEvent.click(screen.getByRole("button", { name: "Experten & Berater" }));

    await waitFor(() => {
      expect(lastArgs().p_offers).toEqual(["kapital"]);
      expect(lastArgs().p_needs).toEqual(["experten"]);
    });
  });

  it("nimmt einen abgewählten Chip wieder aus dem Argument", async () => {
    renderDirectory();
    await waitFor(() => expect(rpc).toHaveBeenCalled());

    const chip = screen.getByRole("button", { name: "Kapital & Beteiligungen" });
    fireEvent.click(chip);
    await waitFor(() => expect(lastArgs().p_offers).toEqual(["kapital"]));

    fireEvent.click(chip);
    // Leere Auswahl heißt KEIN Filter — nicht „leeres Array".
    await waitFor(() => expect(lastArgs().p_offers).toBeUndefined());
  });

  it("räumt mit „Filter zurücksetzen“ auch die Chips ab", async () => {
    renderDirectory();
    await waitFor(() => expect(rpc).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: "Kapital & Beteiligungen" }));
    await waitFor(() => expect(lastArgs().p_offers).toEqual(["kapital"]));

    fireEvent.click(screen.getByRole("button", { name: "Filter zurücksetzen" }));
    await waitFor(() => expect(lastArgs().p_offers).toBeUndefined());
    expect(screen.getByRole("button", { name: "Kapital & Beteiligungen" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("zeigt die Kategorien auf der Karte, nicht nur „Bietet“/„Sucht“", async () => {
    renderDirectory();

    expect(await screen.findByText("Bietet: Kapital")).toBeInTheDocument();
    expect(screen.getByText("Sucht: Experten")).toBeInTheDocument();
  });

  /* AGE-494, Deploy-Fenster: Das Frontend geht bei einem Merge automatisch live,
     die Migration erreicht Prod nur per manuellem `supabase db push`. Dazwischen
     antwortet die ALTE RPC — ohne `offer_categories`/`need_categories`. Die
     Mitgliederseite darf daran nicht zerbrechen; sie zeigt dann eben die
     pauschalen Marken. (Genau dieser Fall hat lokal die Seite weiß gemacht.) */
  it("überlebt eine Antwort der alten RPC ohne Kategorie-Felder", async () => {
    const alteAntwort = member();
    delete (alteAntwort as Partial<DirectoryMember>).offer_categories;
    delete (alteAntwort as Partial<DirectoryMember>).need_categories;
    rpc.mockResolvedValue({ data: [alteAntwort], error: null });

    renderDirectory();

    expect(await screen.findByText("Anna Beispiel")).toBeInTheDocument();
    // Auf die Karte einschränken: „Bietet"/„Sucht" stehen auch über den
    // Filtergruppen, und ein ungenauer Treffer wäre kein Beleg.
    const karte = within(screen.getByRole("link", { name: /Anna Beispiel/ }));
    expect(karte.getByText("Bietet")).toBeInTheDocument();
    expect(karte.getByText("Sucht")).toBeInTheDocument();
  });

  /* Altbestand: eine offers-Zeile ohne `category` setzt `has_offers`, taucht aber
     in keinem Array auf. Ohne den Rückfall verlöre die Karte jeden Hinweis. */
  it("fällt für kategorielose Einträge auf die pauschale Marke zurück", async () => {
    rpc.mockResolvedValue({
      data: [member({ offer_categories: [], need_categories: [], has_needs: false })],
      error: null,
    });
    renderDirectory();

    expect(await screen.findByText("Bietet")).toBeInTheDocument();
    expect(screen.queryByText(/^Bietet: /)).not.toBeInTheDocument();
  });
});
