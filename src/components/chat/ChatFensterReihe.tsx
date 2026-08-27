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
  onMinimiere,
  onZiehAuf,
  onSchliesse,
  onBeruehre,
}: {
  fenster: ChatfensterStand["fenster"];
  myId: string;
  ungelesenJeThread: Map<string, number>;
  onMinimiere: (threadId: string) => void;
  onZiehAuf: (threadId: string) => void;
  onSchliesse: (threadId: string) => void;
  onBeruehre: (threadId: string) => void;
}) {
  if (fenster.length === 0) return null;

  /**
   * Beim Schliessen darf der Fokus nicht auf den `body` fallen — wer mit der
   * Tastatur arbeitet, stünde sonst mitten im Nichts (Plan-Review, opencode).
   *
   * Geregelt wird genau dieser eine Fall. Die Verdrängung durch ein viertes
   * Gespräch braucht keine Regel: der Klick, der sie auslöst, liegt in der
   * Nachrichten-Leiste, der Fokus also ohnehin dort.
   */
  function schliesseUndVersetzeFokus(threadId: string) {
    const uebrig = fenster.filter((f) => f.threadId !== threadId);
    onSchliesse(threadId);
    // Nach dem Neuzeichnen, sonst greift die Suche noch ins alte Dokument.
    queueMicrotask(() => {
      const ziel = uebrig.length
        ? document.querySelector<HTMLElement>(
            `[data-chatfenster="${uebrig[uebrig.length - 1].threadId}"] [data-fenster-schalter="groesse"]`,
          )
        : document.querySelector<HTMLElement>('[data-leisten-pill="rechts"]');
      ziel?.focus();
    });
  }

  return createPortal(
    <div
      data-chatfenster-reihe=""
      // `pointer-events-none` am Behälter, `auto` an jedem Fenster: die Abstände
      // dazwischen und der Streifen über der Reihe dürfen nicht die Seite
      // dahinter blockieren.
      className="pointer-events-none fixed bottom-0 z-30 flex items-end justify-end gap-2 overflow-hidden"
      style={{
        // EINE Quelle für beide Ränder — dieselben Variablen, mit denen der
        // Rahmen schon heute seinen Inhalt versetzt. Eine zweite Rechnung wäre
        // die, die jemand vergisst, wenn sich die erste ändert.
        left: "calc(var(--fbc-sidebar-w, 0rem) + 1rem)",
        right: "calc(var(--fbc-chat-w, 0rem) + 1rem)",
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
