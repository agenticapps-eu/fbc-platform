import type { HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export function Card({
  className,
  padded = true,
  ...props
}: HTMLAttributes<HTMLDivElement> & { padded?: boolean }) {
  return (
    <div
      className={cn(
        // `min-w-0`: eine Karte steht regelmäßig als Kind eines Rasters oder
        // einer Flexbox, und solche Kinder stehen per Voreinstellung auf
        // `min-width: auto` — sie schrumpfen also NICHT unter ihren Inhalt.
        // Trägt ein Nachfahre `truncate` (das ist `white-space: nowrap`),
        // fordert er seine volle Textbreite und drückt die Karte auf. Gemessen
        // am 26.08. auf der eingeloggten Startseite bei 320 px: Karte 418 px in
        // einer 288-px-Spur, Seite um 114 px schiebbar; mit `min-width: 0`
        // fällt die Dokumentbreite auf exakt die Fensterbreite (AGE-584).
        //
        // Hier und nicht an den Aufrufstellen: zwischen dem kürzenden Text und
        // dem Rasterkind liegt fast immer eine Komponentengrenze, an der jede
        // Prüfung von außen verstummt. Oberhalb der Spurbreite ist die
        // Eigenschaft wirkungslos — sie senkt nur den Boden.
        "fbc-card min-w-0 rounded-[var(--radius-card)] border border-line bg-canvas shadow-soft",
        padded && "p-6",
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-lg font-semibold text-ink", className)} {...props} />;
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("mt-1 text-sm text-muted", className)} {...props} />;
}
