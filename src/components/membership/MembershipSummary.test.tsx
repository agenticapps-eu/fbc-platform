import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { MembershipSummary } from "./MembershipSummary";

function renderSummary(current: string | null, showManageCta = false) {
  render(
    <MemoryRouter>
      <MembershipSummary current={current} showManageCta={showManageCta} />
    </MemoryRouter>,
  );
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

  it("renders the manage CTA only when requested", () => {
    renderSummary("discover", true);
    const link = screen.getByRole("link", { name: /Mitgliedschaft verwalten/i });
    expect(link).toHaveAttribute("href", "/mitgliedschaft");
  });

  it("hides the CTA by default", () => {
    renderSummary("discover");
    expect(screen.queryByRole("link", { name: /Mitgliedschaft verwalten/i })).toBeNull();
  });
});
