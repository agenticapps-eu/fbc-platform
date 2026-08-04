import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export interface PageHeroProps {
  /** Pfad unter /images. Fehlt er, trägt der Hero nur den Verlauf. */
  image?: string;
  /** Kleine Zeile über der Überschrift (Begrüßung, Rubrik). */
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Suchfeld, Buttons, Filter — sitzt unter dem Text, noch im Hero. */
  children?: ReactNode;
  className?: string;
}

/** Seitenkopf mit Bild, Verlauf und Titel (AGE-499).
 *
 *  Aufbau: das Foto liegt rechts und blutet nach oben und rechts aus; darüber
 *  läuft ein Verlauf von der Kartenfläche nach transparent, sodass der Text
 *  links auf ruhiger Fläche steht und das Bild rechts frei atmet. Genau so
 *  zeigt es die Referenz.
 *
 *  Warum der Verlauf zwei Stopps in der Kartenfarbe hat und nicht einen: mit nur
 *  einem Stopp beginnt das Bild schon unter dem Text durchzuscheinen, und
 *  Fließtext auf Foto ist auch mit Schleier schlechter lesbar als auf Fläche.
 *
 *  Die Bilder liegen selbst gehostet unter /images (Quelle und Lizenz in
 *  public/images/CREDITS.md) — aus demselben Grund, aus dem AGE-492 die Fonts
 *  vom Google-CDN geholt hat: kein Fremdabruf beim Seitenaufruf.
 */
export function PageHero({ image, eyebrow, title, subtitle, children, className }: PageHeroProps) {
  return (
    <section
      className={cn(
        "relative isolate overflow-hidden rounded-[var(--radius-card)] border border-line bg-canvas",
        className,
      )}
    >
      {image && (
        <>
          <img
            src={image}
            alt=""
            aria-hidden="true"
            loading="eager"
            // fetchPriority: der Hero ist das größte Element above the fold; ohne
            // Priorität lädt er hinter den Karten-Requests.
            fetchPriority="high"
            className="absolute inset-y-0 right-0 h-full w-full object-cover sm:w-[70%]"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(90deg, var(--color-canvas) 0%, var(--color-canvas) 38%, color-mix(in srgb, var(--color-canvas) 55%, transparent) 62%, transparent 88%)",
            }}
          />
        </>
      )}

      <div className="relative flex flex-col gap-4 px-6 py-10 sm:px-10 sm:py-14">
        <div className="max-w-xl">
          {eyebrow && (
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
              {eyebrow}
            </p>
          )}
          <h1 className="mt-2 font-display text-3xl leading-tight text-ink-strong sm:text-4xl">
            {title}
          </h1>
          {subtitle && <p className="mt-3 text-base text-muted">{subtitle}</p>}
        </div>
        {children && <div className="max-w-2xl">{children}</div>}
      </div>
    </section>
  );
}
