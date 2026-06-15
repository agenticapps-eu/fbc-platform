import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { Conversation } from "../components/chat/Conversation";
import { ThreadList } from "../components/chat/ThreadList";
import { Card, CardDescription, CardTitle } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { useToast } from "../components/ui/toast-context";
import {
  fetchMessages,
  fetchThreads,
  mergeMessage,
  messagesQueryKey,
  sendMessage,
  subscribeToThread,
  threadsQueryKey,
  type ChatMessage,
} from "../lib/chat";
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
  const { toast } = useToast();

  const threadsQuery = useQuery({
    queryKey: threadsQueryKey(myId),
    queryFn: () => fetchThreads(myId),
    enabled: Boolean(myId),
  });

  const activeId = threadId ?? null;
  const activeThread = threadsQuery.data?.find((t) => t.id === activeId) ?? null;

  const messagesQuery = useQuery({
    queryKey: messagesQueryKey(activeId ?? ""),
    queryFn: () => fetchMessages(activeId!),
    enabled: Boolean(activeId),
  });

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
    });
    return unsubscribe;
  }, [activeId, myId, queryClient]);

  async function handleSend(body: string) {
    if (!activeId || !myId) return;
    const optimistic: ChatMessage = {
      id: `optimistic-${crypto.randomUUID()}`,
      threadId: activeId,
      senderId: myId,
      body,
      createdAt: new Date().toISOString(),
      pending: true,
    };
    queryClient.setQueryData<ChatMessage[]>(messagesQueryKey(activeId), (prev) => [
      ...(prev ?? []),
      optimistic,
    ]);

    try {
      const real = await sendMessage({ threadId: activeId, senderId: myId, body });
      // Echte Zeile gleicht die optimistische Blase ab (Realtime-Echo bleibt idempotent).
      queryClient.setQueryData<ChatMessage[]>(messagesQueryKey(activeId), (prev) =>
        mergeMessage(prev ?? [], real),
      );
      void queryClient.invalidateQueries({ queryKey: threadsQueryKey(myId) });
    } catch (error) {
      // Rollback: optimistische Blase entfernen, Nutzer informieren.
      queryClient.setQueryData<ChatMessage[]>(messagesQueryKey(activeId), (prev) =>
        (prev ?? []).filter((m) => m.id !== optimistic.id),
      );
      toast({
        title: "Nachricht nicht gesendet",
        description: errorMessage(error),
        variant: "error",
      });
    }
  }

  const threads = threadsQuery.data ?? [];

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-semibold text-ink">Chat</h1>
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
        <EmptyState
          title="Noch keine Konversationen"
          description="Sobald eine Kontaktanfrage angenommen wurde, erscheint hier euer Chat."
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
            />
          </div>

          {/* Konversation: mobil nur sichtbar, wenn ausgewählt. */}
          <div className={cn("min-h-0", activeId ? "block" : "hidden md:block")}>
            {activeThread ? (
              <Conversation
                thread={activeThread}
                messages={messagesQuery.data ?? []}
                myId={myId}
                onSend={handleSend}
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
