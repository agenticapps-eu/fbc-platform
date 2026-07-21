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

export type DesignVariantId =
  | "a"
  | "b"
  | "c"
  | "d"
  | "e"
  | "f"
  | "g"
  | "h"
  | "i"
  | "sommerfest"
  | "blau"
  | "linkedin";

export const DESIGN_VARIANT_IDS: readonly DesignVariantId[] = [
  "a",
  "b",
  "c",
  "d",
  "e",
  "f",
  "g",
  "h",
  "i",
  "sommerfest",
  "blau",
  "linkedin",
];

/** Was der Switcher tatsächlich zur Auswahl stellt (AGE-439).
 *
 *  Detlev hat die übrigen Varianten abbestellt („die werden wir eh nicht
 *  verwenden"), B–I sind deshalb hier raus. Sie bleiben aber vollständig in
 *  `DESIGN_VARIANTS` und in `src/index.css` stehen — das Zurückholen ist eine
 *  Zeile, und `?variant=b` funktioniert weiterhin fürs interne Zeigen.
 *  Absichtlich getrennt von DESIGN_VARIANT_IDS: „bekannt" ≠ „angeboten".
 *
 *  AGE-441 stellt `blau` dazu — die Vergleichsreihe für den Termin am 22.07.
 *  ist damit: Sommerfest (heutiger Default) · Blau (Vorschlag) · eff.bee.zee
 *  (Referenz-Look). H/I bleiben bewusst ausgeblendet — Detlev hat sie
 *  abbestellt, und der Vorschlag beantwortet „blau" bereits. */
export const SWITCHER_VARIANT_IDS: readonly DesignVariantId[] = [
  "a",
  "sommerfest",
  "blau",
  "linkedin",
];

export const DEFAULT_VARIANT: DesignVariantId = "sommerfest";

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
  h: {
    id: "h",
    label: "Navy & Gold (dunkel)",
    description: "Marineblau als Chrome, Gold-Akzent, helle Cards (Wimpel/Marke).",
    motion: "medium",
    heroStyle: "dark-glow",
    headlineFont: "serif",
    cardStyle: "solid",
    backdrop: "none",
  },
  i: {
    id: "i",
    label: "Navy & Gold (hell)",
    description: "Navy als Text/Akzent, helle Sidebar & Content, Gold-Akzent.",
    motion: "medium",
    heroStyle: "light",
    headlineFont: "serif",
    cardStyle: "solid",
    backdrop: "none",
  },
  /** AGE-441 — „neues blaues Design" (Detlev, 21.07.). Nimmt die Palette des
   *  eff.bee.zee-Dummys (`src/vision/theme.ts`), legt sie aber auf die FBC-
   *  Tokens: der Look ist eff.bee.zee, die Marke bleibt Fair Business Club.
   *  Der Akzent-Token heißt weiterhin `--color-gold`, trägt hier aber Blau —
   *  das ist die dokumentierte Mechanik (gleiche Namen, andere Werte). */
  blau: {
    id: "blau",
    label: "FBC Blau",
    description: "eff.bee.zee-Blau auf FBC-Marke: dunkle Navy-Sidebar, Blau als Akzent.",
    motion: "medium",
    heroStyle: "dark-glow",
    headlineFont: "sans",
    cardStyle: "solid",
    backdrop: "none",
  },
  sommerfest: {
    id: "sommerfest",
    label: "Sommerfest (FBC)",
    description: "FBC-Marke: warmes Creme, Navy-Text, Gold-Akzent, ruhiges Dashboard.",
    motion: "medium",
    heroStyle: "light",
    headlineFont: "serif",
    cardStyle: "solid",
    backdrop: "none",
    recommended: true,
  },
  linkedin: {
    id: "linkedin",
    label: "eff.bee.zee (Vision)",
    description:
      "Vision-Vorschau als Klick-Dummy: eigene Marke, dunkle Navy-Sidebar, ActivePoints.",
    motion: "medium",
    heroStyle: "dark-glow",
    headlineFont: "sans",
    cardStyle: "solid",
    backdrop: "none",
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

/** Ermittelt die initiale Variante: URL ?variant= > localStorage > Default.
 *  Ungültige Werte werden in jeder Stufe übersprungen.
 *
 *  Der gespeicherte Wert muss zusätzlich noch angeboten werden (AGE-439): wer
 *  zuletzt auf einer zurückgezogenen Variante stand, säße sonst darauf fest,
 *  weil der Switcher keinen Weg zurück anbietet. Die URL bleibt bewusst
 *  großzügig — Deep-Links auf B–I sollen weiter funktionieren. */
export function resolveInitialVariant({
  search,
  stored,
}: {
  search: string;
  stored: string | null;
}): DesignVariantId {
  const fromUrl = readVariantFromSearch(search);
  if (isDesignVariantId(fromUrl)) return fromUrl;
  if (isDesignVariantId(stored) && SWITCHER_VARIANT_IDS.includes(stored)) return stored;
  return DEFAULT_VARIANT;
}
