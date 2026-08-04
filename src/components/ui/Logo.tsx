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
export function Logo({
  lockup = "full",
  className,
  onChrome = false,
}: {
  lockup?: Lockup;
  className?: string;
  /** Steht auf der Sidebar-/Topbar-Fläche, nicht auf Inhalt (AGE-499). */
  onChrome?: boolean;
}) {
  if (lockup === "mark") {
    return <CompassMark className={className} title="eff.bee.zee" />;
  }

  // `onChrome`: das Lockup steht auf der Sidebar-/Topbar-Fläche statt auf Inhalt.
  // Seit AGE-499 kann die dunkel sein, während der Inhalt hell bleibt — dann
  // trägt weder `text-ink` (dunkel auf dunkel) noch der Inhalts-Akzent (#2F6BD1
  // auf #081527 sind 2.6:1). Deshalb hier die Chrome-Tokens, statt das Logo raten
  // zu lassen: es kennt sein Theme nicht, aber sein Aufrufer kennt seine Fläche.
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2.5",
        onChrome ? "text-on-chrome-active" : "text-ink",
        className,
      )}
    >
      <CompassMark className="h-8 w-auto" />
      <span className="text-lg font-semibold leading-none tracking-tight">
        eff<span className={onChrome ? "text-accent-on-chrome" : "text-accent"}>.</span>bee
        <span className={onChrome ? "text-accent-on-chrome" : "text-accent"}>.</span>zee
      </span>
    </span>
  );
}
