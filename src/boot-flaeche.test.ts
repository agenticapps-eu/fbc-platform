import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  BAND_ANTEIL,
  QUER_SCHWELLE,
  RAMPE,
  SCHRIFTZUG_HOEHE,
  SCHRIFTZUG_OBEN,
  WEB_DATEIEN,
} from "../scripts/splash.logic";

/**
 * Die Boot-Fläche (AGE-642, B5) — geprüft an den drei Dateien, die sie tragen.
 *
 * Sie ist der einzige Teil dieser App, der ausserhalb von React lebt: Markup in
 * `index.html`, Regeln in `src/index.css`, entschieden von einem Inline-Skript
 * im `<head>`. Kein Bauteil-Test erreicht sie, jsdom zeichnet sie nicht, und
 * ein Fehler daran fällt erst am Gerät auf. Diese Datei ist deshalb die einzige
 * Stelle, an der die vier Zusagen zusammengehalten werden — und jede von ihnen
 * hat eine Mutation, die sie rot macht (siehe die Kommentare).
 */
const HTML = readFileSync("index.html", "utf8");
const CSS = readFileSync("src/index.css", "utf8");

/** Der Block einer Regel, roh — für Selektor-Fragen reicht der Text davor.
 *
 *  `[^{}]*` im Rumpf und nicht `[^}]*`: sonst schluckt der erste Treffer eines
 *  `@media`-Blocks dessen Bedingung als „Selektor" und die innere Regel als
 *  Rumpf — die Prüfung auf `data-boot` ginge dann fälschlich rot. So überspringt
 *  der Ausdruck den äusseren Block und findet die Regel darin. Für flache
 *  Regeln sind beide Fassungen identisch. */
function regelnMitUrl(css: string): { selektor: string; url: string }[] {
  const treffer: { selektor: string; url: string }[] = [];
  const muster = /([^{}]+)\{([^{}]*)\}/g;
  for (const [, selektor, rumpf] of css.matchAll(muster)) {
    for (const [, url] of rumpf.matchAll(/url\("([^"]+)"\)/g)) {
      treffer.push({ selektor: selektor.trim(), url });
    }
  }
  return treffer;
}

describe("Die Boot-Fläche steht im ausgelieferten Dokument", () => {
  // Mutation: das `<div class="boot-flaeche">` vor oder hinter `#root` schieben
  // → rot. Draussen räumt React es beim ersten `render()` NICHT weg, und die
  // Fläche bliebe über der Anwendung stehen.
  it("liegt innerhalb von `#root`, damit React sie beim Zeichnen wegräumt", () => {
    const root = HTML.match(/<div id="root">([\s\S]*?)<\/div>\s*<script type="module"/);
    expect(root, "`#root` nicht gefunden — hat sich der Aufbau von index.html geändert?").not.toBe(
      null,
    );
    expect(root?.[1]).toContain('class="boot-flaeche"');
  });

  // Mutation: die Fläche als `<img>` statt Hintergrundbild bauen → dieser Test
  // bliebe grün, deshalb steht die eigentliche Zusage weiter unten im CSS.
  // Hier zählt nur: sie ist Markup im Dokument und kein Anwendungscode.
  it("trägt beide Ebenen als Markup und nicht als Bauteil", () => {
    expect(HTML).toContain('class="boot-flaeche__band"');
    expect(HTML).toContain('class="boot-flaeche__schriftzug"');
  });
});

describe("Im Browser kostet sie nichts", () => {
  // Mutation: `display: none` aus der Vorgabe entfernen → rot. Ohne sie
  // erschiene die Fläche auf der Web-Seite, wo es gar keinen Startbildschirm
  // gibt, den sie fortsetzen könnte.
  it("ist ohne `data-boot` unsichtbar", () => {
    expect(CSS).toMatch(/\.boot-flaeche\s*\{\s*display:\s*none;\s*\}/);
  });

  // DIE Zusage dieses Blocks, und die einzige, die Bytes spart.
  // Mutation: `html[data-boot="nativ"]` aus einem der beiden Selektoren
  // streichen → rot. Der Browser lüde das Bild dann bei jedem Aufruf mit,
  // obwohl es dort nie gezeigt wird.
  it('nennt die Bilder ausschliesslich unter `html[data-boot="nativ"]`', () => {
    const mitUrl = regelnMitUrl(CSS).filter((r) => r.url.includes("/brand/splash-"));
    // An `WEB_DATEIEN` gebunden und nicht als Zahl hingeschrieben: eine vierte
    // Fassung soll diesen Test mitziehen, nicht ihn brechen.
    expect(mitUrl.length).toBe(Object.keys(WEB_DATEIEN).length);
    for (const r of mitUrl) {
      expect(r.selektor, `Regel ohne nativen Wächter: ${r.selektor}`).toContain(
        'html[data-boot="nativ"]',
      );
    }
  });

  // Mutation: die Bedingung im Inline-Skript entfernen → rot. Das Attribut
  // stünde dann immer, und mit ihm die Fläche.
  it("setzt `data-boot` nur, wenn Capacitor sich als nativ meldet", () => {
    const kopf = HTML.slice(0, HTML.indexOf("</head>"));
    expect(kopf).toContain("window.Capacitor.isNativePlatform()");
    expect(kopf).toContain('document.documentElement.dataset.boot = "nativ"');
  });
});

