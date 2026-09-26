import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PricingCard from "./PricingCard";
import { LEVELS } from "../../config/levels";

function renderCard(over: Partial<React.ComponentProps<typeof PricingCard>> = {}) {
  const props = {
    level: LEVELS.discover,
    interval: "year" as const,
    isCurrent: false,
    canUpgrade: true,
    busy: false,
    onUpgrade: vi.fn(),
    ...over,
  };
  render(<PricingCard {...props} />);
  return props;
}

describe("PricingCard", () => {
  it("renders label, monogram and yearly price", () => {
    renderCard();
    const card = screen.getByTestId("level-discover");
    expect(within(card).getByText("Discover")).toBeInTheDocument();
    // Das Monogramm ist die roemische Zahl des RANGS, nicht des Schluessels.
    // `discover` stand bis AGE-903 auf Rang 3 und steht jetzt auf Rang 4 — die
    // Karte trug also dieselbe Beschriftung und eine andere Zahl, ohne dass sich
    // ihr Name aenderte.
    expect(within(card).getByText("IV")).toBeInTheDocument();
    expect(within(card).getByText(/300 € \/ Jahr/)).toBeInTheDocument();
  });

  it("shows the monthly price when interval is month", () => {
    renderCard({ interval: "month" });
    expect(screen.getByText(/30 € \/ Monat/)).toBeInTheDocument();
  });

  it("shows Gratis for a free tier", () => {
    renderCard({ level: LEVELS.active, canUpgrade: false });
    expect(screen.getByText("Gratis")).toBeInTheDocument();
  });

  it("marks the current tier and hides the upgrade button", () => {
    renderCard({ isCurrent: true, canUpgrade: false });
    const card = screen.getByTestId("level-discover");
    expect(card).toHaveAttribute("data-current", "true");
    expect(within(card).getByText("Aktuell")).toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: /upgrade/i })).toBeNull();
  });

  it("renders the Empfohlen tag only when recommended", () => {
    renderCard({ recommended: true });
    expect(screen.getByText("Empfohlen")).toBeInTheDocument();
  });

  it("calls onUpgrade with the level key and disables while busy", () => {
    renderCard({ busy: true });
    const btn = screen.getByRole("button", { name: /upgrade/i });
    expect(btn).toBeDisabled();
  });

  it("calls onUpgrade when clicked and enabled", () => {
    const onUpgrade = vi.fn();
    render(
      <PricingCard
        level={LEVELS.discover}
        interval="year"
        isCurrent={false}
        canUpgrade
        busy={false}
        onUpgrade={onUpgrade}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /upgrade/i }));
    expect(onUpgrade).toHaveBeenCalledWith("discover");
  });

  it("shows the Testzahlung hint for upgradeable tiers", () => {
    renderCard();
    expect(screen.getByText(/Testzahlung · Demo/)).toBeInTheDocument();
  });
});
