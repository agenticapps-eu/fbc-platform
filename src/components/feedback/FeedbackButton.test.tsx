import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthFixture, fakeAuthValue } from "../../test/auth-fixtures";
import type { AuthContextValue } from "../../providers/auth-context";
import { ToastProvider } from "../ui/Toast";

vi.mock("../../lib/feedback", () => ({ submitPlatformFeedback: vi.fn() }));
import { submitPlatformFeedback } from "../../lib/feedback";
import { FeedbackButton } from "./FeedbackButton";

const mockedSubmit = vi.mocked(submitPlatformFeedback);

beforeEach(() => {
  mockedSubmit.mockReset();
  mockedSubmit.mockResolvedValue();
});

function renderAt(
  route: string,
  user: AuthContextValue["user"] | null = { id: "u1" } as AuthContextValue["user"],
) {
  const value = fakeAuthValue({ user, tier: "basic", levelRank: 1 });
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AuthFixture value={value}>
        <ToastProvider>
          <FeedbackButton />
        </ToastProvider>
      </AuthFixture>
    </MemoryRouter>,
  );
}

describe("FeedbackButton", () => {
  it("bleibt für nicht eingeloggte Besucher unsichtbar — sie können ohnehin nicht speichern", () => {
    renderAt("/", null);
    expect(screen.queryByRole("button", { name: /feedback/i })).toBeNull();
  });

  it("sperrt das Absenden, solange keine Sterne gewählt sind", () => {
    renderAt("/");
    fireEvent.click(screen.getByRole("button", { name: /feedback/i }));
    expect(screen.getByRole("button", { name: /absenden/i })).toBeDisabled();
  });

  it("schickt Sterne, Texte und die aktuelle Route", async () => {
    renderAt("/meine-chancen");
    fireEvent.click(screen.getByRole("button", { name: /feedback/i }));
    fireEvent.click(screen.getByRole("radio", { name: "4 von 5 Sternen" }));
    fireEvent.change(screen.getByLabelText(/was gefällt dir/i), {
      target: { value: "Der Compass" },
    });
    fireEvent.change(screen.getByLabelText(/was fehlt dir/i), { target: { value: "Nichts" } });
    fireEvent.change(screen.getByLabelText(/welche idee/i), { target: { value: "Mehr Events" } });
    fireEvent.click(screen.getByRole("button", { name: /absenden/i }));

    await waitFor(() =>
      expect(mockedSubmit).toHaveBeenCalledWith({
        profileId: "u1",
        rating: 4,
        likes: "Der Compass",
        misses: "Nichts",
        idea: "Mehr Events",
        route: "/meine-chancen",
      }),
    );
  });

  it("zeigt einen Fehler an, statt ihn verschwinden zu lassen", async () => {
    mockedSubmit.mockRejectedValue(new Error("kaputt"));
    renderAt("/");
    fireEvent.click(screen.getByRole("button", { name: /feedback/i }));
    fireEvent.click(screen.getByRole("radio", { name: "5 von 5 Sternen" }));
    fireEvent.click(screen.getByRole("button", { name: /absenden/i }));

    expect(await screen.findByText(/konnte nicht gespeichert werden/i)).toBeInTheDocument();
  });

  // ── Overlay-Hygiene (AGE-529) ────────────────────────────────────────────

  it("sperrt die Seite dahinter und hält den Fokus im Panel", () => {
    // Anschluss 3 von 4 an `useOverlay`. Der Fokusumlauf steht neben der
    // Body-Sperre, weil die Sperre allein auch dann grün wäre, wenn der Ref nie
    // am Container hinge.
    renderAt("/");
    fireEvent.click(screen.getByRole("button", { name: /feedback/i }));

    expect(document.body.style.position).toBe("fixed");

    const dialog = screen.getByRole("dialog");
    // Dieselbe Menge, die der Hook sieht — NICHT `getAllByRole("button")`: die
    // Sterne tragen `role="radio"` und fielen dort heraus, der CSS-Selektor des
    // Hooks kennt sie aber. Die erste Fassung dieses Tests scheiterte genau
    // daran, und der Hook hatte recht.
    const knoten = Array.from(dialog.querySelectorAll<HTMLElement>("button, textarea"));
    knoten[knoten.length - 1].focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(knoten[0]);

    fireEvent.click(within(dialog).getByRole("button", { name: /abbrechen/i }));
    expect(document.body.style.position).toBe("");
  });

  it("schwebt unter sm nicht mehr — dort verdeckte er die Composer-Kacheln", () => {
    // Gemessen auf 375×812 (AGE-528, Task 9.7): der feste Knopf lag über der
    // kuratierten Kachel „Frage", `elementFromPoint` in deren Mitte lieferte
    // „Feedback".
    //
    // Diese Zusicherung ist bewusst SCHWACH und sagt das auch: jsdom hat kein
    // Layout und kennt keine Breakpoints, `elementFromPoint` liefert dort
    // nichts Brauchbares. Geprüft wird nur, dass das Schweben an `sm` hängt —
    // die echte Messung braucht einen Browser und steht in der Abnahme (4.3).
    renderAt("/");
    const knopf = screen.getByRole("button", { name: /feedback/i });
    const klassen = knopf.className.split(/\s+/);

    expect(klassen).toContain("sm:fixed");
    expect(klassen).not.toContain("fixed");
  });
});
