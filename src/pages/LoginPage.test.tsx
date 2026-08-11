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
    fireEvent.click(screen.getByRole("button", { name: "Konto erstellen" }));

    // Getrimmt: führende/folgende Leerzeichen landen sonst im Verzeichnis.
    // Ohne Passwort seit AGE-527 — es entsteht beim Einlösen des Links.
    await waitFor(() => expect(signUp).toHaveBeenCalledWith("anna@example.org", "Anna Muster"));
  });

  it("verlangt einen Namen und registriert ohne ihn nicht", async () => {
    const signUp = renderLogin();
    toRegisterMode();

    fireEvent.change(screen.getByLabelText("E-Mail"), { target: { value: "anna@example.org" } });
    fireEvent.click(screen.getByRole("button", { name: "Konto erstellen" }));

    expect(await screen.findByText(/Bitte deinen Namen eingeben/)).toBeInTheDocument();
    expect(signUp).not.toHaveBeenCalled();
  });

  it("zeigt das Namensfeld im Login-Modus nicht", () => {
    renderLogin();
    expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
  });

  // AGE-505. Der Weg muss genau hier stehen: Wer sein Passwort vergessen hat,
  // scheitert an DIESER Seite und sucht ihn nirgendwo sonst.
  it("bietet einen Weg für ein vergessenes Passwort an", () => {
    renderLogin();
    const link = screen.getByRole("link", { name: /Passwort vergessen/i });
    expect(link).toHaveAttribute("href", "/passwort-vergessen");
  });

  // Befund 8.7 aus Review 5.4: der Fall oben belegte den Link, nicht seine
  // BEDINGUNG. Wer `mode === "login"` entfernt, bestünde ihn weiterhin — und
  // böte dann jemandem, der gerade ein Konto anlegt, an, ein Passwort
  // zurückzusetzen, das es noch nicht gibt.
  it("zeigt den Weg im Registrierungsmodus NICHT — dort ist nichts zu vergessen", () => {
    renderLogin();
    toRegisterMode();
    expect(screen.queryByRole("link", { name: /Passwort vergessen/i })).not.toBeInTheDocument();
  });


  /**
   * AGE-527. Das Passwort entsteht erst nach der Bestätigung der Mail — beim
   * Einlösen des Links. Vorher eines zu erheben hieß: gesetzt, nie gebraucht,
   * stillschweigend überschrieben.
   *
   * Der zweite Test hier ist der wichtigere, und er kommt aus dem Plan-Review:
   * Das Zod-Schema verlangte `password` in BEIDEN Modi. Wer nur das Feld
   * entfernt, bekommt einen Knopf, der wortlos nichts tut — die Validierung
   * scheitert an einem Feld, das gar nicht mehr gerendert wird. Ein Test, der
   * bloß „wurde ohne Passwort aufgerufen" prüft, sieht das nicht: Er ist auch
   * dann grün, wenn `signUp` NIE läuft.
   */
  it("zeigt im Registrierungsmodus kein Passwortfeld", () => {
    renderLogin();
    toRegisterMode();

    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("E-Mail")).toBeInTheDocument();
    expect(screen.queryByLabelText("Passwort")).not.toBeInTheDocument();
  });

  it("registriert ohne Passworteingabe — der Submit läuft durch", async () => {
    const signUp = renderLogin();
    toRegisterMode();

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Anna Muster" } });
    fireEvent.change(screen.getByLabelText("E-Mail"), { target: { value: "anna@example.org" } });
    fireEvent.click(screen.getByRole("button", { name: "Konto erstellen" }));

    await waitFor(() => expect(signUp).toHaveBeenCalledWith("anna@example.org", "Anna Muster"));
    // Und keine Schema-Meldung zu einem Feld, das es nicht mehr gibt.
    expect(screen.queryByText(/Passwort muss mindestens/i)).not.toBeInTheDocument();
  });

  it("verlangt im LOGIN-Modus weiterhin ein Passwort", () => {
    renderLogin();
    expect(screen.getByLabelText("Passwort")).toBeInTheDocument();
  });

  /**
   * Befund aus dem Diff-Review zu AGE-527: Die Zehn-Zeichen-Regel galt auch beim
   * ANMELDEN. Der Anmeldedienst prüft sie dort nicht — sie gilt beim SETZEN.
   * Ein Konto aus der Zeit vor C4 mit acht Zeichen käme serverseitig durch und
   * wurde vom eigenen Formular ausgesperrt.
   */
  it("sperrt beim Anmelden kein kurzes Alt-Passwort aus", async () => {
    const signIn = vi.fn(async () => ({ error: null }));
    render(
      <AuthFixture value={fakeAuthValue({ signIn })}>
        <DesignVariantProvider>
          <MemoryRouter>
            <LoginPage />
          </MemoryRouter>
        </DesignVariantProvider>
      </AuthFixture>,
    );

    fireEvent.change(screen.getByLabelText("E-Mail"), { target: { value: "alt@example.org" } });
    fireEvent.change(screen.getByLabelText("Passwort"), { target: { value: "achtzehn" } });
    fireEvent.click(screen.getByRole("button", { name: "Anmelden" }));

    await waitFor(() => expect(signIn).toHaveBeenCalledWith("alt@example.org", "achtzehn"));
    expect(screen.queryByText(/mindestens 10 Zeichen/i)).not.toBeInTheDocument();
  });

  it("verlangt beim Anmelden aber ein nicht leeres Passwort", async () => {
    const signIn = vi.fn(async () => ({ error: null }));
    render(
      <AuthFixture value={fakeAuthValue({ signIn })}>
        <DesignVariantProvider>
          <MemoryRouter>
            <LoginPage />
          </MemoryRouter>
        </DesignVariantProvider>
      </AuthFixture>,
    );

    fireEvent.change(screen.getByLabelText("E-Mail"), { target: { value: "alt@example.org" } });
    fireEvent.click(screen.getByRole("button", { name: "Anmelden" }));

    expect(await screen.findByText(/Bitte dein Passwort eingeben/i)).toBeInTheDocument();
    expect(signIn).not.toHaveBeenCalled();
  });
});
