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
 *
 * ══ SEIT AGE-1003 DECKT DIESE DATEI BEIDE LEISTEN ═════════════════════════
 * Donald hat Frage E7 mit Ja beantwortet: die linke Navigation trägt dieselbe
 * Fläche. Der Dateiname sagt weiter „chatleiste", weil ein Umbenennen die
 * Historie der Datei für reine Namenskosmetik zerschneiden würde; der dritte
 * `describe`-Block unten gehört der linken Leiste.
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
 * Die Tokens, die auf der LINKEN Leiste liegen (AGE-1003).
 *
 * `--sidebar-surface` ist ihre Fläche. Die übrigen sind Chrome-Tokens, die
 * schon vorher dort lagen und mit dem Farbwechsel neu gerechnet werden
 * mussten. `--leiste-focus` ist neu: `ring-accent` trägt auf `#002B51` nur
 * 2,83:1 und fällt damit unter die 3:1 der Norm.
 */
const LINKE_LEISTE_TOKENS = [
  "--sidebar-surface",
  "--leiste-focus",
  "--leiste-badge",
  "--leiste-badge-ink",
  // AGE-1018: die Schrift. Bis dahin hing sie an `--color-on-chrome` und
  // `--color-on-chrome-muted` — und die lesen 22 Stellen in WillkommenPage,
  // 17 in OnboardingPage und `Button variant="secondary"`.
  "--leiste-ink",
  "--leiste-ink-muted",
  // Der Einklapp-Pill, gespiegelt zu `--thread-chrome-ink` (Befund des Reviews).
  "--leiste-chrome-ink",
] as const;

/**
 * Jede Farbe, die auf der linken Leiste gegen ihre Flaeche steht — die
 * VOLLSTAENDIGE Liste, nicht die der umgelegten Tokens.
 *
 * Der Unterschied ist genau der Befund, an dem die erste Fassung dieses
 * Changes gescheitert ist: sie mass die fuenf Tokens, die sie angefasst hatte,
 * und sah deshalb nicht, dass das Abzeichen `bg-accent` liest und von 3,61:1
 * auf 2,83:1 gefallen war — dieselbe Zahl, mit der derselbe Change den
 * Fokus-Token begruendet. Derselbe Fehler wie bei AGE-1002, eine Leiste weiter
 * links, und der Test hat ihn aus demselben Grund nicht gesehen.
 *
 * Die Schwelle steht je Eintrag dabei, weil sie nicht fuer alle gleich ist:
 * 4,5:1 fuer Text, 3:1 fuer bedeutungstragende Grafik.
 */
const AUF_DER_LEISTE: { token: string; schwelle: number; was: string }[] = [
  // AGE-1018: hier standen `--color-on-chrome` und `--color-on-chrome-muted`.
  // Sie sind NICHT durchgefallen — sie trugen 6,78:1 und 5,70:1 und waren
  // gruen. Die Leiste LIEST sie nur nicht mehr. Ein Test, der Tokens gegen
  // eine Flaeche rechnet, die sie nicht beruehren, ist gruen und misst das
  // Falsche; das ist schlimmer als rot.
  { token: "--leiste-ink", schwelle: 4.5, was: "inaktiver Menueintrag, Symbol" },
  { token: "--leiste-ink-muted", schwelle: 4.5, was: "Abschnittsmarke" },
  { token: "--leiste-chrome-ink", schwelle: 4.5, was: "Einklapp-Pill" },
  { token: "--color-on-chrome-active", schwelle: 4.5, was: "aktiver Eintrag, Wortmarke" },
  { token: "--color-accent-on-chrome", schwelle: 3, was: "Punkte der Wortmarke" },
  { token: "--leiste-focus", schwelle: 3, was: "Fokusring" },
  { token: "--leiste-badge", schwelle: 3, was: "Flaeche des Zaehlers" },
];

