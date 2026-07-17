import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import MitgliedschaftPage from "./MitgliedschaftPage";
import { ToastProvider } from "../components/ui";

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
      <ToastProvider>
        <MitgliedschaftPage />
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe("MitgliedschaftPage", () => {
  beforeEach(() => {
    invoke.mockReset();
    invoke.mockResolvedValue({ data: { url: "https://stripe.test/x" }, error: null });
  });

  it("zeigt alle 6 Stufen als Karten", () => {
    renderPage();
    for (const key of ["basic", "connect", "discover", "exchange", "focus", "impact"])
      expect(screen.getByTestId(`level-${key}`)).toBeInTheDocument();
  });

  it("zeigt das 'Deine Mitgliedschaft'-Panel mit der aktuellen Stufe", () => {
    renderPage();
    expect(screen.getByText("Deine Mitgliedschaft")).toBeInTheDocument();
    // 'Discover' erscheint jetzt im Panel UND auf der Karte → mehrfach.
    expect(screen.getAllByText("Discover").length).toBeGreaterThanOrEqual(2);
  });

  it("markiert Discover als Empfohlen", () => {
    renderPage();
    expect(within(screen.getByTestId("level-discover")).getByText("Empfohlen")).toBeInTheDocument();
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

  it("zeigt einen Fehler-Toast und navigiert nicht, wenn der Checkout-Start fehlschlägt", async () => {
    invoke.mockResolvedValue({ data: null, error: { message: "boom" } });
    const assign = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      value: { ...originalLocation, assign },
      writable: true,
      configurable: true,
    });
    renderPage();
    fireEvent.click(
      within(screen.getByTestId("level-focus")).getByRole("button", { name: /upgrade/i }),
    );
    await waitFor(() =>
      expect(screen.getByText(/Upgrade konnte nicht gestartet werden/i)).toBeInTheDocument(),
    );
    expect(assign).not.toHaveBeenCalled();
    Object.defineProperty(window, "location", {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  });
});
