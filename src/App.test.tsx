import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import App from "./App";
import { ToastProvider } from "./components/ui/Toast";
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
