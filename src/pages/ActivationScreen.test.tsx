import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ActivationScreen from "./ActivationScreen";
import { AuthFixture, fakeAuthValue } from "../test/auth-fixtures";
import { requestActivationLink, resendActivationLink } from "../lib/activation";

/**
 * Gemockt wird nur der Netzwerkrand. Der Bildschirm selbst läuft echt.
 *
 * Was hier festgehalten wird, ist kein Detail, sondern der Befund aus dem
 * Audit vom 2026-08-06: der eingeloggte Weg darf NICHT über
 * `requestActivationLink(email)` gehen. Diese Function ist unauthentifiziert
 * und nimmt eine frei wählbare Adresse entgegen — über sie konnte ein Fremder
 * den ausstehenden Link eines Mitglieds entwerten und es aussperren. Der
 * eingeloggte Weg geht über `resendActivationLink()`, deren Subjekt die Sitzung
 * ist (`auth.uid()` in `request_own_activation_token`).
 */
vi.mock("../lib/activation", async (orig) => {
  const echt = await orig<typeof import("../lib/activation")>();
  return {
    ...echt,
    requestActivationLink: vi.fn(async () => {}),
    resendActivationLink: vi.fn(async () => {}),
  };
});

function renderMit() {
  return render(
    <AuthFixture
      value={fakeAuthValue({
        isActivated: false,
        activationName: "Detlev",
        user: { id: "u1", email: "detlev@test.fbc" } as never,
      })}
    >
      <ActivationScreen />
    </AuthFixture>,
  );
}

describe("ActivationScreen", () => {
  beforeEach(() => {
    vi.mocked(requestActivationLink).mockClear();
    vi.mocked(resendActivationLink).mockClear();
  });

  it("fordert den Link über die Sitzung an, nicht über die Adresse", async () => {
    renderMit();

    fireEvent.click(screen.getByRole("button", { name: /Bestätigungslink senden/i }));

    await waitFor(() => expect(resendActivationLink).toHaveBeenCalledTimes(1));
    // Kein Argument: es gibt keine Adresse, die jemand fälschen könnte.
    expect(vi.mocked(resendActivationLink).mock.calls[0]).toEqual([]);
    expect(requestActivationLink).not.toHaveBeenCalled();
  });

  it("bestätigt den Versand und sperrt den Knopf für die Sperrfrist", async () => {
    renderMit();

    fireEvent.click(screen.getByRole("button", { name: /Bestätigungslink senden/i }));

    expect(await screen.findByText(/Der Link ist unterwegs/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Erneut senden in/i })).toBeDisabled();
  });

  /**
   * Der Absender ist seit dem 06.08.2026 `noreply@effbeezee.com`, der Rückkanal
   * bleibt `info@fairbusinessclub.de`. Der Bildschirm muss den Absender nennen,
   * weil die Aktivierungsmail bei importierten Konten der einzige Weg ins Konto
   * ist — ein Absender, den niemand angekündigt hat, ist von Phishing nicht zu
   * unterscheiden, und wer ihn nicht wiedererkennt, klickt nicht.
   *
   * _Korrektur 06.08.: hier stand, `effbeezee.com` sei „eine andere Domain als
   * die, unter der der Club auftritt". Das ist falsch — die Plattform heißt
   * **eff.bee.zee** (siehe `send-activation/emails.ts:82`, der Mailtext führt
   * den Namen selbst ein). Die Domain ist die ausgeschriebene Marke, nicht eine
   * fremde. Die Assertion bleibt trotzdem richtig, nur ihre Begründung war es
   * nicht._
   *
   * Der Test hält beide Hälften fest — angekündigter Absender UND Rückkanal —,
   * weil genau ihr Auseinanderfallen der Fehler wäre. Dass der Rückkanal
   * wirklich trägt, ist inzwischen am `Reply-To`-Header der zugestellten Mail
   * belegt, nicht nur hier behauptet.
   */
  it("kündigt den Absender an und nennt getrennt davon den Rückkanal", async () => {
    renderMit();

    fireEvent.click(screen.getByRole("button", { name: /Bestätigungslink senden/i }));

    const hinweis = await screen.findByText(/Der Link ist unterwegs/i);
    expect(hinweis).toHaveTextContent("noreply@effbeezee.com");
    // Der Rückkanal bleibt die Club-Domain — er steht woanders auf der Seite.
    expect(screen.getByRole("link", { name: /info@fairbusinessclub\.de/i })).toHaveAttribute(
      "href",
      "mailto:info@fairbusinessclub.de",
    );
  });

  it("meldet einen Transportfehler, ohne etwas über die Adresse zu verraten", async () => {
    vi.mocked(resendActivationLink).mockRejectedValueOnce(new Error("network"));
    renderMit();

    fireEvent.click(screen.getByRole("button", { name: /Bestätigungslink senden/i }));

    expect(await screen.findByText(/hat gerade nicht geklappt/i)).toBeInTheDocument();
  });
});
