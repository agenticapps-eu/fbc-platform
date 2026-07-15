import { levelLabel, isMembershipLevel, type MembershipLevel } from "../../config/levels";
import { Badge, type BadgeVariant } from "./Badge";

/** Sechs Stufen auf drei Gold-Gewichte (AGE-311). Die Palette ist bewusst
 *  gold-only (AGE-237) — sechs unterscheidbare Goldtöne wären nicht lesbar, also
 *  gruppiert die Medaille nach dem, was ein Mitglied ohnehin unterscheidet:
 *  gratis → erste zahlende Stufen → oberes Ende. */
const LEVEL_WEIGHT: Record<MembershipLevel, BadgeVariant> = {
  basic: "muted",
  connect: "muted",
  discover: "soft",
  exchange: "soft",
  focus: "strong",
  impact: "strong",
};

/** Badge für eine Mitgliedsstufe. Akzeptiert den rohen tier-Key aus dem
 *  Auth-Context (string) und fällt auf "neutral" zurück, falls die DB einen
 *  hier nicht modellierten Wert liefert. */
export function TierBadge({ tier }: { tier: string }) {
  const variant: BadgeVariant = isMembershipLevel(tier) ? LEVEL_WEIGHT[tier] : "neutral";
  // Gold-Glow-Puls nur für das obere Ende und nur in b/d (CSS .fbc-tier-pulse ist
  // je Variante gestaffelt). Die Gratis-Stufen bleiben ruhig.
  const pulse = variant === "strong";
  return (
    <Badge variant={variant} className={pulse ? "fbc-tier-pulse" : undefined}>
      {levelLabel(tier)}
    </Badge>
  );
}
