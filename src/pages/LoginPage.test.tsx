import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AuthFixture, fakeAuthValue } from "../test/auth-fixtures";
import { DesignVariantProvider } from "../providers/DesignVariantProvider";
import LoginPage from "./LoginPage";

/**
 * AGE-437: Die Registrierung muss einen Namen erheben. Der Signup-Trigger
 * (20260611171003:91) liest ihn aus `raw_user_meta_data->>'full_name'` und
 * schreibt ihn nach `profiles.name` — kommt er nicht mit, bleibt der Name NULL
 * und das Mitglied erscheint im Verzeichnis dauerhaft als „Mitglied"
 * (MemberDirectory.tsx:235). Deshalb wird hier geprüft, was tatsächlich AN
 * `signUp` ÜBERGEBEN wird, nicht nur, dass ein Feld existiert.
 */
function renderLogin(signUp = vi.fn(async () => ({ error: null }))) {
  render(
    <AuthFixture value={fakeAuthValue({ signUp })}>
      <DesignVariantProvider>
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      </DesignVariantProvider>
    </AuthFixture>,
  );
  return signUp;
}

function toRegisterMode() {
  fireEvent.click(screen.getByRole("button", { name: /Noch kein Konto\? Registrieren/ }));
}

describe("LoginPage", () => {
  // AGE-451: neue Konten starten auf `basic` (handle_new_user), nicht discover.
  // Der Registrierungshinweis muss das korrekt sagen — sonst verspricht er eine
  // bezahlte Stufe, die es erst per Stripe-Upgrade gibt.
  it("nennt im Registrierungshinweis die Stufe Basic, nicht Discover", () => {
    renderLogin();
    toRegisterMode();
    expect(screen.getByText(/Stufe „Basic“/)).toBeInTheDocument();
    expect(screen.queryByText(/Discover/)).toBeNull();
  });

  it("übergibt den eingegebenen Namen an signUp", async () => {
    const signUp = renderLogin();
    toRegisterMode();

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "  Anna Muster  " } });
    fireEvent.change(screen.getByLabelText("E-Mail"), { target: { value: "anna@example.org" } });
    fireEvent.change(screen.getByLabelText("Passwort"), { target: { value: "geheim1234" } });
    fireEvent.click(screen.getByRole("button", { name: "Konto erstellen" }));

    // Getrimmt: führende/folgende Leerzeichen landen sonst im Verzeichnis.
    await waitFor(() =>
      expect(signUp).toHaveBeenCalledWith("anna@example.org", "geheim1234", "Anna Muster"),
    );
  });

  it("verlangt einen Namen und registriert ohne ihn nicht", async () => {
    const signUp = renderLogin();
    toRegisterMode();

    fireEvent.change(screen.getByLabelText("E-Mail"), { target: { value: "anna@example.org" } });
    fireEvent.change(screen.getByLabelText("Passwort"), { target: { value: "geheim1234" } });
    fireEvent.click(screen.getByRole("button", { name: "Konto erstellen" }));

    expect(await screen.findByText(/Bitte deinen Namen eingeben/)).toBeInTheDocument();
    expect(signUp).not.toHaveBeenCalled();
  });

  it("zeigt das Namensfeld im Login-Modus nicht", () => {
    renderLogin();
    expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
  });
});
