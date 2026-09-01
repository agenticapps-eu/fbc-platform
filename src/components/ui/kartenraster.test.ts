import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Kartenraster folgen ihrem Behälter, nicht dem Fenster (AGE-629).
 *
 * Der Anlass ist gemessen, am 31.08. gegen `63f3237` im Browser: eine rechte
 * Inhaltsspalte kostet 280 px und verengt die Liste — das Fenster bleibt gleich
 * breit. Ein Raster, das am Viewport schaltet, merkt davon nichts und bleibt
 * dreispaltig. Mit Spalte fielen die Karten auf 126 px (1024 px Fenster) und
 * auf 115 px (1280 px mit offener Nachrichten-Leiste), unter die rund 128 px,
 * die AGE-627 ausdrücklich verworfen hat.
 *
 * Was dieser Test NICHT kann: die Spaltenzahl messen. jsdom rechnet kein
 * Layout und kennt keine Containerabfragen — `getComputedStyle` liefert hier
 * nie ein aufgelöstes `grid-template-columns`. Geprüft wird deshalb die
 * Ursache im Quelltext: ein Viewport-Präfix an einer Spaltenzahl. Die Wirkung
 * wird im Browser abgenommen, und die gemessenen Zahlen stehen in
 * `openspec/changes/suchspalte-rechts/tasks.md` §5. Das ist der benannte Preis
 * dieses Zuschnitts, nicht ein Versehen.
 *
 * Warum drei Dateien und nicht ganz `src`: die Zusage gilt Rastern aus
 * gleichartigen Karten, und die erkennt kein Ausdruck von selbst. Ein
 * pauschales Verbot für alle `grid-cols-*` fiele über Formularzeilen und
 * Kachelböden her, die dieser Change nicht anfasst. Die Liste ist deshalb
 * ausgeschrieben und beim Lesen prüfbar — wer eine vierte Kartenfläche baut,
 * trägt sie hier nach.
 */
const KARTENFLAECHEN = [
  "src/components/community/MemberDirectory.tsx",
  "src/components/events/EventsList.tsx",
  "src/pages/AcademyPage.tsx",
];

/**
 * Trägt das Präfix einen **Viewport**-Breakpoint?
 *
 * Zwei Fallen, beide von der Verbiegungsprobe gefunden und keine davon beim
 * ersten Schreiben gesehen:
 *
 * 1. Der Breakpoint steht nicht immer am Anfang. Ist die Klasse die erste im
 *    Anführungszeichen, lautet das Token `className="xl:grid-cols-4` — eine
 *    Verankerung auf `^` oder `:` findet das `xl` nicht. Deshalb: davor steht
 *    Zeilenanfang oder ein Zeichen, das in keinem Klassennamen vorkommt.
 * 2. `@lg:` ist eine CONTAINER-Abfrage, kein Viewport. Tailwind kennt beide
 *    Schreibweisen mit denselben Namen, und sie unterscheiden sich allein am
 *    `@`. Deshalb gehört `@` zu den Zeichen, die davorstehen DÜRFEN, ohne dass
 *    es ein Verstoß wird — sonst verböte dieser Wächter genau das, wozu er
 *    zwingen will.
 *
 * `2xl` steht in der Aufzählung vorn: sonst versuchte der Ausdruck an der `2`
 * zuerst die kürzeren Namen, scheiterte, und am `x` läge dann die Ziffer `2`
 * davor — ein Zeichen, das sehr wohl in Klassennamen vorkommt.
 */
function istViewportPraefix(praefix: string): boolean {
  return /(?:^|[^a-z0-9@[\]])(2xl|sm|md|lg|xl):/.test(praefix);
}

/**
 * Kommentare raus, bevor gesucht wird.
 *
 * Sonst schlägt der Wächter auf seinen eigenen Anlass an: der Kommentar, der
 * erklärt, WARUM `lg:grid-cols-3` hier falsch wäre, enthält `lg:grid-cols-3`.
 * Beim ersten Lauf war genau das der einzige verbleibende Treffer — eine
 * Regel, die verbietet, ihren eigenen Grund aufzuschreiben, wäre eine Falle
 * für den Nächsten.
 *
 * Bewusst eine eigene Fassung und kein Import aus `schmale-geraete.test.ts`,
 * wo dieselbe Hilfe steht: ein Import zöge deren `describe`-Blöcke in die
 * Sammlung DIESER Datei und liesse sie doppelt laufen. Der Preis ist eine
 * zweite Zeile Regex, der Preis des Imports wären doppelte Testläufe.
 *
 * Das `[^:]` vor `//` schützt Adressen — `https://…` ist kein Kommentar.
 */
