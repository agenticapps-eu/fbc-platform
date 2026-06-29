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

/** Strukturelle Flags (AGE-237, experimentelle Varianten E/F/G). Steuern
 *  wiederverwendbare Bausteine statt Komponenten-Forks:
 *  - `backdrop` → <VariantBackdrop> (aurora-Mesh / Papier-Textur / nichts)
 *  - `cardStyle` → Card-Look via [data-card-style] (glass / editorial / solid) */
export type BackdropStyle = "none" | "aurora" | "paper";
export type CardStyle = "solid" | "glass" | "editorial";

export interface DesignVariant {
  id: DesignVariantId;
  label: string;
  description: string;
  motion: MotionIntensity;
  heroStyle: HeroStyle;
  headlineFont: HeadlineFont;
  /** Animierter Hintergrund hinter dem App-Content (Default: 'none'). */
  backdrop?: BackdropStyle;
  /** Kartenstil; setzt [data-card-style] auf <html> (Default: 'solid'). */
  cardStyle?: CardStyle;
  /** Optionaler Zweitakzent (Hex), nur für die Styleguide-Vorschau. */
  accent2?: string;
  /** Bewusst distinktes Experiment — im Switcher als „Experimentell" markiert. */
  experimental?: boolean;
  recommended?: boolean;
}

export type DesignVariantId = "a" | "b" | "c" | "d" | "e" | "f" | "g";

export const DESIGN_VARIANT_IDS: readonly DesignVariantId[] = ["a", "b", "c", "d", "e", "f", "g"];

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
  e: {
    id: "e",
    label: "Noir Editorial",
    description: "Hochkontrast-Magazin, riesige Serif, Hairlines.",
    motion: "subtle",
    heroStyle: "dark-glow",
    headlineFont: "serif",
    cardStyle: "editorial",
    backdrop: "none",
    experimental: true,
  },
  f: {
    id: "f",
    label: "Aurora Glass",
    description: "Futuristisch, Glas, leuchtende Aurora-Gradients.",
    motion: "dramatic",
    heroStyle: "dark-glow",
    headlineFont: "sans",
    cardStyle: "glass",
    backdrop: "aurora",
    accent2: "#6ee0c2",
    experimental: true,
  },
  g: {
    id: "g",
    label: "Warm Boutique",
    description: "Warm, taktil, Leinen/Terracotta/Salbei, organisch.",
    motion: "medium",
    heroStyle: "light",
    headlineFont: "serif",
    cardStyle: "solid",
    backdrop: "paper",
    accent2: "#6e7e5c",
    experimental: true,
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
