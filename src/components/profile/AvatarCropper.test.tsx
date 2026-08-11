import { describe, expect, it } from "vitest";
import { cropGeometry } from "./AvatarCropper";

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
