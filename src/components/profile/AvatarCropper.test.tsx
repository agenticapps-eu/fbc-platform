import { fireEvent, render, screen } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { AvatarCropper, cropGeometry } from "./AvatarCropper";

/**
 * Der Zuschnitt wird über seine GEOMETRIE geprüft, nicht über ein gerendertes
 * Canvas: jsdom hat keinen 2D-Kontext, ein Render-Test könnte also nur
 * behaupten, dass die Komponente nicht wirft. Die Rechnung ist das, was beim
 * Wechsel von quadratisch auf 3:1 kaputtgehen kann — also wird sie gemessen.
 */
describe("cropGeometry", () => {
  it("bleibt für den Avatar bei 512×512 — Regressionsschutz für den Bestandsaufruf", () => {
    const g = cropGeometry({ aspect: 1, outWidth: 512 });
    expect([g.outWidth, g.outHeight]).toEqual([512, 512]);
    expect([g.viewWidth, g.viewHeight]).toEqual([288, 288]);
  });

  it("liefert für das Hintergrundbild 3:1 — 1500×500", () => {
    const g = cropGeometry({ aspect: 3, outWidth: 1500 });
    expect([g.outWidth, g.outHeight]).toEqual([1500, 500]);
    expect(g.viewWidth / g.viewHeight).toBeCloseTo(3);
  });

  it("skaliert das Bild so, dass es den Ausschnitt IMMER füllt (kein Rand)", () => {
    // Ein hochkantes Bild in einem 3:1-Ausschnitt: die Breite ist die knappe
    // Kante, also muss über die Breite skaliert werden.
    const g = cropGeometry({ aspect: 3, outWidth: 1500, naturalWidth: 600, naturalHeight: 1800 });
    expect(g.baseScale * 600).toBeGreaterThanOrEqual(g.viewWidth);
    expect(g.baseScale * 1800).toBeGreaterThanOrEqual(g.viewHeight);
  });

  it("hält den Versatz innerhalb des Bildes — es entsteht nie ein Loch", () => {
    const g = cropGeometry({ aspect: 1, outWidth: 512, naturalWidth: 1000, naturalHeight: 1000 });
    // Weit über die Kante hinausgezogen …
    const geklemmt = g.clamp(9999, -9999, 1);
    expect(geklemmt.x).toBeLessThanOrEqual(0);
    expect(geklemmt.y).toBeGreaterThanOrEqual(g.viewHeight - 1000 * g.baseScale);
  });
});

/**
 * Hier wird nun DOCH gerendert — aber nicht, um zu behaupten, dass es nicht
 * wirft (der Einwand oben gilt weiter und ist der Grund, warum die Geometrie
 * getrennt gemessen wird). Gemessen wird die Overlay-Hygiene aus AGE-529, und
 * die hängt an nichts, was jsdom fehlt: Body-Stile und Fokus sind dort echt.
 *
 * Anschluss 2 von 4 an `useOverlay`. Der Fokusumlauf steht neben der Sperre,
 * weil die Sperre allein auch grün wäre, wenn der Ref nie am Container hinge.
 */
describe("AvatarCropper — Overlay-Hygiene", () => {
  beforeAll(() => {
    // jsdom kennt weder createObjectURL noch einen 2D-Kontext. Beides wird nur
    // gebraucht, damit die Komponente überhaupt bis zum Markup kommt; das Bild
    // lädt in jsdom ohnehin nie, `ready` bleibt false und es wird nichts gezeichnet.
    vi.stubGlobal("URL", { ...URL, createObjectURL: () => "blob:x", revokeObjectURL: () => {} });
  });
  afterAll(() => vi.unstubAllGlobals());

  function renderCropper() {
    return render(
      <AvatarCropper
        file={new File(["x"], "a.png", { type: "image/png" })}
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    );
  }

  it("sperrt die Seite dahinter und hält den Fokus im Zuschnitt", () => {
    const { unmount } = renderCropper();

    expect(document.body.style.position).toBe("fixed");

    const dialog = screen.getByRole("dialog");
    const knoten = Array.from(dialog.querySelectorAll<HTMLElement>("button, input"));
    expect(knoten.length).toBeGreaterThan(1);
    knoten[knoten.length - 1].focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(knoten[0]);

    unmount();
    expect(document.body.style.position).toBe("");
  });
});
