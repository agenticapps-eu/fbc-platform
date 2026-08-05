import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import App from "./App";
import { ToastProvider } from "./components/ui/Toast";
import type { AuthContextValue } from "./providers/auth-context";
import { AuthFixture, authAsTier, fakeAuthValue } from "./test/auth-fixtures";

describe("App", () => {
  it("zeigt die Shell-Navigation und rendert auf / die öffentliche Startseite", () => {
    // Die Startseite lädt Events/Feed (TanStack Query) → Provider nötig.
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <AuthFixture value={fakeAuthValue()}>
        <QueryClientProvider client={queryClient}>
          {/* AppShell rendert jetzt <FeedbackButton /> (AGE-300), das useToast()
              braucht — wie main.tsx muss auch der Test-Wrapper ToastProvider stellen. */}
          <ToastProvider>
            <MemoryRouter initialEntries={["/"]}>
              <App />
            </MemoryRouter>
          </ToastProvider>
        </QueryClientProvider>
      </AuthFixture>,
    );

    // Logo erscheint in Sidebar (Desktop) und Header (Mobil) — beide im DOM.
    expect(screen.getAllByRole("link", { name: "eff.bee.zee" }).length).toBeGreaterThan(0);
    // Anon sieht das ganze Schaufenster: alle fünf „Entdecken"-Einträge, unabhängig
    // davon, ob der Inhalt gegatet ist (Spec §1 — Rechte gaten Inhalte, nicht das Menü).
    // AGE-494: „Compass" ist nicht mehr darunter — der Kompass hat keinen eigenen
    // Menüpunkt mehr und lebt als Filter über der Mitgliederliste.
    for (const label of ["Start", "Academy", "Events", "Mitglieder", "Aktivität"]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
    // „Mein Bereich" setzt ein Konto voraus und bleibt für Anon aus. Kompass,
    // Meine Kurse, Kontakte und Mitgliedschaft haben gar keinen Eintrag mehr.
    for (const label of [
      "Mein Profil",
      "Einstellungen",
      "Kompass",
      "Meine Kurse",
      "Meine Kontakte",
      "Mitgliedschaft",
    ]) {
      expect(screen.queryByRole("link", { name: label })).not.toBeInTheDocument();
    }
    // / rendert die öffentliche Startseite.
    expect(
      screen.getByRole("heading", { name: "Willkommen im Fair Business Club" }),
    ).toBeInTheDocument();
  });

  // AGE-494: /kontakte hat keinen Menüeintrag mehr — die Prüfung braucht eine
  // Route, die noch im Menü steht. /aktivitaet tut dasselbe.
  it("markiert auf /aktivitaet genau einen Sidebar-Eintrag als aktiv", () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <AuthFixture value={authAsTier("impact")}>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <MemoryRouter initialEntries={["/aktivitaet"]}>
              <App />
            </MemoryRouter>
          </ToastProvider>
        </QueryClientProvider>
      </AuthFixture>,
    );
    const active = screen
      .getAllByRole("link")
      .filter((el) => el.getAttribute("aria-current") === "page");
    expect(active).toHaveLength(1);
    expect(active[0]).toHaveTextContent("Aktivität");
  });

  /* AGE-494: Eine aus dem Menü genommene Route markiert folgerichtig keinen
     Eintrag mehr — sie ist erreichbar, aber nicht mehr Teil der Navigation.
     Ohne diesen Test fiele ein versehentlich wieder eingehängter Eintrag nicht auf. */
  it("markiert auf /kontakte gar keinen Sidebar-Eintrag mehr", () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <AuthFixture value={authAsTier("impact")}>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <MemoryRouter initialEntries={["/kontakte"]}>
              <App />
            </MemoryRouter>
          </ToastProvider>
        </QueryClientProvider>
      </AuthFixture>,
    );
    const active = screen
      .getAllByRole("link")
      .filter((el) => el.getAttribute("aria-current") === "page");
    expect(active).toHaveLength(0);
  });
});

/**
 * AGE-492 — der eff.bee.zee-Vision-Dummy ist aus dem Renderpfad entfernt. Bis
 * AGE-450 rendete App.tsx ihn für Staff statt der echten App; dieser Escape-Hatch
 * ist weg, und `src/vision/` wird von nirgends mehr importiert.
 *
 * Der Test steht bewusst als Regressionsschutz weiter hier: er hätte vor diesem
 * Change bestanden (mit umgekehrter Erwartung), und er fällt, sobald jemand den
 * Renderpfad zurückholt. Der Dummy zeigt ein „Vorschau · in Entwicklung"-Banner —
 * daran hängt die Prüfung.
 */
describe("der Vision-Dummy ist aus dem Renderpfad entfernt", () => {
  afterEach(() => {
    localStorage.clear();
    window.history.replaceState({}, "", "/");
  });

  function renderApp(value: AuthContextValue) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <AuthFixture value={value}>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <MemoryRouter initialEntries={["/"]}>
              <App />
            </MemoryRouter>
          </ToastProvider>
        </QueryClientProvider>
      </AuthFixture>,
    );
  }

  it("rendert die echte App auch für Staff — nicht die Vision", async () => {
    renderApp(
      fakeAuthValue({ user: { id: "admin" } as AuthContextValue["user"], staffRole: "admin" }),
    );
    // Die AppShell der echten App (Sidebar-Navigation) ist da; der Vision-Dummy
    // ersetzt die Routes vollständig und hätte sie nicht.
    await waitFor(() => expect(screen.getByRole("link", { name: "Events" })).toBeInTheDocument());
    expect(screen.queryByText(/Vorschau · in Entwicklung/)).not.toBeInTheDocument();
  });

  // Bestandsnutzer tragen "linkedin" noch im localStorage. Das darf weder die
  // Vision holen noch die App auf ein Theme ohne CSS-Block stellen.
  it('ignoriert ein gespeichertes „linkedin" und fällt auf hell zurück', async () => {
    localStorage.setItem("fbc.designVariant", "linkedin");
    renderApp(
      fakeAuthValue({ user: { id: "admin" } as AuthContextValue["user"], staffRole: "admin" }),
    );
    await waitFor(() => expect(screen.getByRole("link", { name: "Events" })).toBeInTheDocument());
    expect(screen.queryByText(/Vorschau · in Entwicklung/)).not.toBeInTheDocument();
    expect(document.documentElement.dataset.variant).toBe("hell");
  });
});
