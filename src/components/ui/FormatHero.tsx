import type { FormatHeroMeta } from "../../config/formatHero";
import { BEREICHE, type Bereich } from "../../config/bereiche";
import { Icon } from "./icons";
import { PageHero } from "./PageHero";
import { cn } from "../../lib/cn";

/** Seitenkopf einer Format-Route (Kompass, Academy, Events …).
 *
 *  Seit AGE-499 rendert er über `PageHero` und trägt damit dasselbe Muster wie
 *  das Dashboard: Bild rechts auslaufend, Verlauf, Titel auf ruhiger Fläche.
 *  Vorher war es eine flache Akzentfläche ohne Bild (AGE-450 #7) — die Referenz
 *  zeigt jeden Kopf mit Motiv.
 *
 *  Das Motiv steht in der Route-Tabelle (config/formatHero.ts), nicht hier: die
 *  Seiten unterscheiden sich im Motiv, nicht im Aufbau.
 *
 *  Bezeichnet die Seite einen Gegenstandsbereich, trägt **die Überschrift** dessen
 *  Marke (AGE-582, Aufgabe 1.17). Bewusst nur die Überschrift und nicht jede
 *  Karte: auf einer Ein-Bereichs-Seite trägt jede Zeile denselben Bereich, und
 *  eine Marke auf allen wiederholte dieselbe Auskunft, statt zu unterscheiden.
 *  Entscheidung Donald, 24.08.
 *
 *  Nicht jede Kopf-Route ist ein Bereich: `/academy`, `/mitgliedschaft` und
 *  `/meine-chancen` stehen nicht im Kanon und bleiben ohne Marke. */
export function FormatHero({
  meta,
  bereich,
  className,
}: {
  meta: FormatHeroMeta;
  bereich?: Bereich;
  className?: string;
}) {
  return (
    <PageHero
      image={meta.image}
      title={
        bereich ? (
          <span className="flex items-center gap-3">
            <Icon
              name={BEREICHE[bereich].icon}
              className={cn("h-7 w-7 shrink-0 sm:h-8 sm:w-8", BEREICHE[bereich].farbe)}
            />
            {meta.title}
          </span>
        ) : (
          meta.title
        )
      }
      subtitle={meta.claim}
      className={className ?? "mb-8"}
    />
  );
}
