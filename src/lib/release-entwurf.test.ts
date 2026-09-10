import { describe, expect, it } from "vitest";

import { parseArchivEintrag } from "../../scripts/release-entries.logic";
import { RELEASE_GESCHICHTEN } from "../content/release-geschichten";
import type { ReleaseGeschichte } from "../types/release";
import { entwurfAus } from "./release-entwurf";

/**
 * Aus mehreren Änderungen wird EINE Nachricht (AGE-631).
 *
 * Die Funktion liegt unter `src/lib/`, nicht bei den Skripten: die Admin-Fläche
 * ruft sie zur Laufzeit, und ein Import aus `scripts/` zöge Node-Module in den
 * Browser-Build. Der Parser daneben darf hier importiert werden, weil dieser
 * Test unter Node läuft.
 */

const MIT_ALLEM = `# Glocke verdrahten und vier Hinweistypen

Linear: **AGE-620**

## What Changes

- Vier Hinweistypen schreiben in \`notifications\`
- Die Glocke liest sie
`;

const OHNE_TITEL = `## Why

Der Feed lud alles auf einmal.

## What Changes

- Seitenweises Laden mit Keyset-Cursor
`;

/**
 * Diese drei Zusagen gelten dem ERZEUGTEN Entwicklertext und sind älter als die
 * kuratierte Quelle (AGE-631). Sie reichen seit AGE-705 ausdrücklich eine leere
 * Geschichtenliste: ihr Beispiel-Slug ist ein echter Archiv-Slug, und zu dem
 * liegt inzwischen eine Geschichte vor — der Entwurf nähme dann zu Recht deren
 * Titel. Die Behauptungen selbst sind zeichengleich geblieben; nur der
 * Gegenstand ist wieder eindeutig benannt.
 */
describe("entwurfAus — mehrere Changes werden EINE Nachricht", () => {
  const a = parseArchivEintrag("2026-08-27-glocke-und-hinweistypen", MIT_ALLEM);
  const b = parseArchivEintrag("2026-08-25-feed-paging", OHNE_TITEL);

  it("fasst mehrere Einträge zu einem Text zusammen, nicht zu mehreren", () => {
    const entwurf = entwurfAus([a, b], []);
    expect(entwurf.text).toContain("Glocke verdrahten und vier Hinweistypen");
    expect(entwurf.text).toContain("feed-paging");
    // EIN Titel für die ganze Nachricht — das ist die Anforderung.
    expect(entwurf.titel).toBe("Neu in der App");
  });

  it("führt jeden gewählten Slug im Entwurf mit", () => {
    // Ohne diese Menge könnte die Fläche später nicht sagen, was schon
    // angekündigt wurde — und dieselbe Änderung erschiene zweimal.
    expect(entwurfAus([a, b]).slugs).toEqual([
      "2026-08-27-glocke-und-hinweistypen",
      "2026-08-25-feed-paging",
    ]);
  });

  it("ergibt aus null Einträgen einen leeren Entwurf, keinen kaputten", () => {
    const leer = entwurfAus([]);
    expect(leer.slugs).toEqual([]);
    expect(leer.text).toBe("");
  });
});

/**
 * Der Entwurf zieht aus der kuratierten Quelle (AGE-705).
 *
 * Die Geschichten werden als Argument gereicht und nicht aus
 * `release-geschichten.ts` gelesen: dort kommen 22 weitere dazu, und ein Test,
 * der an deren Inhalt hängt, bräche bei jeder redaktionellen Änderung. Genau
 * EINE Zusage greift auf die echte Datei zu — die, die den Vorgabewert belegt.
 */
const GESCHICHTE: ReleaseGeschichte = {
  slug: "2026-08-27-glocke-und-hinweistypen",
  datum: "2026-08-27",
  titel: "Die Glocke sagt dir, was passiert ist",
  text: `Oben rechts sitzt eine Glocke. Sie zählt, was seit deinem letzten Blick dazugekommen ist.

Vier Anlässe landen dort: eine Kontaktanfrage, eine Antwort darauf, eine neue Nachricht und eine Einladung zu einem Event.`,
  // Der Entwurf liest das Bild nicht — es steht hier, weil das Modell es
  // verlangt, und nicht, weil eine Zusage daran hinge.
  bild: { src: "/bilder/glocke.png", alt: "Die geöffnete Glocke", width: 1440, height: 900 },
  freigegeben: false,
};

