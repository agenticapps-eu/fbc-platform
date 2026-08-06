import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ActivationRedeemPage from "./ActivationRedeemPage";
import { AuthContext } from "../providers/auth-context";
import { fakeAuthValue } from "../test/auth-fixtures";
import { redeemActivation, requestActivationLink } from "../lib/activation";

/**
 * Gemockt wird nur der Netzwerkrand. Die Seite selbst — Formular, Statuslogik,
 * die sieben Fälle aus AGE-495 §6 — läuft echt.
 *
 * `leseTokenAusFragment` bleibt ungemockt und liest wirklich aus `location.hash`:
 * dass das Token im FRAGMENT steht und danach aus der Adresszeile verschwindet,
 * ist eine Anforderung und keine Implementierungsnebensache.
 */
vi.mock("../lib/activation", async (orig) => {
  const echt = await orig<typeof import("../lib/activation")>();
  return {
    ...echt,
    redeemActivation: vi.fn(),
    requestActivationLink: vi.fn(async () => {}),
  };
});

const navigate = vi.fn();
vi.mock("react-router-dom", async (orig) => {
  const echt = await orig<typeof import("react-router-dom")>();
  return { ...echt, useNavigate: () => navigate };
});

function renderMit(hash: string, auth = {}) {
  window.history.replaceState(null, "", `/aktivierung${hash}`);
  return render(
    <AuthContext.Provider value={fakeAuthValue({ isActivated: false, ...auth })}>
      <MemoryRouter>
        <ActivationRedeemPage />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

function passwortSetzen(wert: string) {
  fireEvent.change(screen.getByLabelText(/Neues Passwort/i), { target: { value: wert } });
  fireEvent.click(screen.getByRole("button", { name: /Zugang freischalten/i }));
}

describe("ActivationRedeemPage", () => {
  beforeEach(() => {
    vi.mocked(redeemActivation).mockReset();
    vi.mocked(requestActivationLink).mockClear();
    navigate.mockClear();
  });

  it("liest das Token aus dem Fragment und räumt die Adresszeile auf", () => {
    renderMit("#token=geheim");
    // Die Anforderung: das Token darf danach nicht mehr in der Adresse stehen —
    // weder für einen Screenshot noch für die Browser-Historie.
    expect(window.location.hash).toBe("");
    expect(screen.getByLabelText(/Neues Passwort/i)).toBeInTheDocument();
  });

  it("lehnt ein zu kurzes Passwort im Formular ab, ohne zu senden", () => {
    renderMit("#token=geheim");
    passwortSetzen("kurz");
    expect(redeemActivation).not.toHaveBeenCalled();
    // Die Feldmeldung, nicht der erklärende Vorspann — beide nennen die Zahl.
    expect(screen.getByText(/Das Passwort braucht mindestens 10 Zeichen/i)).toBeInTheDocument();
  });

  it("löst mit gültigem Token ein und schickt danach zur Anmeldung", async () => {
    vi.mocked(redeemActivation).mockResolvedValue("activated");
    renderMit("#token=geheim");
    passwortSetzen("EinLangesPasswort");
    await waitFor(() =>
      expect(redeemActivation).toHaveBeenCalledWith("geheim", "EinLangesPasswort"),
    );
    // Alle Sitzungen sind widerrufen, auch die eigene — eine tote Session
    // weiterzutragen wäre falsch.
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/login", { replace: true }));
  });

  it("Status expired nennt die Frist und bietet einen neuen Link an", async () => {
    vi.mocked(redeemActivation).mockResolvedValue("expired");
    renderMit("#token=alt");
    passwortSetzen("EinLangesPasswort");
    expect(await screen.findByText(/abgelaufen/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Neuen Link senden/i })).toBeInTheDocument();
  });

  it("Status used sagt: Konto ist aktiviert, und führt zum Login", async () => {
    vi.mocked(redeemActivation).mockResolvedValue("used");
    renderMit("#token=verbraucht");
    passwortSetzen("EinLangesPasswort");
    expect(await screen.findByText(/bereits aktiviert/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Jetzt anmelden/i })).toBeInTheDocument();
  });

  it("Status superseded sagt NICHT bereits-aktiviert — das Konto ist es gerade nicht", async () => {
    // Der Kern von Task 12.4: mit einer gemeinsamen Meldung bekäme jemand, der
    // zweimal anfordert und den ersten Link klickt, eine falsche Auskunft.
    vi.mocked(redeemActivation).mockResolvedValue("superseded");
    renderMit("#token=ueberholt");
    passwortSetzen("EinLangesPasswort");
    const meldung = await screen.findByText(/nicht mehr gültig/i);
    expect(meldung).toBeInTheDocument();
    expect(screen.queryByText(/bereits aktiviert/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Neuen Link senden/i })).toBeInTheDocument();
  });

  it("zeigt ohne Token das Anforderungsformular — der Weg bei übernommenem Passwort", () => {
    renderMit("");
    expect(
      screen.getByRole("heading", { name: /Bestätigungslink anfordern/i }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/Neues Passwort/i)).not.toBeInTheDocument();
  });

  it("fordert einen Link an und verrät dabei nicht, ob es die Adresse gibt", async () => {
    renderMit("");
    fireEvent.change(screen.getByLabelText(/E-Mail-Adresse/i), {
      target: { value: "wer@auch.immer" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Neuen Link senden/i }));
    await waitFor(() => expect(requestActivationLink).toHaveBeenCalledWith("wer@auch.immer"));
    expect(
      await screen.findByText(/Wenn es zu dieser Adresse ein Konto gibt/i),
    ).toBeInTheDocument();
  });

  it("leitet ein bereits aktiviertes Konto ohne Token still auf die Startseite", async () => {
    // Fall 3 aus §6: alter Link im Postfach, Konto längst aktiv. Keine
    // Fehlermeldung — das Mitglied hat nichts falsch gemacht.
    renderMit("", { user: { id: "u1", email: "m@test.fbc" } as never, isActivated: true });
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/", { replace: true }));
  });

  it("leitet einen AUSGELOGGTEN Besucher NICHT weg — das ist der Weg zurück", async () => {
    // Für Ausgeloggte ist isActivated true (es gibt nichts zu aktivieren). Ohne
    // die user-Bedingung landete genau das Mitglied auf der Startseite, dessen
    // Passwort ein Dritter übernommen hat — und käme nie an einen neuen Link.
    // Beim Betrachten der laufenden Oberfläche gefunden.
    renderMit("", { user: null, isActivated: true });
    expect(navigate).not.toHaveBeenCalled();
    expect(
      screen.getByRole("heading", { name: /Bestätigungslink anfordern/i }),
    ).toBeInTheDocument();
  });
});
