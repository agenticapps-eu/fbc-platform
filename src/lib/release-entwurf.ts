import { RELEASE_GESCHICHTEN } from "../content/release-geschichten";
import type { ReleaseEintrag, ReleaseGeschichte } from "../types/release";

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

/**
 * Zu jedem Eintrag die kuratierte Geschichte, wo es eine gibt (AGE-705).
 *
 * Der Rückfall auf den Entwicklertext ist keine Bequemlichkeit: jeder künftige
 * Change legt einen Archiveintrag an, für den noch keine Geschichte geschrieben
 * ist. Ohne ihn bliebe die Fläche für genau diesen Eintrag leer.
 *
 * `freigegeben` wird hier NICHT geprüft. Es steuert den öffentlichen Blog; über
 * die Zustellung entscheidet ein Admin, der den Entwurf vor sich sieht und ihn
 * überschreiben kann.
 *
 * @param geschichten Vorgabe ist die gepflegte Datei; die Tests reichen eigene,
 *   damit sie nicht am redaktionellen Inhalt hängen.
 */
export function entwurfAus(
  eintraege: ReleaseEintrag[],
  geschichten: ReleaseGeschichte[] = RELEASE_GESCHICHTEN,
): ReleaseEntwurf {
  const nachSlug = new Map(geschichten.map((g) => [g.slug, g]));
  const slugs = eintraege.map((e) => e.slug);

  // Genau ein kuratierter Eintrag: die Geschichte IST der Entwurf. Keine
  // zusätzliche Überschrift, keine Aufzählungsvorlage — sie ist bereits in
  // Mitgliedersprache geschrieben und trägt bewusst kein Markup.
  const einzeln = eintraege.length === 1 ? nachSlug.get(eintraege[0].slug) : undefined;
  if (einzeln) return { titel: einzeln.titel, text: einzeln.text, slugs };

  const text = eintraege
    .map((e) => {
      const geschichte = nachSlug.get(e.slug);
      const kopf = `## ${geschichte ? geschichte.titel : e.titel}`;
      const rumpf = geschichte
        ? geschichte.text
        : e.aenderungen.map((a) => `- ${a}`).join("\n");
      return rumpf ? `${kopf}\n\n${rumpf}` : kopf;
    })
    .join("\n\n");
  return { titel: "Neu in der App", text, slugs };
}
