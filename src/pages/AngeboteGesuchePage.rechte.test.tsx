import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "../components/ui/Toast";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AngeboteGesucheEditor } from "./AngeboteGesuchePage";
import { fetchMatchingProfile, type MatchingProfileValues } from "../lib/matching-profile";
import type { Berechtigung } from "../config/berechtigungen";

/**
 * Der Suche-&-Biete-Editor hängt an `suche_biete` (AGE-1000).
 *
 * ══ WORUM ES HIER WIRKLICH GEHT ═══════════════════════════════════════════
 * Das ist die Oberflächenhälfte eines Befunds, der im Diff-Review als CRITICAL
 * kam: `saveMatchingProfile` löschte den Bestand, bevor es einfügte. Seit
 * AGE-1000 verlangt `offers_insert_own` das Recht `suche_biete`, der DELETE
 * aber nur Eigentum — ein DISCOVER-Konto, das hier einen Titel korrigiert und
 * speichert, verlor seine Angebote UND Gesuche endgültig, mit einem
 * Fehler-Toast als einzigem Hinweis.
 *
 * Behoben ist das an zwei Stellen, und beide braucht es:
 *  * `matching-profile.ts` fügt jetzt VOR dem Löschen ein — gemessen in
 *    `src/lib/matching-profile.test.ts`, inklusive „löscht GAR NICHT, wenn der
 *    Insert abgewiesen wird".
 *  * diese Seite bietet ohne das Recht kein Formular an — gemessen hier.
 *
 * Der Editor ist über `/kompass` erreichbar, und `/compass` sowie
 * `/angebote-gesuche` leiten für alte Lesezeichen dorthin. Ein In-App-Link
 * fehlt heute; die Route lebt trotzdem, und nach Entscheidung E2 (echte Stufen
 * des Bestands) wird DISCOVER der Normalfall statt der Ausnahme.
 */

vi.mock("../lib/matching-profile", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/matching-profile")>()),
  fetchMatchingProfile: vi.fn(),
  saveMatchingProfile: vi.fn(),
}));

vi.mock("../providers/auth-context", () => ({
  useAuth: () => ({ user: { id: "u-1" } }),
}));

let rechte: Berechtigung[] = [];
let laedt = false;
let fehler = false;
vi.mock("../hooks/useDarf", () => ({
  useMeineRechte: () => ({ rechte, laedt, fehler }),
  useDarf: (k: Berechtigung) => ({ darf: rechte.includes(k), laedt, fehler }),
}));

const BESTAND: MatchingProfileValues = {
  offers: [
    {
      category: "mentoring",
      theme: "sein",
      title: "Mentoring fuer Gruender",
      description: "",
      tags: [],
      source: "editor",
    },
  ],
  needs: [
    {
      category: "investoren",
      theme: "haben",
      title: "Investoren fuer Runde A",
      description: "",
      tags: [],
      tx_volume_band: "",
      source: "chip",
    },
  ],
};

function zeige(werte: MatchingProfileValues = BESTAND) {
  vi.mocked(fetchMatchingProfile).mockResolvedValue(werte);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter>
          <AngeboteGesucheEditor />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

// Mehrzahl, nicht Einzahl: das Formular traegt den Speichern-Knopf an zwei
// Stellen (Kopf und Fuss). `getByRole` waere hier „found multiple" und damit rot
// aus dem falschen Grund.
const speichernKnoepfe = () => screen.queryAllByRole("button", { name: /Speichern/ });
// Der Hinweis steht als UEBERSCHRIFT und noch einmal im Beschreibungstext —
// geprueft wird die Ueberschrift, damit die Zusage eindeutig bleibt.
const hinweis = () => screen.findByRole("heading", { name: /Such- & Bieteprofil ab Focus/ });

describe("Suche & Biete: der Editor hängt am Recht", () => {
  beforeEach(() => {
    rechte = [];
    laedt = false;
    fehler = false;
  });

  it("zeigt das Formular mit `suche_biete`", async () => {
    rechte = ["suche_biete"];
    zeige();
    await screen.findByDisplayValue("Mentoring fuer Gruender");
    expect(speichernKnoepfe().length).toBeGreaterThan(0);
  });

  it("zeigt ohne das Recht KEINEN Speichern-Knopf", async () => {
    rechte = [];
    zeige();
    // Auf den Hinweis warten, nicht auf die Abwesenheit des Knopfs: ein
    // `queryBy` auf dem noch nicht gerenderten Baum wäre immer null und damit
    // immer grün.
    expect(await hinweis()).toBeInTheDocument();
    expect(speichernKnoepfe()).toEqual([]);
  });

  it("nennt die Stufe und den Weg über Support, ohne Kaufknopf", async () => {
    rechte = [];
    zeige();
    expect(await hinweis()).toBeInTheDocument();
    expect(screen.getByText(/Support/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Upgrade|Kaufen|Buchen/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Upgrade|Kaufen|Buchen/ })).not.toBeInTheDocument();
  });

  it("zeigt den bestehenden Eintrag weiter — ein Abstieg löscht nichts", async () => {
    // Die wichtigste Zusage der Datei nach dem Knopf: der Bestand ist nicht
    // gelöscht, nur nicht mehr pflegbar. Ihn zu verschweigen wäre von „gelöscht"
    // nicht zu unterscheiden.
    rechte = [];
    zeige();
    expect(await screen.findByText("Mentoring fuer Gruender")).toBeInTheDocument();
    expect(screen.getByText("Investoren fuer Runde A")).toBeInTheDocument();
  });

  it("verspricht einem leeren Bestand nichts, was es nicht gibt", async () => {
    rechte = [];
    zeige({ offers: [], needs: [] });
    expect(await hinweis()).toBeInTheDocument();
    expect(screen.queryByText(/bisherigen Einträge/)).not.toBeInTheDocument();
  });

  it("zeigt bei einem gescheiterten Rechte-Abruf das Formular", async () => {
    // Der Zustand löst sich nicht von selbst auf; ein FOCUS-Konto verlöre
    // sonst den Editor, weil eine Abfrage schiefging. Gefahrlos, seit
    // `saveMatchingProfile` vor dem Löschen einfügt.
    rechte = [];
    fehler = true;
    zeige();
    await screen.findByDisplayValue("Mentoring fuer Gruender");
    expect(speichernKnoepfe().length).toBeGreaterThan(0);
  });

  it("zeigt während des Ladens weder Formular noch Hinweis", () => {
    rechte = ["suche_biete"];
    laedt = true;
    zeige();
    expect(speichernKnoepfe()).toEqual([]);
    expect(screen.queryByRole("heading", { name: /ab Focus/ })).not.toBeInTheDocument();
  });
});
