import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Die Feedback-Fläche der Verwaltung (AGE-587, Abschnitt 5).
 *
 * Sie löst die alte `AdminFeedbackCard` auf `/admin` ab. Die Karte holte ALLES
 * auf einmal — sie war die letzte listende Fläche ohne Blätterung.
 *
 * Gemockt wird ausschliesslich die SUPABASE-GRENZE, nicht `lib/feedback` und
 * nicht die Seite selbst. Sonst prüfte der Test seine eigenen Mocks; die
 * interessanten Aussagen sind, WELCHE Argumente die Bedienung erzeugt und was
 * die Fläche aus den Antworten macht.
 */
const rpc = vi.fn();
const themen = vi.fn();
const createSignedUrl = vi.fn();
const removeObjekte = vi.fn();

vi.mock("../lib/supabase", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpc(...args),
    // `feedback_themes` ist die EINZIGE Tabelle, die diese Fläche direkt liest
    // — die Themenliste ist ein Nachschlagewerk und keine Sicht auf Feedback.
    // Jeder andere Tabellenzugriff bleibt ein Fehler, damit die Fläche nicht
    // heimlich an `feedback` vorbei an die RPC vorbeiliest.
    from: (name: string) => {
      if (name !== "feedback_themes") {
        throw new Error(`Kein direkter Tabellenzugriff in der Feedback-Sicht: ${name}`);
      }
      return { select: () => ({ order: () => themen() }) };
    },
    storage: {
      from: () => ({
        createSignedUrl: (pfad: string, sek: number) => createSignedUrl(pfad, sek),
        remove: (pfade: string[]) => removeObjekte(pfade),
      }),
    },
  },
}));

import AdminFeedbackPage from "./AdminFeedbackPage";
import { FEEDBACK_SEITENGROESSE } from "../lib/feedback";
import { AuthFixture, fakeAuthValue } from "../test/auth-fixtures";
import type { AuthContextValue } from "../providers/auth-context";
import { ToastProvider } from "../components/ui/Toast";

const THEMEN = [
  { key: "generell", label: "Generell", sort: 1 },
  { key: "fehler", label: "Fehler / etwas geht nicht", sort: 2 },
];

function zeile(overrides: Record<string, unknown> = {}) {
  return {
    id: crypto.randomUUID(),
    rating: 4,
    likes: "Der Compass ist klar",
    misses: null,
    idea: null,
    route: "/compass",
    ref_type: null,
    created_at: "2026-07-16T10:00:00Z",
    author_name: "Anna Müller",
    profile_id: "u1",
    theme: "generell",
    screenshot_path: null,
    author_aktiv: true,
    ...overrides,
  };
}

/** Wer schaut zu? Vorgabe ist ein Admin, der NICHT der Verfasser ist. */
function renderPage(eigeneId = "admin-1") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const value = fakeAuthValue({
    user: { id: eigeneId } as AuthContextValue["user"],
    tier: "impact",
    levelRank: 6,
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AuthFixture value={value}>
          <ToastProvider>
            <AdminFeedbackPage />
          </ToastProvider>
        </AuthFixture>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Die zuletzt an `admin_list_feedback` übergebenen Argumente. */
function lastArgs(): Record<string, unknown> {
  return (rpc.mock.calls.at(-1)?.[1] ?? {}) as Record<string, unknown>;
}

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({ data: [zeile()], error: null });
  themen.mockReset();
  themen.mockResolvedValue({ data: THEMEN, error: null });
  createSignedUrl.mockReset();
  createSignedUrl.mockResolvedValue({ data: { signedUrl: "https://x/bild" }, error: null });
  removeObjekte.mockReset();
  removeObjekte.mockResolvedValue({ error: null });
});

