import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Die Farben der Nachrichtenleiste — gerechnet, nicht geschätzt (AGE-1002).
 *
 * ══ WARUM DAS EIN TEST IST UND KEINE NOTIZ ════════════════════════════════
 * Detlev hat `#002B51` vorgegeben. Die Farbe zu setzen ist ein Einzeiler; die
 * Arbeit ist die Lesbarkeit, und die hängt an drei Flächen, die sich um wenige
 * Prozent unterscheiden — Grundfläche, Zeile unter dem Mauszeiger, aktive
 * Zeile. Die naheliegende Wahl fällt dabei durch: eine gefüllte Aktivfläche in
 * der Akzentfarbe der Navigation (`#1F53B0`) trägt den Vorschautext nur mit
 * 2,9:1.
 *
 * In einer Notiz wäre das in sechs Wochen wieder offen. Als Test wird jede
 * Farbänderung rot, die eine Schwelle reisst.
 *
 * ══ UND WARUM HIER UND NICHT IM BILD ══════════════════════════════════════
 * Dieser Test liest die TOKENWERTE aus `index.css`. Er belegt damit, dass die
 * gewählten Farben die Norm erfüllen — **nicht**, dass eine Fläche in der
 * laufenden Anwendung wirklich diese Farbe trägt. Das ist die Sichtprobe, und
 * sie ist eine eigene Aufgabe. Zwei verschiedene Fragen, zwei verschiedene
 * Belege.
 */

const CSS = readFileSync("src/index.css", "utf8");

/** Die Tokens, die `ThreadList` und die Kopfzeilen der Leiste lesen. */
const LEISTEN_TOKENS = [
  "--chat-rail-surface",
  "--thread-ink",
  "--thread-muted",
  "--thread-hover",
  "--thread-active",
  "--thread-line",
  "--thread-badge",
  "--thread-badge-ink",
  "--thread-focus",
  "--thread-chrome-ink",
  "--thread-chrome-ink-hover",
] as const;

/**
 * Die Tokens, die der sekundäre Knopf in der Leiste liest — ALLE fünf.
 *
 * Die erste Fassung dieses Tests prüfte `--color-chrome` und
 * `--color-on-chrome`, also genau die zwei, die umgelegt WAREN. Sie konnte
 * deshalb nicht sehen, dass `hover:bg-chrome-elevated` auf dem navy-Wert stehen
 * geblieben war und die Schrift beim Überfahren mit 1,0:1 verschwand. Ein Test,
 * der nur prüft, was man schon getan hat, ist kein Wächter.
 */
const KNOPF_TOKENS = [
  "--color-chrome",
  "--color-on-chrome",
  "--color-chrome-elevated",
  "--color-chrome-border",
  "--color-soft",
] as const;

/**
 * CSS ohne Blockkommentare. `block()` zählt rohe Klammern; eine `{` in einem
 * Kommentar verschöbe den Schnitt still. Heute enthält keiner eine — geprüft —,
 * aber „heute keiner" ist keine Zusage über morgen. Befund des Code-Reviews.
 */
