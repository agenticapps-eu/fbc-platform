import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Zusagen für schmale Geräte (AGE-584). Zwei Regeln, beide aus einer Messung
 * bei 320 px, keine dritte auf Verdacht.
 *
 * Der Anlass: die eingeloggte Startseite ließ sich um 114 px seitlich schieben,
 * das Verzeichnis um 39 px. Ursache war nicht die Schriftgröße — eine Spalte,
 * die auf `10rem` festgenagelt ist, bleibt 160 px breit, egal wie klein der
 * Text darin ist.
 *
 * Was dieser Test NICHT kann: den Überlauf selbst messen. jsdom rechnet kein
 * Layout — es kennt weder `getBoundingClientRect` mit echten Breiten noch
 * `scrollWidth`. Geprüft werden deshalb die beiden Ursachen im Quelltext. Eine
 * dritte, hier nicht gemessene Ursache liefe durch. Das ist der benannte Preis
 * dieses Zuschnitts, nicht ein Versehen.
 */

function quelldateien(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const pfad = join(dir, name);
    if (statSync(pfad).isDirectory()) quelldateien(pfad, acc);
    else if (pfad.endsWith(".tsx") && !pfad.endsWith(".test.tsx")) acc.push(pfad);
  }
  return acc;
}

/**
 * Regel 1 — eine feste Rasterspalte gilt erst ab einem Breakpoint.
 *
 * Absichtlich auf `grid-cols-[…]` begrenzt. Ein Ausdruck, der irgendeine feste
 * Länge sucht, fängt `gap-px`, `w-4` und den halben Rest des Baums mit; die
 * Zusage handelt aber von Rasterspalten und von nichts sonst.
 *
 * `minmax(0,…fr)` ist KEIN Verstoß: die 0 ist die Untergrenze, nicht die
 * Spaltenbreite — genau die Schreibweise, die man will.
 */
export function festeSpaltenVerstoesse(quelle: string): string[] {
  const treffer: string[] = [];
  const muster = /((?:[a-z0-9]+:)*)grid-cols-\[([^\]]+)\]/g;
  for (const m of quelle.matchAll(muster)) {
    const [, praefixe, spalten] = m;
    const hatBreakpoint = /\b(sm|md|lg|xl|2xl):/.test(praefixe);
    if (hatBreakpoint) continue;
    // Feste Länge irgendwo in der Definition — außer als Untergrenze in minmax().
    const ohneMinmax = spalten.replace(/minmax\(\s*0[a-z%]*\s*,/g, "minmax(,");
    // KEIN `\b` hinter der Einheit: Tailwind trennt Spalten mit `_`, und `_`
    // ist ein Wortzeichen — zwischen `10rem` und `_1fr` liegt also gar keine
    // Wortgrenze. Mit `\b` fand der Ausdruck genau die Schreibweise nicht, für
    // die er geschrieben wurde; die Verbiegungsprobe hat es gefangen.
    if (/\d(?:\.\d+)?(?:rem|px|ch|em)(?![a-z])/.test(ohneMinmax)) treffer.push(m[0]);
  }
  return treffer;
}

describe("Regel 1 — feste Rasterspalten brauchen einen Breakpoint", () => {
  /**
   * Verbiegungsprobe. Ein Wächter, der nur die beim Schreiben bekannten Zeilen
   * findet, ist grün und prüft nichts: er wurde ja an ihnen entlanggebaut.
   * Diese Fälle sind erfunden und decken die Ränder ab.
   */
  it("erkennt einen Verstoß und lässt korrekte Schreibweisen in Ruhe", () => {
    expect(festeSpaltenVerstoesse(`className="grid grid-cols-[10rem_1fr_auto] gap-2"`)).toEqual([
      "grid-cols-[10rem_1fr_auto]",
    ]);
    expect(festeSpaltenVerstoesse(`className="grid grid-cols-[10rem_1fr_5rem_auto]"`)).toHaveLength(
      1,
    );
    // Hinter einem Breakpoint ist genau das erlaubt — es ist die Behebung.
    expect(festeSpaltenVerstoesse(`className="sm:grid-cols-[10rem_1fr_auto]"`)).toEqual([]);
    expect(festeSpaltenVerstoesse(`className="grid grid-cols-1 sm:grid-cols-2"`)).toEqual([]);
    // `minmax(0,…fr)` ist die gewollte Schreibweise, kein Verstoß.
    expect(festeSpaltenVerstoesse(`className="grid-cols-[1fr_minmax(0,0.85fr)]"`)).toEqual([]);
    // `gap-px` darf nicht mitgefangen werden.
    expect(festeSpaltenVerstoesse(`className="grid gap-px grid-cols-2"`)).toEqual([]);
  });

  it("findet keinen Verstoß im Quelltext", () => {
    const gefunden = quelldateien("src")
      .map((pfad) => ({ pfad, treffer: festeSpaltenVerstoesse(readFileSync(pfad, "utf8")) }))
      .filter((x) => x.treffer.length > 0)
      .map((x) => `${x.pfad}: ${x.treffer.join(", ")}`);
    expect(gefunden).toEqual([]);
  });
});

/**
 * Regel 2 — die geteilten Layout-Bausteine schrumpfen unter ihren Inhalt.
 *
 * Warum am Baustein und nicht an der Aufrufstelle: zwischen einem kürzenden
 * Text und dem Rasterkind darüber liegt in diesem Code regelmäßig eine
 * Komponentengrenze. Ein Test, der von `truncate` aus die JSX-Vorfahren
 * hinaufgeht, verstummt an jeder solchen Grenze — er wäre bei BEIDEN gemessenen
 * Verstößen grün gewesen. Deshalb hängt die Zusage an den zwei Bausteinen, durch
 * die beide Fälle laufen.
 *
 * `Card` behebt die eingeloggte Startseite (gemessen 434 → 320),
 * `StaggerItem` das Verzeichnis (359 → 320; dieselbe Eigenschaft auf der Karte
 * bewirkt dort nichts: 359 → 359).
 */
/**
 * Kommentare weg, BEVOR geprüft wird. Beide Bausteine erklären in einem
 * Kommentar, warum sie `min-w-0` tragen — und nennen die Klasse dabei
 * wörtlich. Eine Prüfung auf den rohen Dateiinhalt wäre deshalb grün geblieben,
 * wenn jemand die Klasse entfernt und den Kommentar stehen lässt. Gemessen: mit
 * entfernter Klasse und stehendem Kommentar liefen alle vier Tests durch.
 */
function ohneKommentare(quelle: string): string {
  return quelle.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("Regel 2 — geteilte Bausteine tragen min-w-0", () => {
  it.each([
    ["src/components/ui/Card.tsx", "Card"],
    ["src/components/ui/Motion.tsx", "StaggerItem"],
  ])("%s trägt min-w-0 im Code, nicht bloß im Kommentar", (pfad) => {
    expect(ohneKommentare(readFileSync(pfad, "utf8"))).toContain("min-w-0");
  });

  it("die Kommentar-Entfernung wirkt wirklich", () => {
    expect(ohneKommentare('// nur ein Kommentar mit min-w-0\nconst a = 1;')).not.toContain(
      "min-w-0",
    );
    expect(ohneKommentare('/** Block mit min-w-0 */\nconst b = 2;')).not.toContain("min-w-0");
    // Und sie darf echten Code nicht wegfressen — auch nicht mit „//" in einer URL.
    expect(ohneKommentare('cn("min-w-0", x); // siehe https://x/y')).toContain('cn("min-w-0", x)');
  });
});
