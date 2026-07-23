import { cn } from "../../lib/cn";
import type { FormatHeroMeta } from "../../config/formatHero";

export function FormatHero({ meta, className }: { meta: FormatHeroMeta; className?: string }) {
  return (
    <header
      className={cn(
        // Heller Format-Hero (AGE-450 #7): leichtgewichtig „wie die Startseite" statt
        // des früheren dunklen from-night-Verlaufs, der zu schwer wirkte. Rein
        // token-getrieben (bg-gold-soft/text-ink) → trägt jede Design-Variante hell.
        // Bewusst flach (kein Schatten), damit der Hero nicht wieder Gewicht bekommt.
        "mb-8 rounded-[var(--radius-card)] border border-gold/40 bg-gold-soft/20 px-6 py-10",
        className,
      )}
    >
      <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">{meta.title}</h1>
      <p className="mt-2 max-w-xl text-muted">{meta.claim}</p>
    </header>
  );
}
