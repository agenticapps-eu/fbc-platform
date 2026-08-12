import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useOverlay } from "./useOverlay";

/**
 * Sperre und Fokus-Falle für alle modalen Overlays (AGE-529).
 *
 * Was hier NICHT geprüft werden kann: ob iOS Safari sich an `position: fixed`
 * hält. jsdom hat kein Layout, kein Safari und kein visuelles Viewport. Geprüft
 * wird, dass die richtigen Stile gesetzt und die richtige Position
 * wiederhergestellt wird — der Rest ist die Sichtprobe am Gerät (Aufgabe 4.5).
 */

let scrollTo: ReturnType<typeof vi.fn>;

beforeEach(() => {
  scrollTo = vi.fn();
  Object.defineProperty(window, "scrollTo", { value: scrollTo, writable: true });
  Object.defineProperty(window, "scrollY", { value: 0, writable: true, configurable: true });
});

afterEach(() => {
  document.body.removeAttribute("style");
});

function setScrollY(y: number) {
  Object.defineProperty(window, "scrollY", { value: y, writable: true, configurable: true });
}

/** Ein Overlay mit drei fokussierbaren Knoten — erster, mittlerer, letzter. */
function Overlay({ aktiv, prefix = "o" }: { aktiv: boolean; prefix?: string }) {
  const ref = useOverlay(aktiv);
  if (!aktiv) return null;
  return (
    <div ref={ref} role="dialog" aria-modal="true" aria-label={prefix}>
      <button type="button">{prefix}-erster</button>
      <button type="button">{prefix}-mittlerer</button>
      <button type="button">{prefix}-letzter</button>
    </div>
  );
}

describe("useOverlay — die Sperre", () => {
  it("friert den body an der aktuellen Scroll-Position ein", () => {
    setScrollY(600);

    render(<Overlay aktiv />);

    expect(document.body.style.position).toBe("fixed");
    expect(document.body.style.top).toBe("-600px");
    expect(document.body.style.left).toBe("0px");
    expect(document.body.style.right).toBe("0px");
  });

  it("stellt die Scroll-Position beim Schließen exakt wieder her", () => {
    // Die wichtigste Zeile des ganzen Changes: `position: fixed` setzt den
    // Dokument-Scroll auf 0. Wer beim Schließen nur die Stile entfernt, wirft
    // den Leser an den Seitenanfang — das ist SCHLECHTER als gar keine Sperre.
    setScrollY(600);
    const { rerender } = render(<Overlay aktiv />);

    rerender(<Overlay aktiv={false} />);

    expect(scrollTo).toHaveBeenCalledWith(0, 600);
    expect(document.body.style.position).toBe("");
  });

  it("gibt vorbelegte Inline-Stile zurück, statt sie zu leeren", () => {
    // Ein global wiederverwendbarer Hook darf fremden Zustand nicht zerstören.
    document.body.style.top = "3px";
    document.body.style.position = "relative";
    setScrollY(120);
    const { rerender } = render(<Overlay aktiv />);

    rerender(<Overlay aktiv={false} />);

    expect(document.body.style.position).toBe("relative");
    expect(document.body.style.top).toBe("3px");
  });

  it("zählt: zwei Sperren, eine gelöst — die Seite bleibt gesperrt", () => {
    setScrollY(600);
    const { rerender } = render(
      <>
        <Overlay aktiv prefix="a" />
        <Overlay aktiv prefix="b" />
      </>,
    );

    rerender(
      <>
        <Overlay aktiv prefix="a" />
        <Overlay aktiv={false} prefix="b" />
      </>,
    );
    expect(document.body.style.position).toBe("fixed");
    expect(scrollTo).not.toHaveBeenCalled();

    rerender(
      <>
        <Overlay aktiv={false} prefix="a" />
        <Overlay aktiv={false} prefix="b" />
      </>,
    );
    expect(document.body.style.position).toBe("");
    expect(scrollTo).toHaveBeenCalledWith(0, 600);
  });
});

describe("useOverlay — die Fokus-Falle", () => {
  it("lenkt Tab vom letzten Knoten auf den ersten", () => {
    render(<Overlay aktiv />);
    const letzter = screen.getByText("o-letzter");
    letzter.focus();

    fireEvent.keyDown(document, { key: "Tab" });

    expect(document.activeElement).toBe(screen.getByText("o-erster"));
  });

  it("lenkt Shift-Tab vom ersten Knoten auf den letzten", () => {
    render(<Overlay aktiv />);
    screen.getByText("o-erster").focus();

    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });

    expect(document.activeElement).toBe(screen.getByText("o-letzter"));
  });

  it("holt den Fokus herein, wenn er außerhalb steht", () => {
    // Der Fall aus dem Plan-Review: DREI der vier Overlays versetzen den Fokus
    // beim Öffnen nicht. Ohne diesen Zweig steht er hinter dem Dialog und eine
    // Falle, die nur an den Rändern umlenkt, sieht ihn nie — `aria-modal` wäre
    // erneut eine Zusage, die der Code nicht einhält.
    render(
      <>
        <button type="button">draußen</button>
        <Overlay aktiv />
      </>,
    );
    screen.getByText("draußen").focus();

    fireEvent.keyDown(document, { key: "Tab" });

    expect(document.activeElement).toBe(screen.getByText("o-erster"));
  });

  it("versetzt den Fokus beim Öffnen NICHT", () => {
    // Die Lightbox setzt ihn selbst und genau einmal — sonst risse jeder
    // Bildwechsel ihn zurück auf „Schließen". Die Falle ergänzt das, sie
    // ersetzt es nicht.
    render(
      <>
        <button type="button">draußen</button>
        <Overlay aktiv />
      </>,
    );
    const draussen = screen.getByText("draußen");
    draussen.focus();

    render(<Overlay aktiv prefix="zweit" />);

    expect(document.activeElement).toBe(draussen);
  });

  it("lässt die untere Falle nicht in das obere Overlay hineingreifen", () => {
    // Der Fall, der die Besitzregel WIRKLICH prüft — und der erst beim
    // Mutationstest entstand: die erste Fassung („Fokus auf `unten-letzter`,
    // Tab → `oben-erster`") war grün, auch wenn man die Stapelspitze ignoriert.
    // Der zuletzt registrierte Zuhörer hat ohnehin das letzte Wort, also sah
    // man den Unterschied nicht.
    //
    // Sichtbar wird er nur MITTEN im oberen Overlay: dort soll gar niemand
    // umlenken (der Browser geht zum nächsten Knoten weiter). Ohne die
    // Besitzregel sähe die UNTERE Falle den Fokus als „außerhalb" an und risse
    // ihn aus dem oberen Overlay heraus.
    render(
      <>
        <Overlay aktiv prefix="unten" />
        <Overlay aktiv prefix="oben" />
      </>,
    );
    const mitte = screen.getByText("oben-mittlerer");
    mitte.focus();

    fireEvent.keyDown(document, { key: "Tab" });

    expect(document.activeElement).toBe(mitte);
  });
});

