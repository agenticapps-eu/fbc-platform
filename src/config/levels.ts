/** Die Zugangsleiter V5 (AGE-903).
 *  Spec: openspec/changes/stufen-v5/specs/membership-tiers/spec.md.
 *
 *  Labels und Preise leben hier, damit eine Label-/Preisänderung ein Einzeiler
 *  bleibt — die Upgrade-Mechanik ist bewusst modell-agnostisch.
 *
 *  `rank` spiegelt membership_tiers.level_rank aus der DB. Die Duplizierung ist
 *  Absicht und harmlos: Frontend-Gating ist Komfort, die Sicherheitsgrenze bleibt
 *  die RLS-Policy in Supabase (has_level(rank)), unabhängig vom Client.
 *
 *  ── DER CLUB BEGINNT BEI DISCOVER (RANG 4) ─────────────────────────────────
 *  ACTIVE, BOOST und CONNECT werden nur technisch vorgehalten und tragen keine
 *  Clubfunktion. Sie tragen deshalb auch 0 €: eine Stufe, die niemand kaufen
 *  kann, braucht keinen Preis (Donald, 26.09.: „aktuell 0, wird ja später
 *  kommen"). Die 75 € für BOOST aus der V5-Matrix kommen als eigene Änderung.
 *
 *  ── ACHTUNG, ZWEI SCHLÜSSEL HABEN IHRE BEDEUTUNG GEWECHSELT ────────────────
 *  `connect` stand vor AGE-903 auf Rang 2 und steht jetzt auf Rang 3;
 *  `discover` stand auf Rang 3 und steht jetzt auf Rang 4 — und kostete dabei
 *  erst 0 €, dann 150 €, jetzt 300 €. Ein Schlüsselname sagt also nichts
 *  darüber, welche Rechte oder welchen Preis er trug. Autorität ist der RANG,
 *  und nur zu einem genannten Zeitpunkt.
 *
 *  Die alten Prototyp-Stufen (explore/impuls/prime/circle/legacy) entfielen mit
 *  AGE-311, `basic` und `exchange` mit AGE-903. `active` ist KEIN Rückfall auf
 *  den alten Prototyp-Schlüssel gleichen Namens, sondern derselbe Name für den
 *  neuen Rang 1. */

export type MembershipLevel = "active" | "boost" | "connect" | "discover" | "focus" | "impact";

export interface LevelConfig {
  key: MembershipLevel;
  label: string;
  /** Jahrespreis in Euro. 0 = gratis, läuft ohne Stripe. */
  priceYear: number;
  /** Monatspreis in Euro (Anzeige; Stripe-Preis-ID lebt server-seitig). 0 = gratis. */
  priceMonth: number;
  /** Spiegelt membership_tiers.level_rank (aufsteigend 1…6). */
  rank: number;
  /** Was diese Stufe freischaltet. */
  summary: string;
}

export const LEVELS: Record<MembershipLevel, LevelConfig> = {
  active: {
    key: "active",
    label: "Active",
    priceYear: 0,
    priceMonth: 0,
    rank: 1,
    summary: "Profil anlegen. Kompass starten. Öffentliche Events.",
  },
  boost: {
    key: "boost",
    label: "Boost",
    priceYear: 0,
    priceMonth: 0,
    rank: 2,
    summary: "Profil vervollständigen. Kompass ausbauen. Öffentliche Events.",
  },
  connect: {
    key: "connect",
    label: "Connect",
    priceYear: 0,
    priceMonth: 0,
    rank: 3,
    summary: "Vorstufe zum Club. Profil, Kompass, öffentliche Events.",
  },
  discover: {
    key: "discover",
    label: "Discover",
    priceYear: 300,
    priceMonth: 30,
    rank: 4,
    summary:
      "Der Club beginnt hier. Mitgliederverzeichnis, Academy, Mitglieder-Events, Kontaktanfragen.",
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
  "active",
  "boost",
  "connect",
  "discover",
  "focus",
  "impact",
];

export const LEVEL_RANK: Record<MembershipLevel, number> = {
  active: 1,
  boost: 2,
  connect: 3,
  discover: 4,
  focus: 5,
  impact: 6,
};

/** Die unterste Clubstufe. Jede Clubschwelle lautet `has_level(CLUB_RANK)` —
 *  die Zahl steht in der Datenbank und hier, und nirgends sonst im Frontend. */
export const CLUB_LEVEL: MembershipLevel = "discover";
export const CLUB_RANK: number = LEVEL_RANK[CLUB_LEVEL];

/** Stufe, auf der neue Mitglieder starten. Spiegelt profiles.tier DEFAULT. */
export const DEFAULT_LEVEL: MembershipLevel = "active";

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