function ohneKommentare(quelle: string): string {
  return quelle.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/**
 * Ein Verstoß ist eine **Spaltenzahl mit Viewport-Präfix**.
 *
 * Ausdrücklich NICHT erfasst:
 * - `grid-cols-[…]` mit eckigen Klammern — das ist die Seitenaufteilung
 *   (`lg:grid-cols-[minmax(0,1fr)_16rem]`), und sie DARF am Viewport hängen:
 *   ob die Spalte überhaupt neben dem Inhalt steht, ist eine Fensterfrage.
 *   Für sie gilt der eigene Wächter in `schmale-geraete.test.ts`.
 * - eine Spaltenzahl ohne Präfix (`grid-cols-1`) — das ist der Grundfall,
 *   von dem die Containerabfragen nach oben abweichen.
 * - `sm:col-span-2` und Verwandte: sie spannen, sie schalten nicht.
 */
export function viewportSpaltenVerstoesse(roh: string): string[] {
  const quelle = ohneKommentare(roh);
  const treffer: string[] = [];
  // Der Zeichenvorrat ist auf das begrenzt, was in einem Klassennamen stehen
  // darf. Mit `\S*` schleppte der Treffer `className="` mit in die Meldung —
  // gefunden hätte er ihn trotzdem, aber eine Fehlermeldung, die Fremdes
  // zitiert, schickt den Leser an die falsche Stelle.
  for (const m of quelle.matchAll(/([a-z0-9@[\]:_.-]*)grid-cols-(\d+)\b/g)) {
    const [, praefix] = m;
    if (istViewportPraefix(praefix)) treffer.push(m[0]);
  }
  return treffer;
}

describe("Kartenraster schalten nicht am Fenster", () => {
  /**
   * Verbiegungsprobe. Ein Wächter, der nur die beim Schreiben bekannten Zeilen
   * findet, ist grün und prüft nichts — er wurde ja an ihnen entlanggebaut.
   * Diese Fälle sind erfunden und decken die Ränder ab.
   */
  it("erkennt Viewport-Präfixe und lässt Containerabfragen in Ruhe", () => {
    expect(
      viewportSpaltenVerstoesse(`className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"`),
    ).toEqual(["sm:grid-cols-2", "lg:grid-cols-3"]);
    expect(viewportSpaltenVerstoesse(`className="xl:grid-cols-4"`)).toEqual(["xl:grid-cols-4"]);
    expect(viewportSpaltenVerstoesse(`className="2xl:grid-cols-6"`)).toEqual(["2xl:grid-cols-6"]);

    // Der Zielzustand: Grundfall ohne Präfix, Abweichungen an Containerbreiten.
    expect(
      viewportSpaltenVerstoesse(
        `className="grid grid-cols-1 @[27rem]:grid-cols-2 @[41rem]:grid-cols-3"`,
      ),
    ).toEqual([]);

    // `@lg:` ist eine Containerabfrage mit demselben Namen wie der Breakpoint.
    // Sie unterscheidet sich allein am `@` — und sie ist der Zielzustand.
    expect(viewportSpaltenVerstoesse(`className="grid-cols-1 @lg:grid-cols-2"`)).toEqual([]);

    // Die Seitenaufteilung darf am Fenster hängen — anderer Wächter.
    expect(viewportSpaltenVerstoesse(`className="lg:grid-cols-[minmax(0,1fr)_16rem]"`)).toEqual([]);

    // Spannen ist kein Schalten.
    expect(viewportSpaltenVerstoesse(`className="sm:col-span-2 lg:col-span-3"`)).toEqual([]);

    // Ein Kommentar darf seinen eigenen Anlass benennen, ohne ihn auszulösen —
    // sonst verbietet die Regel, sie zu erklären.
    expect(viewportSpaltenVerstoesse(`{/* warum lg:grid-cols-3 hier falsch waere */}`)).toEqual([]);
    expect(viewportSpaltenVerstoesse(`// siehe sm:grid-cols-2`)).toEqual([]);
    // Aber echten Code frisst der Entferner nicht weg, auch nicht neben einer
    // Adresse mit „//".
    expect(viewportSpaltenVerstoesse(`className="sm:grid-cols-2" /* https://x/y */`)).toEqual([
      "sm:grid-cols-2",
    ]);

    // Ein zusammengesetztes Präfix zählt trotzdem.
    expect(viewportSpaltenVerstoesse(`className="hover:lg:grid-cols-2"`)).toEqual([
      "hover:lg:grid-cols-2",
    ]);
  });

  it.each(KARTENFLAECHEN)("%s schaltet seine Spalten am Behälter", (datei) => {
    const gefunden = viewportSpaltenVerstoesse(readFileSync(datei, "utf8"));
    expect(gefunden, `${datei}: ${gefunden.join(", ")}`).toEqual([]);
  });
});
