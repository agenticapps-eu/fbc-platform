import { cn } from "../../lib/cn";
import type { ChatThread } from "../../lib/chat";
import { Avatar } from "../ui/Avatar";

/** Thread-Liste („Meine Konversationen", §9) — wählbar, aktiver Thread hervorgehoben. */
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
    <ul className="divide-y divide-line">
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
                active ? "bg-accent-soft/40" : "hover:bg-soft",
              )}
            >
              <Avatar name={thread.partner.name} src={thread.partner.avatarUrl} size="md" />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span
                    className={cn(
                      "truncate text-ink",
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
                      className="shrink-0 rounded-full bg-accent px-1.5 text-[0.6875rem] font-semibold leading-[1.125rem] text-canvas"
                    >
                      {ungelesen}
                    </span>
                  )}
                </span>
                <span className="block truncate text-sm text-muted">
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
