import { Icon } from "./ui/icons";
import { cn } from "../lib/cn";

/**
 * Der Ein- und Ausklapp-Schalter beider angedockter Leisten (AGE-638).
 *
 * **Ein Bauteil, zweimal montiert.** Vorher hatte jede Leiste ihren eigenen
 * Schalter: links unten eine Zeile mit Pfeil und dem Wort „Einklappen", rechts
 * oben ein quadratischer Knopf — zwei Gestalten, zwei Farben, zwei Enden. Sie
 * sind auseinandergelaufen, weil sie nie dasselbe Bauteil waren; ein gemeinsames
 * Aussehen aus zwei Quelltexten läuft wieder auseinander.
 *
 * **Er ist eine AUSBUCHTUNG der Leiste, kein Knopf darauf** (Donald, 27.08.).
 * Er trägt deshalb die Fläche seiner Leiste und deren Schriftfarbe — und
 * **keinen Rahmen**. Ein Rahmen machte ihn zu einem aufgeklebten Bauteil;
 * genau das soll er nicht sein.
 *
 * **Abheben tut ihn der Schatten** (Donald, 27.08.). Das ist hier nicht nur
 * Geschmack: im hellen Theme ist die Leiste weiss (`rgb(255,255,255)`) und der
 * Kopf, in den er oben hineinragt, ebenfalls (`bg-canvas/85`) — gemessen. Ohne
 * den Schatten wäre die Wölbung dort unsichtbar. Er ist gerichtet, nach aussen,
 * damit die Leiste die Ausbuchtung wirft und nicht umgekehrt.
 *
 * **Er hängt an der Leiste, nicht am Rahmen.** `absolute` innerhalb der
 * `<aside>`, um die halbe eigene Breite nach aussen geschoben. Als `fixed`
 * Element am Rahmen müsste er die Leistenbreite ein zweites Mal kennen — und
 * die zweite Rechnung ist die, die jemand vergisst, wenn sich die erste ändert.
 *
 * **Die Pfeilrichtung hängt an ZWEI Achsen**, Seite und Zustand, also an vier
 * Fällen. `data-richtung` trägt sie nach aussen, damit ein Test sie prüfen kann:
 * ein umgedrehter Pfeil ist am zugänglichen Namen nicht zu erkennen.
 */
export function LeistenPill({
  seite,
  flaeche,
  offen,
  steuert,
  onClick,
}: {
  seite: "links" | "rechts";
  /** Worauf die Leiste GERADE steht. Die rechte wechselt beim Aufklappen von
   *  der Chrome- auf die Inhaltsfläche; die Ausbuchtung muss mitwechseln, sonst
   *  sitzt ein Fleck in der falschen Farbe an ihrer Kante. */
  flaeche: "leiste" | "inhalt";
  offen: boolean;
  /** `id` der Leiste, die er auf- und zuklappt. */
  steuert: string;
  onClick: () => void;
}) {
  const bezeichnung = seite === "links" ? "Navigation" : "Nachrichten";
  // Wohin bewegt das Auslösen die Leiste? Genau dorthin zeigt der Pfeil.
  const richtung: "links" | "rechts" = offen
    ? seite === "links"
      ? "links"
      : "rechts"
    : seite === "links"
      ? "rechts"
      : "links";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={offen}
      aria-controls={steuert}
      aria-label={`${bezeichnung} ${offen ? "einklappen" : "ausklappen"}`}
      title={offen ? "Einklappen" : "Ausklappen"}
      data-leisten-pill={seite}
      data-richtung={richtung}
      className={cn(
        // `top-8` ist die Mitte der `h-16`-Kopfzeile (4rem) — der eine Ort, an
        // dem beide Leisten schon heute dieselbe Höhe haben. **Ändert jemand
        // die Höhe dieser Zeile, sitzt die Ausbuchtung schief, und kein Test
        // merkt es** — jsdom kennt keine Geometrie.
        //
        // `w-6` sind 24 px, und das ist kein gerundeter Zufall: WCAG 2.2
        // verlangt für ein Ziel mindestens 24 × 24 px.
        "absolute top-8 z-10 flex h-10 w-6 -translate-y-1/2 items-center justify-center",
        "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        // Die Fläche der Leiste, nicht eine eigene. Kein Rahmen.
        flaeche === "leiste"
          ? "fbc-sidebar-surface text-on-chrome hover:text-on-chrome-active"
          : "bg-canvas text-muted hover:text-ink",
        // Der Schatten ist GERICHTET — nach aussen, weg von der Leiste. Ein
        // Schatten ringsum sähe aus wie eine schwebende Marke; so sieht es aus,
        // als würfe die Leiste ihre eigene Wölbung.
        seite === "links"
          ? "right-0 translate-x-1/2 rounded-r-full shadow-[3px_0_8px_-2px_rgb(15_29_51_/_0.18)]"
          : "left-0 -translate-x-1/2 rounded-l-full shadow-[-3px_0_8px_-2px_rgb(15_29_51_/_0.18)]",
      )}
    >
      <Icon
        name="chevronLeft"
        className={cn("h-4 w-4 transition-transform", richtung === "rechts" && "rotate-180")}
      />
    </button>
  );
}
