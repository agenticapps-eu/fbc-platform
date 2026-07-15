import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { COMPASS_STEPS } from "../config/compass";
import { isSkipped, loadDraft } from "../lib/compass";
import { AuthFixture, authAsTier } from "../test/auth-fixtures";
import OnboardingPage from "./OnboardingPage";

afterEach(() => localStorage.clear());

function renderOnboarding() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <AuthFixture value={authAsTier("basic")}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/onboarding"]}>
          <OnboardingPage />
        </MemoryRouter>
      </QueryClientProvider>
    </AuthFixture>,
  );
}

describe("OnboardingPage — geführter Flow (ein Schritt pro Frage)", () => {
  it("zeigt einen Schritt nach dem anderen und navigiert vor/zurück", () => {
    renderOnboarding();

    expect(screen.getByText(`Schritt 1 von ${COMPASS_STEPS.length}`)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Weiter" }));
    expect(screen.getByText(`Schritt 2 von ${COMPASS_STEPS.length}`)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "← Zurück" }));
    expect(screen.getByText(`Schritt 1 von ${COMPASS_STEPS.length}`)).toBeInTheDocument();
  });

  it("zeigt auf dem letzten Schritt den Abschluss-Button statt „Weiter“", () => {
    renderOnboarding();
    for (let i = 0; i < COMPASS_STEPS.length - 1; i++) {
      fireEvent.click(screen.getByRole("button", { name: "Weiter" }));
    }
    expect(
      screen.getByText(`Schritt ${COMPASS_STEPS.length} von ${COMPASS_STEPS.length}`),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Compass abschließen" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Weiter" })).not.toBeInTheDocument();
  });

  it("merkt sich „Überspringen“ (später nicht erneut zwangsweise zeigen)", () => {
    renderOnboarding();
    expect(isSkipped("test-user")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Überspringen" }));
    expect(isSkipped("test-user")).toBe(true);
  });

  it("persistiert eine Skala-Antwort in den Entwurf (localStorage)", () => {
    const scaleIdx = COMPASS_STEPS.findIndex((s) => s.kind === "scale");
    expect(scaleIdx).toBeGreaterThanOrEqual(0);
    renderOnboarding();
    for (let i = 0; i < scaleIdx; i++) {
      fireEvent.click(screen.getByRole("button", { name: "Weiter" }));
    }
    fireEvent.change(screen.getByRole("slider"), { target: { value: "8" } });
    expect(loadDraft("test-user").scales[COMPASS_STEPS[scaleIdx].id]).toBe(8);
  });

  it("schaltet eine Chip-Auswahl um und persistiert sie", () => {
    const chipsIdx = COMPASS_STEPS.findIndex((s) => s.kind === "chips");
    const step = COMPASS_STEPS[chipsIdx];
    if (step.kind !== "chips") throw new Error("kein Chip-Schritt im Katalog");
    const opt = step.options[0];

    renderOnboarding();
    for (let i = 0; i < chipsIdx; i++) {
      fireEvent.click(screen.getByRole("button", { name: "Weiter" }));
    }
    const chip = screen.getByRole("button", { name: opt.label });
    expect(chip).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(chip);
    expect(chip).toHaveAttribute("aria-pressed", "true");
    expect(loadDraft("test-user").chips[step.id]).toContain(opt.value);
  });
});
