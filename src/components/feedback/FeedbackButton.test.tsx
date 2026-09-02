import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthFixture, fakeAuthValue } from "../../test/auth-fixtures";
import type { AuthContextValue } from "../../providers/auth-context";
import { ToastProvider } from "../ui/Toast";

// Die Konstanten kommen ECHT aus dem Modul und werden nicht nachgebaut: eine
// nachgebaute Grenze wäre eine zweite Wahrheit, und der Test bliebe grün,
// wenn die Grenze am Bucket sich änderte.
vi.mock("../../lib/feedback", async (echt) => {
  const modul = await echt<typeof import("../../lib/feedback")>();
  return {
    ...modul,
    submitPlatformFeedback: vi.fn(),
    uploadFeedbackScreenshot: vi.fn(),
    fetchFeedbackThemen: vi.fn(),
  };
});
import {
  fetchFeedbackThemen,
  submitPlatformFeedback,
  uploadFeedbackScreenshot,
} from "../../lib/feedback";
import { FEEDBACK_SCREENSHOT_MAX_BYTES } from "../../lib/feedback";
import { FeedbackButton } from "./FeedbackButton";

const mockedSubmit = vi.mocked(submitPlatformFeedback);
const mockedUpload = vi.mocked(uploadFeedbackScreenshot);
const mockedThemen = vi.mocked(fetchFeedbackThemen);

const THEMEN = [
  { key: "generell", label: "Generell", sort: 1 },
  { key: "fehler", label: "Fehler / etwas geht nicht", sort: 2 },
];

/**
 * Eine Datei mit ECHTER Grösse. `new File([], …)` wäre 0 Byte gross, und die
 * Grössen-Zusage liefe gegen eine Datei, die die Grenze nie reissen kann.
 */
function bilddatei(name: string, typ: string, bytes: number): File {
  return new File([new Uint8Array(bytes)], name, { type: typ });
}

beforeEach(() => {
  mockedSubmit.mockReset();
  mockedSubmit.mockResolvedValue();
  mockedUpload.mockReset();
  mockedUpload.mockResolvedValue("u1/1.png");
  mockedThemen.mockReset();
  mockedThemen.mockResolvedValue(THEMEN);
});

