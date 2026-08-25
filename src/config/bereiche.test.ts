import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BEREICHE } from "./bereiche";

/**
 * „Eine Bereichsfarbe identifiziert, sie signalisiert nicht" (AGE-582).
 *
 * Diese Zusage ist der Preis, für den die bestehende Anforderung geändert werden
 * durfte: `design-system` sagt wörtlich „Blue SHALL be the only accent family …
 * SHALL NOT define … a per-format accent palette", mit prüfendem Szenario. Die
 * neue Grenze lautet — **interaktiver** Akzent bleibt Blau allein; die zweite
 * Familie darf einen Bereich nur **benennen** und nie an Link, Knopf, Fokusring
 * oder aktivem Zustand erscheinen.
 *
 * Eine Grenze, die niemand nachmisst, ist keine. Der Test misst sie am
 * Quellbaum.
 */

/** Die einzigen zwei Dateien, in denen der Name einer Bereichsfarbe stehen darf:
 *  dort, wo der Wert definiert wird, und dort, wo der Kanon ihn zuordnet. Jede
 *  weitere Fundstelle wäre eine Fläche, die sich die Farbe selbst aussucht — und
 *  damit die Verzweigung über Bereiche in mehreren Dateien, die der Kanon
 *  gerade verhindert. */
const ERLAUBT = new Set(["src/index.css", "src/config/bereiche.ts", "src/config/bereiche.test.ts"]);

function quelldateien(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const pfad = join(dir, name);
    if (statSync(pfad).isDirectory()) {
      if (name === "vision" || name === "test") continue;
      quelldateien(pfad, acc);
    } else if (/\.(tsx?|css)$/.test(name)) {
      acc.push(pfad);
    }
  }
  return acc;
}

const FUNDSTELLEN = quelldateien("src").filter((f) => readFileSync(f, "utf8").includes("bereich-"));

describe("Bereichsfarben (AGE-582)", () => {
  it("der Name einer Bereichsfarbe steht nur im Token-Block und im Kanon", () => {
    expect(FUNDSTELLEN.filter((f) => !ERLAUBT.has(f))).toEqual([]);
  });

  /**
   * Die Form der Klasse ist die eigentliche Zusage. `text-bereich-events` kann
   * nichts signalisieren; `hover:text-bereich-events`, `ring-bereich-events`
   * oder `focus-visible:bg-bereich-events` schon — und keine davon käme durch
   * dieses Muster. Deshalb prüft der Test die Form und nicht eine Liste
   * verbotener Präfixe: eine Liste deckt nur ab, woran jemand gedacht hat.
   */
  it.each(Object.entries(BEREICHE))(
    "%s trägt eine Farbe ohne Zustands-Präfix",
    (_name, eintrag) => {
      expect(eintrag.farbe).toMatch(/^(text|bg)-bereich-[a-z]+$/);
    },
  );

  it("jeder Bereich hat genau einen Glyph, und keine zwei teilen sich einen", () => {
    const glyphen = Object.values(BEREICHE).map((b) => b.icon);
    expect(new Set(glyphen).size).toBe(glyphen.length);
  });

  it("jeder Bereich hat genau eine Farbe, und keine zwei teilen sich eine", () => {
    const farben = Object.values(BEREICHE).map((b) => b.farbe);
    expect(new Set(farben).size).toBe(farben.length);
  });

  /**
   * Die Tokens sind Inhaltsschicht: der navy-Block überschreibt absichtlich nur
   * Chrome. Ein zweiter Satz Werte dort wäre nicht „auch richtig", sondern eine
   * zweite Wahrheit — und beim ersten Auseinanderlaufen zeigte dieselbe Karte in
   * zwei Themes zwei Farben.
   */
  it("kein Bereichs-Token wird im navy-Block überschrieben", () => {
    const css = readFileSync("src/index.css", "utf8");

    // Der Anker MUSS gefunden werden, sonst prüft diese Zusage nichts mehr.
    // Ohne die zwei Zeilen war sie selbstblind: `indexOf` liefert −1,
    // `css.slice(-1)` ist dann das einzelne "}" am Dateiende, `indexOf("\n}")`
    // darin wieder −1 und `slice(0, -1)` die leere Zeichenkette — die Zusage
    // lautete `expect(false).toBe(false)` und wäre grün geblieben, während im
    // navy-Block ein `--color-bereich-*` steht. Gefunden im Code-Review zum
    // Diff (AGE-582); dieselbe Falle, gegen die `icons.test.ts` seine zweite
    // Prüfung trägt.
    const start = css.indexOf('html[data-variant="navy"]');
    expect(start, "Anker html[data-variant=\"navy\"] nicht in index.css gefunden").toBeGreaterThan(-1);

    const navy = css.slice(start);
    const ende = navy.indexOf("\n}");
    expect(ende, "Ende des navy-Blocks nicht gefunden").toBeGreaterThan(-1);

    expect(navy.slice(0, ende).includes("bereich-")).toBe(false);
  });

  it("jedes Farb-Token des Kanons ist in index.css definiert", () => {
    const css = readFileSync("src/index.css", "utf8");
    for (const { farbe } of Object.values(BEREICHE)) {
      expect(css).toContain(`--color-${farbe.replace(/^(text|bg)-/, "")}:`);
    }
  });
});