describe("Sie zeigt dieselbe Komposition wie der Startbildschirm", () => {
  // Mutation: eine der drei Zahlen im CSS verstellen → rot. Sie stehen als
  // Konstanten in `splash.logic.ts` und im Storyboard; das CSS ist die dritte
  // Stelle, und ohne diesen Test die einzige ungeprüfte.
  it("hängt an denselben Anteilen wie das Storyboard", () => {
    // `toBeCloseTo` und nicht `toBe`: 0.58 * 100 ist in IEEE-754
    // 57.99999999999999. Die Zusage gilt der Zahl im CSS, nicht der Rundung.
    const band = CSS.match(/\.boot-flaeche__band\s*\{[^}]*height:\s*([\d.]+)%/);
    expect(Number(band?.[1])).toBeCloseTo(BAND_ANTEIL * 100, 6);

    const zug = CSS.match(/\.boot-flaeche__schriftzug\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(Number(zug.match(/top:\s*([\d.]+)%/)?.[1])).toBeCloseTo(SCHRIFTZUG_OBEN * 100, 6);
    expect(Number(zug.match(/height:\s*([\d.]+)%/)?.[1])).toBeCloseTo(SCHRIFTZUG_HOEHE * 100, 6);
  });

  // Mutation: die Schwelle im CSS auf eine andere Zahl setzen, oder die Regel
  // auf `(orientation: landscape)` allein kürzen → rot. Sie ist die vierte Zahl
  // der Komposition und stünde sonst als einzige nur im Stylesheet. Von ihr
  // hängt ab, welche Geräte quer welches Band sehen: ein Tablet quer bekommt
  // nativ das Hochkantband, und eine reine Orientierungsregel risse dort die
  // Naht auf, die AGE-713 als nahtlos gemessen hat.
  it("nimmt quer unterhalb der Schwelle das quere Band", () => {
    const block = CSS.match(
      /@media\s*\(orientation:\s*landscape\)\s*and\s*\(max-height:\s*(\d+)px\)\s*\{([\s\S]*?)\n\}/,
    );
    expect(block, "keine Querregel im CSS gefunden").not.toBe(null);
    expect(Number(block?.[1])).toBe(QUER_SCHWELLE);
    expect(block?.[2]).toContain(`url("/brand/${WEB_DATEIEN.bandQuer}")`);
  });

  // Mutation: einen Stopp der Rampe streichen → rot. Mit zwei Stopps entstand
  // im Login-Panel eine sichtbare Kante bei 26 % — dieselbe Rampe, derselbe
  // Fehler, nur eine Fläche weiter.
  it("trägt alle vier Übergänge der Rampe, nicht einen", () => {
    const regel = CSS.match(/\.boot-flaeche__band\s*\{([^}]*)\}/)?.[1] ?? "";
    const verlauf = regel.match(/linear-gradient\(([\s\S]*?)\),\s*var\(--boot-band\)/)?.[1] ?? "";
    const stopps = [...verlauf.matchAll(/([\d.]+)%/g)].map((m) => Number(m[1]) / 100);
    expect(stopps).toEqual(RAMPE.map((s) => s.offset));
  });

  // Mutation: den Dateinamen im CSS ändern, ohne `pnpm splash` anzufassen →
  // rot. Ein `url()`, das ins Leere zeigt, fällt sonst nirgends auf: der
  // Browser lädt es nicht, und am Gerät ist die Ebene einfach weg.
  it("holt genau die Dateien, die `pnpm splash` schreibt", () => {
    for (const datei of Object.values(WEB_DATEIEN)) {
      expect(CSS).toContain(`url("/brand/${datei}")`);
    }
  });
});
