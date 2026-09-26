import { levelLabel, isMembershipLevel, type MembershipLevel } from "../../config/levels";
import { Badge, type BadgeVariant } from "./Badge";

/** Sechs Stufen auf drei Akzent-Gewichte (AGE-311). Die Palette ist bewusst
 *  accent-only (AGE-237) — sechs unterscheidbare Akzenttöne wären nicht lesbar, also
 *  gruppiert die Medaille nach dem, was ein Mitglied ohnehin unterscheidet:
 *  gratis → erste zahlende Stufen → oberes Ende. */
/** Die drei Stufen ausserhalb des Clubs tragen `muted`, die drei Clubstufen
 *  heben sich ab. Die Grenze liegt damit auch optisch zwischen Rang 3 und 4 —
 *  dieselbe Grenze, die `has_level(4)` in der Datenbank zieht (AGE-903). */
const LEVEL_WEIGHT: Record<MembershipLevel, BadgeVariant> = {
  active: "muted",
  boost: "muted",
  connect: "muted",
  discover: "soft",
  focus: "strong",
  impact: "strong",
};

/** Badge für eine Mitgliedsstufe. Akzeptiert den rohen tier-Key aus dem
 *  Auth-Context (string) und fällt auf "neutral" zurück, falls die DB einen
 *  hier nicht modellierten Wert liefert. */
export function TierBadge({ tier }: { tier: string }) {
  const variant: BadgeVariant = isMembershipLevel(tier) ? LEVEL_WEIGHT[tier] : "neutral";
  return <Badge variant={variant}>{levelLabel(tier)}</Badge>;
}
