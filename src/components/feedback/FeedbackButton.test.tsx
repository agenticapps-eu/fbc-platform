import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
});
