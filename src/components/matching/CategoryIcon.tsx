import type { CategoryIconKey } from "../../config/matching";
import { Icon, type GlyphName } from "../ui/icons";

/**
 * Symbole für die Such-/Biete-Kategorien (AGE-244). Seit AGE-582 hält diese
 * Datei keinen eigenen Pfad-Record mehr, sondern nur die Zuordnung Kategorie →
 * Glyph im gemeinsamen Satz. Zwei Kategorien teilen sich einen Glyph mit dem
 * Menü, weil ihre Vorlagen dasselbe Motiv mit anderen Zahlen zeichneten:
 * `mentor` den Talar-Hut der Academy, `users` die zwei Personen des
 * Mitgliederverzeichnisses.
 */
const NACH_KATEGORIE: Record<CategoryIconKey, GlyphName> = {
  coins: "coins",
  network: "network",
  bulb: "bulb",
  building: "building",
  shares: "shares",
  briefcase: "briefcase",
  mentor: "academy",
  rocket: "rocket",
  target: "target",
  users: "members",
};

export function CategoryIcon({ icon, className }: { icon: CategoryIconKey; className?: string }) {
  return <Icon name={NACH_KATEGORIE[icon]} className={className} />;
}
