import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DESIGN_VARIANTS } from "../config/designVariants";
import { DesignVariantProvider } from "../providers/DesignVariantProvider";
import { DesignSwitcher } from "./DesignSwitcher";

/** Der Switcher ist seit AGE-492 nicht mehr gemountet (App.tsx), bleibt aber auf
 *  Wunsch im Baum. Geprüft wird nur noch, dass er die zwei Themes anbietet und
 *  das Umschalten wirklich am <html data-variant> ankommt — nicht mehr, wer
 *  welche Variante sehen darf; dieses Gating gibt es nicht mehr. */
function openPanel() {
  render(
    <DesignVariantProvider>
      <DesignSwitcher />
    </DesignVariantProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: /Switcher öffnen/ }));
  return screen.getByRole("dialog", { name: "Theme wählen" });
}

describe("DesignSwitcher", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("bietet genau die zwei Themes an", () => {
    const panel = openPanel();
    const labels = [...panel.querySelectorAll("li button")].map((b) =>
      b.textContent?.replace(/\s+/g, " ").trim(),
    );

    expect(labels).toHaveLength(2);
    expect(labels[0]).toContain(DESIGN_VARIANTS.hell.label);
    expect(labels[1]).toContain(DESIGN_VARIANTS.navy.label);
  });

  it("schaltet das Theme auf <html data-variant> um", () => {
    const panel = openPanel();
    const navyButton = [...panel.querySelectorAll("li button")].find((b) =>
      b.textContent?.includes(DESIGN_VARIANTS.navy.label),
    );
    fireEvent.click(navyButton!);
    expect(document.documentElement.dataset.variant).toBe("navy");
  });
});
