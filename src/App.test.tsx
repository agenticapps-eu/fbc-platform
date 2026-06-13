import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import App from "./App";
import { AuthFixture, fakeAuthValue } from "./test/auth-fixtures";

describe("App", () => {
  it("zeigt die Shell-Navigation und leitet / auf die Community-Startseite", () => {
    render(
      <AuthFixture value={fakeAuthValue()}>
        <MemoryRouter initialEntries={["/"]}>
          <App />
        </MemoryRouter>
      </AuthFixture>,
    );

    // Logo erscheint in Sidebar (Desktop) und Header (Mobil) — beide im DOM.
    expect(screen.getAllByRole("link", { name: "Fair Business Club" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Matching" })).toBeInTheDocument();
    // Index-Redirect / → /community.
    expect(screen.getByRole("heading", { name: "Community" })).toBeInTheDocument();
  });
});
