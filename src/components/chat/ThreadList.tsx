import { cn } from "../../lib/cn";
import type { ChatThread } from "../../lib/chat";
import { Avatar } from "../ui/Avatar";

/** Thread-Liste („Meine Konversationen", §9) — wählbar, aktiver Thread hervorgehoben.
 *
 * ══ DIE FARBEN KOMMEN AUS TOKENS, NICHT AUS KLASSEN (AGE-1002) ════════════
 * Diese Liste steht an ZWEI Orten: auf `/chat` (helle Fläche) und in der
 * angedockten Nachrichtenleiste, die im dunklen Modus `#002B51` trägt. Sie
 * bekommt dafür **kein** Variantenargument und existiert nicht in zwei
 * Fassungen: die `--thread-*`-Tokens fallen auf die Inhaltsfarben zurück und
 * werden ausschliesslich innerhalb von `.fbc-chat-rail` überschrieben
 * (`index.css`). Der ORT entscheidet, nicht ein Argument — und jede neue Fläche,
 * die diese Liste auf dunklen Grund stellt, setzt die Tokens dort.
 *
 * Die Kontraste für den dunklen Fall sind gerechnet und stehen in
 * `index.chatleiste-tokens.test.ts`; eine Farbänderung, die eine Schwelle
 * reisst, wird dort rot. */
export function ThreadList({
  threads,
  activeId,
  onSelect,
  ungelesenJeThread,
}: {
  threads: ChatThread[];
  activeId: string | null;
  onSelect: (threadId: string) => void;
  /** Ungelesene je Thread (AGE-583). Ein Thread, der fehlt, hat null — die RPC
   *  liefert Threads ohne Ungelesenes gar nicht. */
  ungelesenJeThread: Map<string, number>;
}) {
  return (
    <ul className="divide-y divide-[color:var(--thread-line)]">
      {threads.map((thread) => {
        const active = thread.id === activeId;
        const ungelesen = ungelesenJeThread.get(thread.id) ?? 0;
        return (
          <li key={thread.id}>
            <button
              type="button"
              onClick={() => onSelect(thread.id)}
              aria-current={active ? "true" : undefined}
              // Die Zahl gehört in den NAMEN, nicht nur in den Punkt rechts:
              // Farbe trägt nie allein eine Bedeutung, und ein Punkt ist für
              // jemanden, der ihn nicht sieht, gar nichts.
              aria-label={
                ungelesen > 0
                  ? `${thread.partner.name}, ${ungelesen} ungelesen`
                  : thread.partner.name
              }
              className={cn(
                "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
                active ? "bg-[var(--thread-active)]" : "hover:bg-[var(--thread-hover)]",
              )}
            >
              <Avatar name={thread.partner.name} src={thread.partner.avatarUrl} size="md" />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span
                    className={cn(
                      "truncate text-[color:var(--thread-ink)]",
                      ungelesen > 0 ? "font-semibold" : "font-medium",
                    )}
                  >
                    {thread.partner.name}
                  </span>
                  {ungelesen > 0 && (
                    // `aria-hidden`: die Zahl steht schon im Namen des Knopfes,
                    // sonst liest ein Screenreader sie zweimal.
                    <span
                      aria-hidden="true"
                      className="shrink-0 rounded-full bg-[var(--thread-badge)] px-1.5 text-[0.6875rem] font-semibold leading-[1.125rem] text-[color:var(--thread-badge-ink)]"
                    >
                      {ungelesen}
                    </span>
                  )}
                </span>
                <span className="block truncate text-sm text-[color:var(--thread-muted)]">
                  {thread.lastMessage
                    ? `${thread.lastMessage.fromMe ? "Du: " : ""}${thread.lastMessage.body}`
                    : "Noch keine Nachrichten"}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
