// Mitgliedsstufen des Prototyps (P4 §1). Aufsteigende Rechte/Sichtbarkeit.
// Die `level_rank`-Werte spiegeln membership_tiers.level_rank in der DB; sie sind
// hier dupliziert, weil das Frontend-Gating Komfort ist — die Sicherheitsgrenze
// bleibt die RLS-Policy in Supabase, nicht dieser Wert.
export type MembershipTier = "discover" | "prime" | "legacy";

export const TIER_RANK: Record<MembershipTier, number> = {
  discover: 1,
  prime: 5,
  legacy: 7,
};

export const TIER_LABEL: Record<MembershipTier, string> = {
  discover: "Discover",
  prime: "Prime",
  legacy: "Legacy",
};

/**
 * Anzeigename einer Stufe. Fällt auf den rohen Key zurück, falls die DB einen
 * im Prototyp nicht modellierten Tier liefert (z. B. 'circle') — Gating läuft
 * ohnehin über level_rank aus der DB, nicht über diese Tabelle.
 */
export function tierLabel(tier: string): string {
  return TIER_LABEL[tier as MembershipTier] ?? tier;
}
