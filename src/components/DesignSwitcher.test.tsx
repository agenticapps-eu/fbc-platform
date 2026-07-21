import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DESIGN_VARIANTS } from "../config/designVariants";
import { DesignVariantProvider } from "../providers/DesignVariantProvider";
import { DesignSwitcher } from "./DesignSwitcher";

/** AGE-439: Detlev will B–I nicht mehr sehen. Geprüft wird deshalb, was im
 *  geöffneten Panel tatsächlich steht — nicht nur die Konfigurationsliste. */
function openPanel() {
  render(
    <DesignVariantProvider>
      <DesignSwitcher />
    </DesignVariantProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: /Switcher öffnen/ }));
  return screen.getByRole("dialog", { name: "Design-Variante wählen" });
}

describe("DesignSwitcher", () => {
  it("bietet genau A, Sommerfest und eff.bee.zee an", () => {
    const panel = openPanel();
    const labels = [...panel.querySelectorAll("li button")].map((b) =>
      b.textContent?.replace(/\s+/g, " ").trim(),
    );

    expect(labels).toHaveLength(3);
    expect(labels[0]).toContain(DESIGN_VARIANTS.a.label);
    expect(labels[1]).toContain(DESIGN_VARIANTS.sommerfest.label);
    expect(labels[2]).toContain(DESIGN_VARIANTS.linkedin.label);
  });

  it("zeigt keine der zurückgezogenen Varianten B–I", () => {
    const panel = openPanel();
    for (const id of ["b", "c", "d", "e", "f", "g", "h", "i"] as const) {
      expect(panel).not.toHaveTextContent(DESIGN_VARIANTS[id].label);
    }
  });
});
