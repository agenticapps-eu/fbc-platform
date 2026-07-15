import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import AktivitaetPage from "./AktivitaetPage";
import { AuthFixture, authAsTier } from "../test/auth-fixtures";

// CommunityFeed als Mock, um externe Abhängigkeiten zu isolieren
vi.mock("../components/community/CommunityFeed", () => ({
  default: () => <div data-testid="community-feed">Feed Mock</div>,
}));

/** Der Feed lädt über TanStack Query und verlinkt Profile → beide Provider nötig. */
function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <AuthFixture value={authAsTier("discover")}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AktivitaetPage />
        </MemoryRouter>
      </QueryClientProvider>
    </AuthFixture>,
  );
}

describe("AktivitaetPage", () => {
  it("zeigt den Aktivität-Hero", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "Aktivität" })).toBeInTheDocument();
  });
});
