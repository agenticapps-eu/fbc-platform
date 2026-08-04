import type { FormatHeroMeta } from "../../config/formatHero";
import { PageHero } from "./PageHero";

/** Seitenkopf einer Format-Route (Kompass, Academy, Events …).
 *
 *  Seit AGE-499 rendert er über `PageHero` und trägt damit dasselbe Muster wie
 *  das Dashboard: Bild rechts auslaufend, Verlauf, Titel auf ruhiger Fläche.
 *  Vorher war es eine flache Akzentfläche ohne Bild (AGE-450 #7) — die Referenz
 *  zeigt jeden Kopf mit Motiv.
 *
 *  Das Motiv steht in der Route-Tabelle (config/formatHero.ts), nicht hier: die
 *  Seiten unterscheiden sich im Motiv, nicht im Aufbau. */
export function FormatHero({ meta, className }: { meta: FormatHeroMeta; className?: string }) {
  return (
    <PageHero
      image={meta.image}
      title={meta.title}
      subtitle={meta.claim}
      className={className ?? "mb-8"}
    />
  );
}
