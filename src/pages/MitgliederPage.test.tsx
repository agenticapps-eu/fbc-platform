import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import MitgliederPage from "./MitgliederPage";
import { AuthFixture, authAsTier } from "../test/auth-fixtures";

// MemberDirectory als Mock, um externe Abhängigkeiten zu isolieren
vi.mock("../components/community/MemberDirectory", () => ({
  default: () => <h2>Verzeichnis</h2>,
}));

/** MemberDirectory sucht serverseitig (Query) und verlinkt Profile (Router). */
function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <AuthFixture value={authAsTier("discover")}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <MitgliederPage />
        </MemoryRouter>
      </QueryClientProvider>
    </AuthFixture>,
  );
}

describe("MitgliederPage", () => {
  it("zeigt den Mitglieder-Hero", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "Mitglieder" })).toBeInTheDocument();
  });

  it("mountet das Verzeichnis (Suche + Filter), nicht den Feed", () => {
    renderPage();
    // Spec §3: „Mitglieder" ist nur noch Suche · Filter · Profile · Kontaktaufnahme —
    // keine Beiträge. Die Verzeichnis-Überschrift stammt aus MemberDirectory.
    expect(screen.getByRole("heading", { name: "Verzeichnis" })).toBeInTheDocument();
  });
});
