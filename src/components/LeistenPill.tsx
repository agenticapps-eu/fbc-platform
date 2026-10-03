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
  /** Welche Fläche die Leiste trägt — die Ausbuchtung trägt dieselbe, sonst
   *  sitzt ein Fleck in der falschen Farbe an ihrer Kante.
   *
   *  `"inhalt"` ist mit AGE-1002 entfallen. Es stand für den Zustand „rechte
   *  Leiste aufgeklappt, also Inhaltsfläche" — den gibt es nicht mehr: die
   *  rechte Leiste trägt ein- und ausgeklappt `--chat-rail-surface`. Eine
   *  Variante, die niemand mehr setzt, wäre eine Einladung, sie wieder zu
   *  setzen. */
  flaeche: "leiste" | "chat";
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
        // Der Ring liest ab AGE-1002 einen Token statt `ring-accent`. Grund:
        // auf der dunkelblauen Nachrichtenleiste traegt `--color-accent`
        // (#2F6BD1) nur 2,8:1 — unter den 3:1 fuer Bedienelemente, und
        // schlechter als vorher (3,6:1 auf dem Chrome-Rail, 5,1:1 auf Weiss).
        // Befund des Code-Reviews.
        //
        // BERICHTIGT mit AGE-1003: hier stand „links faellt der Token auf
        // genau `--color-accent` zurueck, dort aendert sich also nichts". Das
        // galt, solange die linke Leiste `#081527` trug. Sie traegt jetzt
        // dieselbe Flaeche wie die rechte, und damit holt derselbe Befund den
        // linken Pill ein — er braucht seinen eigenen Token, nicht den der
        // Thread-Liste. JE SEITE EINER, deshalb unten im Zweig und nicht hier.
        "transition-colors focus-visible:outline-none focus-visible:ring-2",
        // Die Fläche der Leiste, nicht eine eigene. Kein Rahmen.
        flaeche === "leiste"
          ? "fbc-sidebar-surface text-on-chrome hover:text-on-chrome-active focus-visible:ring-[color:var(--leiste-focus)]"
          : // `--thread-chrome-ink` und nicht `--thread-muted`: im HELLEN Modus
            // muss der eingeklappte Pill aussehen wie vorher, und das war
            // `text-on-chrome` (#475569) mit Hover `#1F53B0`. `--thread-muted`
            // ist #626f85 und waere sichtbar anders — die Zusage lautet „kein
            // Pixel". Befund des Code-Reviews.
            "bg-[var(--chat-rail-surface)] text-[color:var(--thread-chrome-ink)] hover:text-[color:var(--thread-chrome-ink-hover)] focus-visible:ring-[color:var(--thread-focus)]",
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
