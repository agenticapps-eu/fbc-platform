import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import MemberDirectory from "./MemberDirectory";
import { fetchDirectoryBaseline, searchDirectory, type DirectoryMember } from "../../lib/directory";
import type { Berechtigung } from "../../config/berechtigungen";
import type { MembershipLevel } from "../../config/levels";
import { rechteFuerStufe } from "../../test/auth-fixtures";

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

/* Seit AGE-1000 entscheidet nicht der Rang, sondern das Recht `suche_biete`.
   `useAuth` liefert deshalb nur noch die Kennung; welche Rechte das Konto
   traegt, steht in `rechte` und wird je Fall gesetzt.

   Gemockt wird der HOOK und nicht `ladeMeineRechte`: der Gegenstand dieser
   Datei ist die Flaeche, nicht der Hook. Ueber die echte Abfrage zu gehen
   machte jede Zusage hier asynchron und haengte sie an react-query — der Hook
   hat sein eigenes Testfile (`src/hooks/useDarf.test.tsx`). */
let auth: { user: { id: string } | null; levelRank: number | null } = {
  user: { id: "00000000-0000-0000-0000-0000000000aa" },
  levelRank: null,
};
vi.mock("../../providers/auth-context", () => ({
  useAuth: () => auth,
}));

let rechte: Berechtigung[] = [];
let rechteLaden = false;
let rechteFehler = false;
vi.mock("../../hooks/useDarf", () => ({
  useMeineRechte: () => ({ rechte, laedt: rechteLaden, fehler: rechteFehler }),
  useDarf: (k: Berechtigung) => ({
    darf: rechte.includes(k),
    laedt: rechteLaden,
    fehler: rechteFehler,
  }),
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

function renderDirectory(stufe: MembershipLevel | "laedt" | "fehler") {
  auth = { user: { id: "00000000-0000-0000-0000-0000000000aa" }, levelRank: null };
  rechteLaden = stufe === "laedt";
  rechteFehler = stufe === "fehler";
  rechte = stufe === "laedt" || stufe === "fehler" ? [] : rechteFuerStufe(stufe);
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

/**
 * AGE-1000: die Schwelle der vier Filter ist von der Clubstufe auf das Recht
 * `suche_biete` (FOCUS, Rang 5) gewandert, und damit wandern ALLE Betrachter
 * dieser Datei mit. Der gemessene Fall bleibt derselbe — „gerade darunter"
 * gegen „gerade darüber".
 *
 * Der Betrachter darunter steht jetzt auf DISCOVER und nicht mehr auf Rang 3:
 * Discover ist der höchste Rang ohne `suche_biete`, der diese Fläche überhaupt
 * erreichen kann, und er steht dabei IM Club. Hielte die Ausblendung bei ihm
 * nicht, hielte sie nirgends.
 *
 * Erreichbar ist die Fläche für ihn allerdings nur in einem Fenster:
 * `MembershipGate` sperrt `/mitglieder` seit AGE-1000 am Recht
 * `verzeichnis.suchen` (IMPACT), sperrt aber NICHT, solange die Rechte noch
 * laden. Genau dieses Fenster misst die Datei — sie ist dadurch nicht
 * überflüssig geworden, sondern misst einen schmaleren Fall.
 */
describe("Verzeichnis: Filter ohne `suche_biete` (AGE-598 4.1–4.3, AGE-1000)", () => {
  it("zeigt einem Discover-Konto die vier maskierten Filter gar nicht", async () => {
    renderDirectory("discover");
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

  it("sagt einem Discover-Konto, ab welcher Stufe es die Filter gibt", async () => {
    renderDirectory("discover");
    await screen.findByLabelText(/Volltextsuche/i);

    // Ausblenden ohne Hinweis wäre ein zweites Verschweigen (4.2). Die Stufe
    // muss BENANNT sein — „mehr Filter ab einer höheren Stufe" beantwortet die
    // Frage nicht, die das Fehlen aufwirft.
    expect(screen.getByText(/ab Focus/i)).toBeInTheDocument();
  });

  it("lässt einem Discover-Konto den Branchenfilter — sichtbar und wirksam", async () => {
    renderDirectory("discover");
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
  it("zeigt einem Focus-Konto weiterhin alle Filter und keinen Hinweis", async () => {
    renderDirectory("focus");
    await screen.findByLabelText(/Volltextsuche/i);

    expect(screen.getByLabelText(/Kompetenz/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Thema/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Sucht \/ bietet/i)).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Bietet" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Sucht" })).toBeInTheDocument();

    expect(screen.queryByText(/ab Focus/i)).toBeNull();
  });

  /**
   * Befund des Diff-Reviews (opencode, AGE-903). Solange die Stufe noch LÄDT,
   * ist `levelRank` null. Bis hierher rechnete die Fläche das mit `?? 0` in
   * „Rang 0" um — ein Clubmitglied sah die vier Filter also erst nicht und dann
   * doch, sie erschienen nachträglich.
   *
   * Das widersprach der Begründung, die daneben stehen blieb: ausgeblendet wird,
   * was SYSTEMATISCH nichts findet. Ein Filter, der in diesem Fenster zu viel
   * zeigt, findet höchstens nichts; einer, der zu wenig zeigt, nimmt einem
   * Berechtigten eine Fähigkeit weg. Dieselbe Regel tragen `MembershipGate` und
   * `HeaderSearch` schon: ein Ladezustand ist kein Ausschlussgrund.
   */
  /**
   * Der Fehlerfall, neben dem Ladefall und nicht statt ihm (Befund des
   * Diff-Reviews, codex, MEDIUM). Ein Filter ist keine Aktion: wer zu viel
   * zeigt, findet höchstens nichts. Und dieser Zustand löst sich NICHT von
   * selbst auf — ein FOCUS-Konto verlöre die vier Filter dauerhaft, weil eine
   * Abfrage schiefging.
   */
  it("blendet nichts aus, wenn der Abruf der Rechte gescheitert ist", async () => {
    renderDirectory("fehler");
    await screen.findByLabelText(/Volltextsuche/i);

    expect(screen.getByLabelText(/Kompetenz/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Thema/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Sucht \/ bietet/i)).toBeInTheDocument();
    expect(screen.queryByText(/ab Focus/i)).toBeNull();
  });

  it("blendet nichts aus, solange die Rechte noch nicht feststehen", async () => {
    renderDirectory("laedt");
    await screen.findByLabelText(/Volltextsuche/i);

    expect(screen.getByLabelText(/Kompetenz/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Thema/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Sucht \/ bietet/i)).toBeInTheDocument();
    // Und erst recht kein Hinweis, der eine Stufe nennt, die das Konto
    // vielleicht längst hat.
    expect(screen.queryByText(/ab Focus/i)).toBeNull();
  });
});
