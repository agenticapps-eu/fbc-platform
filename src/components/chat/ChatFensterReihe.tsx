import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { ChatFenster } from "./ChatFenster";
import type { ChatfensterStand } from "./use-chatfenster";

/**
 * Die Reihe der angedockten Chatfenster, unten rechts (AGE-639).
 *
 * **Portal an `document.body`, und das ist nicht verhandelbar.** Ein Vorfahre
 * mit `transform`, `filter` oder `backdrop-filter` wird zum Containing Block
 * für `position: fixed` — dieses Repository hat sich das schon zweimal
 * eingefangen (`.fbc-card:hover` und der `<header>` mit `backdrop-blur`), und
 * `FeedbackButton.tsx:125` trägt den Kommentar dazu bereits.
 *
 * **Sie steht zwischen BEIDEN Leisten**, nicht nur neben der rechten. Die erste
 * Fassung dieses Changes rechnete nur mit der rechten; beide Plan-Reviewer
 * haben unabhängig voneinander darauf gezeigt, und die Zahl gab ihnen recht: bei
 * 1280 px mit aufgeklappter Navigation (16 rem) und aufgeklappter
 * Nachrichten-Leiste (18 rem) bleiben 44 rem, nicht 60.
 *
 * **Deshalb geben die Fenster in der Breite nach, statt abgeschnitten zu
 * werden.** `flex: 1 1 18rem` mit Deckel 18 rem und Boden 12 rem: bei 44 rem
 * sind es 14,3 rem je Fenster — drei GANZE Fenster statt zweieinhalb. Ein
 * angeschnittenes Fenster wäre ein halber Verlauf über einer halben Sendezeile,
 * und das versteckt das Platzproblem, statt es zu lösen.
 *
 * **`z-30`, unter allen modalen Flächen.** Ein Overlay mit Scrim hält die Seite
 * dahinter still; ein Chatfenster darüber wäre sichtbar und unbedienbar — eine
 * Ausnahme von genau der Zusage, die der Scrim gibt.
 */

export function ChatFensterReihe({
  fenster,
  myId,
  ungelesenJeThread,
  leisteLinks,
  leisteRechts,
  onMinimiere,
  onZiehAuf,
  onSchliesse,
  onBeruehre,
}: {
  fenster: ChatfensterStand["fenster"];
  myId: string;
  ungelesenJeThread: Map<string, number>;
  /**
   * Die Breiten beider Leisten, als WERTE übergeben — nicht über
   * `var(--fbc-sidebar-w)`.
   *
   * **Im Browser gemessen, nicht überlegt:** die erste Fassung las genau diese
   * CSS-Variablen. Sie sind aber am Wurzel-`div` der Hülle gesetzt, und diese
   * Reihe hängt per Portal am `document.body` — also OBERHALB davon. `var()`
   * fiel auf `0rem` zurück, die Reihe wurde 77 rem statt 44 rem breit und lief
   * unter beide Leisten. jsdom sieht davon nichts; ein `getBoundingClientRect`
   * im echten Chrome sieht es sofort.
   *
   * Es bleibt EINE Quelle: derselbe Ausdruck in der Hülle, der die Variablen
   * setzt, füllt diese beiden Angaben.
   */
  leisteLinks: string;
  leisteRechts: string;
  onMinimiere: (threadId: string) => void;
  onZiehAuf: (threadId: string) => void;
  onSchliesse: (threadId: string) => void;
  onBeruehre: (threadId: string) => void;
}) {
  /**
   * Beim Schliessen darf der Fokus nicht auf den `body` fallen — wer mit der
   * Tastatur arbeitet, stünde sonst mitten im Nichts (Plan-Review, opencode).
   *
   * Geregelt wird genau dieser eine Fall. Die Verdrängung durch ein viertes
   * Gespräch braucht keine Regel: der Klick, der sie auslöst, liegt in der
   * Nachrichten-Leiste, der Fokus also ohnehin dort.
   *
   * **Über einen Effect, nicht über `queueMicrotask`** (Diff-Review, opencode,
   * LOW). Die erste Fassung setzte voraus, dass Reacts Commit bei einem
   * diskreten Ereignis synchron VOR dem Microtask liegt. Das stimmt heute und
   * ist doch eine Annahme über die Implementierung, kein Versprechen — sie
   * fiele unter geändertem Batching still aus, und „still" ist bei einer
   * Tastaturzusage das Schlimmste. Ein Effect läuft garantiert nach dem
   * Zeichnen.
   */
  const fokusZiel = useRef<string | null>(null);
  useEffect(() => {
    const ziel = fokusZiel.current;
    if (ziel === null) return;
    fokusZiel.current = null;
    const el = ziel
      ? document.querySelector<HTMLElement>(
          `[data-chatfenster="${ziel}"] [data-fenster-schalter="groesse"]`,
        )
      : document.querySelector<HTMLElement>('[data-leisten-pill="rechts"]');
    el?.focus();
  }, [fenster]);

  function schliesseUndVersetzeFokus(threadId: string) {
    const uebrig = fenster.filter((f) => f.threadId !== threadId);
    // Leerer String heisst „kein Fenster mehr da" — dann der Pill der Leiste.
    fokusZiel.current = uebrig.length ? uebrig[uebrig.length - 1].threadId : "";
    onSchliesse(threadId);
  }

  if (fenster.length === 0) return null;

  return createPortal(
    <div
      data-chatfenster-reihe=""
      // `pointer-events-none` am Behälter, `auto` an jedem Fenster: die Abstände
      // dazwischen und der Streifen über der Reihe dürfen nicht die Seite
      // dahinter blockieren.
      className="pointer-events-none fixed bottom-0 z-30 flex items-end justify-end gap-2 overflow-hidden"
      style={{
        left: `calc(${leisteLinks} + 1rem)`,
        right: `calc(${leisteRechts} + 1rem)`,
      }}
    >
      {fenster.map((f) => (
        <ChatFenster
          key={f.threadId}
          thread={{ id: f.threadId, partner: { name: f.name, avatarUrl: f.avatarUrl } }}
          myId={myId}
          minimiert={f.minimiert}
          ungelesen={ungelesenJeThread.get(f.threadId) ?? 0}
          onMinimiere={onMinimiere}
          onZiehAuf={onZiehAuf}
          onSchliesse={schliesseUndVersetzeFokus}
          onBeruehre={onBeruehre}
        />
      ))}
    </div>,
    document.body,
  );
}