function renderAt(
  route: string,
  optionen: { collapsed?: boolean } = {},
  user: AuthContextValue["user"] | null = { id: "u1" } as AuthContextValue["user"],
) {
  const value = fakeAuthValue({ user, tier: "basic", levelRank: 1 });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <AuthFixture value={value}>
          <ToastProvider>
            <FeedbackButton collapsed={optionen.collapsed} />
          </ToastProvider>
        </AuthFixture>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("FeedbackButton", () => {
  it("bleibt für nicht eingeloggte Besucher unsichtbar — sie können ohnehin nicht speichern", () => {
    renderAt("/", {}, null);
    expect(screen.queryByRole("button", { name: /feedback/i })).toBeNull();
  });

  it("sperrt das Absenden, solange keine Sterne gewählt sind", () => {
    renderAt("/");
    fireEvent.click(screen.getByRole("button", { name: /feedback/i }));
    expect(screen.getByRole("button", { name: /absenden/i })).toBeDisabled();
  });

  it("schickt Sterne, Texte und die aktuelle Route", async () => {
    renderAt("/meine-chancen");
    fireEvent.click(screen.getByRole("button", { name: /feedback/i }));
    // Auf die Themen WARTEN. Ohne das stünde die Vorbelegung noch nicht, und
    // die Zusage unten misst genau sie — ein Absenden davor ist ein eigener
    // Fall und steht in „laesst das Absenden zu, wenn die Themenliste NICHT
    // laedt".
    await screen.findByLabelText(/worum geht es/i);
    fireEvent.click(screen.getByRole("radio", { name: "4 von 5 Sternen" }));
    fireEvent.change(screen.getByLabelText(/was gefällt dir/i), {
      target: { value: "Der Compass" },
    });
    fireEvent.change(screen.getByLabelText(/was fehlt dir/i), { target: { value: "Nichts" } });
    fireEvent.change(screen.getByLabelText(/welche idee/i), { target: { value: "Mehr Events" } });
    fireEvent.click(screen.getByRole("button", { name: /absenden/i }));

    await waitFor(() =>
      expect(mockedSubmit).toHaveBeenCalledWith({
        profileId: "u1",
        rating: 4,
        likes: "Der Compass",
        misses: "Nichts",
        idea: "Mehr Events",
        route: "/meine-chancen",
        // Vorbelegt ist das ERSTE Thema nach `sort` — nicht ein hier
        // hingeschriebenes „generell" (AGE-628).
        theme: "generell",
        // Ohne gewähltes Bild geht `null` mit, nicht `undefined`: die
        // Datenschicht lässt die Spalte dann weg.
        screenshotPath: null,
      }),
    );
  });

  it("zeigt einen Fehler an, statt ihn verschwinden zu lassen", async () => {
    mockedSubmit.mockRejectedValue(new Error("kaputt"));
    renderAt("/");
    fireEvent.click(screen.getByRole("button", { name: /feedback/i }));
    fireEvent.click(screen.getByRole("radio", { name: "5 von 5 Sternen" }));
    fireEvent.click(screen.getByRole("button", { name: /absenden/i }));

    expect(await screen.findByText(/konnte nicht gespeichert werden/i)).toBeInTheDocument();
  });

  // ── Overlay-Hygiene (AGE-529) ────────────────────────────────────────────

  it("sperrt die Seite dahinter und hält den Fokus im Panel", () => {
    // Anschluss 3 von 4 an `useOverlay`. Der Fokusumlauf steht neben der
    // Body-Sperre, weil die Sperre allein auch dann grün wäre, wenn der Ref nie
    // am Container hinge.
    renderAt("/");
    fireEvent.click(screen.getByRole("button", { name: /feedback/i }));

    expect(document.body.style.position).toBe("fixed");

    const dialog = screen.getByRole("dialog");
    // Dieselbe Menge, die der Hook sieht — NICHT `getAllByRole("button")`: die
    // Sterne tragen `role="radio"` und fielen dort heraus, der CSS-Selektor des
    // Hooks kennt sie aber. Die erste Fassung dieses Tests scheiterte genau
    // daran, und der Hook hatte recht.
    const knoten = Array.from(dialog.querySelectorAll<HTMLElement>("button, textarea"));
    knoten[knoten.length - 1].focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(knoten[0]);

    fireEvent.click(within(dialog).getByRole("button", { name: /abbrechen/i }));
    expect(document.body.style.position).toBe("");
  });

  it("schwebt GAR NICHT MEHR — er steht in der Seitenleiste", () => {
    // Vorgeschichte in zwei Stufen: AGE-528 mass auf 375×812, dass der feste
    // Knopf über der Kachel „Frage" lag, und band das Schweben an `sm`.
    // AGE-566 traf dieselbe Kollision auf dem Desktop, über „Mitglieder
    // entdecken" — zweimal dasselbe Muster ist kein Zufall. Jetzt sitzt er im
    // Fluss der Seitenleiste und kann nichts mehr verdecken.
    //
    // Die Zusicherung ist bewusst SCHWACH und sagt das auch: jsdom hat kein
    // Layout. Geprüft wird, dass KEINE Variante von `fixed` mehr am Auslöser
    // hängt — das ist die Eigenschaft, die die Kollision überhaupt erlaubte.
    renderAt("/");
    const knopf = screen.getByRole("button", { name: /feedback/i });
    const klassen = knopf.className.split(/\s+/);

    expect(klassen.filter((k) => k.endsWith("fixed"))).toEqual([]);
  });

  it("zeigt eingeklappt nur das Symbol, mit zugänglichem Namen", () => {
    // In der schmalen Leiste trägt das Icon allein — der Name muss dann über
    // `aria-label` kommen, sonst heisst der Knopf für einen Screenreader nichts.
    renderAt("/", { collapsed: true });
    const knopf = screen.getByRole("button", { name: "Feedback" });

    expect(knopf).toHaveAttribute("aria-label", "Feedback");
    expect(knopf.textContent).toBe("");
  });
});

describe("Thema (AGE-628, 7.1)", () => {
  it("bietet die Themen aus der DATENBANK an, in ihrer Reihenfolge", async () => {
    renderAt("/");
    fireEvent.click(screen.getByRole("button", { name: /feedback/i }));

    const auswahl = await screen.findByLabelText(/worum geht es/i);
    const beschriftungen = within(auswahl)
      .getAllByRole("option")
      .map((o) => o.textContent);
    // Weder Schluessel noch Beschriftung stehen im Bauteil — stuenden sie,
    // gaebe es die Liste zweimal und nichts verglichen die Abschriften.
    expect(beschriftungen).toEqual(["Generell", "Fehler / etwas geht nicht"]);
  });

  it("ist mit dem ERSTEN Thema vorbelegt, nicht mit einem Literal im Bauteil", async () => {
    // Die Reihenfolge steht in `feedback_themes.sort`, und die erste Zeile IST
    // „Generell". Diese Fixture dreht sie deshalb um: waere „generell" im
    // Bauteil hingeschrieben, bliebe die Zusage gruen.
    mockedThemen.mockResolvedValue([
      { key: "fehler", label: "Fehler / etwas geht nicht", sort: 1 },
      { key: "generell", label: "Generell", sort: 2 },
    ]);
    renderAt("/");
    fireEvent.click(screen.getByRole("button", { name: /feedback/i }));

    const auswahl = (await screen.findByLabelText(/worum geht es/i)) as HTMLSelectElement;
    expect(auswahl.value).toBe("fehler");
  });

  it("schickt das GEWAEHLTE Thema mit", async () => {
    renderAt("/");
    fireEvent.click(screen.getByRole("button", { name: /feedback/i }));
    const auswahl = await screen.findByLabelText(/worum geht es/i);
    fireEvent.change(auswahl, { target: { value: "fehler" } });
    fireEvent.click(screen.getByRole("radio", { name: "3 von 5 Sternen" }));
    fireEvent.click(screen.getByRole("button", { name: /absenden/i }));

    await waitFor(() =>
      expect(mockedSubmit).toHaveBeenCalledWith(expect.objectContaining({ theme: "fehler" })),
    );
  });

  it("laesst das Absenden zu, wenn die Themenliste NICHT laedt", async () => {
    // Dann traegt die Zeile den dauerhaften Vorgabewert der Spalte. Ein
    // Auswahlfeld ohne Eintraege saehe dagegen aus wie ein Fehler, und ein
    // gesperrtes Absenden waere einer.
    mockedThemen.mockRejectedValue(new Error("keine Themen"));
    renderAt("/");
    fireEvent.click(screen.getByRole("button", { name: /feedback/i }));
    fireEvent.click(screen.getByRole("radio", { name: "5 von 5 Sternen" }));

    expect(screen.queryByLabelText(/worum geht es/i)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /absenden/i }));

    await waitFor(() =>
      expect(mockedSubmit).toHaveBeenCalledWith(expect.objectContaining({ theme: undefined })),
    );
  });
});

