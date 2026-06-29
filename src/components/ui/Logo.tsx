import { useContext } from "react";
import { cn } from "../../lib/cn";
import { DesignVariantContext } from "../../providers/design-variant-context";
import { CrownMark } from "./CrownMark";

type Lockup = "full" | "mark";
type Tone = "auto" | "light" | "dark";

/** FBC-Logo mit Krone.
 *  - `lockup="full"` → Krone + Wortmarke (Login, Hero, breite Sidebar)
 *  - `lockup="mark"` → nur die Krone (kompakt: Header, Favicon-artig)
 *
 *  `tone="auto"` wählt anhand der aktiven Variante: auf der dunklen Variante B
 *  (und explizit `tone="dark"`) die SVG-Krone + helle Gold-Wortmarke; sonst das
 *  echte Lockup-PNG. Das PNG hat einen Creme-Verlauf-Hintergrund und grüne
 *  Wortmarke und ist deshalb nur auf hellen Flächen einsetzbar. */
export function Logo({
  lockup = "full",
  tone = "auto",
  className,
}: {
  lockup?: Lockup;
  tone?: Tone;
  className?: string;
}) {
  // useContext statt useDesignVariant: das Logo soll auch ohne Provider rendern
  // (isolierte Tests, Styleguide-Snippets). Ohne Provider gilt Default 'd' → hell.
  const ctx = useContext(DesignVariantContext);
  const variant = ctx?.variant ?? "d";
  const resolvedTone: "light" | "dark" =
    tone === "auto" ? (variant === "b" ? "dark" : "light") : tone;

  if (lockup === "mark") {
    return <CrownMark className={className} title="Fair Business Club" />;
  }

  if (resolvedTone === "light") {
    return (
      // mix-blend-multiply lässt den hellen (Creme-)PNG-Hintergrund in die helle
      // Fläche eintauchen — Krone/Wortmarke bleiben. Übergangslösung bis Detlevs
      // transparentes SVG vorliegt (TODO). Wirkt nur auf hellen Flächen, daher light.
      <img
        src="/brand/fbc-logo-crown.png"
        alt="Fair Business Club"
        className={cn("block object-contain mix-blend-multiply", className ?? "h-14 w-auto")}
      />
    );
  }

  // Dunkel: SVG-Krone + Gold-Wortmarke.
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <CrownMark className="h-9 w-auto" />
      {/* text-gold (nicht gold-soft): gold-soft wird in Variante B dunkel → unlesbar.
          --color-gold ist in allen Varianten ein helles Gold auf dunklem Grund. */}
      <span className="font-display text-lg font-semibold leading-tight tracking-tight text-gold">
        Fair Business Club
      </span>
    </span>
  );
}
