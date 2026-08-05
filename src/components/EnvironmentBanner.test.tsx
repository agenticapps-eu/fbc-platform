import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import EnvironmentBanner from "./EnvironmentBanner";

/**
 * Der Hinweis, dass gerade NICHT die Produktivumgebung im Browser steht
 * (AGE-496 Task 5).
 *
 * Ab C4 tragen DEV und PROD verschiedene Supabase-Projekte, sehen aber gleich
 * aus. Wer auf DEV eine Einladung verschickt oder ein Profil pflegt, tut das an
 * Demo-Daten — ohne Kennzeichnung merkt das niemand.
 *
 * Assertion auf den sichtbaren Text, nicht auf einen Klassennamen: ein Test
 * gegen `.env-banner` bliebe grün, wenn die Kennzeichnung unsichtbar würde.
 */
describe("Umgebungs-Hinweis", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("erscheint in der DEV-Umgebung", () => {
    vi.stubEnv("VITE_ENVIRONMENT", "dev");

    render(<EnvironmentBanner />);

    expect(screen.getByText(/Testumgebung/i)).toBeInTheDocument();
  });

  it("erscheint auch, wenn VITE_ENVIRONMENT gar nicht gesetzt ist", () => {
    vi.stubEnv("VITE_ENVIRONMENT", "");

    render(<EnvironmentBanner />);

    // Im Zweifel kennzeichnen. Eine fehlende Variable ist kein Beleg dafür,
    // dass hier die Produktivumgebung läuft.
    expect(screen.getByText(/Testumgebung/i)).toBeInTheDocument();
  });

  it("erscheint in der Produktivumgebung nicht", () => {
    vi.stubEnv("VITE_ENVIRONMENT", "prod");

    const { container } = render(<EnvironmentBanner />);

    expect(screen.queryByText(/Testumgebung/i)).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });
});