describe("useOverlay — die Fokus-Rückgabe", () => {
  it("gibt den Fokus an das auslösende Element zurück", () => {
    render(
      <>
        <button type="button">auslöser</button>
        <div id="halter" />
      </>,
    );
    const ausloeser = screen.getByText("auslöser");
    ausloeser.focus();

    const { rerender } = render(<Overlay aktiv />);
    screen.getByText("o-letzter").focus();
    rerender(<Overlay aktiv={false} />);

    expect(document.activeElement).toBe(ausloeser);
  });

  it("reißt den Fokus nicht aus einem noch offenen oberen Overlay", () => {
    // Aus dem Diff-Review: schließt ein UNTERES Overlay, während das obere noch
    // steht, gab seine Aufräumung den Fokus an den eigenen Auslöser zurück —
    // mitten aus dem sichtbaren Dialog heraus. Nur wer oben liegt, darf ihn
    // zurückgeben.
    render(<button type="button">auslöser</button>);
    screen.getByText("auslöser").focus();

    const { rerender } = render(
      <>
        <Overlay aktiv prefix="unten" />
        <Overlay aktiv prefix="oben" />
      </>,
    );
    const drin = screen.getByText("oben-mittlerer");
    drin.focus();

    rerender(
      <>
        <Overlay aktiv={false} prefix="unten" />
        <Overlay aktiv prefix="oben" />
      </>,
    );

    expect(document.activeElement).toBe(drin);
  });

  it("stellt erst die Scroll-Position her und fokussiert dann ohne zu scrollen", () => {
    // Beide Zusagen aus dem Design, die sonst still zurückfallen könnten:
    // `preventScroll` (ein gewöhnliches focus() zöge das Element in den Blick
    // und verschöbe genau die eben wiederhergestellte Position) und die
    // REIHENFOLGE — erst scrollTo, dann focus.
    const reihenfolge: string[] = [];
    scrollTo.mockImplementation(() => reihenfolge.push("scrollTo"));

    render(<button type="button">auslöser</button>);
    const ausloeser = screen.getByText("auslöser");
    // ERST wirklich fokussieren, DANN den Spion setzen — andernfalls merkt sich
    // der Hook `document.body` als Auslöser und der Test prüfte ins Leere.
    ausloeser.focus();
    const fokusSpion = vi.spyOn(ausloeser, "focus").mockImplementation(() => {
      reihenfolge.push("focus");
    });

    const { rerender } = render(<Overlay aktiv />);
    rerender(<Overlay aktiv={false} />);

    expect(fokusSpion).toHaveBeenCalledWith({ preventScroll: true });
    expect(reihenfolge).toEqual(["scrollTo", "focus"]);
  });

  it("bricht nicht, wenn der Auslöser inzwischen verschwunden ist", () => {
    const halter = document.createElement("div");
    document.body.appendChild(halter);
    const fluechtig = document.createElement("button");
    halter.appendChild(fluechtig);
    fluechtig.focus();

    const { rerender } = render(<Overlay aktiv />);
    halter.remove();

    expect(() => rerender(<Overlay aktiv={false} />)).not.toThrow();
  });
});

describe("useOverlay — Randfälle", () => {
  it("bricht nicht an einem Overlay ohne fokussierbaren Inhalt", () => {
    function Leer() {
      const ref = useOverlay(true);
      return (
        <div ref={ref} role="dialog" aria-modal="true">
          <p>nur Text</p>
        </div>
      );
    }
    render(<Leer />);

    expect(() => fireEvent.keyDown(document, { key: "Tab" })).not.toThrow();
    expect(document.body.style.position).toBe("fixed");
  });

  it("übergeht deaktivierte und ausgeblendete Knoten", () => {
    function MitLeichen() {
      const ref = useOverlay(true);
      return (
        <div ref={ref} role="dialog">
          <button type="button">echt-erster</button>
          <button type="button" disabled>
            tot
          </button>
          <input type="hidden" />
          <button type="button" tabIndex={-1}>
            unerreichbar
          </button>
          <button type="button">echt-letzter</button>
        </div>
      );
    }
    render(<MitLeichen />);
    screen.getByText("echt-letzter").focus();

    fireEvent.keyDown(document, { key: "Tab" });

    expect(document.activeElement).toBe(screen.getByText("echt-erster"));
  });
});
