import { useEffect } from "react";
import { createPortal } from "react-dom";

import { RELEASE_BILDER } from "../../content/release-bilder";
import type { ReleaseNote } from "../../lib/release-notes";
import { useOverlay } from "../ui/useOverlay";

/**
 * Eine zugestellte Release-Note, mittig geöffnet (AGE-632).
 *
 * **Portal an `document.body`, und das ist keine Geschmacksfrage.** Ein
 * `fixed`-Overlay innerhalb der Kartenliste hängt in dieser Anwendung nicht am
 * Viewport: `.fbc-card:hover` trägt ein `transform` und der Seitenkopf ein
 * `backdrop-filter`, und beide erzeugen einen Bezugsrahmen, in dem `fixed` an
 * ihnen klebt statt am Fenster. jsdom sieht davon nichts — der Test prüft
 * deshalb den Elternknoten, nicht die Optik.
 *
 * Scroll-Sperre und Fokus-Falle kommen aus `useOverlay` (AGE-529), dem Hook,
 * den sich die vier bestehenden Overlays teilen. Ein fünftes eigenes Muster
 * hier wäre genau der Rückfall, den jener Change abgeschafft hat.
 *
 * Der Text wird als Text gerendert. Er stammt aus der Redaktion eines Admins,
 * aber `dangerouslySetInnerHTML` wäre auch dann eine Einladung, die niemand
 * braucht.
 */
export function ReleaseNoteModal({ note, onClose }: { note: ReleaseNote; onClose: () => void }) {
  const overlay = useOverlay<HTMLDivElement>(true, onClose);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Die Bilder der Änderungen, die diese Note abdeckt. Die meisten Slugs haben
  // keines — das ist der Normalfall und keine Lücke.
  const bilder = note.entry_slugs.flatMap((slug) => RELEASE_BILDER[slug] ?? []);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4 backdrop-blur-sm"
      // `mousedown` auf dem Hintergrund, nicht `click`: wer im Dialog zu
      // markieren beginnt und den Zeiger dabei hinausschiebt, löst sonst einen
      // Klick auf den Hintergrund aus und verliert den Text mitten im Lesen.
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={overlay}
        role="dialog"
        aria-modal="true"
        aria-labelledby="release-note-titel"
        className="max-h-[85vh] w-full max-w-[760px] overflow-y-auto rounded-[var(--radius-card)] border border-line bg-canvas p-6 shadow-soft"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="release-note-titel" className="font-display text-2xl font-semibold text-ink">
            {note.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schliessen"
            className="shrink-0 rounded-md p-1 text-muted transition-colors hover:bg-ink/[0.04] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            ✕
          </button>
        </div>

        <p className="mt-1 text-xs text-muted">{formatDatum(note.sent_at)}</p>

        <p className="mt-4 whitespace-pre-line text-sm text-ink">{note.body}</p>

        {bilder.length > 0 && (
          <div className="mt-5 flex flex-col gap-4">
            {bilder.map((b) => (
              <img
                key={b.src}
                src={b.src}
                alt={b.alt}
                width={b.width}
                height={b.height}
                // `h-auto` zusammen mit den Attributen: die Abmessungen geben
                // dem Browser das Seitenverhältnis, bevor das Bild da ist, und
                // `max-w-full` hält es trotzdem in der Spalte.
                className="h-auto max-w-full rounded-md border border-line"
              />
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

export function formatDatum(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}
