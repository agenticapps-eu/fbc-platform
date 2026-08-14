import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { ToastProvider } from "./ui/Toast";
import type { AuthContextValue } from "../providers/auth-context";
import { AuthFixture, authAsTier, fakeAuthValue } from "../test/auth-fixtures";

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

function renderAt(path: string, value: AuthContextValue) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <AuthFixture value={value}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter initialEntries={[path]}>
            <App />
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    </AuthFixture>,
  );
}

/**
 * Erstlogin führt nicht mehr in den Kompass-Assistenten (AGE-494).
 *
 * Bis hierher fing `HomeRedirect` genau einen Fall ab: eingeloggt, keine
 * `compass_responses`, nicht übersprungen → `/onboarding`. Am 17.08. loggen sich
 * ~70 Menschen zum ersten Mal ein und träfen alle diesen Fall — ein Fragebogen als
 * erster Eindruck. An diesen Platz tritt in C3 das Aktivierungs-Gate.
 *
 * Der Test prüft absichtlich die ECHTE Weiche über `<App />` und nicht die
 * Komponente isoliert: die Aussage ist „der Erstlogin landet auf der Startseite",
 * und die entsteht erst aus Route, Weiche und Seite zusammen.
 */
describe("Erstlogin (AGE-494)", () => {
  it("führt ein frisches Konto ohne Kompass-Antworten NICHT in den Assistenten", async () => {
    // Der Status muss hier ERFOLGREICH mit „keine Antworten" auflösen, sonst
    // prüft der Test nichts: ohne Mock scheitert die Abfrage in der
    // Testumgebung, die alte Weiche fiel in ihren Fehler-Fallback und zeigte die
    // Startseite — der Test wäre auch vor der Änderung grün gewesen.
    const compass = await import("../lib/compass");
    vi.spyOn(compass, "fetchCompassStatus").mockResolvedValue({
      hasResponses: false,
    } as Awaited<ReturnType<typeof compass.fetchCompassStatus>>);

    // Das Fehlschlagen der Dashboard-Abfrage wird ERZWUNGEN, nicht abgewartet.
    // Vorher hing der Test daran, dass der echte Supabase-Aufruf in der
    // Testumgebung von selbst scheitert — lokal in Millisekunden, in CI langsamer
    // als das 1000-ms-Fenster von `findByText`. Genau so ist er in CI umgefallen,
    // ohne dass sich am Verhalten etwas geändert hätte.
    const dashboard = await import("../lib/dashboard");
    vi.spyOn(dashboard, "fetchDashboard").mockRejectedValue(new Error("kein Netz im Test"));

    // Seit AGE-538 hängt an dieser Weiche wieder eine Strecke. Der Merker wird
    // ausdrücklich als gesetzt gemockt: sonst hinge die Aussage dieses Tests
    // daran, dass die Merker-Abfrage in der Testumgebung zufällig scheitert und
    // die Weiche in ihren Fehlerzweig fällt — grün aus dem falschen Grund.
    const settings = await import("../lib/member-settings");
    vi.spyOn(settings, "fetchOnboardedAt").mockResolvedValue("2026-08-14T10:00:00Z");

    renderAt("/", authAsTier("basic"));

    // Auf ein Signal warten, das NUR der Nicht-Assistenten-Pfad erzeugt. Die
    // Shell-Navigation taugt dafür nicht: sie steht auch, während die alte Weiche
    // noch entscheidet, und der Test wäre wieder blind. Dieser Text erscheint nur,
    // wenn `/` das Dashboard gerendert hat statt umzuleiten.
    expect(
      await screen.findByText("Dashboard konnte nicht geladen werden. Bitte neu laden."),
    ).toBeInTheDocument();
    // Und die Assistenten-Strecke ist nirgends: sie lebt außerhalb der AppShell
    // und bringt eine eigene Kopfzeile mit „Überspringen" mit.
    expect(screen.queryByRole("button", { name: "Überspringen" })).not.toBeInTheDocument();
    expect(screen.queryByText(/^Schritt 1 von/)).not.toBeInTheDocument();
  });

  it("zeigt Gästen unverändert die öffentliche Startseite", async () => {
    renderAt("/", fakeAuthValue());

    expect(
      await screen.findByRole("heading", { name: "Willkommen im Fair Business Club" }),
    ).toBeInTheDocument();
  });

  it("fragt den Kompass-Status für die Startseite gar nicht mehr ab", async () => {
    // Der Beleg, dass die Weiche wirklich weg ist und nicht nur ihr Ergebnis
    // zufällig stimmt: die Abfrage darf überhaupt nicht mehr stattfinden.
    const compass = await import("../lib/compass");
    const spy = vi.spyOn(compass, "fetchCompassStatus");
    const settings = await import("../lib/member-settings");
    vi.spyOn(settings, "fetchOnboardedAt").mockResolvedValue("2026-08-14T10:00:00Z");

    renderAt("/", authAsTier("basic"));
    await screen.findByRole("link", { name: "Aktivität" });

    expect(spy).not.toHaveBeenCalled();
  });
});

