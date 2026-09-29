import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Welche Flächen die ganze Leiter aufzählen dürfen (AGE-969).
 *
 * ── WARUM EIN WÄCHTER ÜBER DEM QUELLTEXT ────────────────────────────────────
 * Die aufzählenden Flächen — Startseite, Admin-Einzelbearbeitung — rendern
 * eine Liste aus `LEVEL_ORDER`. Sie einzeln zu rendern hiesse, für jede die
 * halbe Anwendung zu mocken; und eine Zusage je Fläche fände die Fläche nicht,
 * die jemand morgen hinzufügt.
 *
 * Deshalb dieselbe Bauform wie `redirect-targets.test.ts`: den Quelltext lesen
 * und die REGEL festhalten. Wer eine neue Stufenliste baut, wird hier rot,
 * nicht erst beim Durchsehen.
 *
 * ── WAS DIESER WÄCHTER NICHT SIEHT ──────────────────────────────────────────
 *   * Eine Fläche, die die Namen von Hand hinschreibt statt eine Liste zu
 *     lesen. Dagegen hilft nur das Lesen des Diffs.
 *   * Inhalte, die ein Admin zur Laufzeit pflegt.
 *   * Das gebaute Bündel — und das ist Absicht: die drei Namen MÜSSEN darin
 *     bleiben, weil `levels.ts` sie behält und die Admin-Auswahl sie braucht.
 *     Ein Wächter über dem Artefakt wäre ab dem ersten Bau rot. Siehe
 *     `design.md` des Change.
 */

/**
 * Wer `LEVEL_ORDER` lesen darf, und warum. Jeder Eintrag trägt seinen Grund —
 * eine Ausnahmeliste ohne Gründe wächst, bis sie nichts mehr bedeutet.
 */
const DARF_DIE_GANZE_LEITER_LESEN: Record<string, string> = {
  "config/levels.ts": "definiert sie",
  "config/levels.test.ts": "prüft sie",
  "config/stufen-nennung.guard.test.ts": "diese Datei",
  "components/membership/MembershipSummary.tsx":
    "sucht die nächste Stufe — liest aber GENANNTE_STUFEN, nicht die Leiter; " +
    "steht hier, falls die Einfuhr zurückkommt",
  "pages/MitgliedschaftPage.tsx":
    "seit AGE-907 auf / umgeleitet, also nicht erreichbar; AGE-928 baut die " +
    "Seite neu und liest dann GENANNTE_STUFEN",
  "pages/StyleguidePage.tsx": "hinter import.meta.env.DEV, nie im Bündel",
};

/** Die Zeilen einer Datei ohne Kommentarzeilen. Grob, und das genuegt: ein
 *  Bezeichner mitten in einem Satz ist Prosa, kein Aufruf. */
function ohneKommentare(text: string): string[] {
  return text.split("\n").filter((z) => !/^\s*(\/\/|\*|\/\*)/.test(z));
}

function alleQuellen(wurzel: string, gesammelt: string[] = []): string[] {
  for (const eintrag of readdirSync(wurzel, { withFileTypes: true })) {
    const pfad = join(wurzel, eintrag.name);
    if (eintrag.isDirectory()) alleQuellen(pfad, gesammelt);
    else if (/\.tsx?$/.test(eintrag.name)) gesammelt.push(pfad);
  }
  return gesammelt;
}

describe("Wer die ganze Stufenleiter aufzählen darf (AGE-969)", () => {
  const quellen = alleQuellen("src");

  it("findet überhaupt Quelldateien — sonst misst der Rest nichts", () => {
    // Die Positivkontrolle zum Wächter selbst. Ein Verzeichniswechsel liesse
    // ihn sonst lautlos über einer leeren Menge grün werden.
    expect(quellen.length).toBeGreaterThan(200);
  });

  it("liest LEVEL_ORDER nur dort, wo es einen benannten Grund gibt", () => {
    const treffer = quellen
      // Kommentarzeilen zaehlen nicht: dieser Change erklaert an mehreren
      // Stellen, WARUM dort nicht mehr `LEVEL_ORDER` steht. Eine Erklaerung
      // ist keine Fundstelle.
      .filter((p) => ohneKommentare(readFileSync(p, "utf8")).some((z) => /\bLEVEL_ORDER\b/.test(z)))
      .map((p) => p.replace(/^src\//, ""))
      .filter((p) => !(p in DARF_DIE_GANZE_LEITER_LESEN))
      .sort();

    expect(
      treffer,
      "Diese Dateien zählen die ganze Stufenleiter auf. Seit AGE-969 nennt die " +
        "Oberfläche nur DISCOVER, FOCUS und IMPACT — lies `GENANNTE_STUFEN` " +
        "statt `LEVEL_ORDER`. Braucht die Fläche wirklich alle sechs (etwa die " +
        "Admin-Auswahl, die eine gesetzte niedrigere Stufe stehen lässt), trag " +
        "sie oben mit ihrem Grund ein.",
    ).toEqual([]);
  });

  it("nennt die drei Stufen ausserhalb des Clubs in keiner Fläche wörtlich", () => {
    // Gegen die Fläche, die den Namen von Hand hinschreibt statt eine Liste zu
    // lesen. Case-sensitiv und mit Wortgrenzen — `connect` klein ist ein
    // Schlüssel oder ein englisches Verb und geht niemanden etwas an.
    const verdaechtig = quellen
      .filter((p) => !/\.test\.tsx?$/.test(p))
      .filter((p) => !p.startsWith("src/config/levels"))
      .filter((p) => !p.startsWith("src/content/"))
      .filter((p) => !p.startsWith("src/vision/"))
      .map((p) => ({ pfad: p, text: readFileSync(p, "utf8") }))
      // Nur JSX-Text und Zeichenketten, nicht Kommentare: der Kommentar in
      // `TierBadge` erklärt gerade, warum die drei dort NICHT erscheinen.
      .filter(({ text }) =>
        ohneKommentare(text).some((z) => /["'>]\s*(Active|Boost|Connect)\b/.test(z)),
      )
      .map(({ pfad }) => pfad)
      .sort();

    expect(
      verdaechtig,
      "Hier steht ein Stufenname ausserhalb des Clubs wörtlich in einer " +
        "Zeichenkette oder in JSX-Text. Seit AGE-969 nennt die Oberfläche ihn " +
        "nicht mehr.",
    ).toEqual([]);
  });
});
