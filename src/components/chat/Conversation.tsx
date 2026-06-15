import { useEffect, useRef, useState, type FormEvent } from "react";

import type { ChatMessage, ChatThread } from "../../lib/chat";
import { cn } from "../../lib/cn";
import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";

/** Konversationsansicht (§9): Nachrichten-Verlauf + Eingabe mit optimistischem Senden. */
export function Conversation({
  thread,
  messages,
  myId,
  onSend,
}: {
  thread: ChatThread;
  messages: ChatMessage[];
  myId: string;
  onSend: (body: string) => void | Promise<void>;
}) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // Immer ans Ende scrollen, wenn neue Nachrichten kommen oder der Thread wechselt.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, thread.id]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    // Eingabe sofort leeren (optimistisch); Button bleibt bis zum Insert gesperrt,
    // damit ein zweiter Klick keine doppelte Blase erzeugt. onSend fängt Fehler selbst.
    setDraft("");
    setSending(true);
    void Promise.resolve(onSend(body)).finally(() => setSending(false));
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-line px-5 py-4">
        <Avatar name={thread.partner.name} src={thread.partner.avatarUrl} size="md" />
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-semibold text-ink">
            {thread.partner.name}
          </p>
          {thread.partner.company && (
            <p className="truncate text-sm text-muted">{thread.partner.company}</p>
          )}
        </div>
      </header>

      <div className="flex-1 space-y-2 overflow-y-auto bg-soft px-5 py-4">
        {messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">
            Noch keine Nachrichten — schreibe die erste.
          </p>
        ) : (
          messages.map((message) => {
            const mine = message.senderId === myId;
            return (
              <div key={message.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                <span
                  className={cn(
                    "max-w-[75%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap",
                    mine
                      ? "bg-gold text-night rounded-br-sm"
                      : "border border-line bg-canvas text-ink rounded-bl-sm",
                    message.pending && "opacity-60",
                  )}
                >
                  {message.body}
                </span>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={submit} className="flex items-end gap-2 border-t border-line px-5 py-3">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit(event);
            }
          }}
          rows={1}
          placeholder="Nachricht schreiben…"
          aria-label="Nachricht schreiben"
          className="max-h-32 min-h-[2.75rem] flex-1 resize-none rounded-md border border-line bg-canvas px-3 py-2.5 text-sm text-ink focus-visible:border-gold focus-visible:outline-none"
        />
        <Button type="submit" disabled={sending || !draft.trim()}>
          Senden
        </Button>
      </form>
    </div>
  );
}
