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
 * **Er hängt an der Leiste, nicht am Rahmen.** `absolute` innerhalb der
 * `<aside>`, um die halbe eigene Breite nach aussen geschoben. Als `fixed`
 * Element am Rahmen müsste er die Leistenbreite ein zweites Mal kennen — und
 * die zweite Rechnung ist die, die jemand vergisst, wenn sich die erste ändert.
 *
 * **Die Farben setzt er selbst.** Links liegt er auf Chrome-Fläche (navy im
 * navy-Theme), rechts aufgeklappt auf Inhaltsfläche. Erbte er, sähe er an
 * beiden Leisten verschieden aus — und der Vorgang hätte die Ungleichheit, die
 * er beseitigen soll, in ein einziges Bauteil hineingezogen.
 *
 * **Die Pfeilrichtung hängt an ZWEI Achsen**, Seite und Zustand, also an vier
 * Fällen. `data-richtung` trägt sie nach aussen, damit ein Test sie prüfen kann:
 * ein umgedrehter Pfeil ist am zugänglichen Namen nicht zu erkennen.
 */
export function LeistenPill({
  seite,
  offen,
  steuert,
  onClick,
}: {
  seite: "links" | "rechts";
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
        // Der halbe Pill: gerundet nur zur AUSSENSEITE, und um die halbe eigene
        // Breite über die Kante geschoben. `top-8` ist die Mitte der 4rem hohen
        // Kopfzeile — der eine Ort, an dem beide Leisten schon heute dieselbe
        // Höhe haben.
        "absolute top-8 z-10 flex h-10 w-5 -translate-y-1/2 items-center justify-center",
        "border border-line bg-canvas text-ink shadow-soft transition-colors",
        "hover:bg-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        seite === "links"
          ? "right-0 translate-x-1/2 rounded-r-full border-l-0"
          : "left-0 -translate-x-1/2 rounded-l-full border-r-0",
      )}
    >
      <Icon
        name="chevronLeft"
        className={cn("h-4 w-4 transition-transform", richtung === "rechts" && "rotate-180")}
      />
    </button>
  );
}
