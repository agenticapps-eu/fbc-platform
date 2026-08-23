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

  /**
   * Befund F2 aus AGE-495 (C3, Review-Restbefund): `isActivated === null`
   * deckt zwei verschiedene Lagen ab — „noch am Laden/Wiederholen" und, nach
   * drei Fehlversuchen, das endgültige „wir wissen es nicht" (siehe
   * AuthProvider.tsx). Bislang gab das Gate in BEIDEN Fällen `null` zurück:
   * dauerhaft nichts, ohne Meldung, ohne Ausweg. `activationLookupFailed`
   * unterscheidet die beiden Lagen.
   */
  describe("wenn die Prüfung endgültig aufgegeben hat (activationLookupFailed)", () => {
    it("zeigt eine Fehlermeldung mit Wiederholen-Option statt dauerhaft nichts", () => {
      renderMit({ user: einNutzer, isActivated: null, activationLookupFailed: true });
      expect(screen.queryByText("Geschützter Inhalt")).not.toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: /Noch ein Schritt/i })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /erneut versuchen/i })).toBeInTheDocument();
    });

    it("löst beim Klick auf den Wiederholen-Knopf einen Seiten-Reload aus", () => {
      const reload = vi.fn();
      const originalLocation = window.location;
      Object.defineProperty(window, "location", {
        configurable: true,
        value: { ...originalLocation, reload },
      });

      renderMit({ user: einNutzer, isActivated: null, activationLookupFailed: true });
      screen.getByRole("button", { name: /erneut versuchen/i }).click();
      expect(reload).toHaveBeenCalledTimes(1);

      Object.defineProperty(window, "location", {
        configurable: true,
        value: originalLocation,
      });
    });

    it("bleibt bei WEDER-NOCH, solange nur gewartet wird (activationLookupFailed: false)", () => {
      // Löschprobe für die beiden Tests oben: ohne activationLookupFailed:true
      // bleibt das alte Warten-Verhalten unverändert — die neue Fehlermeldung
      // erscheint NICHT von selbst, nur weil isActivated null ist.
      renderMit({ user: einNutzer, isActivated: null, activationLookupFailed: false });
      expect(screen.queryByRole("button", { name: /erneut versuchen/i })).not.toBeInTheDocument();
    });
  });

  /**
   * AGE-581: dem Konto wurde der Zugang entzogen — deaktiviert oder gelöscht.
   *
   * Ohne eigenen Zweig liefe ein gesperrtes Konto in einen von zwei falschen
   * Bildschirmen. Hat es nie bestätigt, sieht es den Aktivierungsbildschirm und
   * darf sich einen Zugangslink schicken lassen, für einen Zugang, den es nicht
   * mehr gibt. Hat es bestätigt, kommt es sogar DURCH die Wand — `activated`
   * behält seine Bedeutung („hat je bestätigt") und wird von der Sperre nicht
   * umgedeutet — und schaut dann auf lauter leere Seiten, weil die RLS ihm
   * überall nichts liefert.
   */
  describe("wenn dem Konto der Zugang entzogen wurde (isBlocked)", () => {
    it("zeigt den Sperrhinweis statt des Inhalts — auch wenn das Konto bestätigt hat", () => {
      // Der wichtigere der beiden Fälle: `isActivated: true` käme ohne den
      // neuen Zweig durch und landete auf leeren Seiten.
      renderMit({ user: einNutzer, isActivated: true, isBlocked: true });
      expect(screen.queryByText("Geschützter Inhalt")).not.toBeInTheDocument();
      expect(screen.getByRole("heading", { name: /Zugang gesperrt/i })).toBeInTheDocument();
    });

    it("zeigt den Sperrhinweis auch dem nie bestätigten Konto — nicht die Aktivierungswand", () => {
      renderMit({ user: einNutzer, isActivated: false, isBlocked: true });
      expect(screen.queryByRole("heading", { name: /Noch ein Schritt/i })).not.toBeInTheDocument();
      expect(screen.getByRole("heading", { name: /Zugang gesperrt/i })).toBeInTheDocument();
    });

    it("bietet KEINEN Zugangslink an — der Zugang ist weg, nicht unbestätigt", () => {
      renderMit({ user: einNutzer, isActivated: false, isBlocked: true });
      expect(screen.queryByRole("button", { name: /link/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /erneut senden/i })).not.toBeInTheDocument();
    });

    it("verrät nicht, WELCHE der beiden Handlungen ein Admin vorgenommen hat", () => {
      // `blocked` ist ein Wahrheitswert und kein Zustandswort. Stünde
      // „deaktiviert" oder „gelöscht" auf dem Schirm, wäre die Entscheidung
      // gegen ein Zustandswort in der Datenbank an der Oberfläche wieder
      // aufgehoben.
      renderMit({ user: einNutzer, isActivated: true, isBlocked: true });
      expect(document.body.textContent).not.toMatch(/deaktiviert|gelöscht|geloescht/i);
    });

    it("lässt einen Weg offen: abmelden", () => {
      renderMit({ user: einNutzer, isActivated: true, isBlocked: true });
      expect(screen.getByRole("button", { name: /abmelden/i })).toBeInTheDocument();
    });

    it("bleibt ohne isBlocked beim alten Verhalten", () => {
      // Löschprobe für die fünf Zusagen oben: der neue Zweig darf sich nicht
      // von selbst einschalten, sonst sähe JEDES unbestätigte Konto den
      // Sperrhinweis statt der Wand.
      renderMit({ user: einNutzer, isActivated: false, isBlocked: false });
      expect(screen.getByRole("heading", { name: /Noch ein Schritt/i })).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: /Zugang gesperrt/i })).not.toBeInTheDocument();
    });
  });
});