describe("Screenshot (AGE-628, 7.2)", () => {
  function waehleBild(datei: File) {
    const feld = screen.getByLabelText(/screenshot auswählen/i) as HTMLInputElement;
    fireEvent.change(feld, { target: { files: [datei] } });
  }

  it("laedt das Bild HOCH und schickt den Pfad mit — in dieser Reihenfolge", async () => {
    renderAt("/");
    fireEvent.click(screen.getByRole("button", { name: /feedback/i }));
    waehleBild(bilddatei("schuss.png", "image/png", 100));
    fireEvent.click(screen.getByRole("radio", { name: "2 von 5 Sternen" }));
    fireEvent.click(screen.getByRole("button", { name: /absenden/i }));

    await waitFor(() => expect(mockedUpload).toHaveBeenCalled());
    expect(mockedSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ screenshotPath: "u1/1.png" }),
    );
  });

  it("schreibt KEINE Zeile, wenn das Hochladen scheitert", async () => {
    // Sonst stuende eine Feedback-Zeile ohne ihr Bild da, und niemand wuesste,
    // dass eines gemeint war.
    mockedUpload.mockRejectedValue(new Error("kaputt"));
    renderAt("/");
    fireEvent.click(screen.getByRole("button", { name: /feedback/i }));
    waehleBild(bilddatei("schuss.png", "image/png", 100));
    fireEvent.click(screen.getByRole("radio", { name: "2 von 5 Sternen" }));
    fireEvent.click(screen.getByRole("button", { name: /absenden/i }));

    await screen.findByText(/konnte nicht gespeichert werden/i);
    expect(mockedSubmit).not.toHaveBeenCalled();
  });

  it("weist ein falsches Format ab, bevor es hochlaedt — die Grenze ist der Bucket", async () => {
    renderAt("/");
    fireEvent.click(screen.getByRole("button", { name: /feedback/i }));
    waehleBild(bilddatei("bild.gif", "image/gif", 100));

    expect(await screen.findByText(/PNG, JPEG oder WebP/i)).toBeInTheDocument();
    expect(screen.queryByText("bild.gif")).toBeNull();
  });

  it("weist ein zu grosses Bild ab — dieselbe Grenze wie am Bucket", async () => {
    renderAt("/");
    fireEvent.click(screen.getByRole("button", { name: /feedback/i }));
    waehleBild(bilddatei("gross.png", "image/png", FEEDBACK_SCREENSHOT_MAX_BYTES + 1));

    expect(await screen.findByText(/grösser als 5 MB/i)).toBeInTheDocument();
  });

  it("laesst sich wieder entfernen", async () => {
    renderAt("/");
    fireEvent.click(screen.getByRole("button", { name: /feedback/i }));
    waehleBild(bilddatei("schuss.png", "image/png", 100));
    expect(await screen.findByText("schuss.png")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /bild entfernen/i }));

    expect(screen.queryByText("schuss.png")).toBeNull();
  });

  it("bleibt optional: ohne Bild wird gar nicht hochgeladen", async () => {
    renderAt("/");
    fireEvent.click(screen.getByRole("button", { name: /feedback/i }));
    fireEvent.click(screen.getByRole("radio", { name: "4 von 5 Sternen" }));
    fireEvent.click(screen.getByRole("button", { name: /absenden/i }));

    await waitFor(() => expect(mockedSubmit).toHaveBeenCalled());
    expect(mockedUpload).not.toHaveBeenCalled();
  });
});

