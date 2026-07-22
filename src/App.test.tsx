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
    expect(screen.getAllByRole("link", { name: "Fair Business Club" }).length).toBeGreaterThan(0);
    // Anon sieht das ganze Schaufenster: alle sechs „Entdecken"-Einträge, unabhängig
    // davon, ob der Inhalt gegatet ist (Spec §1 — Rechte gaten Inhalte, nicht das Menü).
    for (const label of ["Start", "Compass", "Academy", "Events", "Mitglieder", "Aktivität"]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
    // „Mein Bereich"/„Service" setzen ein Konto voraus und bleiben für Anon aus.
    for (const label of ["Mein Profil", "Meine Chancen", "Meine Kurse", "Einstellungen"]) {
      expect(screen.queryByRole("link", { name: label })).not.toBeInTheDocument();
    }
    // / rendert die öffentliche Startseite.
    expect(
      screen.getByRole("heading", { name: "Willkommen im Fair Business Club" }),
    ).toBeInTheDocument();
  });

  it("markiert auf /kontakte genau einen Sidebar-Eintrag als aktiv", () => {
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
    expect(active).toHaveLength(1);
    expect(active[0]).toHaveTextContent("Meine Kontakte");
  });
});

/**
 * AGE-450 — eff.bee.zee (Variante `linkedin`) ist Detlevs Vision und darf für
 * Nicht-Admins nicht sichtbar sein, auch nicht über persistiertes localStorage.
 * Der Vision-Dummy zeigt sein „Vorschau · in Entwicklung"-Banner — daran hängt die Prüfung.
 */
describe("eff.bee.zee ist admin-only", () => {
  afterEach(() => {
    localStorage.clear();
    // Der Provider spiegelt die Variante per replaceState in window.location;
    // ohne Rücksetzen gewänne dieses ?variant= im nächsten Test über localStorage.
    window.history.replaceState({}, "", "/");
  });

  // Höchste Priorität hat ?variant= (vor localStorage) — deterministisch gesetzt.
  function selectLinkedin() {
    window.history.replaceState({}, "", "/?variant=linkedin");
  }

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

  it("rendert die Vision-App für Staff", () => {
    selectLinkedin();
    renderApp(
      fakeAuthValue({ user: { id: "admin" } as AuthContextValue["user"], staffRole: "admin" }),
    );
    expect(screen.getByText(/Vorschau · in Entwicklung/)).toBeInTheDocument();
  });

  it("verbirgt die Vision-App vor Nicht-Staff und fällt auf die echte App zurück", async () => {
    selectLinkedin();
    renderApp(fakeAuthValue());
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Willkommen im Fair Business Club" }),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByText(/Vorschau · in Entwicklung/)).not.toBeInTheDocument();
  });
});
