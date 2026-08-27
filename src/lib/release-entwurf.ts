import type { ReleaseEintrag } from "../types/release";

/**
 * Aus mehreren Änderungen wird EIN Entwurf (AGE-631).
 *
 * Steht hier und nicht im Erzeuger unter `scripts/`: die Admin-Fläche braucht
 * sie zur Laufzeit, und ein Import aus `scripts/` zöge Node-Module in den
 * Browser-Build. Dieselbe Trennung wie bei `src/types/release.ts`.
 *
 * Der Text ist ein **Vorschlag**. Er soll überschrieben werden — die
 * Proposal-Sprache ist für Entwickler geschrieben.
 */
export interface ReleaseEntwurf {
  titel: string;
  text: string;
  slugs: string[];
}

export function entwurfAus(eintraege: ReleaseEintrag[]): ReleaseEntwurf {
  const text = eintraege
    .map((e) => {
      const kopf = `## ${e.titel}`;
      const punkte = e.aenderungen.map((a) => `- ${a}`).join("\n");
      return punkte ? `${kopf}\n\n${punkte}` : kopf;
    })
    .join("\n\n");
  return { titel: "Neu in der App", text, slugs: eintraege.map((e) => e.slug) };
}
