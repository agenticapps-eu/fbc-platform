import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import AppFooter from "./AppFooter";

/**
 * Der Verweis auf den oeffentlichen Blog (AGE-705).
 *
 * Er ist die einzige Stelle, an der die Anwendung auf `www.effbeezee.com`
 * zeigt. Faellt er bei einem spaeteren Umbau des Footers heraus, merkt das
 * niemand: die Seite sieht danach richtig aus, und der Weg zum Blog ist
 * lautlos weg.
 */
describe("AppFooter", () => {
  function zeige() {
    render(
      <MemoryRouter>
        <AppFooter />
      </MemoryRouter>,
    );
  }

  it("fuehrt zum oeffentlichen Blog", () => {
    zeige();
    const verweis = screen.getByRole("link", { name: /Blog und Tutorials/i });
    expect(verweis).toHaveAttribute("href", "https://www.effbeezee.com/");
  });

  it("oeffnet ihn in einem neuen Tab, ohne den Verweiser mitzugeben", () => {
    zeige();
    const verweis = screen.getByRole("link", { name: /Blog und Tutorials/i });
    expect(verweis).toHaveAttribute("target", "_blank");
    expect(verweis.getAttribute("rel")).toContain("noopener");
  });

  it("stellt ihn NICHT in die Rechtliches-Navigation", () => {
    // Sonst saege ein Screenreader den Blog als Rechtsdokument an.
    zeige();
    const rechtliches = screen.getByRole("navigation", { name: "Rechtliches" });
    expect(rechtliches.querySelector('a[href="https://www.effbeezee.com/"]')).toBeNull();
  });
});