describe("Die Feedback-Seite zeigt, was die Karte zeigte (5.1)", () => {
  it("zeigt Sterne, die drei Texte, Datum, Verfasser und Pfad", async () => {
    rpc.mockResolvedValue({
      data: [
        zeile({
          rating: 3,
          likes: "Der Compass ist klar",
          misses: "Eine Suche fehlt",
          idea: "Mehr Events",
          route: "/compass",
          author_name: "Anna Müller",
        }),
      ],
      error: null,
    });

    renderPage();

    expect(await screen.findByText("Der Compass ist klar")).toBeInTheDocument();
    expect(screen.getByText("Eine Suche fehlt")).toBeInTheDocument();
    expect(screen.getByText("Mehr Events")).toBeInTheDocument();
    // Die Sterne tragen eine Textfassung — die Zeichen allein wären für eine
    // Vorleseausgabe stumm.
    expect(screen.getByText("3 von 5 Sternen")).toBeInTheDocument();
    expect(screen.getByText("16.07.2026")).toBeInTheDocument();
    expect(screen.getByText(/Anna Müller/)).toBeInTheDocument();
    expect(screen.getByText(/\/compass/)).toBeInTheDocument();
  });

  it("liest über die RPC und fordert eine Zeile mehr an, als sie zeigt", async () => {
    renderPage();
    await screen.findByText("Der Compass ist klar");

    expect(rpc.mock.calls[0][0]).toBe("admin_list_feedback");
    // Ohne gesetzten Filter gehen BEIDE Facetten als `null` hinüber, nicht als
    // `[]` (AGE-628): `spalte = any('{}')` ist in PostgreSQL false, ein leeres
    // Array liesse die ungefilterte Seite leer.
    expect(lastArgs()).toEqual({
      p_limit: FEEDBACK_SEITENGROESSE + 1,
      p_offset: 0,
      p_themes: null,
      p_ratings: null,
    });
  });
});

describe("Blättern wie in der Mitgliederliste (5.1)", () => {
  it("holt beim Weiterblättern die nächste Seite — an der Datenbank, nicht im Browser", async () => {
    const seite1 = Array.from({ length: FEEDBACK_SEITENGROESSE + 1 }, (_, i) =>
      zeile({ likes: `Erste ${i}` }),
    );
    rpc.mockResolvedValueOnce({ data: seite1, error: null });
    rpc.mockResolvedValueOnce({ data: [zeile({ likes: "Zweite Seite" })], error: null });

    renderPage();
    await screen.findByText("Erste 0");

    fireEvent.click(screen.getByRole("button", { name: /Weiter/i }));

    await screen.findByText("Zweite Seite");
    expect(lastArgs().p_offset).toBe(FEEDBACK_SEITENGROESSE);
    // Die Zusatzzeile wird angefordert, aber NICHT angezeigt.
    expect(screen.queryByText(`Erste ${FEEDBACK_SEITENGROESSE}`)).not.toBeInTheDocument();
  });

  it("bietet auf der ersten Seite keinen Weg zurück", async () => {
    renderPage();
    await screen.findByText("Der Compass ist klar");

    expect(screen.getByRole("button", { name: /Zurück/i })).toBeDisabled();
  });
});

describe("Ein Fehler sieht nicht aus wie Leere (5.6)", () => {
  /**
   * Der Leerzustand behauptet „es gibt kein Feedback". Ein gescheiterter Aufruf
   * weiss das gerade nicht — und in dieser Fläche hat „leer" ohnehin schon eine
   * zweite Ursache (ein Nicht-Admin bekommt null Zeilen). Eine dritte, stumme
   * braucht es nicht.
   */
  it("zeigt bei einem Fehler eine Fehlermeldung und NICHT den Leerzustand", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });

    renderPage();

    expect(await screen.findByText(/konnte nicht geladen werden/i)).toBeInTheDocument();
    expect(screen.queryByText(/Noch kein Feedback/i)).not.toBeInTheDocument();
  });

  it("zeigt den Leerzustand nur, wenn die Antwort wirklich leer ist", async () => {
    rpc.mockResolvedValue({ data: [], error: null });

    renderPage();

    expect(await screen.findByText(/Noch kein Feedback/i)).toBeInTheDocument();
    expect(screen.queryByText(/konnte nicht geladen werden/i)).not.toBeInTheDocument();
  });
});

describe("Jede Zeile führt zu ihrem Verfasser", () => {
  /**
   * `profile_id` ist der Grund, warum die RPC sie überhaupt herausgibt: die
   * Zeile soll verknüpfbar sein und nicht nur lesbar. Ohne diese Zusage wäre
   * die Spalte eine Zusage ohne Leser.
   */
  it("verlinkt den Verfasser auf sein Profil", async () => {
    rpc.mockResolvedValue({
      data: [zeile({ author_name: "Anna Müller", profile_id: "u7" })],
      error: null,
    });

    renderPage();

    const link = await screen.findByRole("link", { name: /Anna Müller/ });
    expect(link).toHaveAttribute("href", "/admin/mitglied/u7");
  });
});

