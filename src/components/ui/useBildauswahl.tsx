import { useEffect, useId, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Capacitor } from "@capacitor/core";

import { bilderVonQuelle, entscheideBildauswahl, type Bildquelle } from "../../lib/bildauswahl";
import { Button } from "./Button";
import { useOverlay } from "./useOverlay";

/**
 * Die Rückfrage „woher kommt das Bild?" (AGE-642 C3).
 *
 * **Sie gehört uns, nicht dem System.** Capacitor 8 hat `getPhoto` samt
 * eingebauter Kamera/Galerie-Rückfrage als veraltet markiert und verweist
 * dafür ausdrücklich auf eine eigene Oberfläche. Der Ersatz sind zwei
 * getrennte Aufrufe, und nur der zweite kann Mehrfachauswahl — der Feed
 * behielte sie sonst nicht.
 *
 * **Portal an `document.body`, und das ist keine Geschmacksfrage.** Ein
 * `fixed`-Overlay innerhalb der Kartenliste hängt in dieser Anwendung nicht am
 * Viewport: `.fbc-card:hover` trägt ein `transform` und der Seitenkopf ein
 * `backdrop-filter`, und beide erzeugen einen Bezugsrahmen, in dem `fixed` an
 * ihnen klebt statt am Fenster. Genau derselbe Grund wie bei
 * `ReleaseNoteModal`; jsdom sieht davon nichts.
 */
function BildQuelleWahl({
  onWaehlen,
  onAbbrechen,
}: {
  onWaehlen: (quelle: Bildquelle) => void;
  onAbbrechen: () => void;
}) {
  const overlay = useOverlay<HTMLDivElement>(true, onAbbrechen);
  const titelId = useId();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onAbbrechen();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onAbbrechen]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-scrim p-4 backdrop-blur-sm sm:items-center"
      // `mousedown` auf dem Hintergrund, nicht `click` — dieselbe Begründung
      // wie bei `ReleaseNoteModal`.
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onAbbrechen();
      }}
    >
      <div
        ref={overlay}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titelId}
        // `pb-[env(safe-area-inset-bottom)]`: von unten aufgezogen steht der
        // untere Knopf sonst im Home-Indikator (AGE-642 C1).
        className="w-full max-w-sm rounded-[var(--radius-card)] border border-line bg-canvas p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-soft sm:pb-5"
      >
        <h2 id={titelId} className="font-display text-lg font-semibold text-ink">
          Bild hinzufügen
        </h2>
        <div className="mt-4 flex flex-col gap-2">
          {/* Kein Icon: der Satz kennt kein `camera`, und einen dafuer
              anzulegen waere Scope, den C3 nicht verlangt. Ein Icon nur am
              zweiten Knopf saehe nach einem Fehler aus. */}
          <Button variant="primary" onClick={() => onWaehlen("kamera")}>
            Aufnehmen
          </Button>
          <Button variant="ghost" onClick={() => onWaehlen("mediathek")}>
            Aus der Mediathek
          </Button>
          <Button variant="ghost" size="sm" className="border-transparent" onClick={onAbbrechen}>
            Abbrechen
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Der gemeinsame Aufrufpunkt für jede Bildauswahl (AGE-642 C3).
 *
 * Die aufrufende Fläche weiß NICHT, auf welcher Plattform sie läuft: sie ruft
 * `oeffnen` und bekommt ihre Dateien über `uebernehmen` — im Web über das
 * `onChange` ihres bestehenden Feldes, nativ aus Kamera oder Mediathek. Beide
 * Wege enden in derselben Senke; das ist der ganze Punkt.
 *
 * @param uebernehmen wohin die gewählten Dateien gehen — dieselbe Stelle, die
 *   auch das `onChange` des Dateifeldes bedient
 */
export function useBildauswahl(uebernehmen: (dateien: File[]) => void): {
  /**
   * @param feld das bestehende Dateifeld dieser Fläche; nativ ungenutzt
   * @param frei wie viele Bilder hier noch hineinpassen
   */
  oeffnen: (feld: HTMLInputElement | null, optionen?: { mehrere?: boolean; frei?: number }) => void;
  /** Muss gerendert werden. Im Web immer `null`. */
  rueckfrage: ReactNode;
} {
  const [offen, setOffen] = useState<{ mehrere: boolean; limit: number } | null>(null);

  function oeffnen(
    feld: HTMLInputElement | null,
    { mehrere = false, frei = 1 }: { mehrere?: boolean; frei?: number } = {},
  ) {
    const weg = entscheideBildauswahl({
      nativ: Capacitor.isNativePlatform(),
      mehrere,
      frei,
    });
    if (weg.art === "dateifeld") {
      feld?.click();
      return;
    }
    setOffen({ mehrere: weg.mehrere, limit: weg.limit });
  }

  async function waehlen(quelle: Bildquelle, mehrere: boolean, limit: number) {
    // ERST schliessen, dann holen: der native Auswahldialog legt sich über die
    // App, und die Rückfrage stünde nach seiner Rückkehr sonst noch offen —
    // samt der Scroll-Sperre, die `useOverlay` gelegt hat.
    setOffen(null);
    const dateien = await bilderVonQuelle(quelle, { mehrere, limit });
    if (dateien.length > 0) uebernehmen(dateien);
  }

  return {
    oeffnen,
    rueckfrage: offen ? (
      <BildQuelleWahl
        onWaehlen={(quelle) => void waehlen(quelle, offen.mehrere, offen.limit)}
        onAbbrechen={() => setOffen(null)}
      />
    ) : null,
  };
}
