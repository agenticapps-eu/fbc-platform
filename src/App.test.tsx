import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App", () => {
  it("rendert den Titel", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "Fair Business Club" })).toBeInTheDocument();
  });
});
