import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import ActivationGate from "./ActivationGate";
import { AuthContext } from "../providers/auth-context";
import { fakeAuthValue } from "../test/auth-fixtures";

/**
 * Die Wand wird ECHT gerendert, samt ActivationScreen — kein `vi.mock` auf
 * eigene Komponenten. Ein Mock auf `ActivationScreen` würde nur belegen, dass
 * der Mock aufgerufen wurde, nicht dass das Mitglied die Wand sieht.
 *
 * Gemockt wird ausschließlich der Netzwerkrand (`lib/activation`), damit der
 * Test nicht an Supabase hängt.
 */
vi.mock("../lib/activation", () => ({
  requestActivationLink: vi.fn(async () => {}),
}));

function renderMit(
  auth: Partial<Parameters<typeof fakeAuthValue>[0]>,
  kind = <p>Geschützter Inhalt</p>,
) {
  return render(
    <AuthContext.Provider value={fakeAuthValue(auth)}>
      <MemoryRouter>
        <ActivationGate>{kind}</ActivationGate>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

const einNutzer = { id: "u1", email: "mitglied@test.fbc" } as never;

describe("ActivationGate", () => {
  it("zeigt den Inhalt für ein bestätigtes Mitglied", () => {
    renderMit({ user: einNutzer, isActivated: true });
    expect(screen.getByText("Geschützter Inhalt")).toBeInTheDocument();
  });

  it("ersetzt den Inhalt für ein unbestätigtes Konto durch die Wand", () => {
    renderMit({ user: einNutzer, isActivated: false });
    expect(screen.queryByText("Geschützter Inhalt")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Noch ein Schritt/i })).toBeInTheDocument();
  });

  it("nennt die Adresse, an die der Link geht", () => {
    renderMit({ user: einNutzer, isActivated: false });
    expect(screen.getByText("mitglied@test.fbc")).toBeInTheDocument();
  });

  it("lässt den ausgeloggten Besucher durch — das Schaufenster bleibt offen", () => {
    renderMit({ user: null, isActivated: true });
    expect(screen.getByText("Geschützter Inhalt")).toBeInTheDocument();
  });

  it("zeigt WEDER Inhalt NOCH Wand, solange der Zustand unbekannt ist", () => {
    // Fail closed heißt hier warten. Ein Netzwerkfehler darf einem bestätigten
    // Mitglied nicht vorwerfen, es sei unbestätigt — und ein unbestätigtes darf
    // nicht durchrutschen, solange die Antwort aussteht.
    renderMit({ user: einNutzer, isActivated: null });
    expect(screen.queryByText("Geschützter Inhalt")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Noch ein Schritt/i })).not.toBeInTheDocument();
  });

  it("entscheidet nichts, solange die Session lädt", () => {
    renderMit({ user: null, isLoading: true, isActivated: null });
    expect(screen.queryByText("Geschützter Inhalt")).not.toBeInTheDocument();
  });

  it("bietet dem unbestätigten Konto den Weg zurück ins Schaufenster an", () => {
    // Ohne diesen Hinweis liest sich der leere Bildschirm wie ein Fehler:
    // ausgeloggt sieht man mehr als eingeloggt-aber-unbestätigt.
    renderMit({ user: einNutzer, isActivated: false });
    expect(screen.getByRole("button", { name: /abmelden und weiterstöbern/i })).toBeInTheDocument();
  });
});
