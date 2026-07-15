import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import AktivitaetPage from "./AktivitaetPage";

/** Der Feed lädt über TanStack Query und verlinkt Profile → beide Provider nötig. */
function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AktivitaetPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("AktivitaetPage", () => {
  it("zeigt den Aktivität-Hero", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "Aktivität" })).toBeInTheDocument();
  });
});
