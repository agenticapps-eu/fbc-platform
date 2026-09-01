import { useState, type ReactNode } from "react";

import { Icon } from "./icons";

/**
 * Inhalt links, Filter in einer mitlaufenden Spalte rechts (AGE-629).
 *
 * Ein eigenes Bauteil und nicht dreimal dieselbe Klassenkette: `/mitglieder`,
 * `/events` und `/academy` tragen exakt dieselbe Anordnung, und darin stecken
 * vier Zusagen, die einzeln lautlos brechen, wenn eine Kopie sie verliert.
 * Sie stehen hier zusammen, weil sie zusammengehören — nachgewiesen in AGE-626
 * und von dort übernommen:
 *
 *  * `lg:self-start` — ein Grid-Kind ist per Default so hoch wie sein Behälter,
 *    dann hat `sticky` nichts, woran es kleben könnte. Ohne diese Klasse wirkt
 *    `sticky` scheinbar gar nicht, und man sucht am falschen Ende.
 *  * `lg:top-20` (5rem) — der Shell-Header ist `sticky top-0` mit `h-16`; ohne
 *    den Versatz schiebt sich die Spalte darunter.
 *  * `lg:max-h-[calc(100vh-6rem)]` + `lg:overflow-y-auto` — eine Filterliste,
 *    die länger als der Schirm ist, wäre unten sonst nicht erreichbar.
 *  * erst ab `lg` — darunter steht die Spalte im Fluss.
 *
 * `lg:row-start-1` bei der Spalte und beim Inhalt: sonst begänne die Spalte
 * erst neben der Trefferliste statt oben.
 *
 * Die Spalte ist bewusst NICHT die angedockte Leiste an der Viewport-Kante.
 * Das ist die Nachrichten-Leiste aus AGE-627, eine andere Ebene mit einem
 * anderen Umbruchpunkt. Diese hier sitzt INNERHALB des Inhaltsbereichs.
 */
export function FilterSpalte({
  id,
  filter,
  children,
  anfangsOffen = false,
  hinweisWennZu,
}: {
  /** Verbindet Schalter und Fläche über `aria-controls`. Je Seite eindeutig. */
  id: string;
  /** Was in der Spalte steht — Suchfeld, Facetten, Sortierung. */
  filter: ReactNode;
  /** Der Inhalt links. */
  children: ReactNode;
  /**
   * Startet die Spalte unterhalb von `lg` aufgeklappt? Standard ist zu. Offen
   * nur, wenn sonst gefiltert würde, ohne dass ein Filterfeld zu sehen ist.
   */
  anfangsOffen?: boolean;
  /**
   * Steht unter dem Schalter, solange die Spalte zu ist. Für den Fall, dass
   * ein aktiver Filter unsichtbar geworden ist — eine kurze Trefferliste
   * erklärt sich sonst nicht mehr.
   */
  hinweisWennZu?: ReactNode;
}) {
  const [offen, setOffen] = useState(anfangsOffen);

  return (
    // `grid-cols-1` ist NICHT überflüssig, auch wenn ein Raster ohne Angabe
    // ohnehin einspaltig ist. Der Unterschied ist die Untergrenze: die
    // implizite Spalte ist `auto` und wächst auf `max-content` — bei 375 px
    // wurden beide Kinder dadurch 389 px breit und schoben das Dokument um
    // 31 px zur Seite. `grid-cols-1` ist bei Tailwind `minmax(0, 1fr)`, und
    // die Null ist hier die ganze Zusage.
    //
    // Im Bild gefunden, nicht im Test: 2315 grüne Tests sahen es nicht, und
    // `scrollWidth` allein hätte nur gesagt DASS, nicht WAS.
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
      <aside className="lg:sticky lg:top-20 lg:col-start-2 lg:row-start-1 lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto">
        {/* Nur unterhalb von `lg`: darüber steht die Spalte ohnehin, und ein
            Schalter, der nichts schaltet, ist eine Falle für die Tastatur. */}
        <div className="mb-3 lg:hidden">
          <button
            type="button"
            onClick={() => setOffen((v) => !v)}
            aria-expanded={offen}
            aria-controls={id}
            className="inline-flex w-full items-center justify-between rounded-md border border-line px-3 py-2 text-sm text-muted transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          >
            Filter
            <Icon name="chevronDown" className={`h-4 w-4 ${offen ? "rotate-180" : ""}`} />
          </button>
          {!offen && hinweisWennZu && <p className="mt-2 text-sm text-muted">{hinweisWennZu}</p>}
        </div>

        {/* `hidden` klappt zu, `lg:block` holt zurück. Die Reihenfolge im
            Stylesheet entscheidet, nicht die im Attribut — deshalb hier eine
            feste Zeichenkette und kein `cn()`: das löscht keine Gegenklasse. */}
        <div id={id} className={`${offen ? "" : "hidden"} lg:block`}>
          {filter}
        </div>
      </aside>

      <div className="space-y-6 lg:col-start-1 lg:row-start-1">{children}</div>
    </div>
  );
}
