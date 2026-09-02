import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import MemberDirectory from "./MemberDirectory";
import { fetchDirectoryBaseline, searchDirectory, type DirectoryMember } from "../../lib/directory";

/**
 * AGE-598, Aufgabengruppe 4 — die Filter, die eine Stufe nicht bedienen kann.
 *
 * Seit der Migration `20260902150000_verzeichnis_ab_connect.sql` beginnt die
 * Verzeichnisliste bei `connect` (Rang 2), die erweiterten Felder aber
 * weiterhin bei `discover` (Rang 3). Vier Filter arbeiten auf genau diesen
 * maskierten Spalten und finden unterhalb Rang 3 SYSTEMATISCH nichts:
 * Kompetenz, Thema, Angebotsart und die beiden Chip-Gruppen „Bietet"/„Sucht".
 *
 * Entschieden in D5: sie werden AUSGEBLENDET, nicht leer laufen gelassen. Ein
 * sichtbarer Filter ist ein Versprechen; einer, der nie etwas findet, bricht es
 * bei jeder Benutzung und erzeugt dabei die Frage, die er nicht beantwortet —
 * „liegt es an mir?".
 *
 * Das Ausblenden ALLEIN wäre allerdings ein zweites Verschweigen. Deshalb steht
 * an ihrer Stelle ein Hinweis, ab welcher Stufe es sie gibt (4.2).
 *
 * Die Positivkontrolle ist hier keine Höflichkeit: ein Test, der nur die
 * Abwesenheit prüft, bleibt auch dann grün, wenn die Filter für JEDEN
 * verschwinden. Rang 3 und Rang 2 stehen deshalb nebeneinander in dieser Datei.
 *
 * Die Sicherheitsgrenze ist und bleibt die RPC — dieser Test misst Komfort.
 */
vi.mock("../../lib/directory", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/directory")>()),
  searchDirectory: vi.fn(),
  fetchDirectoryBaseline: vi.fn(),
}));

/* Die Stufe kommt aus `useAuth().levelRank` — derselbe Wert, den auch
   `MembershipGate` liest. Veränderlich, weil jeder Fall in dieser Datei eine
   andere Stufe braucht. */
let auth: { user: { id: string } | null; levelRank: number | null } = {
  user: { id: "00000000-0000-0000-0000-0000000000aa" },
  levelRank: 3,
};
vi.mock("../../providers/auth-context", () => ({
  useAuth: () => auth,
}));

function member(overrides: Partial<DirectoryMember> = {}): DirectoryMember {
  return {
    id: crypto.randomUUID(),
    name: "Anna Beispiel",
    avatar_url: null,
    cover_url: null,
    region: null,
    company: null,
    short_bio: null,
    branche: null,
    tier: "impact",
    roles: null,
    competencies: null,
    has_offers: false,
    has_needs: false,
    offer_categories: [],
    need_categories: [],
    ...overrides,
  };
}

/** Ein Bestand mit genau einer Branche und einer Region — sonst hätten die
 *  beiden Filter, die 4.3 als funktionsfähig zusagt, keine einzige Option. */
const BASELINE = [member({ branche: "Handwerk", region: "Nord", competencies: ["Statik"] })];

function renderDirectory(levelRank: number | null) {
  auth = { user: { id: "00000000-0000-0000-0000-0000000000aa" }, levelRank };
  vi.mocked(searchDirectory).mockResolvedValue([]);
  vi.mocked(fetchDirectoryBaseline).mockResolvedValue(BASELINE);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/mitglieder"]}>
        <MemberDirectory />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(searchDirectory).mockReset();
  vi.mocked(fetchDirectoryBaseline).mockReset();
});

describe("Verzeichnis: Filter unterhalb der Rang-3-Schwelle (AGE-598, 4.1–4.3)", () => {
  it("zeigt einem connect-Konto die vier maskierten Filter gar nicht", async () => {
    renderDirectory(2);
    await screen.findByLabelText(/Volltextsuche/i);

    // Die drei Auswahlfelder auf maskierten Spalten …
    expect(screen.queryByLabelText(/Kompetenz/i)).toBeNull();
    expect(screen.queryByLabelText(/Thema/i)).toBeNull();
    expect(screen.queryByLabelText(/Sucht \/ bietet/i)).toBeNull();
    // … und die beiden Chip-Gruppen. Über die Rolle und nicht über den Text:
    // „Bietet" steht als Wort auch in den Optionen der Angebotsart.
    expect(screen.queryByRole("group", { name: "Bietet" })).toBeNull();
    expect(screen.queryByRole("group", { name: "Sucht" })).toBeNull();
  });

  it("sagt einem connect-Konto, ab welcher Stufe es die Filter gibt", async () => {
    renderDirectory(2);
    await screen.findByLabelText(/Volltextsuche/i);

    // Ausblenden ohne Hinweis wäre ein zweites Verschweigen (4.2). Die Stufe
    // muss BENANNT sein — „mehr Filter ab einer höheren Stufe" beantwortet die
    // Frage nicht, die das Fehlen aufwirft.
    expect(screen.getByText(/ab Discover/i)).toBeInTheDocument();
  });

  it("lässt einem connect-Konto den Branchenfilter — sichtbar und wirksam", async () => {
    renderDirectory(2);
    await screen.findByLabelText(/Volltextsuche/i);

    // Sichtbar: er läuft seit 3c auf einem Basisfeld und findet etwas.
    const branche = screen.getByLabelText(/Branche/i);
    expect(branche).toBeInTheDocument();
    // Und die Region ebenso — auch sie steht in `profiles_public`.
    expect(screen.getByLabelText(/Region/i)).toBeInTheDocument();

    // Wirksam: die Auswahl erreicht die RPC. Ein sichtbarer Filter, der den
    // Filterzustand nicht mehr erreicht, wäre die schlechtere Hälfte von D5.
    //
    // Erst auf die Option warten. Die Facetten kommen aus der Baseline-Abfrage,
    // und `findByLabelText` oben ist schon beim ERSTEN Rendern erfüllt — ein
    // `change` auf einen Wert, den das Feld noch nicht kennt, verpufft
    // wortlos und der Test wäre grün geworden, ohne etwas zu belegen.
    await screen.findByRole("option", { name: "Handwerk" });
    fireEvent.change(branche, { target: { value: "Handwerk" } });
    await waitFor(() => {
      expect(vi.mocked(searchDirectory)).toHaveBeenCalledWith(
        expect.objectContaining({ branche: "Handwerk" }),
      );
    });
  });

  /**
   * Positivkontrolle. Ohne sie belegte die Datei nur, dass die Filter fehlen —
   * nicht, dass sie jemandem noch angeboten werden.
   */
  it("zeigt einem discover-Konto weiterhin alle Filter und keinen Hinweis", async () => {
    renderDirectory(3);
    await screen.findByLabelText(/Volltextsuche/i);

    expect(screen.getByLabelText(/Kompetenz/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Thema/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Sucht \/ bietet/i)).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Bietet" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Sucht" })).toBeInTheDocument();

    expect(screen.queryByText(/ab Discover/i)).toBeNull();
  });
});
