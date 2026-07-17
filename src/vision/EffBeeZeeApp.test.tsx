import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EffBeeZeeApp } from "./EffBeeZeeApp";
import { SCREENS } from "./screens";
import { VISION_ITEMS } from "./nav";

describe("EffBeeZeeApp (Vision-Dummy)", () => {
  it("zeigt das Vorschau-Banner und startet auf dem Active-Screen", () => {
    render(<EffBeeZeeApp />);
    expect(screen.getByText(/Vorschau · in Entwicklung/)).toBeInTheDocument();
    expect(screen.getByText("Heute für dich empfohlen")).toBeInTheDocument();
  });

  it("wechselt den Screen über die state-basierte Navigation (keine toten Links)", () => {
    render(<EffBeeZeeApp />);
    const nav = screen.getByRole("navigation");
    fireEvent.click(within(nav).getByRole("button", { name: /Übersicht/ }));
    expect(screen.getByText("Willkommen zurück, Detlev!")).toBeInTheDocument();
  });

  it("hat für jeden der 18 Nav-Einträge einen Screen", () => {
    for (const item of VISION_ITEMS) {
      expect(SCREENS[item.key]).toBeTypeOf("function");
    }
  });
});

// Smoke: jeder Screen rendert ohne Fehler (fängt eine kaputte Fixture/Referenz).
describe("Vision-Screens rendern fehlerfrei", () => {
  for (const [key, Screen] of Object.entries(SCREENS)) {
    it(`Screen ${key}`, () => {
      const { container } = render(<Screen />);
      expect(container).not.toBeEmptyDOMElement();
    });
  }
});
