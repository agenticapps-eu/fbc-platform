import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MembershipSummary } from "./MembershipSummary";

// AGE-907: ohne `MemoryRouter`. Die Karte enthält keinen Link mehr, seit
// `showManageCta` mit dem Kaufweg entfallen ist — ein Router drumherum wäre
// Kulisse und ließe den nächsten Leser eine Navigation vermuten, die es hier
// nicht gibt.
function renderSummary(current: string | null) {
  render(<MembershipSummary current={current} />);
}

describe("MembershipSummary", () => {
  it("shows the current tier label and its next step", () => {
    renderSummary("basic");
    expect(screen.getByText("Basic")).toBeInTheDocument();
    expect(screen.getByText(/Nächster Schritt: Connect/)).toBeInTheDocument();
  });

  it("has no next step for the top tier", () => {
    renderSummary("impact");
    expect(screen.getByText("Impact")).toBeInTheDocument();
    expect(screen.queryByText(/Nächster Schritt/)).toBeNull();
  });

  it("falls back to Basic for null/unknown tier", () => {
    renderSummary(null);
    expect(screen.getByText("Basic")).toBeInTheDocument();
  });

  // AGE-907: Zwei Zusagen standen hier — „renders the manage CTA only when
  // requested" und „hides the CTA by default". Der Knopf ist mit dem ruhenden
  // Kaufweg entfallen, also gibt es keine Bedingung mehr zu prüfen, sondern nur
  // noch eine Abwesenheit. Und die trägt eine Positivkontrolle: ohne die zweite
  // Zeile wäre der Test auch grün, wenn die Karte gar nichts mehr rendert.
  it("trägt überhaupt keinen Weg zur Mitgliedschaft mehr", () => {
    renderSummary("discover");
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Deine Mitgliedschaft")).toBeInTheDocument();
  });
});
