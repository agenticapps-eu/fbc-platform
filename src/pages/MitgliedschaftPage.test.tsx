import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import MitgliedschaftPage from "./MitgliedschaftPage";

const invoke = vi.fn();
vi.mock("../lib/supabase", () => ({
  supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } },
}));
vi.mock("../providers/auth-context", () => ({
  useAuth: () => ({ tier: "discover", levelRank: 3 }),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <MitgliedschaftPage />
    </MemoryRouter>,
  );
}

describe("MitgliedschaftPage", () => {
  beforeEach(() => {
    invoke.mockReset();
    invoke.mockResolvedValue({ data: { url: "https://stripe.test/x" }, error: null });
  });

  it("zeigt alle 6 Stufen", () => {
    renderPage();
    for (const l of ["Basic", "Connect", "Discover", "Exchange", "Focus", "Impact"])
      expect(screen.getByText(l)).toBeInTheDocument();
  });

  it("markiert die aktuelle Stufe und bietet nur höhere zahlende Stufen zum Upgrade", () => {
    renderPage();
    expect(screen.getByTestId("level-discover")).toHaveAttribute("data-current", "true");
    // Höher + zahlend → Button
    expect(
      within(screen.getByTestId("level-exchange")).getByRole("button", { name: /upgrade/i }),
    ).toBeEnabled();
    // Aktuell/niedriger → kein Upgrade-Button
    expect(
      within(screen.getByTestId("level-discover")).queryByRole("button", { name: /upgrade/i }),
    ).toBeNull();
    expect(
      within(screen.getByTestId("level-connect")).queryByRole("button", { name: /upgrade/i }),
    ).toBeNull();
  });

  it("zeigt den Testzahlung-Hinweis", () => {
    renderPage();
    expect(screen.getAllByText(/Testzahlung · Demo/i).length).toBeGreaterThan(0);
  });

  it("schaltet mit dem Jahr/Monat-Toggle die Beträge", () => {
    renderPage();
    expect(within(screen.getByTestId("level-exchange")).getByText(/300/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /monatlich/i }));
    expect(within(screen.getByTestId("level-exchange")).getByText(/30/)).toBeInTheDocument();
  });

  it("ruft create-checkout-session mit level + interval", () => {
    renderPage();
    fireEvent.click(
      within(screen.getByTestId("level-focus")).getByRole("button", { name: /upgrade/i }),
    );
    expect(invoke).toHaveBeenCalledWith("create-checkout-session", {
      body: { level: "focus", interval: "year" },
    });
  });
});
