import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import MitgliedschaftPage from "./MitgliedschaftPage";
import { ToastProvider } from "../components/ui";

const invoke = vi.fn();
vi.mock("../lib/supabase", () => ({
  supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } },
}));
// Veränderlich, weil eine der Zusagen von der Stufe des Betrachters abhängt:
// wer schon `impact` trägt, bekommt gar keine Preise zu sehen.
let auth: { tier: string; levelRank: number } = { tier: "discover", levelRank: 3 };
vi.mock("../providers/auth-context", () => ({
  useAuth: () => auth,
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <MitgliedschaftPage />
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe("MitgliedschaftPage", () => {
  beforeEach(() => {
    invoke.mockReset();
    invoke.mockResolvedValue({ data: { url: "https://stripe.test/x" }, error: null });
    auth = { tier: "discover", levelRank: 4 };
  });

  it("zeigt alle 6 Stufen als Karten", () => {
    renderPage();
    for (const key of ["active", "boost", "connect", "discover", "focus", "impact"])
      expect(screen.getByTestId(`level-${key}`)).toBeInTheDocument();
  });

  it("zeigt das 'Deine Mitgliedschaft'-Panel mit der aktuellen Stufe", () => {
    renderPage();
    expect(screen.getByText("Deine Mitgliedschaft")).toBeInTheDocument();
    // 'Discover' erscheint jetzt im Panel UND auf der Karte → mehrfach.
    expect(screen.getAllByText("Discover").length).toBeGreaterThanOrEqual(2);
  });

  it("markiert Discover als Empfohlen", () => {
    renderPage();
    expect(within(screen.getByTestId("level-discover")).getByText("Empfohlen")).toBeInTheDocument();
  });

  it("markiert die aktuelle Stufe und bietet nur höhere zahlende Stufen zum Upgrade", () => {
    renderPage();
    expect(screen.getByTestId("level-discover")).toHaveAttribute("data-current", "true");
    // Höher + zahlend → Button. Über `discover` (Rang 4) liegen nur noch FOCUS
    // und IMPACT; `exchange` gab es bis AGE-903 und stand dazwischen.
    expect(
      within(screen.getByTestId("level-focus")).getByRole("button", { name: /upgrade/i }),
    ).toBeEnabled();
    // Aktuell/niedriger → kein Upgrade-Button
    expect(
      within(screen.getByTestId("level-discover")).queryByRole("button", { name: /upgrade/i }),
    ).toBeNull();
    expect(
      within(screen.getByTestId("level-connect")).queryByRole("button", { name: /upgrade/i }),
    ).toBeNull();
  });

  // AGE-903 — die Stufen ausserhalb des Clubs tragen 0 € und KEINEN Kaufweg.
  // `PAID` nennt seit AGE-903 nur die drei Clubstufen; ein Kaufknopf an einer
  // Stufe ohne Funktion wäre ein Angebot ohne Gegenstand. Die Karte bleibt
  // sichtbar — sie erklärt die Leiter —, nur der Knopf fehlt.
  it("bietet für die drei Stufen ausserhalb des Clubs keinen Kaufweg", () => {
    renderPage();
    for (const key of ["active", "boost", "connect"]) {
      const karte = screen.getByTestId(`level-${key}`);
      expect(karte).toBeInTheDocument();
      expect(within(karte).queryByRole("button", { name: /upgrade/i })).toBeNull();
      expect(within(karte).queryByRole("link", { name: /upgrade/i })).toBeNull();
    }
  });

  it("zeigt den Testzahlung-Hinweis", () => {
    renderPage();
    expect(screen.getAllByText(/Testzahlung · Demo/i).length).toBeGreaterThan(0);
  });

  it("schaltet mit dem Jahr/Monat-Toggle die Beträge", () => {
    renderPage();
    // 600/60 statt 300/30: gemessen wird an FOCUS, weil der Monatsbetrag von
    // `discover` (30) eine Teilzeichenfolge seines Jahresbetrags (300) ist —
    // `getByText(/30/)` träfe dort in BEIDEN Stellungen und die Zusage wäre
    // grün, ohne den Umschalter je gefragt zu haben.
    expect(within(screen.getByTestId("level-focus")).getByText(/600/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /monatlich/i }));
    expect(within(screen.getByTestId("level-focus")).getByText(/60/)).toBeInTheDocument();
  });

  it("ruft create-checkout-session mit level + interval", () => {
    renderPage();
    fireEvent.click(
      within(screen.getByTestId("level-focus")).getByRole("button", { name: /upgrade/i }),
    );
    expect(invoke).toHaveBeenCalledWith("create-checkout-session", {
      body: { level: "focus", interval: "year" },
    });
  });

  it("zeigt einen Fehler-Toast und navigiert nicht, wenn der Checkout-Start fehlschlägt", async () => {
    invoke.mockResolvedValue({ data: null, error: { message: "boom" } });
    const assign = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      value: { ...originalLocation, assign },
      writable: true,
      configurable: true,
    });
    renderPage();
    fireEvent.click(
      within(screen.getByTestId("level-focus")).getByRole("button", { name: /upgrade/i }),
    );
    await waitFor(() =>
      expect(screen.getByText(/Upgrade konnte nicht gestartet werden/i)).toBeInTheDocument(),
    );
    expect(assign).not.toHaveBeenCalled();
    Object.defineProperty(window, "location", {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  });

  describe("Wer schon impact trägt", () => {
    // Der WP-Import legt jedes übernommene Mitglied auf `impact` an. Eine
    // Preistabelle mit vier zahlenden Stufen, von denen keine für es gilt, ist
    // für diesen Kreis keine Information, sondern eine Aufforderung ins Leere.
    beforeEach(() => {
      auth = { tier: "impact", levelRank: 6 };
    });

    it("sieht keine einzige Preiskarte", () => {
      renderPage();
      for (const key of ["active", "connect", "discover", "discover", "focus", "impact"])
        expect(screen.queryByTestId(`level-${key}`)).not.toBeInTheDocument();
    });

    it("sieht auch den Jahr/Monat-Schalter nicht", () => {
      // Der Schalter ohne Karten wäre ein Bedienelement ohne Wirkung.
      renderPage();
      expect(screen.queryByRole("button", { name: "Jährlich" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Monatlich" })).not.toBeInTheDocument();
    });

    it("sieht weiterhin die eigene Mitgliedschaft", () => {
      // Die Positivkontrolle zur Verneinung: die Seite ist nicht leer, sie
      // beantwortet nur eine andere Frage — „was habe ich?" statt „was kostet was?".
      renderPage();
      expect(screen.getByText("Deine Mitgliedschaft")).toBeInTheDocument();
    });
  });
});
