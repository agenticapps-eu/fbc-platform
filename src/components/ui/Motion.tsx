import { AnimatePresence, animate, motion, useInView } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "../../lib/cn";
import { useDesignVariantValue } from "../../providers/design-variant-context";

/** Seitenübergang: weicher Fade/Slide-Up beim Routenwechsel. Intensität (Dauer,
 *  Slide-Distanz) folgt der aktiven Variante; bei reduced-motion ein No-Op-Fade. */
export function RouteTransition({ routeKey, children }: { routeKey: string; children: ReactNode }) {
  const { preset } = useDesignVariantValue();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={routeKey}
        initial={{ opacity: 0, y: preset.slide }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: Math.round(-preset.slide * 0.4) }}
        transition={{ duration: preset.duration, ease: preset.ease }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

/** Container für gestaffeltes Listen-Reveal. Kinder als <StaggerItem> rendern. */
export function Stagger({ children, className }: { children: ReactNode; className?: string }) {
  const { preset } = useDesignVariantValue();
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: preset.stagger } } }}
    >
      {children}
    </motion.div>
  );
}

/** Einzelnes gestaffeltes Element (erscheint mit Fade/Slide-Up).
 *
 *  `min-w-0`: dieses `motion.div` schiebt sich zwischen `<Stagger>` und den
 *  eigentlichen Inhalt. Steht `<Stagger>` auf `grid`, ist NICHT die Karte das
 *  Rasterkind, sondern dieser Wrapper — und er stünde sonst auf
 *  `min-width: auto` und schrumpfte nicht unter seinen Inhalt.
 *
 *  Gemessen am 26.08. im Verzeichnis bei 320 px: die Seite war um 39 px
 *  schiebbar. Dieselbe Eigenschaft auf der Karte statt hier bewirkte dort
 *  NICHTS (359 → 359); hier behebt sie es (359 → 320). Ein Layout-Wrapper, der
 *  seine Kinder am Schrumpfen hindert, ist ein Defekt im Wrapper (AGE-584). */
export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  const { preset } = useDesignVariantValue();
  return (
    <motion.div
      className={cn("min-w-0", className)}
      variants={{
        hidden: { opacity: 0, y: preset.slide },
        show: { opacity: 1, y: 0, transition: { duration: preset.duration, ease: preset.ease } },
      }}
    >
      {children}
    </motion.div>
  );
}

/** Zahl, die beim Sichtbarwerden von 0 hochzählt (Impact-/Potenzial-Score). */
export function CountUp({
  value,
  className,
  format = (n: number) => String(Math.round(n)),
}: {
  value: number;
  className?: string;
  format?: (n: number) => string;
}) {
  const { preset } = useDesignVariantValue();
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-15% 0px" });
  const [display, setDisplay] = useState(0);

  const animated = preset.duration > 0;
  useEffect(() => {
    if (!inView || !animated) return;
    // onUpdate (Callback, kein synchroner Effekt-setState) treibt den Hochzähler.
    const controls = animate(0, value, {
      duration: Math.max(0.7, preset.duration * 1.4),
      ease: preset.ease,
      onUpdate: setDisplay,
    });
    return () => controls.stop();
  }, [inView, animated, value, preset.duration, preset.ease]);

  // reduced-motion: direkt den Endwert rendern (kein State-Update im Effekt).
  return (
    <span ref={ref} className={className}>
      {format(animated ? display : value)}
    </span>
  );
}
