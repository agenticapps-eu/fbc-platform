import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MeineKursePage from "./MeineKursePage";

describe("MeineKursePage", () => {
  it("nennt den Bereich", () => {
    render(<MeineKursePage />);
    expect(screen.getByRole("heading", { name: "Meine Kurse" })).toBeInTheDocument();
  });

  it("sagt ehrlich, dass noch keine Kurse belegt sind — ohne Fake-Daten", () => {
    render(<MeineKursePage />);
    expect(screen.getByText(/noch keine Kurse belegt/i)).toBeInTheDocument();
  });
});