describe("entwurfAus — kuratierte Geschichten statt Entwicklertext", () => {
  const kuratiert = parseArchivEintrag("2026-08-27-glocke-und-hinweistypen", MIT_ALLEM);
  const roh = parseArchivEintrag("2026-08-25-feed-paging", OHNE_TITEL);

  it("schlägt zu einem kuratierten Eintrag dessen Geschichte vor", () => {
    const entwurf = entwurfAus([kuratiert], [GESCHICHTE]);
    expect(entwurf.text).toContain("Oben rechts sitzt eine Glocke");
    // Der Rohstoff aus dem Proposal darf NICHT durchschlagen.
    expect(entwurf.text).not.toContain("Vier Hinweistypen schreiben in");
  });

  it("schlägt ohne Geschichte weiterhin den erzeugten Entwicklertext vor", () => {
    // Ohne diesen Rückfall bliebe die Fläche für jeden künftigen Change leer.
    expect(entwurfAus([roh], [GESCHICHTE]).text).toContain(
      "- Seitenweises Laden mit Keyset-Cursor",
    );
  });

  it("trägt in einer gemischten Auswahl beides", () => {
    const entwurf = entwurfAus([kuratiert, roh], [GESCHICHTE]);
    expect(entwurf.text).toContain("Oben rechts sitzt eine Glocke");
    expect(entwurf.text).toContain("- Seitenweises Laden mit Keyset-Cursor");
  });

  it("nimmt bei genau einem kuratierten Eintrag Titel und Text UNVERÄNDERT", () => {
    // `toBe` und nicht `toContain`: das ist die Zusage, die eine zusätzliche
    // Überschrift und eine Aufzählungsvorlage ausschliesst.
    const entwurf = entwurfAus([kuratiert], [GESCHICHTE]);
    expect(entwurf.titel).toBe("Die Glocke sagt dir, was passiert ist");
    expect(entwurf.text).toBe(GESCHICHTE.text);
    expect(entwurf.slugs).toEqual(["2026-08-27-glocke-und-hinweistypen"]);
  });

  it("lässt neben der Geschichte den Rohstoff IHRES Eintrags weg", () => {
    // Befund aus dem Mutationslauf: die gemischte Auswahl war nur auf „enthält
    // beides“ geprüft. Ein Rumpf, der die Aufzählung ZUSÄTZLICH anhängt, wäre
    // grün geblieben — und die Entwicklersprache stünde in der Zustellung.
    const entwurf = entwurfAus([kuratiert, roh], [GESCHICHTE]);
    expect(entwurf.text).not.toContain("Vier Hinweistypen schreiben in");
    expect(entwurf.text).not.toContain("Die Glocke liest sie");
    // Die Aufzählung des NICHT kuratierten Eintrags bleibt.
    expect(entwurf.text).toContain("- Seitenweises Laden mit Keyset-Cursor");
  });

  it("erhält die Absatztrennung der Geschichte auch neben einem rohen Eintrag", () => {
    // Zeichengleich enthalten — die Leerzeile zwischen den Absätzen inklusive.
    expect(entwurfAus([kuratiert, roh], [GESCHICHTE]).text).toContain(GESCHICHTE.text);
  });

  it("überschreibt bei mehreren Einträgen den Entwicklertitel mit dem der Geschichte", () => {
    const entwurf = entwurfAus([kuratiert, roh], [GESCHICHTE]);
    expect(entwurf.text).toContain("## Die Glocke sagt dir, was passiert ist");
    expect(entwurf.text).not.toContain("Glocke verdrahten und vier Hinweistypen");
  });

  it("führt mehrere Einträge in der Reihenfolge der Liste", () => {
    const vorwaerts = entwurfAus([kuratiert, roh], [GESCHICHTE]).text;
    expect(vorwaerts.indexOf("Oben rechts")).toBeLessThan(vorwaerts.indexOf("Keyset-Cursor"));
    const rueckwaerts = entwurfAus([roh, kuratiert], [GESCHICHTE]).text;
    expect(rueckwaerts.indexOf("Keyset-Cursor")).toBeLessThan(rueckwaerts.indexOf("Oben rechts"));
  });

  it("schlägt eine noch nicht freigegebene Geschichte trotzdem vor", () => {
    // `freigegeben` steuert den ÖFFENTLICHEN Blog. Über die Zustellung
    // entscheidet ein Admin, der den Entwurf vor sich sieht — würde hier
    // gefiltert, wäre die Fläche vor der redaktionellen Abnahme unbrauchbar.
    expect(GESCHICHTE.freigegeben).toBe(false);
    expect(entwurfAus([kuratiert], [GESCHICHTE]).text).toBe(GESCHICHTE.text);
  });

  it("greift ohne zweites Argument auf die gepflegte Datei zu", () => {
    // Die einzige Zusage an den echten Inhalt — und nur an seine erste
    // Geschichte, damit Block 4 sie nicht rötet. Ohne sie wäre ein Vorgabewert
    // von `[]` grün, und die Admin-Fläche sähe nie eine Geschichte.
    const echt = RELEASE_GESCHICHTEN[0];
    const entwurf = entwurfAus([parseArchivEintrag(echt.slug, MIT_ALLEM)]);
    expect(entwurf.titel).toBe(echt.titel);
    expect(entwurf.text).toBe(echt.text);
  });
});
