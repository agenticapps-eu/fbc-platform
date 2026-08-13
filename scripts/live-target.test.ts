import { describe, expect, test } from "vitest";

import { bestimmeLiveZiel, extractRefAusApiUrl } from "./live-target.logic";

const DEV_REF = "foelowldexkcqzewvrcf";
const PROD_REF = "viwntbodrtqxgmqyxluh";

const refs = { devRef: DEV_REF, prodRef: PROD_REF };

describe("extractRefAusApiUrl", () => {
  test("liest den Ref aus der API-URL", () => {
    expect(extractRefAusApiUrl(`https://${DEV_REF}.supabase.co`)).toBe(DEV_REF);
  });

  test("stört sich nicht an einem abschließenden Schrägstrich", () => {
    expect(extractRefAusApiUrl(`https://${PROD_REF}.supabase.co/`)).toBe(PROD_REF);
  });

  test("liefert null bei einer URL ohne Ref", () => {
    expect(extractRefAusApiUrl("https://example.com")).toBeNull();
  });

  test("liefert null bei etwas, das keine URL ist", () => {
    expect(extractRefAusApiUrl("foelowldexkcqzewvrcf")).toBeNull();
  });
});

describe("bestimmeLiveZiel", () => {
  test("trifft der Ref den DEV-Sollwert, wird DEV gemessen", () => {
    const e = bestimmeLiveZiel({ apiUrl: `https://${DEV_REF}.supabase.co`, ...refs });

    expect(e).toEqual({ kind: "ziel", umgebung: "dev", ref: DEV_REF });
  });

  test("trifft der Ref den PROD-Sollwert, wird PROD gemessen", () => {
    const e = bestimmeLiveZiel({ apiUrl: `https://${PROD_REF}.supabase.co`, ...refs });

    expect(e).toEqual({ kind: "ziel", umgebung: "prod", ref: PROD_REF });
  });

  // Der Fall aus dem Vorfall vom 2026-08-13: `prod` in Infisical zeigt auf das
  // DEV-Projekt. Die alte, fest verdrahtete Fassung mass hier PROD und blockierte
  // damit den Deploy wegen einer Datenbank, die niemand liest.
  test("der Build der prod-Umgebung zeigt heute auf DEV — und genau das kommt heraus", () => {
    const e = bestimmeLiveZiel({ apiUrl: `https://${DEV_REF}.supabase.co`, ...refs });

    expect(e.kind).toBe("ziel");
    expect(e).not.toMatchObject({ umgebung: "prod" });
  });

  test("ein unbekanntes Projekt bricht ab, statt auf PROD zurückzufallen", () => {
    const fremd = "zzzzyyyyxxxxwwwwvvvv";
    const e = bestimmeLiveZiel({ apiUrl: `https://${fremd}.supabase.co`, ...refs });

    expect(e.kind).toBe("abbruch");
    if (e.kind !== "abbruch") throw new Error("unerreichbar");
    expect(e.grund).toContain(fremd);
  });

  test("fehlende API-URL bricht ab", () => {
    expect(bestimmeLiveZiel({ apiUrl: undefined, ...refs }).kind).toBe("abbruch");
  });

  test("leere API-URL bricht ab", () => {
    expect(bestimmeLiveZiel({ apiUrl: "   ", ...refs }).kind).toBe("abbruch");
  });

  test("unparsbare API-URL bricht ab", () => {
    expect(bestimmeLiveZiel({ apiUrl: "kein-url", ...refs }).kind).toBe("abbruch");
  });

  // Dieselbe Haltung wie in evaluateStage1: ein Sollwert, der kein Ref ist,
  // darf nicht als Vergleichsmaßstab durchgehen — sonst wäre ein leerer oder
  // vertippter Dateiinhalt stillschweigend „passt nie".
  test("ein Sollwert, der kein Projekt-Ref ist, bricht ab", () => {
    const e = bestimmeLiveZiel({
      apiUrl: `https://${DEV_REF}.supabase.co`,
      devRef: "",
      prodRef: PROD_REF,
    });

    expect(e.kind).toBe("abbruch");
  });

  // Zwei identische Sollwerte hiessen: die beiden Umgebungen sind nicht mehr
  // unterscheidbar, und das Ergebnis waere reine Reihenfolge im Code.
  test("gleiche Sollwerte für beide Umgebungen brechen ab", () => {
    const e = bestimmeLiveZiel({
      apiUrl: `https://${DEV_REF}.supabase.co`,
      devRef: DEV_REF,
      prodRef: DEV_REF,
    });

    expect(e.kind).toBe("abbruch");
  });
});