const CSS_OHNE_KOMMENTARE = CSS.replace(/\/\*[\s\S]*?\*\//g, "");

/** Schneidet den Rumpf einer Regel heraus, deren Selektor exakt so beginnt. */
function block(selektor: string): string {
  const CSS = CSS_OHNE_KOMMENTARE;
  const i = CSS.indexOf(selektor);
  if (i < 0) throw new Error(`Selektor nicht gefunden: ${selektor}`);
  const auf = CSS.indexOf("{", i);
  let tiefe = 0;
  for (let k = auf; k < CSS.length; k++) {
    if (CSS[k] === "{") tiefe++;
    else if (CSS[k] === "}") {
      tiefe--;
      if (tiefe === 0) return CSS.slice(auf + 1, k);
    }
  }
  throw new Error(`Rumpf nicht geschlossen: ${selektor}`);
}

function wert(rumpf: string, token: string): string | null {
  const m = new RegExp(`${token}:\\s*([^;]+);`).exec(rumpf);
  return m ? m[1].trim() : null;
}

// ── Farbrechnung ────────────────────────────────────────────────────────────
// Bewusst klein gehalten und ohne Abhängigkeit: `#rrggbb` und
// `rgb(r g b / a)`, mehr kommt in diesen Tokens nicht vor. Ein Format, das
// hier nicht vorkommt, soll WERFEN statt stillschweigend 0 zu liefern —
// sonst wäre eine Farbe, die niemand lesen kann, ein grüner Test.
type Farbe = { r: number; g: number; b: number; a: number };

function parse(s: string): Farbe {
  const hex = /^#([0-9a-f]{6})$/i.exec(s.trim());
  if (hex) {
    const n = parseInt(hex[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
  }
  const rgb = /^rgb\(\s*(\d+)\s+(\d+)\s+(\d+)\s*\/\s*([\d.]+)\s*\)$/.exec(s.trim());
  if (rgb) {
    return { r: +rgb[1], g: +rgb[2], b: +rgb[3], a: +rgb[4] };
  }
  throw new Error(`Farbformat nicht unterstuetzt: ${s}`);
}

/** Legt `vorn` über `hinten` — für die halbtransparenten Zustandsflächen. */
function ueber(vorn: Farbe, hinten: Farbe): Farbe {
  const m = (v: number, h: number) => Math.round(vorn.a * v + (1 - vorn.a) * h);
  return { r: m(vorn.r, hinten.r), g: m(vorn.g, hinten.g), b: m(vorn.b, hinten.b), a: 1 };
}

function leuchtdichte(f: Farbe): number {
  const k = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * k(f.r) + 0.7152 * k(f.g) + 0.0722 * k(f.b);
}

function kontrast(a: Farbe, b: Farbe): number {
  const [hell, dunkel] = [leuchtdichte(a), leuchtdichte(b)].sort((x, y) => y - x);
  return (hell + 0.05) / (dunkel + 0.05);
}

const auf2 = (n: number) => Math.round(n * 100) / 100;

// ── Alle `var(--…)` aus dem Quellbaum sammeln ──────────────────────────────
function dateien(verzeichnis: string): string[] {
  return readdirSync(verzeichnis).flatMap((name) => {
    const pfad = join(verzeichnis, name);
    if (statSync(pfad).isDirectory()) return dateien(pfad);
    return /\.(tsx?|css)$/.test(name) ? [pfad] : [];
  });
}

describe("Nachrichtenleiste: die Tokens sind gesetzt", () => {
  it("führt alle Leisten-Tokens mit einem Rückfall im @theme-Block", () => {
    // `@theme` und nicht `:root`: dieses Repo nutzt Tailwind v4, und die Tokens
    // stehen dort. Die erste Fassung dieses Tests suchte in `:root` und war
    // deshalb rot, obwohl die Tokens gesetzt waren — der Test stand an der
    // falschen Stelle, nicht die Zusage.
    const wurzel = block("@theme");
    for (const token of LEISTEN_TOKENS) {
      expect(wert(wurzel, token), `${token} fehlt auf :root`).not.toBeNull();
    }
  });

  it("laesst den hellen Modus unveraendert — Wert fuer Wert", () => {
    // Die Spec sagt „im hellen Modus ändert sich NICHTS, kein Pixel". Das ist
    // eine Zusage und keine Absicht, also wird sie geprüft: jeder Rückfall im
    // `@theme`-Block muss GENAU der Wert sein, den die Fläche vorher trug.
    //
    // Das ist stärker als ein Screenshot: ein Bild belegt einen Moment, diese
    // Liste belegt jeden künftigen auch. Der Code-Review hat zu Recht
    // angemerkt, dass die Sichtprobe nur den dunklen Modus gemessen hat — und
    // dabei zwei echte Abweichungen gefunden (Symbol und Pill im eingeklappten
    // Rail), die jetzt über `--thread-chrome-ink` behoben sind.
    const theme = block("@theme");
    const paare: [string, string][] = [
      ["--chat-rail-surface", "#ffffff"],
      ["--thread-ink", "#1e2a3a"],
      ["--thread-muted", "#626f85"],
      ["--thread-hover", "#f6f8fb"],
      ["--thread-line", "#e2e8f0"],
      ["--thread-badge", "#2f6bd1"],
      ["--thread-badge-ink", "#ffffff"],
      ["--thread-focus", "#2f6bd1"],
      // Die zwei, an denen die Zusage zuerst gebrochen war: vorher las das
      // Symbol im Rail und der Pill `--color-on-chrome` (#475569) mit Hover
      // `--color-on-chrome-active` (#1f53b0).
      ["--thread-chrome-ink", "#475569"],
      ["--thread-chrome-ink-hover", "#1f53b0"],
    ];
    for (const [name, soll] of paare) {
      expect(wert(theme, name)?.toLowerCase(), `${name} im hellen Modus`).toBe(soll);
    }
  });

  it("rechnet die helle Aktivflaeche richtig aus `accent-soft/40`", () => {
    // Der frühere Wert war `bg-accent-soft/40`, also #EFF5FD zu 40 % auf Weiss.
    // Die erste Fassung schrieb #F6FBFE — Grün und Blau richtig, Rot um 3
    // daneben, in einem Kommentar, der behauptet, die Zahl sei ausgerechnet.
    // Befund des Code-Reviews.
    const mischen = (v: number) => Math.round(0.4 * v + 0.6 * 255);
    const soll =
      "#" +
      [0xef, 0xf5, 0xfd]
        .map(mischen)
        .map((v) => v.toString(16).padStart(2, "0"))
        .join("");
    expect(wert(block("@theme"), "--thread-active")?.toLowerCase()).toBe(soll);
  });

  it("überschreibt sie im dunklen Modus, und zwar NUR innerhalb der Leiste", () => {
    // Der Selektor ist die halbe Zusage: stünden die Tokens auf
    // `html[data-variant="navy"]`, färbte sich `ThreadList` auch auf `/chat`.
    const leiste = block('html[data-variant="navy"] .fbc-chat-rail');
    for (const token of LEISTEN_TOKENS) {
      expect(wert(leiste, token), `${token} fehlt im navy-Block der Leiste`).not.toBeNull();
    }
  });

  it("setzt die Fläche auf Detlevs gemessenen Wert", () => {
    const leiste = block('html[data-variant="navy"] .fbc-chat-rail');
    expect(wert(leiste, "--chat-rail-surface")?.toLowerCase()).toBe("#002b51");
  });

  it("ist NICHT das #081527 der linken Navigation", () => {
    // Die Unterscheidung ist der Kern der Vorgabe. Ohne diese Zeile wäre „die
    // Leiste ist dunkel" auch von einem Gleichmachen mit der Navigation
    // erfüllt — und genau das hat Detlev ausgeschlossen.
    const leiste = block('html[data-variant="navy"] .fbc-chat-rail');
    expect(wert(leiste, "--chat-rail-surface")?.toLowerCase()).not.toBe("#081527");
    expect(wert(block('html[data-variant="navy"]'), "--sidebar-surface")?.toLowerCase()).toBe(
      "#081527",
    );
  });

  it("die Thread-Liste liest die Tokens wirklich", () => {
    // Der Befund, der diesen Fall erzwingt: ohne ihn liesse sich `ThreadList`
    // auf `text-ink` / `hover:bg-soft` / `divide-line` zurückdrehen, und die
    // GANZE Testsuite bliebe grün — genau die Regression, gegen die dieser
    // Change existiert. Die Flächenklasse der Leiste allein belegt nichts über
    // die Liste darin.
    const quelle = readFileSync("src/components/chat/ThreadList.tsx", "utf8");
    for (const token of [
      "--thread-ink",
      "--thread-muted",
      "--thread-hover",
      "--thread-active",
      "--thread-line",
      "--thread-badge",
      "--thread-badge-ink",
      "--thread-focus",
    ]) {
      expect(quelle, `ThreadList liest ${token} nicht`).toContain(`var(${token})`);
    }
    // Und die Gegenprobe: keine Inhaltsfarbe mehr im Klassentext.
    const ohneKommentare = quelle.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");
    for (const klasse of ["text-ink", "text-muted", "bg-soft", "divide-line", "bg-accent"]) {
      expect(ohneKommentare, `ThreadList traegt noch ${klasse}`).not.toContain(`"${klasse}`);
    }
  });

  it("jedes Leisten-Token wird von mindestens einer Quelldatei gelesen", () => {
    // Ein Token, das niemand liest, ist tote Konfiguration — und ein Test, der
    // nur „irgendeines wird benutzt" prüft, ist von einer einzigen Datei
    // erfüllt.
    const quellen = dateien("src")
      .filter((p) => !/\.test\.[tj]sx?$/.test(p))
      .map((p) => readFileSync(p, "utf8"))
      .join("\n");
    for (const token of LEISTEN_TOKENS) {
      expect(quellen, `${token} wird nirgends gelesen`).toContain(`var(${token})`);
    }
  });

  it("benutzt kein Token, das es nicht gibt", () => {
    // Ein Tippfehler in einem Variablennamen fällt bei keinem Typcheck auf: der
    // Browser nimmt dann die geerbte Farbe, und die Fläche sieht „irgendwie
    // falsch" aus statt kaputt.
    const gesetzt = new Set([...CSS.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
    const benutzt = new Set<string>();
    for (const pfad of dateien("src")) {
      if (pfad.endsWith("index.chatleiste-tokens.test.ts")) continue;
      const inhalt = readFileSync(pfad, "utf8");
      for (const m of inhalt.matchAll(/var\((--(?:thread|chat-rail)-[a-z0-9-]+)/g)) {
        benutzt.add(m[1]);
      }
    }
    expect(benutzt.size, "keine Leisten-Tokens im Quellbaum benutzt").toBeGreaterThan(0);
    expect([...benutzt].filter((t) => !gesetzt.has(t))).toEqual([]);
  });
});

describe("Nachrichtenleiste: die Kontraste halten auf ALLEN drei Flächen", () => {
  const leiste = () => block('html[data-variant="navy"] .fbc-chat-rail');
  const token = (name: string) => {
    const v = wert(leiste(), name);
    if (!v) throw new Error(`${name} fehlt`);
    return parse(v);
  };

  /** Grundfläche, Hover und aktive Zeile — die halbtransparenten überlagert. */
  const flaechen = () => {
    const grund = token("--chat-rail-surface");
    return {
      Grundfläche: grund,
      Hover: ueber(token("--thread-hover"), grund),
      "aktive Zeile": ueber(token("--thread-active"), grund),
    };
  };

  it("Fliesstext erfüllt 4,5:1 auf jeder Fläche", () => {
    for (const name of ["--thread-ink", "--thread-muted"] as const) {
      const text = token(name);
      for (const [wo, flaeche] of Object.entries(flaechen())) {
        const v = kontrast(text, flaeche);
        expect(auf2(v), `${name} auf ${wo}: ${auf2(v)}:1`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("das Ungelesen-Abzeichen hebt sich auf ALLEN drei Flaechen mit 3:1 ab", () => {
    // Es sitzt in der Thread-Zeile und wandert also mit ihr durch Hover und
    // Aktivzustand. Die erste Fassung prüfte nur die Grundfläche — Befund des
    // Code-Reviews.
    for (const [wo, flaeche] of Object.entries(flaechen())) {
      const v = kontrast(token("--thread-badge"), flaeche);
      expect(auf2(v), `Abzeichen auf ${wo}: ${auf2(v)}:1`).toBeGreaterThanOrEqual(3);
    }
  });

  it("die Ziffer auf dem Abzeichen erfüllt 4,5:1", () => {
    const v = kontrast(token("--thread-badge-ink"), token("--thread-badge"));
    expect(auf2(v), `Ziffer auf Abzeichen: ${auf2(v)}:1`).toBeGreaterThanOrEqual(4.5);
  });

  it("legt ALLE fuenf Tokens um, die der sekundaere Knopf liest", () => {
    // `Button variant="secondary"` liest `border-chrome-border bg-chrome
    // text-on-chrome hover:bg-chrome-elevated` und, aus `base`,
    // `ring-offset-soft`. Fünf, nicht zwei — und zwei Knöpfe, nicht einer:
    // „Mitglieder entdecken" im Leerzustand und „Weitere Gespräche" beim
    // Blättern.
    const leiste = block('html[data-variant="navy"] .fbc-chat-rail');
    for (const name of KNOPF_TOKENS) {
      expect(wert(leiste, name), `${name} ist in der Leiste nicht umgelegt`).not.toBeNull();
    }
  });

  it("der sekundaere Knopf hebt sich ab und ist lesbar — ruhend UND unter dem Zeiger", () => {
    // „Noch kein Gespräch … Mitglieder entdecken" ist für ein neues Mitglied
    // der Normalfall dieser Leiste. Ohne Umlegung hätte sich `#081527` mit
    // 1,3:1 von `#002B51` abgehoben; mit NUR den beiden ersten Tokens wäre die
    // Schrift beim Überfahren auf `#0E1F38` gelandet — 1,0:1, also weg.
    const schrift = token("--color-on-chrome");
    const flaechen = {
      ruhend: token("--color-chrome"),
      "unter dem Zeiger": token("--color-chrome-elevated"),
    };
    for (const [wo, flaeche] of Object.entries(flaechen)) {
      const gegenLeiste = kontrast(flaeche, token("--chat-rail-surface"));
      const aufKnopf = kontrast(schrift, flaeche);
      expect(
        auf2(gegenLeiste),
        `Knopf ${wo} gegen Leiste: ${auf2(gegenLeiste)}:1`,
      ).toBeGreaterThanOrEqual(3);
      expect(auf2(aufKnopf), `Schrift auf Knopf ${wo}: ${auf2(aufKnopf)}:1`).toBeGreaterThanOrEqual(
        4.5,
      );
    }
  });

  it("der Fokusring ist auf allen drei Flaechen sichtbar", () => {
    // `ring-accent` trug auf `#002B51` nur 2,8:1 — unter den 3:1 für
    // Bedienelemente, und schlechter als vor dieser Änderung (3,6:1 auf dem
    // Chrome-Rail, 5,1:1 auf Weiss). Der Pill ist der EINZIGE Weg, die Leiste
    // wieder einzuklappen.
    const ring = token("--thread-focus");
    for (const [wo, flaeche] of Object.entries(flaechen())) {
      const v = kontrast(ring, flaeche);
      expect(auf2(v), `Fokusring auf ${wo}: ${auf2(v)}:1`).toBeGreaterThanOrEqual(3);
    }
  });

  it("die chrome-artige Schrift der Leiste ist lesbar", () => {
    // Das Symbol im eingeklappten Rail und der Pill. Sie lesen eigene Tokens,
    // damit der HELLE Modus unverändert bleibt — hier geht es um den dunklen.
    for (const name of ["--thread-chrome-ink", "--thread-chrome-ink-hover"] as const) {
      const v = kontrast(token(name), token("--chat-rail-surface"));
      expect(auf2(v), `${name}: ${auf2(v)}:1`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("die Trennlinie ist sichtbar — mindestens 1,3:1", () => {
    // Bewusst NICHT 3:1: eine Trennlinie zwischen Listenzeilen ist Dekoration
    // im Sinne der Norm (1.4.11 gilt für Bedienelemente und
    // bedeutungstragende Grafik). Eine untere Grenze steht hier trotzdem,
    // damit sie nicht unsichtbar wird — und sie ist als Entscheidung benannt,
    // nicht als Schwelle der Norm ausgegeben.
    const grund = token("--chat-rail-surface");
    const v = kontrast(ueber(token("--thread-line"), grund), grund);
    expect(auf2(v), `Trennlinie: ${auf2(v)}:1`).toBeGreaterThanOrEqual(1.3);
  });

  it("die gerechneten Werte stehen in der Spec — Gegenprobe gegen die Tabelle", () => {
    // Die Spec führt eine Tabelle mit Verhältnissen. Weicht die Rechnung davon
    // ab, ist eine der beiden falsch, und das soll auffallen. Toleranz 0,15,
    // weil die Spec auf eine Dezimale rundet.
    const erwartet: Record<string, Record<string, number>> = {
      "--thread-ink": { Grundfläche: 14.3, Hover: 12.1, "aktive Zeile": 10.1 },
      "--thread-muted": { Grundfläche: 8.8, Hover: 7.4, "aktive Zeile": 6.2 },
    };
    for (const [name, je] of Object.entries(erwartet)) {
      for (const [wo, soll] of Object.entries(je)) {
        const ist = kontrast(token(name), flaechen()[wo as keyof ReturnType<typeof flaechen>]);
        expect(Math.abs(ist - soll), `${name} auf ${wo}: ${auf2(ist)} statt ${soll}`).toBeLessThan(
          0.15,
        );
      }
    }
  });
});
