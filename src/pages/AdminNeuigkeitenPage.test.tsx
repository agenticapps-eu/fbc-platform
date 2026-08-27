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
 *  5. Beim Öffnen ist die **letzte Woche** vorangehakt, älteres nicht — und
 *     nach dem Zustellen kommt kein Häkchen von selbst zurück.
 *
 * **Die Daten der Attrappe sind relativ zu heute gerechnet, nicht fest.** Mit
 * `datum: "2026-08-27"` prüfte dieser Test die Vorauswahl an genau dem Tag, an
 * dem er geschrieben wurde, und ab dem achten Tag danach das Gegenteil —
 * grün-nach-rot ohne eine Zeile Codeänderung.
 */

const { tagVor } = vi.hoisted(() => ({
  /** `JJJJ-MM-TT`, n Tage vor heute. Geteilt zwischen Attrappe und Test —
   *  `vi.mock` wird gehoistet und sähe eine normale Konstante nicht. */
  tagVor: (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10),
}));

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
      slug: `${tagVor(0)}-glocke`,
      datum: tagVor(0),
      titel: "Glocke verdrahtet",
      linear: "AGE-620",
      aenderungen: ["Vier Hinweistypen"],
    },
    {
      slug: `${tagVor(2)}-feed`,
      datum: tagVor(2),
      titel: "Feed blättert",
      linear: null,
      aenderungen: ["Seitenweise laden"],
    },
    {
      slug: `${tagVor(40)}-damals`,
      datum: tagVor(40),
      titel: "Damals gebaut",
      linear: null,
      aenderungen: ["Vor langer Zeit"],
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
      note({ id: "n9", status: "sent", entry_slugs: [`${tagVor(0)}-glocke`] }),
    ]);
    renderPage();

    expect(await screen.findByText("Feed blättert")).toBeInTheDocument();
    expect(screen.queryByText("Glocke verdrahtet")).not.toBeInTheDocument();
  });

  it("lässt NICHTS aus, was nur in einem Entwurf steht", async () => {
    // Sonst verschwände eine Änderung für immer, sobald jemand sie in einen
    // Entwurf gezogen und den Entwurf liegen gelassen hat.
    fetchEntwuerfe.mockResolvedValue([
      note({ id: "n8", status: "draft", entry_slugs: [`${tagVor(0)}-glocke`] }),
    ]);
    renderPage();

    expect(await screen.findByText("Glocke verdrahtet")).toBeInTheDocument();
  });
});

describe("Was beim Öffnen vorangehakt ist", () => {
  it("hakt die letzte Woche an und älteres nicht", async () => {
    renderPage();
    await screen.findByLabelText(/Glocke verdrahtet/);

    expect(screen.getByLabelText(/Glocke verdrahtet/)).toBeChecked();
    expect(screen.getByLabelText(/Feed blättert/)).toBeChecked();
    // Die Positivkontrolle zur Verneinung: der alte Eintrag STEHT in der
    // Liste. Verschwände er, sähe eine verkürzte Liste aus wie eine
    // vollständige — und niemand kündigte ihn je an.
    expect(screen.getByLabelText(/Damals gebaut/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Damals gebaut/)).not.toBeChecked();
    expect(screen.getByRole("button", { name: /Aus 2 Änderungen/ })).toBeInTheDocument();
  });

  it("lässt sich abwählen", async () => {
    renderPage();
    fireEvent.click(await screen.findByLabelText(/Glocke verdrahtet/));

    expect(screen.getByLabelText(/Glocke verdrahtet/)).not.toBeChecked();
    expect(screen.getByLabelText(/Feed blättert/)).toBeChecked();
    expect(screen.getByRole("button", { name: /Aus 1 Änderungen/ })).toBeInTheDocument();
  });

  it("bringt nach dem Zustellen KEIN Häkchen von selbst zurück", async () => {
    // Die Falle an einer abgeleiteten Vorauswahl: nach dem Zustellen leert die
    // Fläche die Auswahl. Wäre „leer" von „noch nicht angefasst" nicht zu
    // unterscheiden, stünden sofort wieder Häkchen da — und der nächste Klick
    // auf „zustellen" schickte dieselben Änderungen ein zweites Mal los.
    renderPage();
    await screen.findByLabelText(/Glocke verdrahtet/);
    fireEvent.click(screen.getByRole("button", { name: /Entwurf machen/ }));
    fireEvent.click(screen.getByRole("button", { name: "Entwurf speichern" }));
    const knopf = screen.getByRole("button", { name: /zustellen/ });
    await waitFor(() => expect(knopf).not.toBeDisabled());
    fireEvent.click(knopf);

    await waitFor(() => expect(stelleZu).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByLabelText(/Glocke verdrahtet/)).not.toBeChecked());
    expect(screen.getByLabelText(/Feed blättert/)).not.toBeChecked();
  });
});

describe("Aus mehreren Änderungen wird EINE Nachricht", () => {
  it("fasst die Auswahl zu einem Entwurf zusammen", async () => {
    renderPage();
    // Die beiden jungen sind vorangehakt — geklickt wird nur, was dazukommt.
    await screen.findByLabelText(/Glocke verdrahtet/);
    fireEvent.click(screen.getByRole("button", { name: /Entwurf machen/ }));

    const feld = screen.getByLabelText(/Text — so, wie ein Mitglied/) as HTMLTextAreaElement;
    expect(feld.value).toContain("Glocke verdrahtet");
    expect(feld.value).toContain("Feed blättert");
    // EIN Titel für die ganze Nachricht.
    expect((screen.getByLabelText("Titel") as HTMLInputElement).value).toBe("Neu in der App");
  });

  it("stellt den GEÄNDERTEN Text zu, nicht den vorgeschlagenen", async () => {
    renderPage();
    await screen.findByLabelText(/Glocke verdrahtet/);
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
    await screen.findByLabelText(/Glocke verdrahtet/);
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
    expect(kaesten).toHaveLength(3);
    expect(screen.queryByText(/Empfänger/)).not.toBeInTheDocument();
    // Positivkontrolle: der Kreis wird trotzdem benannt, nur nicht gewählt.
    expect(screen.getByRole("button", { name: /alle aktivierten Mitglieder/ })).toBeInTheDocument();
  });
});
