import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import App from "./App";
import { AuthFixture, fakeAuthValue } from "./test/auth-fixtures";

describe("App", () => {
  it("zeigt die Shell-Navigation und leitet / auf die Community-Startseite", () => {
    // Die Community-Startseite mountet jetzt den Feed (TanStack Query) → Provider nötig.
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
    expect(screen.getByRole("link", { name: "Matching" })).toBeInTheDocument();
    // Index-Redirect / → /community.
    expect(screen.getByRole("heading", { name: "Community" })).toBeInTheDocument();
  });
});
