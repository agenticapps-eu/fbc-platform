import { useContext } from "react";
import { cn } from "../../lib/cn";
import { DesignVariantContext } from "../../providers/design-variant-context";
import { CrownMark } from "./CrownMark";

type Lockup = "full" | "mark";
type Tone = "auto" | "light" | "dark";

/** Varianten mit dunkler Masthead-/Sidebar-Fläche (schwarzes bzw. Glas-Chrome):
 *  hier muss das Logo die SVG-Krone + helle Gold-Wortmarke nutzen, weil das
 *  Creme-PNG auf Dunkel nicht funktioniert. */
const DARK_CHROME_VARIANTS = new Set(["b", "e", "f", "blau-navy"]);

/** FBC-Logo mit Krone.
 *  - `lockup="full"` → gestapelt: Krone über Wortmarke + Claim (Header, Login, Hero)
 *  - `lockup="mark"` → nur die Krone (kompakt, Favicon-artig)
 *
 *  `tone="auto"` wählt anhand der aktiven Variante: auf dunklen Masthead-
 *  Varianten (B/E/F bzw. explizit `tone="dark"`) die SVG-Krone + helle
 *  Gold-Wortmarke; sonst das echte Lockup-PNG (offizielles FBC-Logo: Gold-Krone
 *  + schwarze Wortmarke „FAIR BUSINESS CLUB" + Claim, transparenter Grund). Das
 *  PNG hat echte Transparenz, ist aber nur auf HELLEN Flächen einsetzbar, weil
 *  die Wortmarke schwarz ist und auf Dunkel verschwände — dort greift tone=dark
 *  (SVG-Krone + helle Gold-Wortmarke). Ein helles Lockup-Asset für dunkle
 *  Flächen steht noch aus. */
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
    tone === "auto" ? (DARK_CHROME_VARIANTS.has(variant) ? "dark" : "light") : tone;

  if (lockup === "mark") {
    return <CrownMark className={className} title="Fair Business Club" />;
  }

  if (resolvedTone === "light") {
    return (
      // Das offizielle Lockup-PNG hat einen ECHTEN transparenten Hintergrund
      // (Palette + tRNS, per Checkerboard-Test bestätigt) — daher kein
      // mix-blend-multiply mehr: es wird plan gerendert und sitzt sauber auf
      // jeder hellen Fläche. Die schwarze Wortmarke braucht Hell, daher light.
      // Default h-20: das Lockup ist gestapelt (Krone über Wortmarke + Claim).
      <img
        src="/brand/fbc-logo-crown.png"
        alt="Fair Business Club"
        className={cn("block object-contain", className ?? "h-20 w-auto")}
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
