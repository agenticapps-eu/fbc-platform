import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";

import type { ChatMessage } from "../../lib/chat";
import { cn } from "../../lib/cn";
import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";
import { EmojiAuswahl } from "./EmojiAuswahl";

const NUR_UHRZEIT = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" });
const MIT_DATUM = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});
const VOLLES_DATUM = new Intl.DateTimeFormat("de-DE", { dateStyle: "full", timeStyle: "short" });

/** `HH:MM` für heute, `TT.MM., HH:MM` für alles Ältere (AGE-645).
 *
 *  Das Datum ist nicht Zierde. Ohne es stünde eine Nachricht von letztem
 *  Dienstag als blosses „14:03" da — und weil dieser Vorgang Datumstrenner
 *  ausdrücklich ausschliesst, gäbe es nirgends sonst einen Hinweis auf den Tag.
 *  Der Plan-Reviewer hat genau das vorgerechnet.
 *
 *  Die Zone ist die des Betrachters, weil `Intl` ohne weitere Angabe so
 *  arbeitet: zwei Mitglieder in verschiedenen Zonen sehen für dieselbe Zeile
 *  verschiedene Uhrzeiten. Gewollt. */
function zeitLabel(createdAt: string, jetzt: Date): string {
  const d = new Date(createdAt);
  const gleicherTag =
    d.getFullYear() === jetzt.getFullYear() &&
    d.getMonth() === jetzt.getMonth() &&
    d.getDate() === jetzt.getDate();
  return (gleicherTag ? NUR_UHRZEIT : MIT_DATUM).format(d);
}

/** Konversationsansicht (§9): Nachrichten-Verlauf + Eingabe mit optimistischem Senden.
 *
 *  Zwei Varianten, ein Bauteil (AGE-639). Als `seite` trägt sie ihren eigenen
 *  Kopf mit Bild und Namen; als `fenster` nicht — dort IST die Titelzeile des
 *  Fensters der Kopf, samt Minimieren und Schliessen, und ein zweiter Kopf
 *  darunter nennte den Partner ein zweites Mal auf 14 rem Breite.
 *
 *  EINE Angabe statt zweier Schalter („ohne Kopf", „enger"): beides folgt aus
 *  derselben Tatsache — diese Unterhaltung steht in einem angedockten Fenster.
 *  Zwei Schalter liessen sich unabhängig setzen und damit falsch kombinieren. */
