import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Icon } from "./icons";

/**
 * Der gezeichnete Zustand der Glyphen (AGE-582).
 *
 * `icons.test.ts` daneben ist ein Quelltext-Test: er hält fest, dass es NUR
 * diesen einen Satz gibt. Er sagt nichts darüber, wie ein Glyph aussieht — und
 * genau dort ist beim Zusammenführen etwas verlorengegangen, das erst der
 * Code-Review zum Diff gefunden hat.
 *
 * WAS PASSIERT WAR: die Regel „gefüllt ⇒ keine Kontur" stammt aus `NavIcon` und
 * ist dort richtig. Auf das Herz am Beitrag angewandt schrumpft es beim Klick um
 * eine halbe Strichstärke je Seite, statt wie vorher zu wachsen — die alte
 * `HeartIcon`-Fassung behielt `stroke` in beiden Zuständen und schaltete nur
 * `fill`. Bei `h-4` ist das sichtbar, und es passiert unter dem Finger.
 *
 * Die Sichtprobe der neunzehnten Sitzung hätte es nicht gefunden: sie deckte
 * Menü, Dashboard und zwei Seitenköpfe ab, den Like-Knopf nicht.
 */

function svgVon(el: HTMLElement) {
  const svg = el.querySelector("svg");
  if (!svg) throw new Error("kein <svg> gerendert");
  return { fill: svg.getAttribute("fill"), stroke: svg.getAttribute("stroke") };
}

describe("Icon", () => {
  it("das Herz behält seine Kontur in BEIDEN Zuständen — nur die Füllung schaltet", () => {
    const umriss = svgVon(render(<Icon name="heart" />).container);
    const gefuellt = svgVon(render(<Icon name="heart" variant="solid" />).container);

    expect(umriss).toEqual({ fill: "none", stroke: "currentColor" });
    expect(gefuellt).toEqual({ fill: "currentColor", stroke: "currentColor" });

    // Die eigentliche Aussage, unabhängig von den Werten oben: die Aussenkante
    // ändert sich nicht, weil die Strichstärke in beiden Fassungen zählt.
    expect(gefuellt.stroke).toBe(umriss.stroke);
  });

  it("ein Menü-Glyph legt seine Kontur beim Füllen ab — dort ist das gewollt", () => {
    const umriss = svgVon(render(<Icon name="home" />).container);
    const gefuellt = svgVon(render(<Icon name="home" variant="solid" />).container);

    expect(umriss).toEqual({ fill: "none", stroke: "currentColor" });
    expect(gefuellt).toEqual({ fill: "currentColor", stroke: "none" });
  });

  it("die Krone ist immer Fläche — sie kennt keinen Umriss-Zustand", () => {
    expect(svgVon(render(<Icon name="crown" />).container)).toEqual({
      fill: "currentColor",
      stroke: "none",
    });
  });
});
