/** Design-Varianten-System (AGE-237 Folge: Live-Switcher).
 *
 *  Die vier Varianten sind KEINE vier Oberflächen, sondern eine Theming-/
 *  Animations-Schicht über den bestehenden Komponenten: ein `data-variant`-
 *  Attribut auf <html> schaltet CSS-Variablen-Overrides (src/index.css) und
 *  wenige Verhaltens-Flags um. Quelle der Wahrheit für die Auswahl:
 *  URL ?variant= > localStorage > Default 'd'. */

export type MotionIntensity = "subtle" | "medium" | "dramatic";
export type HeroStyle = "light" | "dark-glow";
export type HeadlineFont = "serif" | "sans";

export interface DesignVariant {
  id: DesignVariantId;
  label: string;
  description: string;
  motion: MotionIntensity;
  heroStyle: HeroStyle;
  headlineFont: HeadlineFont;
  recommended?: boolean;
}

export type DesignVariantId = "a" | "b" | "c" | "d";

export const DESIGN_VARIANT_IDS: readonly DesignVariantId[] = ["a", "b", "c", "d"];

export const DEFAULT_VARIANT: DesignVariantId = "d";

/** localStorage-Schlüssel der persistierten Auswahl. */
export const VARIANT_STORAGE_KEY = "fbc.designVariant";

/** Query-Parameter für Deep-Links (z. B. ?variant=b). */
export const VARIANT_QUERY_PARAM = "variant";

export const DESIGN_VARIANTS: Record<DesignVariantId, DesignVariant> = {
  a: {
    id: "a",
    label: "Quiet Luxury",
    description: "Hell, editorial, große Serif, viel Weißraum, dezentes Gold.",
    motion: "subtle",
    heroStyle: "light",
    headlineFont: "serif",
  },
  b: {
    id: "b",
    label: "Members' Club",
    description: 'Dunkle App-Flächen, cinematischer Gold-Glow, „VIP"-Anmutung.',
    motion: "dramatic",
    heroStyle: "dark-glow",
    headlineFont: "serif",
  },
  c: {
    id: "c",
    label: "Warm Social",
    description: "Warmes Creme, freundlich, rund, verspielt-weiche Animationen.",
    motion: "medium",
    heroStyle: "light",
    headlineFont: "sans",
  },
  d: {
    id: "d",
    label: "Blend",
    description: "Warme helle Basis + Serif-Headlines + Gold-Glow-Hero.",
    motion: "dramatic",
    heroStyle: "dark-glow",
    headlineFont: "serif",
    recommended: true,
  },
};

export function isDesignVariantId(value: unknown): value is DesignVariantId {
  return typeof value === "string" && (DESIGN_VARIANT_IDS as readonly string[]).includes(value);
}

/** Liest den ?variant=-Wert aus einem Such-String (mit oder ohne führendes „?"). */
function readVariantFromSearch(search: string): string | null {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return params.get(VARIANT_QUERY_PARAM);
}

/** Ermittelt die initiale Variante: URL ?variant= > localStorage > Default 'd'.
 *  Ungültige Werte werden in jeder Stufe übersprungen. */
export function resolveInitialVariant({
  search,
  stored,
}: {
  search: string;
  stored: string | null;
}): DesignVariantId {
  const fromUrl = readVariantFromSearch(search);
  if (isDesignVariantId(fromUrl)) return fromUrl;
  if (isDesignVariantId(stored)) return stored;
  return DEFAULT_VARIANT;
}
