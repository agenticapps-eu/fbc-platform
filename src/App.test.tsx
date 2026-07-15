import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import App from "./App";
import { AuthFixture, authAsTier, fakeAuthValue } from "./test/auth-fixtures";

describe("App", () => {
  it("zeigt die Shell-Navigation und rendert auf / die öffentliche Startseite", () => {
    // Die Startseite lädt Events/Feed (TanStack Query) → Provider nötig.
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <AuthFixture value={fakeAuthValue()}>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={["/"]}>
            <App />
          </MemoryRouter>
        </QueryClientProvider>
      </AuthFixture>,
    );

    // Logo erscheint in Sidebar (Desktop) und Header (Mobil) — beide im DOM.
    expect(screen.getAllByRole("link", { name: "Fair Business Club" }).length).toBeGreaterThan(0);
    // Anon sieht nur die öffentlichen Formate (Start/Events/Community) — die
    // gegateten Einträge wie „Matching" tauchen im Anon-Menü nicht auf.
    expect(screen.getByRole("link", { name: "Start" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Events" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Community" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Matching" })).not.toBeInTheDocument();
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
          <MemoryRouter initialEntries={["/kontakte"]}>
            <App />
          </MemoryRouter>
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
