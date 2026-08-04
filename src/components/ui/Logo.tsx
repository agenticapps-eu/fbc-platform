import { cn } from "../../lib/cn";
import { CompassMark } from "./CompassMark";

type Lockup = "full" | "mark";

/** eff.bee.zee-Logo (AGE-492).
 *
 *  - `lockup="full"` → Marke und Wortmarke NEBENEINANDER (nicht gestapelt wie
 *    das alte Kronen-PNG)
 *  - `lockup="mark"` → nur der Kompass
 *
 *  Kein `tone` mehr und kein Varianten-Wissen: die Marke erbt über
 *  `currentColor` die Farbe ihrer Umgebung, die Wortmarke steht in `text-ink`.
 *  Damit trägt EIN Asset beide Themes. Vorher wählte das Logo anhand einer Liste
 *  dunkler Varianten zwischen SVG-Krone und Lockup-PNG — und das helle
 *  Lockup-Asset für dunkle Flächen fehlte dauerhaft; genau der offene Punkt, den
 *  diese Datei als Kommentar mitschleppte.
 *
 *  Die Punkte in „eff.bee.zee" tragen die Akzentfarbe; laut Vorlage ist das das
 *  einzige Farbdetail der Wortmarke. Klein geschrieben, nie in Versalien. */
export function Logo({ lockup = "full", className }: { lockup?: Lockup; className?: string }) {
  if (lockup === "mark") {
    return <CompassMark className={className} title="eff.bee.zee" />;
  }

  return (
    <span className={cn("inline-flex items-center gap-2.5 text-ink", className)}>
      <CompassMark className="h-8 w-auto" />
      <span className="text-lg font-semibold leading-none tracking-tight">
        eff<span className="text-accent">.</span>bee<span className="text-accent">.</span>zee
      </span>
    </span>
  );
}
