import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { Conversation } from "../components/chat/Conversation";
import { ThreadList } from "../components/chat/ThreadList";
import { Button } from "../components/ui/Button";
import { Card, CardDescription, CardTitle } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import {
  mergeMessage,
  messagesQueryKey,
  subscribeToThread,
  threadsQueryKey,
  type ChatMessage,
} from "../lib/chat";
import { useGespraech } from "../components/chat/use-gespraech";
import { useUngelesen } from "../components/chat/use-ungelesen";
import { useThreadsSeite } from "../components/chat/use-threads-seite";
import { cn } from "../lib/cn";
import { useAuth } from "../providers/auth-context";

function errorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "Unbekannter Fehler.";
}

/**
 * Chat (AGE-248, §9) — Master-Detail: Konversations-Liste + Verlauf, Realtime über
 * Supabase auf `messages`. Nur Prime+ (Route-Gating) und nur für freigegebene
 * Kontakte (Threads entstehen serverseitig erst bei `accepted`; das messages-INSERT
 * ist RLS-gegated). Optimistisches Senden mit Rollback bei RLS-Fehler.
 */
export default function ChatPage() {
  const { user } = useAuth();
  const myId = user?.id ?? "";
  const { threadId } = useParams<{ threadId?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // DERSELBE Hook wie die stehende Leiste — eine Datenquelle, ein Umfang, und
  // zwar als Eigenschaft des Caches statt als Verabredung zwischen zwei
  // Flächen. Die Invalidierungen weiter unten stehen unverändert unter
  // demselben Schlüssel.
  const threadsQuery = useThreadsSeite(myId || null);

  // Derselbe Query-Schlüssel wie Kopfzeile und Profilkachel — React Query
  // bündelt die drei, und sie können nicht auseinanderlaufen (AGE-583).
  const { stand: ungelesen } = useUngelesen(myId || null);

  const activeId = threadId ?? null;
  const threads = threadsQuery.data?.pages.flatMap((seite) => seite.threads) ?? [];
  const activeThread = threads.find((t) => t.id === activeId) ?? null;

  // Verlauf, Lesestand und optimistisches Senden kommen seit AGE-639 aus EINER
  // Definition — dieselbe, aus der ein angedocktes Chatfenster sein Gespräch
  // bezieht. Die drei Blöcke, die hier standen, waren die Vorlage dafür.
  //
  // `aktiv` ist hier `Boolean(activeId)`: die Vollansicht liegt dem Mitglied
  // immer gegenüber, wenn überhaupt ein Gespräch gewählt ist. Ein Fenster
  // übergibt an derselben Stelle `!minimiert`.
  const gespraech = useGespraech({ threadId: activeId ?? "", myId, aktiv: Boolean(activeId) });

  // Realtime: neue Nachrichten des OFFENEN Threads live einspielen (§9).
  // Bekannte Phase-1-Lücke: zwischen initialem fetchMessages und aktivem Channel
  // eintreffende Nachrichten erscheinen erst beim nächsten Thread-Wechsel/Refetch.
  useEffect(() => {
    if (!activeId) return;
    const unsubscribe = subscribeToThread(activeId, (incoming) => {
      queryClient.setQueryData<ChatMessage[]>(messagesQueryKey(activeId), (prev) =>
        mergeMessage(prev ?? [], incoming),
      );
      void queryClient.invalidateQueries({ queryKey: threadsQueryKey(myId) });
      // **Hier wird der Lesestand NICHT mehr vorgerückt** (AGE-639).
      //
      // Er wird es trotzdem, und zwar sofort: `useGespraech` hängt seinen
      // Effect an die letzte FREMDE Nachricht, und die Zeile darüber schreibt
      // sie gerade in den Cache. Die Zusage aus AGE-583 — die Summe darf nicht
      // auf 1 springen und zurückfallen — bleibt damit erfüllt.
      //
      // Der Aufruf, der hier stand, ist ersatzlos entfallen, weil er neben dem
      // Hook ein ZWEITES Mal geschrieben hätte: je eingehender Fremdnachricht
      // zwei Upserts statt einem. Gefunden hat es die Diff-Review (opencode,
      // HIGH) — und sie hat damit zugleich einen Kommentar im Hook widerlegt,
      // der „gleich viele Schreibvorgänge" behauptete. Gemessen war das nur am
      // Hook allein, nicht an dieser Seite mit ihrem eigenen Abo.
    });
    return unsubscribe;
  }, [activeId, myId, queryClient]);

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-semibold text-ink">Nachrichten</h1>
        <p className="mt-1 text-sm text-muted">
          Direktnachrichten mit deinen freigegebenen Kontakten — in Echtzeit.
        </p>
      </header>

      {threadsQuery.isError ? (
        <Card>
          <CardTitle>Chat konnte nicht geladen werden</CardTitle>
          <CardDescription>{errorMessage(threadsQuery.error)}</CardDescription>
        </Card>
      ) : !threadsQuery.isLoading && threads.length === 0 ? (
        // AGE-494: Hier liegt die Handlung beim Mitglied — also den Weg zeigen,
        // statt auf ein Ereignis zu warten, das es selbst auslösen kann.
        <EmptyState
          title="Noch kein Gespräch begonnen"
          description="Chats entstehen, sobald eine Kontaktanfrage angenommen wurde. Schau im Verzeichnis, wer zu dir passt, und schreib die erste Anfrage."
          action={
            <Link to="/mitglieder">
              <Button variant="primary" size="sm">
                Mitglieder entdecken
              </Button>
            </Link>
          }
        />
      ) : (
        <Card className="grid h-[32rem] grid-cols-1 overflow-hidden p-0 md:grid-cols-[18rem_1fr]">
          {/* Liste: mobil ausgeblendet, sobald ein Thread offen ist. */}
          <div
            className={cn(
              "min-h-0 overflow-y-auto border-line md:border-r",
              activeId ? "hidden md:block" : "block",
            )}
          >
            <ThreadList
              threads={threads}
              activeId={activeId}
              onSelect={(id) => navigate(`/chat/${id}`)}
              ungelesenJeThread={ungelesen.jeThread}
            />
            {/* Ohne diesen Knopf wäre alles jenseits der ersten Seite dauerhaft
                unerreichbar — eine Grenze ohne Weg dahinter ist keine Seite,
                sondern eine stille Kappung. */}
            {threadsQuery.hasNextPage && (
              <div className="flex justify-center p-3">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void threadsQuery.fetchNextPage()}
                  disabled={threadsQuery.isFetchingNextPage}
                >
                  {threadsQuery.isFetchingNextPage ? "Wird geladen…" : "Weitere Gespräche"}
                </Button>
              </div>
            )}
          </div>

          {/* Konversation: mobil nur sichtbar, wenn ausgewählt. */}
          <div className={cn("min-h-0", activeId ? "block" : "hidden md:block")}>
            {activeThread ? (
              <Conversation
                thread={activeThread}
                messages={gespraech.messages}
                myId={myId}
                onSend={gespraech.sende}
              />
            ) : (
              <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted">
                Wähle links eine Konversation.
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
