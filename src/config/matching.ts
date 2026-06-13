/**
 * Such-/Biete-Kategorien, Komplementarität & Volumen (AGE-244, matching-spec §2/§8).
 *
 * EINZIGE Quelle für: die Editor-Optionen (Anlegen/Bearbeiten von offers/needs),
 * die Labels & Icons im Dashboard/Matching, die Komplementaritäts-Map (need ↔
 * offer; speist die Score-Engine AGE-245) sowie das Volumen-Routing fbc/dkri (§8).
 *
 * Bewusst als schlichte, deklarative Konfiguration gehalten — Liste, Zuordnungen
 * und Schwellen lassen sich ohne Code-Kenntnis (mit Detlev) justieren, ohne dass
 * Editor, Dashboard oder Engine angefasst werden müssen.
 */

export type MatchingTheme = "sein" | "tun" | "haben" | "wirken";
export type MatchingSide = "offer" | "need";
export type Routing = "fbc" | "dkri";

export const MATCHING_THEME_LABEL: Record<MatchingTheme, string> = {
  sein: "Sein",
  tun: "Tun",
  haben: "Haben",
  wirken: "Wirken",
};

/** Themen-Optionen für die Auswahl im Editor (feste Reihenfolge). */
export const MATCHING_THEMES = (["sein", "tun", "haben", "wirken"] as const).map((value) => ({
  value,
  label: MATCHING_THEME_LABEL[value],
}));

/** Schlüssel der verfügbaren Inline-Icons (siehe components/matching/CategoryIcon). */
export type CategoryIconKey =
  | "coins"
  | "network"
  | "bulb"
  | "building"
  | "shares"
  | "briefcase"
  | "mentor"
  | "rocket"
  | "target"
  | "users";

export interface MatchingCategory {
  /** Stabiler Schlüssel, wird in offers/needs.category gespeichert. */
  key: string;
  label: string;
  theme: MatchingTheme;
  icon: CategoryIconKey;
  side: MatchingSide;
}

// ── „Ich biete" (offer) ───────────────────────────────────────────────────────
export const OFFER_CATEGORIES: MatchingCategory[] = [
  { key: "kapital", label: "Kapital", theme: "haben", icon: "coins", side: "offer" },
  { key: "kontakte", label: "Kontakte", theme: "wirken", icon: "network", side: "offer" },
  { key: "know_how", label: "Know-how", theme: "tun", icon: "bulb", side: "offer" },
  { key: "immobilien", label: "Immobilien", theme: "haben", icon: "building", side: "offer" },
  { key: "beteiligungen", label: "Beteiligungen", theme: "haben", icon: "shares", side: "offer" },
  { key: "leistungen", label: "Leistungen", theme: "tun", icon: "briefcase", side: "offer" },
  { key: "mentoring", label: "Mentoring", theme: "sein", icon: "mentor", side: "offer" },
];

// ── „Ich suche" (need) ────────────────────────────────────────────────────────
export const NEED_CATEGORIES: MatchingCategory[] = [
  { key: "investoren", label: "Investoren", theme: "haben", icon: "coins", side: "need" },
  { key: "projekte", label: "Projekte", theme: "tun", icon: "rocket", side: "need" },
  { key: "immobilien", label: "Immobilien", theme: "haben", icon: "building", side: "need" },
  { key: "partner", label: "Partner", theme: "wirken", icon: "network", side: "need" },
  { key: "experten", label: "Experten", theme: "tun", icon: "bulb", side: "need" },
  { key: "kunden", label: "Kunden", theme: "wirken", icon: "target", side: "need" },
  { key: "mitarbeiter", label: "Mitarbeiter", theme: "tun", icon: "users", side: "need" },
  { key: "mentoren", label: "Mentoren", theme: "sein", icon: "mentor", side: "need" },
];

/**
 * Komplementaritäts-Map (need-key → passende offer-keys), matching-spec §2.
 * Grundlage des Komplementaritäts-Faktors (35 %) der Score-Engine (AGE-245).
 */
export const COMPLEMENTARITY: Record<string, string[]> = {
  investoren: ["kapital", "beteiligungen"],
  projekte: ["kapital", "beteiligungen", "kontakte"],
  immobilien: ["immobilien", "beteiligungen"],
  partner: ["kontakte", "beteiligungen", "leistungen"],
  experten: ["know_how", "leistungen"],
  kunden: ["kontakte", "leistungen"],
  mitarbeiter: ["kontakte"],
  mentoren: ["mentoring", "know_how"],
};

// ── Volumen-Bänder & Routing (matching-spec §8) ───────────────────────────────
// Werte spiegeln EXAKT den DB-Check auf needs.tx_volume_band (Migration matching).
export type VolumeBand = "lt_10k" | "10k_100k" | "100k_1m" | "1m_10m" | "gt_10m";

export interface VolumeBandDef {
  value: VolumeBand;
  label: string;
}

export const VOLUME_BANDS: VolumeBandDef[] = [
  { value: "lt_10k", label: "< 10.000 €" },
  { value: "10k_100k", label: "10.000 – 100.000 €" },
  { value: "100k_1m", label: "100.000 € – 1 Mio. €" },
  { value: "1m_10m", label: "1 – 10 Mio. €" },
  { value: "gt_10m", label: "> 10 Mio. €" },
];

/**
 * Volumen-Schwelle für DKRI Deal-Keeping (§8) — zentral konfiguriert, damit sie
 * ohne Codeänderung justierbar ist: Bänder ab dieser Größe werden zu DKRI
 * geroutet, kleinere bleiben beim FBC-Matching.
 */
export const DKRI_VOLUME_BANDS: ReadonlySet<VolumeBand> = new Set<VolumeBand>(["1m_10m", "gt_10m"]);

export function routingForBand(band: VolumeBand | string | null | undefined): Routing {
  return band && DKRI_VOLUME_BANDS.has(band as VolumeBand) ? "dkri" : "fbc";
}

// ── Lookups ───────────────────────────────────────────────────────────────────
const CATEGORY_BY_SIDE_KEY = new Map<string, MatchingCategory>(
  [...OFFER_CATEGORIES, ...NEED_CATEGORIES].map((c) => [`${c.side}:${c.key}`, c]),
);

export function categoriesForSide(side: MatchingSide): MatchingCategory[] {
  return side === "offer" ? OFFER_CATEGORIES : NEED_CATEGORIES;
}

export function findCategory(
  side: MatchingSide,
  key: string | null | undefined,
): MatchingCategory | undefined {
  return key ? CATEGORY_BY_SIDE_KEY.get(`${side}:${key}`) : undefined;
}

/** Label einer Kategorie; fällt für unbekannte Schlüssel lesbar auf den Key zurück. */
export function categoryLabel(side: MatchingSide, key: string | null | undefined): string {
  if (!key) return "—";
  return findCategory(side, key)?.label ?? key.charAt(0).toUpperCase() + key.slice(1);
}

export function volumeBandLabel(band: string | null | undefined): string | null {
  if (!band) return null;
  return VOLUME_BANDS.find((b) => b.value === band)?.label ?? band;
}