describe("Filtern (AGE-628, 8.2/8.3)", () => {
  it("bietet die Themen aus der DATENBANK als Kaestchen an", async () => {
    renderPage();
    await screen.findByText("Der Compass ist klar");

    // Weder Schluessel noch Beschriftung stehen in der Seite.
    expect(
      await screen.findByRole("checkbox", { name: "Fehler / etwas geht nicht" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Generell" })).toBeInTheDocument();
  });

  it("schickt eine gewaehlte Marke als Array, die leere Facette als null", async () => {
    renderPage();
    await screen.findByText("Der Compass ist klar");
    fireEvent.click(await screen.findByRole("checkbox", { name: "Fehler / etwas geht nicht" }));

    await waitFor(() => expect(lastArgs().p_themes).toEqual(["fehler"]));
    expect(lastArgs().p_ratings).toBeNull();
  });

  it("kombiniert zwei Marken derselben Facette", async () => {
    renderPage();
    await screen.findByText("Der Compass ist klar");
    fireEvent.click(await screen.findByRole("checkbox", { name: "Generell" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Fehler / etwas geht nicht" }));

    await waitFor(() => expect(lastArgs().p_themes).toEqual(["generell", "fehler"]));
  });

  it("nimmt eine Marke auch wieder weg — und schickt dann wieder null", async () => {
    // Ohne diese Zusage bliebe offen, ob „abwaehlen" auf `[]` zurueckfaellt.
    // `[]` waere fatal: `= any('{}')` ist false, die Liste bliebe leer.
    renderPage();
    await screen.findByText("Der Compass ist klar");
    const kaestchen = await screen.findByRole("checkbox", { name: "Generell" });
    fireEvent.click(kaestchen);
    await waitFor(() => expect(lastArgs().p_themes).toEqual(["generell"]));

    fireEvent.click(kaestchen);

    await waitFor(() => expect(lastArgs().p_themes).toBeNull());
  });

  it("filtert auch nach Bewertung", async () => {
    renderPage();
    await screen.findByText("Der Compass ist klar");
    fireEvent.click(await screen.findByRole("checkbox", { name: "3 Sterne" }));

    await waitFor(() => expect(lastArgs().p_ratings).toEqual([3]));
  });

  it("springt beim Filterwechsel auf Seite 1 zurueck (6.4)", async () => {
    // Der Fall, der sonst wie ein leerer Bestand aussieht: jemand steht auf
    // Seite 2, engt ein — und die Auswahl hat zwei Treffer auf Seite 1.
    rpc.mockResolvedValue({
      data: Array.from({ length: FEEDBACK_SEITENGROESSE + 1 }, () => zeile()),
      error: null,
    });
    renderPage();
    await screen.findAllByText("Der Compass ist klar");
    fireEvent.click(screen.getByRole("button", { name: /weiter/i }));
    await waitFor(() => expect(lastArgs().p_offset).toBe(FEEDBACK_SEITENGROESSE));

    fireEvent.click(await screen.findByRole("checkbox", { name: "Generell" }));

    await waitFor(() => expect(lastArgs().p_offset).toBe(0));
  });

  it("unterscheidet den gefilterten Leerzustand vom ungefilterten", async () => {
    renderPage();
    await screen.findByText("Der Compass ist klar");
    rpc.mockResolvedValue({ data: [], error: null });
    fireEvent.click(await screen.findByRole("checkbox", { name: "Generell" }));

    expect(await screen.findByText(/zu dieser auswahl liegt nichts vor/i)).toBeInTheDocument();
    expect(screen.queryByText(/noch kein feedback/i)).toBeNull();
  });

  it("… und sagt ohne Filter weiterhin: noch kein Feedback", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    renderPage();

    expect(await screen.findByText(/noch kein feedback/i)).toBeInTheDocument();
  });
});

describe("Screenshot in der Verwaltung (AGE-628, 8.4)", () => {
  it("signiert das Bild ERST beim Anzeigen — eine Zeile ohne Bild signiert nichts", async () => {
    renderPage();
    await screen.findByText("Der Compass ist klar");

    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it("zeigt das Bild ueber die signierte URL", async () => {
    rpc.mockResolvedValue({ data: [zeile({ screenshot_path: "u1/1.png" })], error: null });
    renderPage();

    const bild = await screen.findByAltText(/screenshot/i);
    expect(bild).toHaveAttribute("src", "https://x/bild");
    expect(createSignedUrl).toHaveBeenCalledWith("u1/1.png", expect.any(Number));
  });

  it("entfernt Zeile UND Objekt — ueber die RPC, mit der Feedback-Kennung", async () => {
    rpc.mockImplementation((name: string) =>
      name === "admin_feedback_bild_loeschen"
        ? Promise.resolve({ data: "u1/1.png", error: null })
        : Promise.resolve({ data: [zeile({ id: "f7", screenshot_path: "u1/1.png" })], error: null }),
    );
    renderPage();
    await screen.findByAltText(/screenshot/i);

    fireEvent.click(screen.getByRole("button", { name: /bild entfernen/i }));

    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith("admin_feedback_bild_loeschen", { p_feedback_id: "f7" }),
    );
    expect(removeObjekte).toHaveBeenCalledWith(["u1/1.png"]);
  });

  it("bietet den Loeschknopf nur an, wo es ein Bild gibt", async () => {
    renderPage();
    await screen.findByText("Der Compass ist klar");

    expect(screen.queryByRole("button", { name: /bild entfernen/i })).toBeNull();
  });
});

describe("Gespraech eroeffnen (AGE-628, 8.5/8.6)", () => {
  it("ruft den Oeffnungs-Weg mit der profile_id und springt in den Faden", async () => {
    rpc.mockImplementation((name: string) =>
      name === "admin_gespraech_oeffnen"
        ? Promise.resolve({ data: "t-42", error: null })
        : Promise.resolve({ data: [zeile({ profile_id: "u9" })], error: null }),
    );
    renderPage();
    await screen.findByText("Der Compass ist klar");

    fireEvent.click(screen.getByRole("button", { name: /gespräch öffnen/i }));

    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith("admin_gespraech_oeffnen", { p_ziel: "u9" }),
    );
  });

  it("landet beim RICHTIGEN von zwei gleichnamigen Mitgliedern (8.7)", async () => {
    // Der Name ist keine Kennung. Zwei Zeilen mit demselben `author_name` und
    // verschiedenen `profile_id` — der Sprung muss der Kennung folgen, nicht
    // dem Text.
    rpc.mockImplementation((name: string) =>
      name === "admin_gespraech_oeffnen"
        ? Promise.resolve({ data: "t-1", error: null })
        : Promise.resolve({
            data: [
              zeile({ id: "f1", likes: "Erste Meldung", author_name: "Anna Müller", profile_id: "u-eins" }),
              zeile({ id: "f2", likes: "Zweite Meldung", author_name: "Anna Müller", profile_id: "u-zwei" }),
            ],
            error: null,
          }),
    );
    renderPage();
    const zweite = (await screen.findByText("Zweite Meldung")).closest("li");
    expect(zweite).not.toBeNull();

    fireEvent.click(within(zweite!).getByRole("button", { name: /gespräch öffnen/i }));

    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith("admin_gespraech_oeffnen", { p_ziel: "u-zwei" }),
    );
  });

  it("verlinkt gleichnamige Verfasser ebenfalls auf IHR jeweiliges Profil", async () => {
    rpc.mockResolvedValue({
      data: [
        zeile({ likes: "Erste Meldung", author_name: "Anna Müller", profile_id: "u-eins" }),
        zeile({ likes: "Zweite Meldung", author_name: "Anna Müller", profile_id: "u-zwei" }),
      ],
      error: null,
    });
    renderPage();
    await screen.findByText("Zweite Meldung");

    const ziele = screen
      .getAllByRole("link", { name: "Anna Müller" })
      .map((a) => a.getAttribute("href"));
    expect(ziele).toEqual(["/admin/mitglied/u-eins", "/admin/mitglied/u-zwei"]);
  });

  it("bietet am EIGENEN Feedback kein Gespraech an — und sagt warum", async () => {
    rpc.mockResolvedValue({ data: [zeile({ profile_id: "admin-1" })], error: null });
    renderPage("admin-1");
    await screen.findByText("Der Compass ist klar");

    expect(screen.queryByRole("button", { name: /gespräch öffnen/i })).toBeNull();
    expect(screen.getByText(/deine eigene rückmeldung/i)).toBeInTheDocument();
  });

  it("bietet bei einem Verfasser OHNE Zugang kein Gespraech an — und sagt warum", async () => {
    // Der Faden liesse sich anlegen, aber nur der Admin koennte darin
    // schreiben: die Gegenseite scheitert an `is_activated()`. Ein Knopf, der
    // nur scheitern kann, ist ein Versprechen ins Leere.
    rpc.mockResolvedValue({ data: [zeile({ author_aktiv: false })], error: null });
    renderPage();
    await screen.findByText("Der Compass ist klar");

    expect(screen.queryByRole("button", { name: /gespräch öffnen/i })).toBeNull();
    expect(screen.getByText(/keinen zugang mehr/i)).toBeInTheDocument();
  });
});
