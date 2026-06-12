import { tierLabel, type MembershipTier } from "../../lib/tiers";
import { Badge, type BadgeVariant } from "./Badge";

const KNOWN: readonly MembershipTier[] = ["discover", "prime", "legacy"];

/** Badge für eine Mitgliedsstufe. Akzeptiert den rohen tier-Key aus dem
 *  Auth-Context (string) und fällt auf "neutral" zurück, falls die DB einen
 *  im Prototyp nicht modellierten Tier liefert. */
export function TierBadge({ tier }: { tier: string }) {
  const variant: BadgeVariant = KNOWN.includes(tier as MembershipTier)
    ? (tier as BadgeVariant)
    : "neutral";
  return <Badge variant={variant}>{tierLabel(tier)}</Badge>;
}
