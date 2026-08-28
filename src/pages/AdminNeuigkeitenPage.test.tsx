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
const fetchAngekuendigt = vi.fn<() => Promise<Note[]>>();
const fetchUebersprungene = vi.fn<() => Promise<string[]>>();
const markiereUebersprungen = vi.fn<(slug: string) => Promise<void>>();
const holeZurueck = vi.fn<(slug: string) => Promise<void>>();
const speichereEntwurf = vi.fn();
const stelleZu = vi.fn<(id: string) => Promise<number>>();

vi.mock("../lib/release-notes", async (original) => ({
  ...(await original<typeof import("../lib/release-notes")>()),
  fetchEntwuerfe: () => fetchEntwuerfe(),
  fetchAngekuendigt: () => fetchAngekuendigt(),
  fetchUebersprungene: () => fetchUebersprungene(),
  markiereUebersprungen: (slug: string) => markiereUebersprungen(slug),
  holeZurueck: (slug: string) => holeZurueck(slug),
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

/**
 * Der Bestand der Attrappe. **Schreiben wirkt hier auf das nächste Lesen** —
 * sonst prüfte der Test nur, ob die Fläche ihren eigenen Zustand aufräumt, und
 * bliebe grün, wenn genau dieses Aufräumen die einzige Mechanik wäre. Der echte
 * Weg ist: schreiben → Abfrage entwerten → neu lesen → neu rechnen.
 */
let uebersprungen: string[] = [];

beforeEach(() => {
  uebersprungen = [];
  fetchEntwuerfe.mockReset().mockResolvedValue([]);
  fetchAngekuendigt.mockReset().mockResolvedValue([]);
  fetchUebersprungene.mockReset().mockImplementation(() => Promise.resolve([...uebersprungen]));
  markiereUebersprungen.mockReset().mockImplementation((slug) => {
    uebersprungen.push(slug);
    return Promise.resolve();
  });
  holeZurueck.mockReset().mockImplementation((slug) => {
    uebersprungen = uebersprungen.filter((s) => s !== slug);
    return Promise.resolve();
  });
  speichereEntwurf.mockReset().mockResolvedValue(note({ id: "gespeichert" }));
  stelleZu.mockReset().mockResolvedValue(74);
});

/** Das Kästchen „nicht relevant" einer Zeile. Eigener Name, damit die Zeile
 *  zwei unterscheidbare Bedienelemente hat — `/Glocke verdrahtet/` allein wäre
 *  ab jetzt mehrdeutig. */
const nichtRelevant = (titel: string) => screen.getByLabelText(`Nicht relevant: ${titel}`);

describe("Was zur Auswahl steht", () => {
  it("listet die noch nicht angekündigten Änderungen", async () => {
    renderPage();
    expect(await screen.findByText("Glocke verdrahtet")).toBeInTheDocument();
    expect(screen.getByText("Feed blättert")).toBeInTheDocument();
  });

  it("lässt aus, was eine ZUGESTELLTE Note schon abdeckt", async () => {
    fetchAngekuendigt.mockResolvedValue([
      note({ id: "n9", status: "sent", entry_slugs: [`${tagVor(0)}-glocke`] }),
    ]);
    renderPage();

    expect(await screen.findByText("Feed blättert")).toBeInTheDocument();
    // Seit AGE-636 verschwindet es nicht spurlos, sondern wandert ins Archiv.
    // Die Zusage lautet deshalb auf die AUSWAHL: kein Kästchen mehr.
    expect(screen.queryByLabelText(/^Glocke verdrahtet/)).not.toBeInTheDocument();
    expect(screen.getByText("Glocke verdrahtet")).toBeInTheDocument();
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
    await screen.findByLabelText(/^Glocke verdrahtet/);

    expect(screen.getByLabelText(/^Glocke verdrahtet/)).toBeChecked();
    expect(screen.getByLabelText(/^Feed blättert/)).toBeChecked();
    // Die Positivkontrolle zur Verneinung: der alte Eintrag STEHT in der
    // Liste. Verschwände er, sähe eine verkürzte Liste aus wie eine
    // vollständige — und niemand kündigte ihn je an.
    expect(screen.getByLabelText(/^Damals gebaut/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Damals gebaut/)).not.toBeChecked();
    expect(screen.getByRole("button", { name: /Aus 2 Änderungen/ })).toBeInTheDocument();
  });

  it("lässt sich abwählen", async () => {
    renderPage();
    fireEvent.click(await screen.findByLabelText(/^Glocke verdrahtet/));

    expect(screen.getByLabelText(/^Glocke verdrahtet/)).not.toBeChecked();
    expect(screen.getByLabelText(/^Feed blättert/)).toBeChecked();
    expect(screen.getByRole("button", { name: /Aus 1 Änderungen/ })).toBeInTheDocument();
  });

  it("bringt nach dem Zustellen KEIN Häkchen von selbst zurück", async () => {
    // Die Falle an einer abgeleiteten Vorauswahl: nach dem Zustellen leert die
    // Fläche die Auswahl. Wäre „leer" von „noch nicht angefasst" nicht zu
    // unterscheiden, stünden sofort wieder Häkchen da — und der nächste Klick
    // auf „zustellen" schickte dieselben Änderungen ein zweites Mal los.
    renderPage();
    await screen.findByLabelText(/^Glocke verdrahtet/);
    fireEvent.click(screen.getByRole("button", { name: /Entwurf machen/ }));
    fireEvent.click(screen.getByRole("button", { name: "Entwurf speichern" }));
    const knopf = screen.getByRole("button", { name: /zustellen/ });
    await waitFor(() => expect(knopf).not.toBeDisabled());
    fireEvent.click(knopf);

    await waitFor(() => expect(stelleZu).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByLabelText(/^Glocke verdrahtet/)).not.toBeChecked());
    expect(screen.getByLabelText(/^Feed blättert/)).not.toBeChecked();
  });
});

describe("Aus mehreren Änderungen wird EINE Nachricht", () => {
  it("fasst die Auswahl zu einem Entwurf zusammen", async () => {
    renderPage();
    // Die beiden jungen sind vorangehakt — geklickt wird nur, was dazukommt.
    await screen.findByLabelText(/^Glocke verdrahtet/);
    fireEvent.click(screen.getByRole("button", { name: /Entwurf machen/ }));

    const feld = screen.getByLabelText(/Text — so, wie ein Mitglied/) as HTMLTextAreaElement;
    expect(feld.value).toContain("Glocke verdrahtet");
    expect(feld.value).toContain("Feed blättert");
    // EIN Titel für die ganze Nachricht.
    expect((screen.getByLabelText("Titel") as HTMLInputElement).value).toBe("Neu in der App");
  });

  it("stellt den GEÄNDERTEN Text zu, nicht den vorgeschlagenen", async () => {
    renderPage();
    await screen.findByLabelText(/^Glocke verdrahtet/);
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
    await screen.findByLabelText(/^Glocke verdrahtet/);
    fireEvent.click(screen.getByRole("button", { name: /Entwurf machen/ }));
    fireEvent.click(screen.getByRole("button", { name: "Entwurf speichern" }));

    await waitFor(() => expect(knopf).not.toBeDisabled());
    fireEvent.click(knopf);
    await waitFor(() => expect(stelleZu).toHaveBeenCalledWith("gespeichert"));
  });

  it("bietet KEINE Empfängerauswahl an — die Zusage aus specs/admin", async () => {
    renderPage();
    await screen.findByText("Glocke verdrahtet");

    // Die einzigen Auswahlkästchen auf dieser Fläche sind die der Änderungen —
    // seit AGE-636 zwei je Zeile: aufnehmen und „nicht relevant". Ein Kästchen
    // mit einem Mitgliedsnamen daran wäre genau die Fläche, die AGE-304
    // verboten hat.
    const kaesten = screen.getAllByRole("checkbox");
    expect(kaesten).toHaveLength(6);
    expect(screen.queryByText(/Empfänger/)).not.toBeInTheDocument();
    // Positivkontrolle: der Kreis wird trotzdem benannt, nur nicht gewählt.
    expect(screen.getByRole("button", { name: /alle aktivierten Mitglieder/ })).toBeInTheDocument();
  });
});

describe("Nicht relevant — das zweite Kästchen (AGE-636)", () => {
  it("markiert und nimmt den Eintrag zugleich aus der Auswahl", async () => {
    renderPage();
    await screen.findByLabelText(/^Glocke verdrahtet/);
    // Vorangehakt ist er, weil er von heute ist — genau der gefährliche Fall.
    expect(screen.getByLabelText(/^Glocke verdrahtet/)).toBeChecked();

    fireEvent.click(nichtRelevant("Glocke verdrahtet"));

    await waitFor(() => expect(markiereUebersprungen).toHaveBeenCalledWith(`${tagVor(0)}-glocke`));
    // Die Zusage ist NICHT „das Kästchen ist leer", sondern „er landet nicht in
    // der Mitteilung". Gemessen wird deshalb am Entwurf.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Aus 1 Änderungen/ })).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: /Entwurf machen/ }));
    const feld = screen.getByLabelText(/Text — so, wie ein Mitglied/) as HTMLTextAreaElement;
    expect(feld.value).not.toContain("Glocke verdrahtet");
    expect(feld.value).toContain("Feed blättert");
  });

  it("sperrt das Zustellen, wenn nach dem SPEICHERN markiert wurde", async () => {
    // Der Fund der Fremd-Review (codex, HIGH): `stelleZu(id)` liest die Zeile in
    // der Datenbank, nicht den Bildschirm. Ohne diese Sperre verschickte
    // „speichern → markieren → zustellen" genau den Eintrag, den der Admin
    // gerade aussortiert hat.
    renderPage();
    await screen.findByLabelText(/^Glocke verdrahtet/);
    fireEvent.click(screen.getByRole("button", { name: /Entwurf machen/ }));
    fireEvent.click(screen.getByRole("button", { name: "Entwurf speichern" }));

    const knopf = screen.getByRole("button", { name: /zustellen/ });
    await waitFor(() => expect(knopf).not.toBeDisabled());

    fireEvent.click(nichtRelevant("Glocke verdrahtet"));

    await waitFor(() => expect(knopf).toBeDisabled());
    fireEvent.click(knopf);
    expect(stelleZu).not.toHaveBeenCalled();
  });

  it("sperrt das Zustellen auch, wenn nur der TEXT noch zur alten Auswahl passt", async () => {
    // Der Weg, den `unveraendert` allein nicht schliesst: Entwurf machen →
    // markieren → ERNEUT speichern. Danach stimmen die `entry_slugs`, der
    // Fliesstext nennt die aussortierte Änderung aber weiterhin — und die
    // Mitglieder läsen von etwas, das ausdrücklich raus sollte.
    // (Fremd-Review auf dem Diff, opencode, MEDIUM.)
    renderPage();
    await screen.findByLabelText(/^Glocke verdrahtet/);
    fireEvent.click(screen.getByRole("button", { name: /Entwurf machen/ }));

    fireEvent.click(nichtRelevant("Glocke verdrahtet"));
    await waitFor(() =>
      expect(screen.queryByLabelText(/^Glocke verdrahtet/)).not.toBeInTheDocument(),
    );

    // Der Text nennt sie noch — und genau das meldet die Fläche.
    expect(
      (screen.getByLabelText(/Text — so, wie ein Mitglied/) as HTMLTextAreaElement).value,
    ).toContain("Glocke verdrahtet");
    expect(screen.getByText(/stammt noch von einer anderen Auswahl/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Entwurf speichern" }));
    await waitFor(() => expect(speichereEntwurf).toHaveBeenCalled());

    // Gespeichert ist gespeichert — trotzdem bleibt zugestellt gesperrt.
    expect(screen.getByRole("button", { name: /zustellen/ })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /zustellen/ }));
    expect(stelleZu).not.toHaveBeenCalled();
  });

  it("schickt beim Speichern den Stand von DAMALS, nicht den vom Antwortzeitpunkt", async () => {
    // `onSuccess` liest sonst den Bildschirm zum Zeitpunkt der Antwort: wer
    // während des Speicherns weitertippt, bekäme seinen NEUEN Stand als
    // „gespeichert" quittiert, während in der Datenbank der alte steht.
    // (Fremd-Review auf dem Diff, codex, HIGH.)
    let aufloesen: ((n: unknown) => void) | undefined;
    speichereEntwurf.mockImplementation(
      () =>
        new Promise((r) => {
          aufloesen = r;
        }),
    );
    renderPage();
    await screen.findByLabelText(/^Glocke verdrahtet/);
    fireEvent.click(screen.getByRole("button", { name: /Entwurf machen/ }));
    fireEvent.click(screen.getByRole("button", { name: "Entwurf speichern" }));
    // react-query ruft die Mutation erst im nächsten Mikrotask — ohne dieses
    // Abwarten gäbe es den Auflöser noch gar nicht.
    await waitFor(() => expect(speichereEntwurf).toHaveBeenCalled());

    // Während die Antwort noch aussteht, wird weitergetippt.
    fireEvent.change(screen.getByLabelText("Titel"), { target: { value: "Nachträglich" } });
    aufloesen!(note({ id: "gespeichert" }));

    // Der Bildschirm weicht jetzt vom gespeicherten Stand ab — also gesperrt.
    await waitFor(() => expect(screen.getByRole("button", { name: /zustellen/ })).toBeDisabled());
    expect(screen.getByText("Erst speichern, dann zustellen.")).toBeInTheDocument();
  });

  it("lässt den Eintrag stehen, wenn das Markieren fehlschlägt", async () => {
    // Kein optimistisches Umschalten: eine Zeile, die verschwindet und beim
    // nächsten Laden wiederkommt, ist schlimmer als eine, die stehen bleibt.
    markiereUebersprungen.mockRejectedValue(new Error("keine Verbindung"));
    renderPage();
    await screen.findByLabelText(/^Glocke verdrahtet/);

    fireEvent.click(nichtRelevant("Glocke verdrahtet"));

    expect(await screen.findByText(/Nicht markiert/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Glocke verdrahtet/)).toBeInTheDocument();
  });
});

describe("Das Archiv (AGE-636)", () => {
  /** Eine zugestellte Note, die „Glocke verdrahtet" abdeckt. */
  const zugestellteNote = () =>
    note({
      id: "n9",
      status: "sent",
      title: "Neu in der App",
      sent_at: "2026-08-20T09:00:00Z",
      entry_slugs: [`${tagVor(0)}-glocke`],
    });

  it("beginnt zugeklappt und trägt die Zahl im Kopf", async () => {
    uebersprungen.push(`${tagVor(40)}-damals`);
    fetchAngekuendigt.mockResolvedValue([zugestellteNote()]);
    renderPage();

    const kopf = await screen.findByText(/Archiv \(2\)/);
    // jsdom hält den Inhalt eines `<details>` auch zugeklappt im Baum — die
    // Zusage lautet deshalb auf das Attribut, nicht auf die Sichtbarkeit.
    expect(kopf.closest("details")).not.toHaveAttribute("open");
  });

  it("nennt bei Zugestelltem die Mitteilung und das Datum — und bietet KEINEN Weg zurück", async () => {
    fetchAngekuendigt.mockResolvedValue([zugestellteNote()]);
    renderPage();

    await screen.findByText(/Archiv \(1\)/);
    // Datum UND Titel in einer Zusage: `2026-08-20` allein steht auch in der
    // Karte „Bereits zugestellt" und wäre dort schon erfüllt, ohne dass das
    // Archiv es je nennt.
    expect(screen.getByText(/zugestellt 2026-08-20 · „Neu in der App"/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Zurück in die Liste/ })).not.toBeInTheDocument();
  });

  it("holt eine als nicht relevant markierte Änderung zurück", async () => {
    uebersprungen.push(`${tagVor(40)}-damals`);
    renderPage();

    await screen.findByText(/Archiv \(1\)/);
    expect(screen.queryByLabelText(/^Damals gebaut/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Zurück in die Liste/ }));

    await waitFor(() => expect(holeZurueck).toHaveBeenCalledWith(`${tagVor(40)}-damals`));
  });

  it("nennt KEINE Zahl, solange die Grundlage fehlt", async () => {
    // Sonst wanderte die Lüge nur eine Karte tiefer: „Noch nichts archiviert."
    // als Tatsachenbehauptung, während gerade die abgeräumten Einträge nicht
    // geladen werden konnten. (Fremd-Review auf dem Diff, opencode, MEDIUM.)
    fetchUebersprungene.mockRejectedValue(new Error("keine Verbindung"));
    renderPage();

    expect(await screen.findByText(/nicht sagen, was archiviert ist/)).toBeInTheDocument();
    expect(screen.queryByText(/Archiv \(/)).not.toBeInTheDocument();
    expect(screen.queryByText("Noch nichts archiviert.")).not.toBeInTheDocument();
  });

  it("bleibt zu, wenn die Markierungen nicht geladen werden können", async () => {
    // Fail-closed: ein Ausfall, der als „nichts markiert" durchgeht, stellt
    // gerade die abgeräumten Einträge wieder zur Wahl — die jüngeren davon
    // vorangehakt.
    fetchUebersprungene.mockRejectedValue(new Error("keine Verbindung"));
    renderPage();

    expect(
      await screen.findByText(/lässt sich nicht sagen, was noch offen ist/),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Glocke verdrahtet/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Entwurf machen/ })).not.toBeInTheDocument();
  });
});