describe("Was der Umbau NICHT verändert haben darf (AGE-628, 7.3)", () => {
  it("sperrt das Absenden weiterhin ohne Sterne — auch mit Thema und Bild", async () => {
    renderAt("/");
    fireEvent.click(screen.getByRole("button", { name: /feedback/i }));
    await screen.findByLabelText(/worum geht es/i);
    const feld = screen.getByLabelText(/screenshot auswählen/i) as HTMLInputElement;
    fireEvent.change(feld, { target: { files: [bilddatei("s.png", "image/png", 10)] } });

    expect(screen.getByRole("button", { name: /absenden/i })).toBeDisabled();
  });

  it("das Panel WAECHST nicht ueber den Bildschirm hinaus, es scrollt", async () => {
    // Der Umbau macht das Formular hoeher. Die Deckelung steht am Panel und
    // nicht am Inhalt; jsdom rechnet keine Layouts, gemessen wird deshalb die
    // Zusage selbst — die Klassen, die sie tragen.
    renderAt("/");
    fireEvent.click(screen.getByRole("button", { name: /feedback/i }));
    const panel = (await screen.findByLabelText(/worum geht es/i)).closest("div.overflow-y-auto");

    expect(panel).not.toBeNull();
    expect(panel?.className).toContain("max-h-[90vh]");
  });
});
