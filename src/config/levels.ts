/** Das 6-Level-Modell (v4.0, AGE-311).
 *  Spec: docs/superpowers/specs/2026-07-15-fbc-6level-upgrade.md §1 + §3.1.
 *
 *  Labels und Preise leben hier, damit eine Label-/Preisänderung ein Einzeiler
 *  bleibt (§3.1) — die Upgrade-Mechanik ist bewusst modell-agnostisch.
 *
 *  `rank` spiegelt membership_tiers.level_rank aus der DB. Die Duplizierung ist
 *  Absicht und harmlos: Frontend-Gating ist Komfort, die Sicherheitsgrenze bleibt
 *  die RLS-Policy in Supabase (has_level(rank)), unabhängig vom Client.
 *
 *  Die alten Prototyp-Stufen (explore/impuls/active/prime/circle/legacy) sind
 *  ersatzlos weg. ACHTUNG: `discover` existierte vorher mit ANDERER Bedeutung
 *  (0 € statt 150 €) — siehe die Key-Migration in 20260715150000_six_level_model.sql. */

export type MembershipLevel = "basic" | "connect" | "discover" | "exchange" | "focus" | "impact";

export interface LevelConfig {
  key: MembershipLevel;
  label: string;
  /** Jahrespreis in Euro. 0 = gratis, läuft ohne Stripe. */
  priceYear: number;
  /** Monatspreis in Euro (Anzeige; Stripe-Preis-ID lebt server-seitig). 0 = gratis. */
  priceMonth: number;
  /** Spiegelt membership_tiers.level_rank (aufsteigend 1…6). */
  rank: number;
  /** Was diese Stufe freischaltet — Detlevs Wortlaut aus §2. */
  summary: string;
}

export const LEVELS: Record<MembershipLevel, LevelConfig> = {
  basic: {
    key: "basic",
    label: "Basic",
    priceYear: 0,
    priceMonth: 0,
    rank: 1,
    summary: "Profil anlegen. Kompass starten. Entdecken.",
  },
  connect: {
    key: "connect",
    label: "Connect",
    priceYear: 0,
    priceMonth: 0,
    rank: 2,
    summary: "Kompass vervollständigen. Erste Matchings. Favoriten.",
  },
  discover: {
    key: "discover",
    label: "Discover",
    priceYear: 150,
    priceMonth: 15,
    rank: 3,
    summary: "Academy. Vollständiges Mitgliederverzeichnis. Erweiterte Matchings.",
  },
  exchange: {
    key: "exchange",
    label: "Exchange",
    priceYear: 300,
    priceMonth: 30,
    rank: 4,
    summary: "Events. Kontaktanfragen. Aktivität.",
  },
  focus: {
    key: "focus",
    label: "Focus",
    priceYear: 600,
    priceMonth: 60,
    rank: 5,
    summary: "Anbieter werden. Leistungen veröffentlichen. Sichtbarkeit. Leads.",
  },
  impact: {
    key: "impact",
    label: "Impact",
    priceYear: 1200,
    priceMonth: 120,
    rank: 6,
    summary: "Volle Plattform. Priorität. Teams. Partnerprogramme.",
  },
};

/** Aufsteigende Reihenfolge — die Quelle für Pricing-Karten und Vergleiche. */
export const LEVEL_ORDER: readonly MembershipLevel[] = [
  "basic",
  "connect",
  "discover",
  "exchange",
  "focus",
  "impact",
];

export const LEVEL_RANK: Record<MembershipLevel, number> = {
  basic: 1,
  connect: 2,
  discover: 3,
  exchange: 4,
  focus: 5,
  impact: 6,
};

/** Stufe, auf der neue Mitglieder starten (§3.4). Spiegelt profiles.tier DEFAULT. */
export const DEFAULT_LEVEL: MembershipLevel = "basic";

/**
 * Anzeigename einer Stufe. Fällt auf den rohen Key zurück, falls die DB einen
 * hier nicht modellierten Wert liefert — Gating läuft ohnehin über level_rank
 * aus der DB, nicht über diese Tabelle.
 */
export function levelLabel(level: string): string {
  return LEVELS[level as MembershipLevel]?.label ?? level;
}

export function isMembershipLevel(value: string): value is MembershipLevel {
  return value in LEVELS;
}
