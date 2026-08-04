import { cn } from "../../lib/cn";
import type { ChatThread } from "../../lib/chat";
import { Avatar } from "../ui/Avatar";

/** Thread-Liste („Meine Konversationen", §9) — wählbar, aktiver Thread hervorgehoben. */
export function ThreadList({
  threads,
  activeId,
  onSelect,
}: {
  threads: ChatThread[];
  activeId: string | null;
  onSelect: (threadId: string) => void;
}) {
  return (
    <ul className="divide-y divide-line">
      {threads.map((thread) => {
        const active = thread.id === activeId;
        return (
          <li key={thread.id}>
            <button
              type="button"
              onClick={() => onSelect(thread.id)}
              aria-current={active ? "true" : undefined}
              className={cn(
                "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
                active ? "bg-accent-soft/40" : "hover:bg-soft",
              )}
            >
              <Avatar name={thread.partner.name} src={thread.partner.avatarUrl} size="md" />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-medium text-ink">{thread.partner.name}</span>
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
