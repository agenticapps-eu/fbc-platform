import { genannterName, isMembershipLevel, type MembershipLevel } from "../../config/levels";
import { Badge, type BadgeVariant } from "./Badge";

/** Sechs Stufen auf drei Akzent-Gewichte (AGE-311). Die Palette ist bewusst
 *  accent-only (AGE-237) — sechs unterscheidbare Akzenttöne wären nicht lesbar, also
 *  gruppiert die Medaille nach dem, was ein Mitglied ohnehin unterscheidet:
 *  gratis → erste zahlende Stufen → oberes Ende. */
/** Die drei Stufen ausserhalb des Clubs tragen `muted`, die drei Clubstufen
 *  heben sich ab. Die Grenze liegt damit auch optisch zwischen Rang 3 und 4 —
 *  dieselbe Grenze, die `has_level(4)` in der Datenbank zieht (AGE-903).
 *
 *  Seit AGE-969 sind die drei `muted`-Einträge unerreichbar: eine Stufe
 *  ausserhalb des Clubs bekommt gar keine Plakette. Sie bleiben trotzdem
 *  stehen — die drei kommen später wieder, und dann ist ihr Gewicht schon
 *  entschieden. */
const LEVEL_WEIGHT: Record<MembershipLevel, BadgeVariant> = {
  active: "muted",
  boost: "muted",
  connect: "muted",
  discover: "soft",
  focus: "strong",
  impact: "strong",
};

/**
 * Badge für eine Mitgliedsstufe — oder NICHTS (AGE-969).
 *
 * Unterhalb des Clubs entfällt die Plakette. Sie wird nicht leer: ein
 * sichtbarer Kasten ohne Inhalt liest sich als Fehler, und ein Ersatzname wäre
 * ein neuer Stufenname, der später mit BOOST kollidiert.
 *
 * Derselbe Rückfall gilt für einen Schlüssel, den `levels.ts` nicht kennt —
 * eine halbe Auslieferung darf keinen rohen Schlüssel an die Fläche lassen.
 * Das ist die Änderung gegenüber AGE-311, wo genau dieser Fall noch eine
 * `neutral`-Plakette mit dem rohen Wert bekam.
 */
export function TierBadge({ tier }: { tier: string }) {
  const name = genannterName(tier);
  if (name === null) return null;
  const variant: BadgeVariant = isMembershipLevel(tier) ? LEVEL_WEIGHT[tier] : "neutral";
  return <Badge variant={variant}>{name}</Badge>;
}
