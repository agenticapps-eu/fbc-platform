import type { HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export type BadgeVariant = "discover" | "prime" | "legacy" | "neutral";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

// Stufenfarbe nur über Gold/Anthrazit — kein Bunt (AGE-237).
const variants: Record<BadgeVariant, string> = {
  discover: "bg-ink/[0.06] text-muted",
  prime: "bg-gold-soft text-gold-strong",
  // Legacy: helle Gold-Pille mit Gold-Ring — premium & distinkt zu Prime, kein Vollschwarz (AGE-237).
  legacy: "bg-gold-soft text-gold-strong ring-1 ring-gold-strong/45",
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
