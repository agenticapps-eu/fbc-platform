/**
 * Mini-Compass — Fragenkatalog (AGE-243).
 *
 * EINZIGE Quelle der Onboarding-Fragen. Bewusst als schlichte, deklarative
 * Konfiguration gehalten, damit der Katalog ohne Code-Kenntnis mit Detlev final
 * abgestimmt und editiert werden kann: Reihenfolge ändern, Fragen/Optionen
 * ergänzen oder streichen — die Ableitungslogik (src/lib/compass.ts) liest diese
 * Struktur generisch aus, es muss nichts anderes angefasst werden.
 *
 * Konvention (mit AGE-242 abgestimmt): Skala-Antworten (0–10) landen als
 * NUMERISCHE Werte in compass_responses.answers und speisen direkt den
 * Erfolgsradar (recompute_potential_score mittelt numerische Leaves je Thema).
 *
 * Aufbau entlang Sein · Tun · Haben · Wirken + „Ich biete" / „Ich suche".
 */

export type CompassTheme = "sein" | "tun" | "haben" | "wirken";

export const COMPASS_THEME_LABEL: Record<CompassTheme, string> = {
  sein: "Sein",
  tun: "Tun",
  haben: "Haben",
  wirken: "Wirken",
};

/** Skala-Grenzen für die Selbsteinschätzungs-Fragen (0–10, wie der Radar). */
export const COMPASS_SCALE_MIN = 0;
export const COMPASS_SCALE_MAX = 10;
export const COMPASS_SCALE_DEFAULT = 5;

/** Auswahl-Option einer Chip-Frage. `category` nur für offers/needs relevant. */
export interface CompassOption {
  /** Stabiler Schlüssel (für gespeicherten Entwurf); ändert sich nicht mit dem Label. */
  value: string;
  label: string;
  theme: CompassTheme;
  /** offers/needs-Kategorie, z. B. „kapital“, „kontakte“ (P4 §3). */
  category?: string;
}

/** Selbsteinschätzung eines Themas auf einer 0–10-Skala → Erfolgsradar. */
export interface ScaleStep {
  id: string;
  kind: "scale";
  theme: CompassTheme;
  title: string;
  prompt: string;
  minLabel: string;
  maxLabel: string;
}

/** Mehrfachauswahl von Chips → profile_interests | offers | needs. */
export interface ChipsStep {
  id: string;
  kind: "chips";
  target: "interests" | "offers" | "needs";
  title: string;
  prompt: string;
  hint?: string;
  /** Optionales Auswahllimit; ohne Angabe unbegrenzt. */
  maxSelect?: number;
  options: CompassOption[];
}

export type CompassStep = ScaleStep | ChipsStep;

/**
 * Der Default-Katalog (7 Schritte). Platzhalter-Wortlaut bis zur finalen
 * Abstimmung mit Detlev — Struktur und Ableitung sind davon unabhängig.
 */
export const COMPASS_STEPS: CompassStep[] = [
  {
    id: "scale-sein",
    kind: "scale",
    theme: "sein",
    title: "Sein",
    prompt: "Wie klar sind für dich gerade deine Werte, deine Vision und deine Haltung?",
    minLabel: "Noch am Suchen",
    maxLabel: "Völlig klar",
  },
  {
    id: "scale-tun",
    kind: "scale",
    theme: "tun",
    title: "Tun",
    prompt: "Wie konsequent setzt du deine Vorhaben aktuell in die Tat um?",
    minLabel: "Eher zögerlich",
    maxLabel: "Sehr konsequent",
  },
  {
    id: "scale-haben",
    kind: "scale",
    theme: "haben",
    title: "Haben",
    prompt: "Wie solide ist deine wirtschaftliche und ressourcielle Basis?",
    minLabel: "Im Aufbau",
    maxLabel: "Sehr solide",
  },
  {
    id: "scale-wirken",
    kind: "scale",
    theme: "wirken",
    title: "Wirken",
    prompt: "Wie sichtbar ist die Wirkung, die du mit deinem Tun erzielst?",
    minLabel: "Kaum sichtbar",
    maxLabel: "Weithin sichtbar",
  },
  {
    id: "interests",
    kind: "chips",
    target: "interests",
    title: "Deine Interessen",
    prompt: "Was beschäftigt dich? Wähle die Themen, die dich am stärksten ansprechen.",
    hint: "Mehrfachauswahl möglich.",
    options: [
      { value: "persoenlichkeit", label: "Persönlichkeitsentwicklung", theme: "sein" },
      { value: "purpose", label: "Sinn & Purpose", theme: "sein" },
      { value: "leadership", label: "Leadership", theme: "tun" },
      { value: "unternehmertum", label: "Unternehmertum", theme: "tun" },
      { value: "investment", label: "Investment & Kapital", theme: "haben" },
      { value: "immobilien", label: "Immobilien", theme: "haben" },
      { value: "nachhaltigkeit", label: "Nachhaltigkeit", theme: "wirken" },
      { value: "gesellschaft", label: "Gesellschaftlicher Impact", theme: "wirken" },
    ],
  },
  {
    id: "offers",
    kind: "chips",
    target: "offers",
    title: "Ich biete",
    prompt: "Was bringst du in die Community ein?",
    hint: "Wähle, was du anderen Mitgliedern anbieten kannst.",
    options: [
      { value: "kapital", label: "Kapital & Beteiligungen", theme: "haben", category: "kapital" },
      { value: "kontakte", label: "Kontakte & Netzwerk", theme: "wirken", category: "kontakte" },
      { value: "expertise", label: "Expertise & Know-how", theme: "tun", category: "expertise" },
      { value: "mentoring", label: "Mentoring & Sparring", theme: "sein", category: "leistung" },
      { value: "projekte", label: "Projekte & Kooperationen", theme: "tun", category: "projekt" },
      { value: "immobilien", label: "Immobilien", theme: "haben", category: "kapital" },
    ],
  },
  {
    id: "needs",
    kind: "chips",
    target: "needs",
    title: "Ich suche",
    prompt: "Wonach suchst du gerade?",
    hint: "Wähle, wobei dich die Community unterstützen soll.",
    options: [
      { value: "investoren", label: "Investoren & Kapital", theme: "haben", category: "kapital" },
      { value: "partner", label: "Partner & Co-Founder", theme: "wirken", category: "kontakte" },
      { value: "experten", label: "Experten & Berater", theme: "tun", category: "expertise" },
      { value: "mentoren", label: "Mentoren", theme: "sein", category: "leistung" },
      { value: "projekte", label: "Projekte & Deals", theme: "tun", category: "projekt" },
      { value: "immobilien", label: "Immobilien", theme: "haben", category: "kapital" },
    ],
  },
];
