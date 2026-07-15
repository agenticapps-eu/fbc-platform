import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import MitgliederPage from "./MitgliederPage";

/** MemberDirectory sucht serverseitig (Query) und verlinkt Profile (Router). */
function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <MitgliederPage />
      </MemoryRouter>
    </QueryClientProvider>,
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
    // "Feed wird geladen…" ist der garantierte Anfangszustand von CommunityFeed
    // (FeedList.isLoading) — seine Abwesenheit belegt, dass kein Feed mitmountet.
    expect(screen.queryByText("Feed wird geladen…")).not.toBeInTheDocument();
  });
});