/**
 * Die Willkommensstrecke hängt wieder an dieser Weiche (AGE-538, C11).
 *
 * C2 hat den Fragebogen entfernt und den Platz frei gelassen; hier kommt er
 * zurück — mit einem anderen Inhalt und zwei Auswegen. Getestet wird erneut über
 * `<App />`, weil die Aussage „der Erstlogin landet in der Strecke" erst aus
 * Route, Weiche und Ziel zusammen entsteht.
 *
 * Gemockt wird ausschließlich der Rand zur Datenbank. Der Merker MUSS in jedem
 * Fall ausdrücklich gesetzt werden: ohne Mock scheitert die Abfrage in der
 * Testumgebung, die Weiche fällt in ihren Fehlerzweig und zeigt die Startseite —
 * jeder Test wäre grün, ohne irgendetwas zu prüfen.
 */
describe("Willkommensstrecke (AGE-538)", () => {
  const STRECKE = "Schön, dass du da bist";
  const DASHBOARD_KAPUTT = "Dashboard konnte nicht geladen werden. Bitte neu laden.";

  /** `"fehler"` und `"laedt"` sind keine Merker-Werte, sondern die beiden
   *  Zustände neben „gelesen": der Lesefehler und das noch offene Lesen. */
  async function mockMerker(value: string | null | "fehler" | "laedt") {
    const settings = await import("../lib/member-settings");
    const spy = vi.spyOn(settings, "fetchOnboardedAt");
    if (value === "fehler") spy.mockRejectedValue(new Error("kein Netz im Test"));
    else if (value === "laedt") spy.mockReturnValue(new Promise(() => {}));
    else spy.mockResolvedValue(value);
    return spy;
  }

  /** Erzwingt ein Signal, das NUR der Startseiten-Pfad erzeugt. Die
   *  Shell-Navigation taugt dafür nicht: sie steht auch, während die Weiche noch
   *  entscheidet.
   *
   *  Der Rückgabewert ist der Spion selbst: für den LADEzustand ist die
   *  Fehlermeldung das falsche Signal, weil sie erst einen Tick später erscheint
   *  und ihre Abwesenheit deshalb auch dann zu sehen ist, wenn die Startseite
   *  längst rendert. Dass die Abfrage GAR NICHT startet, ist synchron und wahr
   *  oder falsch — nicht schnell oder langsam. */
  async function dashboardScheitern() {
    const dashboard = await import("../lib/dashboard");
    return vi
      .spyOn(dashboard, "fetchDashboard")
      .mockRejectedValue(new Error("kein Netz im Test"));
  }

  beforeEach(async () => {
    // Die Strecke selbst liest Profil und Kategorien — auch das ist DB-Rand.
    const onboarding = await import("../lib/member-onboarding");
    vi.spyOn(onboarding, "fetchOnboardingProfile").mockResolvedValue({
      headline: "",
      avatar_url: null,
      region: "",
    });
    vi.spyOn(onboarding, "fetchOnboardingFreetext").mockResolvedValue({ offers: [], needs: [] });
    const categories = await import("../lib/profile-categories");
    vi.spyOn(categories, "fetchCategorySelection").mockResolvedValue({ offers: [], needs: [] });
  });

  it("führt ein aktiviertes Konto ohne Merker in die Strecke", async () => {
    await mockMerker(null);
    await dashboardScheitern();

    renderAt("/", authAsTier("basic"));

    expect(await screen.findByRole("heading", { name: STRECKE })).toBeInTheDocument();
    expect(screen.queryByText(DASHBOARD_KAPUTT)).not.toBeInTheDocument();
  });

  it("lässt ein Konto MIT Merker auf der Startseite", async () => {
    await mockMerker("2026-08-14T10:00:00Z");
    await dashboardScheitern();

    renderAt("/", authAsTier("basic"));

    expect(await screen.findByText(DASHBOARD_KAPUTT)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: STRECKE })).not.toBeInTheDocument();
  });

  it("leitet einen ausgeloggten Besucher nicht um", async () => {
    // Die Falle aus ActivationRedeemPage.tsx:129-135: für einen Ausgeloggten
    // meldet das System „aktiviert", weil es nichts zu aktivieren gibt. Eine
    // Weiche, die auf `isActivated !== false` prüft, schickt ihn in die Strecke.
    const spy = await mockMerker(null);

    renderAt("/", fakeAuthValue());

    expect(
      await screen.findByRole("heading", { name: "Willkommen im Fair Business Club" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: STRECKE })).not.toBeInTheDocument();
    // Und der Merker wird für ihn gar nicht erst abgefragt.
    expect(spy).not.toHaveBeenCalled();
  });

  it("zeigt einem nicht aktivierten Konto den Aktivierungsbildschirm", async () => {
    await mockMerker(null);

    renderAt("/", { ...authAsTier("basic"), isActivated: false });

    expect(await screen.findByRole("heading", { name: "Noch ein Schritt" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: STRECKE })).not.toBeInTheDocument();
  });

  it("greift auf einer anderen Route nicht ein — die Weiche ist keine Wand", async () => {
    await mockMerker(null);

    renderAt("/mitglieder", authAsTier("impact"));

    expect(await screen.findByText("Finde die Passenden.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: STRECKE })).not.toBeInTheDocument();
  });

  it("zeigt weder Strecke noch Startseite, solange der Merker lädt", async () => {
    // Der dritte Zustand. Ein Test, der den Merker vorbelegt, wäre vorher wie
    // nachher grün und prüfte ihn nie.
    await mockMerker("laedt");
    const dashboard = await dashboardScheitern();

    renderAt("/", authAsTier("basic"));

    // Die Shell steht — die Weiche entscheidet innerhalb von ihr.
    await screen.findByRole("link", { name: "Aktivität" });
    expect(screen.queryByRole("heading", { name: STRECKE })).not.toBeInTheDocument();
    // Die Startseite ist nicht nur unsichtbar, sie ist gar nicht montiert: ihre
    // Abfrage läuft nicht. Das ist die Zusicherung, die den Ladezustand wirklich
    // von „zeigt schon die Startseite" unterscheidet.
    expect(dashboard).not.toHaveBeenCalled();
  });

  it("leitet bei einem Lesefehler NICHT um", async () => {
    // Ein Netzfehler darf niemanden in die Strecke werfen — und er darf erst
    // recht nicht wie ein gesetzter Merker aussehen.
    await mockMerker("fehler");
    await dashboardScheitern();

    renderAt("/", authAsTier("basic"));

    expect(await screen.findByText(DASHBOARD_KAPUTT)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: STRECKE })).not.toBeInTheDocument();
  });
});
