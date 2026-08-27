import { cn } from "../../lib/cn";
import { Avatar } from "../ui/Avatar";
import { Icon } from "../ui/icons";
import { Conversation } from "./Conversation";
import { useGespraech } from "./use-gespraech";

/**
 * Ein angedocktes Chatfenster (AGE-639).
 *
 * **Die Titelzeile IST der Kopf des Gesprächs.** `Conversation` wird deshalb in
 * der Variante `fenster` gerendert, ohne eigenen Kopf — sonst stünde der Name
 * des Partners zweimal übereinander, auf einer Spalte von 14 bis 18 rem.
 *
 * **Der Verlauf wird auch minimiert geladen.** Der Grund ist nicht der Zähler an
 * der Titelzeile — der kommt aus `unread_message_counts()` und steht unabhängig
 * davon. Er ist der Merge-Pfad des einen globalen Realtime-Abos: das schreibt
 * nur fort, was schon im Cache liegt. Lüde ein minimiertes Fenster nichts, fiele
 * jede Nachricht weg, die während des Minimiertseins eintrifft, und das
 * Aufziehen zeigte einen Verlauf, dem genau die neuen Zeilen fehlen.
 *
 * **Die Schalter nennen den Gesprächspartner.** Drei Fenster nebeneinander mit
 * drei Schaltern namens „Schliessen" sind für eine Vorlesesoftware drei
 * ununterscheidbare Ziele.
 *
 * **`onBeruehre` an Zeiger UND Fokus.** Wer hier schreibt, benutzt dieses
 * Fenster; ohne diese Meldung könnte das nächste geöffnete Gespräch ausgerechnet
 * dieses räumen. Beide Plan-Reviewer haben darauf gezeigt.
 */
export function ChatFenster({
  thread,
  myId,
  minimiert,
  ungelesen,
  onMinimiere,
  onZiehAuf,
  onSchliesse,
  onBeruehre,
}: {
  /** Nur Kennung, Name und Bild — mehr braucht ein Fenster nicht, und mehr hat
   *  ein aus dem Gerätespeicher wiederhergestelltes auch nicht. */
  thread: { id: string; partner: { name: string; avatarUrl: string | null } };
  myId: string;
  minimiert: boolean;
  /** Ungelesene dieses Threads. Nur minimiert sichtbar — aufgezogen ist das
   *  Gespräch gelesen, sobald es dasteht. */
  ungelesen: number;
  onMinimiere: (threadId: string) => void;
  onZiehAuf: (threadId: string) => void;
  onSchliesse: (threadId: string) => void;
  onBeruehre: (threadId: string) => void;
}) {
  // `aktiv: !minimiert` — nur ein aufgezogenes Fenster rückt den Lesestand vor.
  // Ein minimiertes ist nicht gelesen worden, und es als gelesen zu markieren
  // nähme es aus genau der Zahl heraus, die zum Hinsehen auffordert.
  const gespraech = useGespraech({ threadId: thread.id, myId, aktiv: !minimiert });

  const name = thread.partner.name;
  const zaehler = minimiert && ungelesen > 0 ? `, ${ungelesen} ungelesen` : "";

  return (
    <section
      // Die ganze Fläche meldet Benutzung, nicht nur die Schalter.
      onMouseDownCapture={() => onBeruehre(thread.id)}
      onFocusCapture={() => onBeruehre(thread.id)}
      aria-label={`Gespräch mit ${name}`}
      data-chatfenster={thread.id}
      className={cn(
        // Breite: `flex 1 1 18rem` mit Deckel und Boden. Bei 1280 px mit beiden
        // Leisten aufgeklappt bleiben 44 rem für drei Fenster — dann sind es
        // 14,3 rem statt 18. Die ZAHL der Fenster bleibt fest; nur die Breite
        // gibt nach. Ein abgeschnittenes Fenster wäre ein halber Verlauf über
        // einer halben Sendezeile.
        "pointer-events-auto flex min-w-[12rem] max-w-[18rem] flex-1 flex-col overflow-hidden",
        "rounded-t-[var(--radius-card)] border border-b-0 border-line bg-canvas shadow-soft",
        minimiert ? "h-11" : "h-[26rem]",
      )}
    >
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-line px-2">
        <Avatar name={name} src={thread.partner.avatarUrl} size="sm" className="shrink-0" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{name}</span>

        {minimiert && ungelesen > 0 && (
          // `aria-hidden`: die Zahl steht schon im Namen des Schalters daneben,
          // sonst liest eine Vorlesesoftware sie zweimal.
          <span
            aria-hidden="true"
            className="shrink-0 rounded-full bg-accent px-1.5 text-[0.6875rem] font-semibold leading-[1.125rem] text-canvas"
          >
            {ungelesen}
          </span>
        )}

        <button
          type="button"
          onClick={() => (minimiert ? onZiehAuf(thread.id) : onMinimiere(thread.id))}
          aria-label={`Gespräch mit ${name} ${minimiert ? "aufziehen" : "minimieren"}${zaehler}`}
          aria-expanded={!minimiert}
          data-fenster-schalter="groesse"
          className="shrink-0 rounded p-1 text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Icon
            name="chevronDown"
            className={cn("h-4 w-4 transition-transform", minimiert && "rotate-180")}
          />
        </button>
        <button
          type="button"
          onClick={() => onSchliesse(thread.id)}
          aria-label={`Gespräch mit ${name} schliessen`}
          className="shrink-0 rounded px-1.5 text-lg leading-none text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <span aria-hidden="true">&times;</span>
        </button>
      </div>

      {/* Drei Zustände, nicht einer — derselbe Dreiklang, den `ChatPanel` führt.
          Ein Fehlschlag als „schreibe die erste Nachricht" zu zeigen hiesse, dem
          Mitglied zu sagen, sein Kontakt habe nichts geschrieben, während in
          Wahrheit gar nichts gelesen wurde. */}
      {!minimiert &&
        (gespraech.isError ? (
          <p className="flex-1 px-3 py-6 text-sm text-muted">
            Das Gespräch konnte nicht geladen werden. Lade die Seite neu.
          </p>
        ) : gespraech.isLoading ? (
          <p className="flex-1 px-3 py-6 text-sm text-muted">Wird geladen…</p>
        ) : (
          <Conversation
            thread={thread}
            messages={gespraech.messages}
            myId={myId}
            onSend={gespraech.sende}
            variante="fenster"
          />
        ))}
    </section>
  );
}
