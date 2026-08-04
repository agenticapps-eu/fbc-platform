/** Theme-System (AGE-492).
 *
 *  Es gibt genau zwei Themes — `hell` und `navy`. Sie sind KEINE zwei
 *  Oberflächen, sondern eine Token-Schicht: ein `data-variant`-Attribut auf
 *  <html> schaltet die CSS-Variablen-Overrides in src/index.css um. Beide
 *  definieren dieselben Token-NAMEN, daher kennt keine Komponente ihr Theme.
 *
 *  Quelle der Wahrheit für die Auswahl:
 *    ausgeloggt → localStorage, Default 'hell'
 *    eingeloggt → member_settings.theme gewinnt und überschreibt localStorage
 *
 *  Anders als bis AGE-439 gibt es keinen `?variant=`-Deep-Link mehr: das Theme
 *  ist eine Nutzer-Einstellung, kein Review-Werkzeug. Zurückgezogene Werte
 *  (a–i, sommerfest, blau*, linkedin) fallen still auf `hell` zurück. */

export interface DesignVariant {
  id: DesignVariantId;
  label: string;
  description: string;
}

export type DesignVariantId = "hell" | "navy";

export const DESIGN_VARIANT_IDS: readonly DesignVariantId[] = ["hell", "navy"];

export const DEFAULT_VARIANT: DesignVariantId = "hell";

/** localStorage-Schlüssel der persistierten Auswahl. */
export const VARIANT_STORAGE_KEY = "fbc.designVariant";

export const DESIGN_VARIANTS: Record<DesignVariantId, DesignVariant> = {
  hell: {
    id: "hell",
    label: "Hell",
    description: "Weiße Flächen, Anthrazit-Text, Blau als Akzent.",
  },
  navy: {
    id: "navy",
    label: "Navy",
    description: "Dunkle Navy-Flächen, helle Schrift, Blau als Akzent.",
  },
};

export function isDesignVariantId(value: unknown): value is DesignVariantId {
  return typeof value === "string" && (DESIGN_VARIANT_IDS as readonly string[]).includes(value);
}

/** Ermittelt das Theme vor dem ersten Render: gespeicherter Wert, sonst Default.
 *
 *  Muss mit dem Inline-Skript in index.html übereinstimmen, das dieselbe Regel
 *  VOR dem ersten Paint anwendet. Weichen die beiden ab, korrigiert der Provider
 *  den Vorab-Wert sichtbar — genau das Flackern, das das Skript verhindern soll. */
export function resolveInitialVariant({ stored }: { stored: string | null }): DesignVariantId {
  return isDesignVariantId(stored) ? stored : DEFAULT_VARIANT;
}
