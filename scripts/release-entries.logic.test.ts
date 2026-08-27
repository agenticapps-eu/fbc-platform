import { describe, expect, it } from "vitest";

import { parseArchivEintrag, entwurfAus } from "./release-entries.logic";

/**
 * Der Erzeuger der Release-Einträge (AGE-631, Band 1).
 *
 * **Die Zusagen hier sind alle Rückfälle, und das ist kein Zufall.** Gemessen am
 * 27.08. gegen das echte Archiv: von 50 Verzeichnissen tragen **21** keine
 * `# Titel`-Zeile — sie beginnen mit `## Why` — und **19** keine
 * `Linear:`-Zeile. Verlässlich ist allein der Verzeichnisname.
 *
 * Ein Erzeuger, der auf das Wohlgeformte besteht, erzeugt eine Fläche, auf der
 * zwei Fünftel der Einträge fehlen — und niemand merkt es, weil eine kürzere
 * Liste genauso aussieht wie eine vollständige.
 */

const MIT_ALLEM = `# Glocke verdrahten und vier Hinweistypen

Linear: **AGE-620**

## Why

Die Glocke in der Kopfzeile ist ein toter Knopf.

## What Changes

- Vier Hinweistypen schreiben in \`notifications\`, mit Fan-out über eine
  DEFINER-Funktion
- Die Glocke liest sie und markiert sie als gelesen
- Vier Opt-out-Schalter auf \`member_settings\`

## Impact

Berührt \`AppShell.tsx\`.
`;

const OHNE_TITEL = `## Why

Der Feed lud alles auf einmal.

## What Changes

- Seitenweises Laden mit Keyset-Cursor
`;

describe("parseArchivEintrag — was das Archiv wirklich hergibt", () => {
  it("liest Titel, Kennung und Änderungen aus einem vollständigen Proposal", () => {
    const e = parseArchivEintrag("2026-08-27-glocke-und-hinweistypen", MIT_ALLEM);
    expect(e.slug).toBe("2026-08-27-glocke-und-hinweistypen");
    expect(e.datum).toBe("2026-08-27");
    expect(e.titel).toBe("Glocke verdrahten und vier Hinweistypen");
    expect(e.linear).toBe("AGE-620");
    expect(e.aenderungen).toEqual([
      "Vier Hinweistypen schreiben in `notifications`, mit Fan-out über eine DEFINER-Funktion",
      "Die Glocke liest sie und markiert sie als gelesen",
      "Vier Opt-out-Schalter auf `member_settings`",
    ]);
  });

  it("fällt ohne Titelzeile auf den Verzeichnisnamen zurück, statt abzubrechen", () => {
    const e = parseArchivEintrag("2026-08-25-feed-paging", OHNE_TITEL);
    expect(e.titel).toBe("feed-paging");
    expect(e.datum).toBe("2026-08-25");
    // Positivkontrolle daneben: der Rest wird trotzdem gelesen. Ein Rückfall,
    // der den ganzen Eintrag entwertet, ist kein Rückfall.
    expect(e.aenderungen).toEqual(["Seitenweises Laden mit Keyset-Cursor"]);
  });

  it("behandelt die Linear-Kennung als optional", () => {
    expect(parseArchivEintrag("2026-08-25-feed-paging", OHNE_TITEL).linear).toBeNull();
  });

  it("nimmt nur die Stichpunkte der obersten Ebene aus dem Aenderungs-Abschnitt", () => {
    const text = `# Titel

## What Changes

- Oben
  - Darunter, gehört nicht in die Ankündigung
- Auch oben

## Impact

- Steht in einem anderen Abschnitt
`;
    expect(parseArchivEintrag("2026-08-01-x", text).aenderungen).toEqual(["Oben", "Auch oben"]);
  });

  it("ueberlebt ein Proposal ganz ohne Aenderungs-Abschnitt", () => {
    const e = parseArchivEintrag("2026-08-01-nur-why", "## Why\n\nEtwas.\n");
    expect(e.aenderungen).toEqual([]);
    expect(e.titel).toBe("nur-why");
  });
});

describe("entwurfAus — mehrere Changes werden EINE Nachricht", () => {
  const a = parseArchivEintrag("2026-08-27-glocke-und-hinweistypen", MIT_ALLEM);
  const b = parseArchivEintrag("2026-08-25-feed-paging", OHNE_TITEL);

  it("fasst mehrere Einträge zu einem Text zusammen, nicht zu mehreren", () => {
    const entwurf = entwurfAus([a, b]);
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
