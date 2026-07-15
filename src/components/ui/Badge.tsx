import type { HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

/** Visuelles Gewicht, KEIN Stufenname. Die Varianten hießen bis AGE-311 nach den
 *  Stufen (discover/prime/legacy) und wurden zugleich dekorativ für Event-Typen und
 *  „Bietet"/„Sucht" benutzt — jede Modelländerung fasste damit auch Schmuck an.
 *  TierBadge bildet die sechs Stufen auf diese Gewichte ab. */
export type BadgeVariant = "muted" | "soft" | "strong" | "neutral";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

// Gewichtung nur über Gold/Anthrazit — kein Bunt (AGE-237).
const variants: Record<BadgeVariant, string> = {
  muted: "bg-ink/[0.06] text-muted",
  soft: "bg-gold-soft text-gold-strong",
  strong: "bg-gold text-night",
  neutral: "bg-ink/5 text-ink",
};

export function Badge({ className, variant = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium tracking-wide",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
