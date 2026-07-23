import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DESIGN_VARIANTS } from "../config/designVariants";
import { DesignVariantProvider } from "../providers/DesignVariantProvider";
import type { AuthContextValue } from "../providers/auth-context";
import { AuthFixture, fakeAuthValue } from "../test/auth-fixtures";
import { DesignSwitcher } from "./DesignSwitcher";

/** AGE-439/450: Detlev will B–I nicht sehen, und eff.bee.zee (seine Vision) nur
 *  für Admins. Geprüft wird deshalb, was im geöffneten Panel tatsächlich steht. */
function openPanel(auth: AuthContextValue = fakeAuthValue()) {
  render(
    <AuthFixture value={auth}>
      <DesignVariantProvider>
        <DesignSwitcher />
      </DesignVariantProvider>
    </AuthFixture>,
  );
  fireEvent.click(screen.getByRole("button", { name: /Switcher öffnen/ }));
  return screen.getByRole("dialog", { name: "Design-Variante wählen" });
}

const adminAuth = fakeAuthValue({
  user: { id: "admin" } as AuthContextValue["user"],
  staffRole: "admin",
});

describe("DesignSwitcher", () => {
  it("bietet Admins A, Sommerfest, die drei FBC-Blau und eff.bee.zee an", () => {
    const panel = openPanel(adminAuth);
    const labels = [...panel.querySelectorAll("li button")].map((b) =>
      b.textContent?.replace(/\s+/g, " ").trim(),
    );

    expect(labels).toHaveLength(6);
    expect(labels[0]).toContain(DESIGN_VARIANTS.a.label);
    expect(labels[1]).toContain(DESIGN_VARIANTS.sommerfest.label);
    expect(labels[2]).toContain(DESIGN_VARIANTS.blau.label);
    expect(labels[3]).toContain(DESIGN_VARIANTS["blau-slate"].label);
    expect(labels[4]).toContain(DESIGN_VARIANTS["blau-navy"].label);
    expect(labels[5]).toContain(DESIGN_VARIANTS.linkedin.label);
  });

  // AGE-450: eff.bee.zee ist Detlevs Vision — Nicht-Admins dürfen sie nicht sehen.
  it("verbirgt eff.bee.zee vor Nicht-Admins — nur A, Sommerfest, die drei FBC-Blau", () => {
    const panel = openPanel();
    const labels = [...panel.querySelectorAll("li button")].map((b) =>
      b.textContent?.replace(/\s+/g, " ").trim(),
    );

    expect(labels).toHaveLength(5);
    expect(panel).not.toHaveTextContent(DESIGN_VARIANTS.linkedin.label);
    expect(panel).toHaveTextContent(DESIGN_VARIANTS.a.label);
    expect(panel).toHaveTextContent(DESIGN_VARIANTS.sommerfest.label);
    expect(panel).toHaveTextContent(DESIGN_VARIANTS.blau.label);
    expect(panel).toHaveTextContent(DESIGN_VARIANTS["blau-slate"].label);
    expect(panel).toHaveTextContent(DESIGN_VARIANTS["blau-navy"].label);
  });

  it("zeigt keine der zurückgezogenen Varianten B–I", () => {
    const panel = openPanel(adminAuth);
    for (const id of ["b", "c", "d", "e", "f", "g", "h", "i"] as const) {
      expect(panel).not.toHaveTextContent(DESIGN_VARIANTS[id].label);
    }
  });
});
