import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import CompassPage from "./CompassPage";
import { AuthFixture, authAsTier } from "../test/auth-fixtures";

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <AuthFixture value={authAsTier("exchange")}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <CompassPage />
        </MemoryRouter>
      </QueryClientProvider>
    </AuthFixture>,
  );
}

describe("CompassPage", () => {
  it("führt Mini-Kompass und Suche & Biete in einer Seite zusammen (Spec §3)", () => {
    renderPage();
    expect(screen.getByRole("tab", { name: "Mini-Kompass" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Suche & Biete" })).toBeInTheDocument();
  });

  it("startet auf dem Mini-Kompass", () => {
    renderPage();
    expect(screen.getByRole("tab", { name: "Mini-Kompass" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});
