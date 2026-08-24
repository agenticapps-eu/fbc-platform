import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * „Jeder wiederverwendbare Glyph steht im Icon-Satz" (AGE-582, Abschnitt 1).
 *
 * Der Anlass ist gemessen, nicht befürchtet: vor diesem Change lagen SVGs in
 * **14** Dateien außerhalb `src/vision`. `CrownIcon` stand byte-gleich zweimal
 * (`mein-bereich/building-blocks.tsx`, `profile/ProfileHero.tsx`), und der
 * Kalender-Glyph dreimal (`NavIcon["/events"]`, `CommunityFeed.CalendarIcon`,
 * `EventDetailPage.DETAIL_ICONS.kalender`). Ein Stilwechsel am Satz erreichte
 * also nie alle Symbole, und niemand merkte es.
 *
 * Der Test ist ein **Mechanismus, keine Absicht**: er liest den Quellbaum und
 * fällt, sobald irgendwo ein `<svg>` entsteht, das nicht im Satz steht. Ein
 * Kommentar „bitte Icons in icons.tsx" hätte dieselbe Wirkung gehabt wie die
 * drei Kalender beweisen — keine.
 */

/** Die einzige Datei, die einen Glyph zeichnen darf: der Satz selbst. */
const SATZ = "src/components/ui/icons.tsx";

/**
 * Ausnahmen — **namentlich, mit Grund** (Aufgabe 1.6, Donalds Wahl vom 24.08.).
 *
 * Eine Ausnahme ist eine Datei, deren `<svg>` kein wiederverwendbarer Glyph ist
 * oder deren Auflösung bewusst vertagt wurde. Sie ist kein Freibrief: siehe die
 * Gegenprüfung unten, die eine Ausnahme ohne `<svg>` als Fehler meldet.
 */
const AUSNAHMEN: Record<string, string> = {
  "src/components/ui/CompassMark.tsx":
    "Markenmarke — trägt eine eigene Anforderung (design-system) und darf dem Satzstil gerade nicht folgen",
  "src/components/mein-bereich/profil-widgets.tsx":
    "Datenvektor: `viewBox 200x48`, eine `<polyline>` aus Messwerten — kein Symbol, sondern ein Diagramm",
  "src/components/ui/Avatar.tsx":
    "Platzhalter-Silhouette im Bauteil selbst; sie hat außerhalb des Avatars keinen Aufrufer",
  "src/pages/EventDetailPage.tsx":
    "VERTAGT (24.08.): `DETAIL_ICONS` ist ein zweiter Satz (kalender/ort/personen/ticket). `kalender` bleibt damit dreimal im Baum — bewusst, um den Diff vor dem Go-Live klein zu halten",
  "src/pages/AdminMitgliederPage.tsx":
    "VERTAGT (24.08.): Drei-Punkte-Symbol des Zeilenmenüs, gefüllt statt gestrichelt",
  "src/pages/MeineChancenPage.tsx":
    "VERTAGT (24.08.): zwei verbundene Kreise als Leerzustands-Symbol — dasselbe Motiv wie `network` im Kategoriensatz",
  "src/components/mein-bereich/building-blocks.tsx":
    "VERTAGT (24.08.): `CheckIcon` bleibt hier. `CrownIcon` verlässt die Datei trotzdem (Aufgabe 1.4), weil er doppelt stand",
};

function quelldateien(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const pfad = join(dir, name);
    if (statSync(pfad).isDirectory()) {
      // src/vision/ ist eingefrorener Entwurf und wird von nirgends importiert
      // (siehe App.test.tsx) — seine Glyphen rendern nie.
      if (name === "vision" || name === "test") continue;
      quelldateien(pfad, acc);
    } else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) {
      acc.push(pfad);
    }
  }
  return acc;
}

const MIT_SVG = quelldateien("src").filter((f) => readFileSync(f, "utf8").includes("<svg"));

describe("Icon-Satz (AGE-582)", () => {
  it("kein <svg> außerhalb des Satzes und der benannten Ausnahmen", () => {
    const fremd = MIT_SVG.filter((f) => f !== SATZ && !(f in AUSNAHMEN));
    expect(fremd).toEqual([]);
  });

  /**
   * Die Gegenprüfung zur Liste oben. Ohne sie verrottet die Ausnahmeliste
   * lautlos: wird ein `<svg>` aus einer Ausnahme entfernt, bleibt der Dateiname
   * stehen und deckt ab da **jeden** künftigen Glyph in derselben Datei. Genau
   * so ist eine Handliste in `redirect-targets.test.ts` einmal blind geworden.
   */
  it.each(Object.keys(AUSNAHMEN))("die Ausnahme %s trägt noch ein <svg>", (datei) => {
    expect(MIT_SVG).toContain(datei);
  });

  it("der Satz existiert und zeichnet", () => {
    expect(MIT_SVG).toContain(SATZ);
  });
});
