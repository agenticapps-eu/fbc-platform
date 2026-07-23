import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { AuthContextValue } from "../providers/auth-context";
import { AuthFixture, fakeAuthValue } from "../test/auth-fixtures";
import RequireAdmin from "./RequireAdmin";

function renderGate(value: AuthContextValue) {
  return render(
    <AuthFixture value={value}>
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route
            path="/admin"
            element={
              <RequireAdmin>
                <p>Admin-Inhalt</p>
              </RequireAdmin>
            }
          />
          <Route path="/" element={<p>Startseite</p>} />
          <Route path="/login" element={<p>Login</p>} />
        </Routes>
      </MemoryRouter>
    </AuthFixture>,
  );
}

describe("RequireAdmin (AGE-455)", () => {
  it("lässt Admins durch", () => {
    renderGate(
      fakeAuthValue({ user: { id: "u1" } as AuthContextValue["user"], staffRole: "admin" }),
    );
    expect(screen.getByText("Admin-Inhalt")).toBeInTheDocument();
  });

  it("leitet eingeloggte Nicht-Admins auf die Startseite", () => {
    renderGate(fakeAuthValue({ user: { id: "u1" } as AuthContextValue["user"], staffRole: null }));
    expect(screen.getByText("Startseite")).toBeInTheDocument();
    expect(screen.queryByText("Admin-Inhalt")).not.toBeInTheDocument();
  });
});
