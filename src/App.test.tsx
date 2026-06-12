import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import App from "./App";
import { AuthFixture, fakeAuthValue } from "./test/auth-fixtures";

describe("App", () => {
  it("zeigt die Shell-Navigation und die Feed-Seite", () => {
    render(
      <AuthFixture value={fakeAuthValue()}>
        <MemoryRouter initialEntries={["/"]}>
          <App />
        </MemoryRouter>
      </AuthFixture>,
    );

    expect(screen.getByRole("link", { name: "Fair Business Club" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Matching" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Feed" })).toBeInTheDocument();
  });
});