export function Conversation({
  thread,
  messages,
  myId,
  onSend,
  variante = "seite",
}: {
  /** Nur, was diese Komponente wirklich braucht — nicht der ganze `ChatThread`.
   *  Ein angedocktes Fenster kennt seinen Partner aus dem Gerätespeicher und
   *  hat dort nie eine vollständige Thread-Zeile; ein `ChatThread` zu verlangen
   *  hiesse, ihm eine zusammenzudichten. `ChatThread` erfüllt diese Form. */
  thread: {
    id: string;
    partner: { name: string; avatarUrl: string | null; company?: string | null };
  };
  messages: ChatMessage[];
  myId: string;
  onSend: (body: string) => void | Promise<void>;
  variante?: "seite" | "fenster";
}) {
  const imFenster = variante === "fenster";
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const eingabeRef = useRef<HTMLTextAreaElement>(null);
  /** Wohin der Cursor nach dem nächsten Anstrich gehört, oder `null`. */
  const cursorRef = useRef<number | null>(null);

  // Fokus und Cursor NACH dem Anstrich setzen: vorher trägt das Feld noch den
  // alten Wert, und `setSelectionRange` liefe gegen dessen Länge.
  useLayoutEffect(() => {
    if (cursorRef.current === null) return;
    const el = eingabeRef.current;
    if (el) {
      el.focus();
      el.setSelectionRange(cursorRef.current, cursorRef.current);
    }
    cursorRef.current = null;
  });

  /** Fügt an der Cursorposition ein, nicht am Ende — wer mitten im Satz ein
   *  Emoji wählt, meint diese Stelle. */
  function fuegeEmojiEin(emoji: string) {
    const el = eingabeRef.current;
    const start = el?.selectionStart ?? draft.length;
    const ende = el?.selectionEnd ?? start;
    setDraft(draft.slice(0, start) + emoji + draft.slice(ende));
    cursorRef.current = start + emoji.length;
  }

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
      {!imFenster && (
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
      )}

      <div
        className={cn(
          "flex-1 space-y-2 overflow-y-auto bg-soft",
          imFenster ? "px-3 py-3" : "px-5 py-4",
        )}
      >
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
                      ? "bg-accent text-chrome rounded-br-sm"
                      : "border border-line bg-canvas text-ink rounded-bl-sm",
                    message.pending && "opacity-60",
                  )}
                >
                  {message.body}
                  {/* Die schwebende Blase bekommt KEINE Zeit: sie trägt die Uhr
                      des Geräts (`use-gespraech.ts`, `new Date()`), die
                      bestätigte Zeile die des Servers. Eine angezeigte Zeit
                      spränge beim Eintreffen des Echos um die Uhrendifferenz. */}
                  {!message.pending && (
                    <time
                      data-testid="nachricht-zeit"
                      dateTime={message.createdAt}
                      title={VOLLES_DATUM.format(new Date(message.createdAt))}
                      className={cn(
                        "mt-1 block text-right text-[0.65rem] tabular-nums",
                        // Zwei Gründe, zwei Farben. Eine einzige gedämpfte Farbe
                        // wäre auf einer der beiden Blasen unlesbar.
                        mine ? "text-chrome/70" : "text-muted",
                      )}
                    >
                      {zeitLabel(message.createdAt, new Date())}
                    </time>
                  )}
                </span>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={submit}
        className={cn(
          "flex items-end gap-2 border-t border-line py-3",
          imFenster ? "px-3" : "px-5",
        )}
      >
        {/* `relative` Wrapper: der Emoji-Schalter liegt IM Feld, nicht als
            dritter Partner in der Zeile — bei 14 rem nähme er dort mehr als ein
            Drittel der verbleibenden Eingabebreite. */}
        <div className="relative flex-1">
          <textarea
            ref={eingabeRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit(event);
              }
            }}
            rows={1}
            // Kürzer im Fenster: bei 14 rem Fensterbreite bleiben der Eingabe
            // rund 7 rem, und „Nachricht schreiben…" brach dort auf zwei Zeilen
            // und wurde abgeschnitten (im Browser gesehen). Der ZUGÄNGLICHE Name
            // bleibt in beiden Varianten derselbe — er beschreibt die Aufgabe,
            // nicht den verfügbaren Platz.
            placeholder={imFenster ? "Nachricht…" : "Nachricht schreiben…"}
            aria-label="Nachricht schreiben"
            className={cn(
              "max-h-32 min-h-[2.75rem] w-full resize-none rounded-md border border-line bg-canvas py-2.5 text-sm text-ink focus-visible:border-accent focus-visible:outline-none",
              // `min-w-0` ist im Fenster nicht Kosmetik: ohne es setzt das
              // Flex-Element seine Inhaltsbreite als Minimum durch und schiebt den
              // Senden-Knopf bei 14 rem aus der Zeile.
              imFenster ? "min-w-0 px-2" : "px-3",
              // Platz für den Emoji-Schalter, der über dem Feld liegt.
              imFenster ? "pr-7" : "pr-9",
            )}
          />
          <EmojiAuswahl
            imFenster={imFenster}
            onWaehle={fuegeEmojiEin}
            onSchliessen={() => eingabeRef.current?.focus()}
          />
        </div>
        <Button type="submit" size={imFenster ? "sm" : "md"} disabled={sending || !draft.trim()}>
          Senden
        </Button>
      </form>
    </div>
  );
}
