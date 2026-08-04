import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import MeineKursePage from "./MeineKursePage";

function renderPage() {
  return render(
    <MemoryRouter>
      <MeineKursePage />
    </MemoryRouter>,
  );
}

describe("MeineKursePage", () => {
  it("nennt den Bereich", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "Meine Kurse" })).toBeInTheDocument();
  });

  /* AGE-494: Der Wortlaut hat gewechselt — von „Du hast noch keine Kurse belegt"
     auf einen Leerzustand, der den Weg zeigt. Die eigentliche Aussage des Tests
     bleibt dieselbe und ist der Punkt: hier werden keine Kurse erfunden. */
  it("zeigt einen Leerzustand mit Weg statt Fake-Daten", () => {
    renderPage();
    expect(screen.getByText(/Lernpfad beginnt in der Academy/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Zur Academy" })).toHaveAttribute("href", "/academy");
  });

  it("erfindet keine Kurse", () => {
    renderPage();
    // Kein Listeneintrag, keine Kurskarte — nur der Leerzustand.
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });
});
