import { describe, expect, it } from "vitest";

import { parseArchivEintrag } from "../../scripts/release-entries.logic";
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
