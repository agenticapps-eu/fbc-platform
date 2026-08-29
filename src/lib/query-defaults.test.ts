import { describe, expect, it } from "vitest";

import { queryVorgaben } from "./query-defaults";

describe("queryVorgaben", () => {
  // Die wichtigere der beiden Zusagen, und deshalb zuerst: im Web darf sich
  // NICHTS ändern. Donalds Entscheidung vom 28.08. war ausdrücklich „nur nativ
  // zähmen". Ein leeres Objekt heisst: `QueryClient` bleibt bei den Vorgaben
  // von react-query, genau wie vor diesem Change.
  it("lässt das Web unverändert", () => {
    expect(queryVorgaben(false)).toEqual({});
  });

  it("zähmt nativ das Nachladen beim Zurückwechseln in die App", () => {
    expect(queryVorgaben(true)).toEqual({
      defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
    });
  });

  // Der eigentliche Zweck, noch einmal als Verneinung: ohne diese Zusage wäre
  // ein Rückfall auf `refetchOnWindowFocus: true` (die react-query-Vorgabe)
  // nicht von einer bestandenen Prüfung zu unterscheiden — und genau der
  // Rückfall kostet auf dem Telefon Datenvolumen.
  it("holt nativ NICHT bei jedem Fokuswechsel neu", () => {
    expect(queryVorgaben(true).defaultOptions?.queries?.refetchOnWindowFocus).toBe(false);
  });

  it("gibt nativ eine Frist an, statt jede Abfrage sofort als veraltet zu führen", () => {
    expect(queryVorgaben(true).defaultOptions?.queries?.staleTime).toBeGreaterThan(0);
  });
});