/**
 * Die vier Stellen, die den Fokusring der linken Leiste zeichnen.
 *
 * Vollständigkeit ist hier die halbe Zusage. Bei AGE-1002 war die Umlegung
 * unvollständig, der Test prüfte genau die umgelegten Tokens, und der Defekt
 * wanderte in einen Zustand, den niemand ansah.
 */
const FOKUS_STELLEN = [
  "src/components/AppShell.tsx",
  "src/components/ui/SidebarNav.tsx",
  "src/components/feedback/FeedbackButton.tsx",
  "src/components/LeistenPill.tsx",
] as const;

/**
 * Die Stellen, die die Schrift der linken Leiste malen (AGE-1018).
 *
 * Dieselbe Begruendung wie bei `FOKUS_STELLEN`: ein Token im CSS belegt nicht,
 * dass es jemand liest. `SidebarNav` steht zweimal drin, weil es BEIDE Toene
 * fuehrt — die Abschnittsmarke und den Menueintrag.
 */
const INK_STELLEN = [
  // AM ELEMENT VERANKERT, nicht an der Datei (Befund des Code-Reviews). Eine
  // Zusage „die Datei enthaelt `var(--leiste-ink)`" ist bei einer Datei mit
  // ZWEI Toenen von jedem der beiden erfuellt: wer Abschnittsmarke und
  // Menueintrag vertauscht, bleibt gruen. Genau diese Falle benennt der
  // Fokus-Waechter weiter unten und loest sie so.
  [
    "src/components/ui/SidebarNav.tsx",
    "--leiste-ink-muted",
    /uppercase tracking-wider text-\[color:var\(--leiste-ink-muted\)\]/,
    "die Abschnittsmarke",
  ],
  [
    "src/components/ui/SidebarNav.tsx",
    "--leiste-ink",
    // An der KLASSENKETTE des Elements verankert, nicht am `isActive` davor:
    // zwischen beiden steht ein Kommentarblock, und eine Zeichenzahl als
    // Abstand waere eine Zusage ueber die Laenge eines Kommentars.
    // `hover:bg-chrome-elevated` kommt in dieser Datei nur am Menueintrag vor.
    /"text-\[color:var\(--leiste-ink\)\] hover:bg-chrome-elevated/,
    "der inaktive Menueintrag",
  ],
  [
    "src/components/feedback/FeedbackButton.tsx",
    "--leiste-ink",
    /text-sm text-\[color:var\(--leiste-ink\)\] transition-colors/,
    "der Knopf auf der Leistenflaeche",
  ],
  [
    "src/components/LeistenPill.tsx",
    "--leiste-chrome-ink",
    /fbc-sidebar-surface text-\[color:var\(--leiste-chrome-ink\)\]/,
    "der Einklapp-Pill",
  ],
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

  it("traegt DIESELBE Flaeche wie die linke Navigation", () => {
    // UMGEDREHT mit AGE-1003. Bis dahin stand hier das Gegenteil: die Leiste
    // dürfe NICHT das `#081527` der linken Navigation sein, und
    // `--sidebar-surface` wurde auf genau diesen Wert festgenagelt. Das war
    // richtig, solange Frage E7 offen war — Donald hat sie am 03.10. mit Ja
    // beantwortet.
    //
    // Die Zusage ist jetzt die GLEICHHEIT, und zwar als Vergleich der beiden
    // Tokens und nicht als zwei Zeilen mit demselben Literal: schriebe jemand
    // nur eine der beiden um, bliebe ein Literal-Paar grün.
    const rechts = wert(block('html[data-variant="navy"] .fbc-chat-rail'), "--chat-rail-surface");
    const links = wert(block('html[data-variant="navy"]'), "--sidebar-surface");
    expect(links?.toLowerCase()).toBe("#002b51");
    expect(links?.toLowerCase()).toBe(rechts?.toLowerCase());
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
      for (const m of inhalt.matchAll(/var\((--(?:thread|chat-rail|leiste)-[a-z0-9-]+)/g)) {
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

describe("Linke Navigation: dieselbe Flaeche, und alles darauf bleibt lesbar", () => {
  // AGE-1003. Der navy-Block OHNE Leisten-Selektor — dort liegt
  // `--sidebar-surface`, und dort liegen die Chrome-Tokens, die auf der Leiste
  // sichtbar sind.
  const navy = () => block('html[data-variant="navy"]');
  const theme = () => block("@theme");
  const token = (name: string, rumpf = navy()) => {
    const v = wert(rumpf, name);
    if (!v) throw new Error(`${name} fehlt`);
    return parse(v);
  };
  const flaeche = () => token("--sidebar-surface");

  it("fuehrt alle Tokens der linken Leiste mit einem Rueckfall im @theme-Block", () => {
    for (const name of LINKE_LEISTE_TOKENS) {
      expect(wert(theme(), name), `${name} fehlt auf :root`).not.toBeNull();
    }
  });

  it("laesst den hellen Modus unveraendert — Wert fuer Wert", () => {
    // Das ist die ganze Zusage fuer den hellen Modus, und sie ist staerker als
    // „sieht gleich aus": `--leiste-focus` traegt dort GENAU den Wert, den
    // `--color-accent` heute hat, also aendert sich links im Hellen kein Pixel.
    const paare: [string, string][] = [
      ["--sidebar-surface", "#ffffff"],
      ["--leiste-focus", "#2f6bd1"],
      // AGE-1018: die beiden Schrift-Tokens tragen im Hellen GENAU die Werte,
      // die `--color-on-chrome` und `--color-on-chrome-muted` dort heute
      // haben. Das ist die ganze Zusage „im hellen Modus aendert sich nichts".
      ["--leiste-ink", "#475569"],
      ["--leiste-ink-muted", "#64748b"],
      ["--leiste-chrome-ink", "#475569"],
    ];
    for (const [name, soll] of paare) {
      expect(wert(theme(), name)?.toLowerCase(), `${name} im hellen Modus`).toBe(soll);
    }
    // Und die Begruendung dieses Wertes wird mitgeprueft: er IST der heutige
    // Akzent. Driftet `--color-accent`, soll diese Zeile darauf hinweisen,
    // statt den Gleichstand stillschweigend zu verlieren.
    expect(wert(theme(), "--leiste-focus")?.toLowerCase()).toBe(
      wert(theme(), "--color-accent")?.toLowerCase(),
    );
    // Dieselbe Bindung fuer die Schrift: die beiden Werte SIND die der
    // abgeloesten Tokens. Driftet eines davon, weist diese Zeile darauf hin,
    // statt den Gleichstand im Hellen stillschweigend zu verlieren.
    expect(wert(theme(), "--leiste-ink")?.toLowerCase()).toBe(
      wert(theme(), "--color-on-chrome")?.toLowerCase(),
    );
    expect(wert(theme(), "--leiste-ink-muted")?.toLowerCase()).toBe(
      wert(theme(), "--color-on-chrome-muted")?.toLowerCase(),
    );
  });

  it("setzt im dunklen Modus die Flaeche und einen eigenen Fokusring", () => {
    expect(wert(navy(), "--sidebar-surface")?.toLowerCase()).toBe("#002b51");
    expect(wert(navy(), "--leiste-focus")?.toLowerCase()).toBe("#b9cce6");
  });

  it("traegt im dunklen Modus die Schrift der Nachrichtenleiste (AGE-1018)", () => {
    expect(wert(navy(), "--leiste-ink")?.toLowerCase()).toBe("#ffffff");
    expect(wert(navy(), "--leiste-ink-muted")?.toLowerCase()).toBe("#b9cce6");
  });

  it("und es sind DIESELBEN Werte, die rechts stehen", () => {
    // Die Vorgabe war Paritaet, nicht „ungefaehr gleich hell". Driftet eine
    // Seite, wird es hier rot — und zwar auf der Seite, die drueckt.
    //
    // ABER KEINE ABLEITUNG im CSS: `--thread-ink` sitzt auf `.fbc-chat-rail`
    // und nicht auf `html`. Ein Element der linken Leiste liegt nicht in dem
    // Teilbaum und bekaeme bei `var(--thread-ink)` den Rueckfallwert. Die
    // Gleichheit ist Absicht und steht deshalb HIER statt dort.
    const rechts = block('html[data-variant="navy"] .fbc-chat-rail');
    expect(wert(navy(), "--leiste-ink")?.toLowerCase()).toBe(
      wert(rechts, "--thread-ink")?.toLowerCase(),
    );
    expect(wert(navy(), "--leiste-ink-muted")?.toLowerCase()).toBe(
      wert(rechts, "--thread-muted")?.toLowerCase(),
    );
    // Der Einklapp-Pill ist ein GESPIEGELTES Bauteil, kein aehnliches — die
    // Spec verlangt „denselben Schalter an derselben Stelle". In BEIDEN Modi.
    expect(wert(navy(), "--leiste-chrome-ink")?.toLowerCase()).toBe(
      wert(rechts, "--thread-chrome-ink")?.toLowerCase(),
    );
    expect(wert(theme(), "--leiste-chrome-ink")?.toLowerCase()).toBe(
      wert(theme(), "--thread-chrome-ink")?.toLowerCase(),
    );
  });

  it("die Schrift haelt 4,5:1 auch im HELLEN Modus", () => {
    // Befund des Code-Reviews: `AUF_DER_LEISTE` rechnet nur gegen die
    // navy-Flaeche. Ein Token, der nur im Dunklen geprueft wird, darf im
    // Hellen beliebig driften — und `--leiste-ink-muted` hat dort gemessen nur
    // 0,26 Reserve (4,76:1). Genau dort, wo bis zu diesem Review zwei falsche
    // Zahlen im Kommentar standen.
    const hell = (name: string) => parse(wert(theme(), name)!);
    for (const name of ["--leiste-ink", "--leiste-ink-muted", "--leiste-chrome-ink"]) {
      const v = kontrast(hell(name), hell("--sidebar-surface"));
      expect(auf2(v), `${name} im hellen Modus: ${auf2(v)}:1`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("die Schrift haelt 4,5:1 auch auf Hover- und Aktivflaeche", () => {
    // Die Grundflaeche deckt `AUF_DER_LEISTE` ab, die beiden anderen Flaechen
    // der Leiste nicht. Und auf der Aktivflaeche faellt die naheliegende Wahl
    // durch: `--leiste-ink-muted` (#B9CCE6) traegt dort nur 4,39:1. Dass die
    // Abschnittsmarken nie auf der Aktivflaeche stehen, ist der Grund, dass
    // der Fall gruen ist — kein Zufall. Deshalb steht hier genau, was wo
    // vorkommen kann, und nicht jede Farbe gegen jede Flaeche.
    const faelle = [
      ["--leiste-ink", "--color-chrome-elevated", "Hover-Flaeche"],
      ["--leiste-ink", "--color-chrome-active", "Aktivflaeche"],
      ["--leiste-ink-muted", "--color-chrome-elevated", "Hover-Flaeche"],
    ] as const;
    for (const [name, flaechenToken, wo] of faelle) {
      const v = kontrast(token(name), token(flaechenToken));
      expect(auf2(v), `${name} auf der ${wo}: ${auf2(v)}:1`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("laesst `--color-chrome` im dunklen Modus auf #081527 stehen", () => {
    // Die Regression, die Entscheidung 1 verhindert. `--color-chrome` faerbt
    // NICHT die Leiste, sondern die Vollflaechen von `/onboarding` und
    // `/willkommen` (`min-h-screen bg-chrome`), `Button variant="secondary"`
    // und als `text-chrome` die Ziffer auf den Zaehlern. Wer es mitzieht,
    // faerbt drei unbeteiligte Flaechen mit — gemessen, nicht vermutet.
    expect(wert(navy(), "--color-chrome")?.toLowerCase()).toBe("#081527");
  });

  it("JEDE Farbe auf der Leiste haelt ihre Schwelle", () => {
    // Ein Fall ueber die vollstaendige Liste statt drei Faelle ueber die
    // bequeme Auswahl. Wer hier ein Element vergisst, vergisst es sichtbar.
    for (const { token: name, schwelle, was } of AUF_DER_LEISTE) {
      const v = kontrast(token(name), flaeche());
      expect(
        auf2(v),
        `${was} (${name}): ${auf2(v)}:1, gefordert ${schwelle}`,
      ).toBeGreaterThanOrEqual(schwelle);
    }
  });

  it("die Ziffer auf dem Zaehler erfuellt 4,5:1", () => {
    // Sie steht auf dem Zaehler, nicht auf der Leiste — die Flaeche darunter
    // ist also `--leiste-badge` und nicht `--sidebar-surface`.
    const v = kontrast(token("--leiste-badge-ink"), token("--leiste-badge"));
    expect(auf2(v), `Ziffer auf dem Zaehler: ${auf2(v)}:1`).toBeGreaterThanOrEqual(4.5);
  });

  it("der Zaehler liest die Tokens wirklich und nicht mehr die Inhaltsfarben", () => {
    const nav = readFileSync("src/components/ui/SidebarNav.tsx", "utf8");
    expect(nav, "der Zaehler liest --leiste-badge nicht").toContain("var(--leiste-badge)");
    expect(nav, "die Ziffer liest --leiste-badge-ink nicht").toContain("var(--leiste-badge-ink)");
    const ohneKommentare = nav.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");
    expect(ohneKommentare, "SidebarNav traegt noch bg-accent").not.toContain("bg-accent");
    expect(ohneKommentare, "SidebarNav traegt noch text-chrome").not.toContain("text-chrome");
  });

  it("die Trennlinien sind sichtbar — und sie sind ausdruecklich KEIN Bedienelement", () => {
    // `--color-chrome-border` ist weiss zu 8 % und traegt damit 1,26:1 gegen
    // die Leiste (vorher 1,23:1 — also minimal BESSER, keine Verschlechterung).
    // Die 3:1 der Norm gelten hier nicht: 1.4.11 fordert sie fuer
    // Bedienelemente und bedeutungstragende Grafik, und eine Haarlinie
    // zwischen zwei Abschnitten ist weder das eine noch das andere. Eine
    // untere Grenze steht trotzdem, damit sie nicht unsichtbar wird — als
    // benannte Entscheidung, nicht als Schwelle der Norm.
    //
    // Befund des Code-Reviews: ohne diesen Fall waere die Linie in der
    // Aufzaehlung gar nicht vorgekommen, und die Anforderung „jedes Element
    // haelt die Schwellen" waere am Tag ihrer Niederschrift falsch gewesen.
    const grund = flaeche();
    const v = kontrast(ueber(token("--color-chrome-border"), grund), grund);
    expect(auf2(v), `Trennlinie: ${auf2(v)}:1`).toBeGreaterThanOrEqual(1.2);
    expect(auf2(v), "die Linie ist bewusst KEIN Bedienelement").toBeLessThan(3);
  });

  it("der Fokusring haelt 3:1 — in BEIDEN Modi", () => {
    // Der Befund, der aus dem angekuendigten Einzeiler eine Aenderung mit
    // Testbedarf macht: `ring-accent` (#2F6BD1) traegt auf #081527 3,61:1 und
    // auf #002B51 nur 2,83:1. Beide Modi stehen hier, weil ein Token, der nur
    // im Dunklen geprueft wird, im Hellen beliebig driften darf.
    const dunkel = kontrast(token("--leiste-focus"), flaeche());
    expect(auf2(dunkel), `Fokusring im navy-Modus: ${auf2(dunkel)}:1`).toBeGreaterThanOrEqual(3);
    const hell = kontrast(token("--leiste-focus", theme()), token("--sidebar-surface", theme()));
    expect(auf2(hell), `Fokusring im hellen Modus: ${auf2(hell)}:1`).toBeGreaterThanOrEqual(3);
  });

  it("der aktive Eintrag ist NICHT an seiner Fuellung erkennbar — und das ist belegt", () => {
    // Die Fuellung `#1F53B0` traegt gegen die Leiste 2,00:1 und hielt die 3:1
    // noch nie (vorher 2,55:1). Dieser Fall nagelt deshalb fest, worauf die
    // Erkennbarkeit WIRKLICH beruht: die Schrift auf der Fuellung. Ohne ihn
    // stuende in der Spec eine Zahl unter der Schwelle ohne Gegenstueck, und
    // beim naechsten Griff an die Farben wuerde entweder blind „behoben" oder
    // blind verteidigt.
    const fuellung = token("--color-chrome-active");
    const gegenLeiste = kontrast(fuellung, flaeche());
    expect(auf2(gegenLeiste), "die Fuellung haelt die 3:1 bewusst nicht").toBeLessThan(3);

    const schrift = kontrast(token("--color-on-chrome-active"), fuellung);
    expect(auf2(schrift), `Schrift auf der Fuellung: ${auf2(schrift)}:1`).toBeGreaterThanOrEqual(
      4.5,
    );

    // Worauf die Erkennbarkeit beruht, steht als RENDER-Zusage in
    // `SidebarNav.active.test.tsx` — aufgeklappt und eingeklappt getrennt.
    // Hier stand erst eine Textsuche ueber die Datei; die konnte die
    // Bedingung `isActive && !collapsed` nicht sehen und haette den
    // eingeklappten Zustand nie gemessen. Befund des Code-Reviews.
  });

  it("der Hover: im Dunkeln traegt ihn die Flaeche, im Hellen die Schrift", () => {
    // UMGESCHRIEBEN MIT AGE-1018 (Befund des Code-Reviews). Bis dahin stand
    // hier „Das Signal ist die Schrift" und wurde mit 16,51:1 belegt — einer
    // Zahl, die seit AGE-1018 nichts mehr ueber den HOVER sagt: Ruhezustand
    // und Hover tragen im navy-Modus dieselbe Farbe. Der Fall blieb gruen und
    // mass nichts mehr.
    const hover = token("--color-chrome-elevated");
    expect(auf2(kontrast(hover, flaeche())), "die Hover-Flaeche hebt sich kaum ab").toBeLessThan(
      1.5,
    );

    // Im DUNKLEN Modus ist der Schriftwechsel bewusst TOT — festgehalten als
    // Gleichheit, damit niemand ihn fuer kaputt haelt und „repariert".
    expect(
      wert(navy(), "--leiste-ink")?.toLowerCase(),
      "im Dunkeln soll der Hover-Schriftwechsel wirkungslos sein",
    ).toBe(wert(navy(), "--color-on-chrome-active")?.toLowerCase());

    // Im HELLEN Modus wechselt er und ist dort das Hauptmerkmal.
    expect(
      wert(theme(), "--leiste-ink")?.toLowerCase(),
      "im Hellen muss der Hover die Schrift wechseln",
    ).not.toBe(wert(theme(), "--color-on-chrome-active")?.toLowerCase());

    // Und der Pill, der KEINE Hover-Flaeche hat, wechselt deshalb in BEIDEN
    // Modi die Schrift. Ohne diese Zeile waere der Befund, der ihm einen
    // eigenen Token gegeben hat, nicht gegen eine Rueckdrehung gesichert.
    for (const [rumpf, wo] of [
      [navy(), "navy"],
      [theme(), "hell"],
    ] as const) {
      expect(
        wert(rumpf, "--leiste-chrome-ink")?.toLowerCase(),
        `der Einklapp-Pill haette in ${wo} keinen Hover mehr`,
      ).not.toBe(wert(rumpf, "--color-on-chrome-active")?.toLowerCase());
    }
  });

  it("alle vier Stellen lesen den Fokus-Token wirklich", () => {
    // Der Befund aus AGE-1002, hier vorweggenommen: ohne diesen Fall liesse
    // sich jede der vier Klassen auf `ring-accent` zurueckdrehen, und die
    // GANZE Suite bliebe gruen. Ein Token im CSS belegt nichts darueber, dass
    // ihn jemand liest.
    for (const pfad of FOKUS_STELLEN) {
      expect(readFileSync(pfad, "utf8"), `${pfad} liest --leiste-focus nicht`).toContain(
        "var(--leiste-focus)",
      );
    }
  });

  it("alle Stellen lesen die Schrift-Tokens wirklich (AGE-1018)", () => {
    // Derselbe Waechter wie fuer den Fokusring, aus demselben Grund: bei
    // AGE-1002 war die Umlegung unvollstaendig, der Test pruefte genau die
    // umgelegten Tokens, und der Defekt wanderte in einen Zustand, den
    // niemand ansah.
    for (const [pfad, gesucht, muster, was] of INK_STELLEN) {
      expect(muster.test(readFileSync(pfad, "utf8")), `${was} liest ${gesucht} nicht`).toBe(true);
    }
  });

  it("und keine davon liest auf der Leiste noch die alten Tokens", () => {
    // Gegenprobe: ein `var(--leiste-ink)` IRGENDWO in der Datei ist von einem
    // zweiten Vorkommen erfuellt, waehrend die eigentliche Stelle auf
    // `text-on-chrome` stehen bleibt.
    //
    // `text-on-chrome-active` BLEIBT ueberall, wo es steht — aktiver Eintrag,
    // Wortmarke, Hover. Die Regex muss das Suffix also ausschliessen, sonst
    // waere sie von genau den Stellen erfuellt, die bleiben sollen.
    const altesInk = /\btext-on-chrome(-muted)?(?![-\w])/;

    for (const [pfad, , muster] of INK_STELLEN) {
      // Kommentare raus: sie SOLLEN die alten Namen nennen und erklaeren,
      // warum sie weg sind.
      const ohneKommentare = readFileSync(pfad, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/.*$/gm, "$1");
      // POSITIVKONTROLLE zum Stripper (Befund des Code-Reviews): fraesse er
      // kuenftig mehr als Kommentare — ein `//` in einer Zeichenkette, eine
      // protokollrelative Adresse —, waere die Zeile darunter LEER-gruen. Der
      // Fall darueber liest die ROHE Datei und faellt dann auch nicht aus.
      expect(muster.test(ohneKommentare), `${pfad}: der Kommentar-Stripper frisst Code`).toBe(
        true,
      );
      expect(
        altesInk.test(ohneKommentare),
        `${pfad} traegt auf der Leiste noch text-on-chrome`,
      ).toBe(false);
    }
  });

  it("und die beiden Vollseiten sind UNBERUEHRT geblieben", () => {
    // Die Positivkontrolle zur Zeile darueber, und sie ist der Grund fuer die
    // eigenen Tokens: dort soll `text-on-chrome` weiter stehen. Waere die
    // Umlegung ein globales Suchen-und-Ersetzen gewesen, faellt dieser Fall.
    for (const pfad of [
      "src/pages/WillkommenPage.tsx",
      "src/pages/OnboardingPage.tsx",
      "src/components/ui/Button.tsx",
    ]) {
      expect(readFileSync(pfad, "utf8"), `${pfad} hat text-on-chrome verloren`).toContain(
        "text-on-chrome",
      );
    }
  });

  it("und die vier Stellen tragen den alten Ring nicht mehr", () => {
    // Gegenprobe zur Zeile darueber: ein `var(--leiste-focus)` IRGENDWO in der
    // Datei ist von einem zweiten Vorkommen erfuellt, waehrend die eigentliche
    // Stelle auf `ring-accent` stehen bleibt.
    //
    // Je Datei genau die Stelle, die auf der Leiste liegt — AppShell hat sechs
    // weitere `ring-accent` auf INHALTS-flaechen, und die bleiben.
    const ohneSuffix = /focus-visible:ring-accent(?![-\w])/;

    const nav = readFileSync("src/components/ui/SidebarNav.tsx", "utf8");
    expect(ohneSuffix.test(nav), "SidebarNav traegt noch focus-visible:ring-accent").toBe(false);

    const feedback = readFileSync("src/components/feedback/FeedbackButton.tsx", "utf8");
    expect(ohneSuffix.test(feedback), "FeedbackButton traegt noch ring-accent").toBe(false);
    // Der Ring IM Overlay bleibt: er steht nicht auf der Leiste.
    expect(feedback, "der Ring im Overlay ist verschwunden").toContain("ring-accent-strong");

    // Am ELEMENT verankert, nicht an der Reihenfolge der Klassen: dieses Repo
    // sortiert Tailwind-Klassen von Hand (kein `prettier-plugin-tailwindcss`),
    // und eine Zusage, die bei jeder eingeschobenen Klasse rot wird, erzieht
    // dazu, sie zu entschaerfen. Befund des Code-Reviews.
    const shell = readFileSync("src/components/AppShell.tsx", "utf8");
    expect(
      /to="\/"[\s\S]{0,300}?var\(--leiste-focus\)/.test(shell),
      "die Wortmarke in der Leiste liest den Token nicht",
    ).toBe(true);

    // Der Pill traegt BEIDE Tokens, je einen pro Seite. Zwei Textsuchen ueber
    // die Datei koennen deshalb nicht unterscheiden, ob sie am richtigen Zweig
    // haengen: wer den linken Ring in den gemeinsamen Teil hochzieht, gibt ihn
    // der RECHTEN Leiste mit — und beide Suchen blieben gruen. Deshalb hier
    // die Bindung an den Zweig, ueber die Flaechenklasse, die ihn ausweist.
    // Befund des Code-Reviews.
    const pill = readFileSync("src/components/LeistenPill.tsx", "utf8");
    const zweige = [
      ...pill.matchAll(/"([^"]*focus-visible:ring-\[color:var\(--[a-z-]+\)\][^"]*)"/g),
    ].map((m) => m[1]);
    const links = zweige.find((z) => z.includes("fbc-sidebar-surface"));
    const rechts = zweige.find((z) => z.includes("var(--chat-rail-surface)"));
    expect(links, "kein Zweig traegt die Flaeche der linken Leiste MIT einem Ring").toBeTruthy();
    expect(rechts, "kein Zweig traegt die Flaeche der rechten Leiste MIT einem Ring").toBeTruthy();
    expect(links, "der linke Zweig liest nicht --leiste-focus").toContain("var(--leiste-focus)");
    expect(rechts, "der rechte Zweig liest nicht --thread-focus").toContain("var(--thread-focus)");
    // Und keiner der beiden Tokens darf ein zweites Mal vorkommen — sonst
    // stuende einer zusaetzlich im gemeinsamen Teil und gaelte fuer beide.
    const ohneKommentare = pill.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");
    for (const name of ["--leiste-focus", "--thread-focus"]) {
      expect(
        ohneKommentare.split(`var(${name})`).length - 1,
        `var(${name}) kommt nicht genau einmal vor`,
      ).toBe(1);
    }
  });

  it("die gerechneten Werte stehen in der Spec — Gegenprobe gegen die Tabelle", () => {
    // Dieselbe Gegenprobe wie fuer die rechte Leiste: weicht die Rechnung von
    // der Tabelle in `openspec` ab, ist eine der beiden falsch.
    const erwartet: [string, number][] = [
      ["--color-on-chrome", 6.78],
      ["--color-on-chrome-muted", 5.7],
      ["--color-on-chrome-active", 14.34],
      ["--color-accent-on-chrome", 4.45],
      ["--leiste-focus", 8.77],
      ["--leiste-badge", 4.45],
    ];
    for (const [name, soll] of erwartet) {
      const ist = kontrast(token(name), flaeche());
      expect(Math.abs(ist - soll), `${name}: ${auf2(ist)} statt ${soll}`).toBeLessThan(0.02);
    }
  });
});
