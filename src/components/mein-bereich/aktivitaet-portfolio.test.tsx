import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AktivitaetPortfolio } from "./aktivitaet-portfolio";

describe("AktivitaetPortfolio", () => {
  it("ist standardmäßig eingeklappt und zeigt Inhalte erst nach Klick", () => {
    render(<AktivitaetPortfolio />);
    expect(screen.queryByText("Meine Statistik (30 Tage)")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Aktivität & Portfolio/ }));
    expect(screen.getByText("Meine Statistik (30 Tage)")).toBeInTheDocument();
    expect(screen.getByText("Meine Investments")).toBeInTheDocument();
  });
});
