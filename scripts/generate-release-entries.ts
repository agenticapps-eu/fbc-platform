#!/usr/bin/env tsx
/**
 * Erzeugt `src/content/release-entries.generated.ts` aus
 * `openspec/changes/archive/` (AGE-631).
 *
 * Hier steht mit Absicht KEINE Logik — alles Entscheidende liegt in
 * `release-entries.logic.ts` und hat dort einen Test daneben. Diese Datei ist
 * die Klammer um Dateisystem und Ausgabe.
 *
 * **Warum zur Bauzeit und nicht als CI-Schritt in die Datenbank.** Ein Eintrag,
 * der im Bündel steht, ist per Konstruktion ausgeliefert — genau das war die
 * Anforderung („wenn sie archiviert wurden, also deployed"). Der Weg über eine
 * Tabelle kostete einen `service_role`-Schlüssel in einem weiteren Workflow und
 * damit einen zweiten schreibenden Weg in die PROD-Datenbank, für eine Liste,
 * die ohnehin nur ein Mensch liest. Siehe `design.md` des Changes.
 *
 * Aufruf: `pnpm release:entries` (und automatisch über `prebuild`).
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import { parseArchivEintrag, type ReleaseEintrag } from "./release-entries.logic";

const ARCHIV = "openspec/changes/archive";
const ZIEL = "src/content/release-entries.generated.ts";

export function eintraegeAusArchiv(wurzel = ARCHIV): ReleaseEintrag[] {
  return readdirSync(wurzel, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()
    .reverse()
    .map((slug) => {
      const pfad = join(wurzel, slug, "proposal.md");
      // Ein Archiv ohne proposal.md ist kein Grund abzubrechen — der
      // Verzeichnisname trägt genug, und der Admin schreibt ohnehin um.
      const text = existsSync(pfad) ? readFileSync(pfad, "utf8") : "";
      return parseArchivEintrag(slug, text);
    });
}

export function alsModul(eintraege: ReleaseEintrag[]): string {
  return `// ERZEUGT — nicht von Hand ändern.
// Quelle: openspec/changes/archive/ · Erzeuger: scripts/generate-release-entries.ts
// Neu erzeugen: pnpm release:entries (läuft auch über prebuild).
import type { ReleaseEintrag } from "../types/release";

export const RELEASE_EINTRAEGE: ReleaseEintrag[] = ${JSON.stringify(eintraege, null, 2)};
`;
}

// Nur ausführen, wenn direkt aufgerufen — sonst könnte ein Test den Import
// nicht nutzen, ohne die Datei zu überschreiben.
if (process.argv[1]?.endsWith("generate-release-entries.ts")) {
  const eintraege = eintraegeAusArchiv();
  writeFileSync(ZIEL, alsModul(eintraege));
  process.stdout.write(`${eintraege.length} Einträge → ${ZIEL}\n`);
}
