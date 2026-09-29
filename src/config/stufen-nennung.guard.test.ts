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
  "content/release-entries.generated.ts":
    "erzeugt aus dem Archiv, erreicht kein Mitglied — und der Archiveintrag zu " +
    "AGE-969 nennt `LEVEL_ORDER`, weil er erklaert, dass die Leiter bleibt",
  "components/membership/MembershipSummary.tsx":
    "sucht die nächste Stufe — liest aber GENANNTE_STUFEN, nicht die Leiter; " +
    "steht hier, falls die Einfuhr zurückkommt",
  "pages/StyleguidePage.tsx": "hinter import.meta.env.DEV, nie im Bündel",
};

/**
 * Die Zeilen einer Datei, aus denen die Kommentare herausgeschnitten sind.
 *
 * Die erste Fassung warf ganze Zeilen weg, die mit einem Kommentarzeichen
 * BEGINNEN. Der Diff-Review hat beide Fehler daran benannt: `code(); // Active`
 * wurde gemeldet, obwohl der Name im Kommentar steht, und ` * Frueher: Active`
 * wurde uebersehen, obwohl … nun ja, dort steht er auch nur im Kommentar.
 * Letzteres ist also harmlos, Ersteres ein Fehlalarm.
 *
 * Jetzt werden Blockkommentare und Zeilenreste entfernt, statt Zeilen zu
 * verwerfen. WAS BLEIBT, und das ist der ehrliche Rest: ein `//` INNERHALB
 * einer Zeichenkette (etwa in einer URL) schneidet den Zeilenrest mit weg. Das
 * macht den Waechter an dieser Stelle blind, nicht laut — und eine URL, die
 * einen Stufennamen traegt, waere ein eigener Befund.
 */
function ohneKommentare(text: string): string[] {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((z) => z.replace(/\/\/.*$/, ""));
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

  /**
   * Die Blindstelle, die der Diff-Review gefunden hat (codex, HIGH).
   *
   * `PublicProfilePage` rannte `{profile.tier}` roh in den Text — ein Mitglied
   * unterhalb des Clubs sah dort den SCHLÜSSEL, also „active" statt „Active".
   * Beide Wächter blieben grün: es war weder eine Zeichenkette noch
   * `LEVEL_ORDER`, sondern ein Ausdruck.
   *
   * Diese Zusage schliesst genau das: ein `tier` gehört nicht ungefiltert in
   * JSX. Der Weg dorthin ist `genannterName()` oder `TierBadge`.
   */
  it("rendert keinen tier-Wert roh in JSX", () => {
    const roh = quellen
      .filter((p) => !/\.test\.tsx?$/.test(p))
      .filter((p) => !p.startsWith("src/vision/"))
      .map((p) => ({ pfad: p, zeilen: ohneKommentare(readFileSync(p, "utf8")) }))
      .filter(({ zeilen }) =>
        // `{…tier}` als JSX-INHALT, nicht als Attributwert: vor der Klammer
        // darf kein `=` stehen, sonst traefe die Regel auch `tier={tier}` —
        // und das ist die richtige Verwendung, denn `TierBadge` filtert
        // selbst. `{levelLabel(tier)}` und `{genannterName(tier)}` fallen
        // ebenfalls nicht darunter, sie tragen eine Klammer.
        // OHNE Leerzeichen innerhalb der Klammern: `{ tier }` mit Leerzeichen
        // ist eine Destrukturierung in einer Parameterliste, `{profile.tier}`
        // ohne ist JSX-Inhalt. Prettier setzt das in diesem Baum so, und die
        // Unterscheidung kostet nichts — schreibt jemand JSX mit Leerzeichen,
        // ist der Waechter dort blind und nicht laut.
        zeilen.some((z) => /(^|[^=])\{[\w.]*\btier\}/.test(z)),
      )
      .map(({ pfad }) => pfad)
      .sort();

    expect(
      roh,
      "Hier steht ein `tier` ungefiltert in JSX — das rendert den rohen " +
        "Schlüssel (klein geschrieben), und unterhalb des Clubs soll überhaupt " +
        "erscheinen. Nimm `genannterName()` oder `TierBadge`.",
    ).toEqual([]);
  });

  it("nennt die drei Stufen ausserhalb des Clubs in keiner Fläche wörtlich", () => {
    // Gegen die Fläche, die den Namen von Hand hinschreibt statt eine Liste zu
    // lesen. Case-sensitiv und mit Wortgrenzen — `connect` klein ist ein
    // Schlüssel oder ein englisches Verb und geht niemanden etwas an.
    const verdaechtig = quellen
      .filter((p) => !/\.test\.tsx?$/.test(p))
      .filter((p) => !p.startsWith("src/config/levels"))
      // Eng statt pauschal: genau die beiden Dateien, die einen Stufennamen
      // tragen DÜRFEN, mit ihrem Grund. `src/content/` als Ganzes
      // auszunehmen war zu grob — dort liegen auch Texte, die ein Mitglied
      // liest. Befund des Diff-Reviews (codex).
      .filter(
        (p) =>
          // Erzeugt aus dem Archiv, erreicht KEIN Mitglied: gelesen wird sie
          // nur von `AdminNeuigkeitenPage` und `lib/release-notes.ts`. Was ein
          // Admin daraus in eine Mitteilung übernimmt, redigiert er selbst.
          p !== "src/content/release-entries.generated.ts" &&
          // Rechtstext: nennt die alten Namen nur noch in der Kopf-Notiz, die
          // erklärt, was geändert wurde.
          p !== "src/content/legal/agb.ts",
      )
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
