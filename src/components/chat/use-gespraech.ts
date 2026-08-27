import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import {
  fetchMessages,
  markThreadRead,
  mergeMessage,
  messagesQueryKey,
  sendMessage,
  threadsQueryKey,
  unreadQueryKey,
  type ChatMessage,
} from "../../lib/chat";
import { useToast } from "../ui/toast-context";

/**
 * EIN Gespräch — für die Vollansicht `/chat/:threadId` und für ein angedocktes
 * Chatfenster (AGE-639).
 *
 * Bis zu diesem Change lagen Verlauf, Lesestand und optimistisches Senden als
 * rund siebzig Zeilen in `ChatPage`. Ein Fenster daneben hätte sie kopiert, und
 * AGE-638 hat gerade erst aufgeräumt, was daraus wird: zwei Flächen, die
 * dasselbe tun sollen und es aus zwei Quelltexten tun, laufen auseinander. Das
 * ist auch die Hausregel dieses Moduls — `useThreadsSeite` und `useUngelesen`
 * existieren aus genau demselben Grund.
 *
 * **Was hier NICHT liegt: das Realtime-Abo.** `ChatPage` behält sein
 * `subscribeToThread`, die Fenster hängen am einen globalen Abo der Hülle.
 * Dieser Hook liest und schreibt nur den Cache, den beide bedienen — er ist
 * damit von der Frage unabhängig, über welche Leitung eine Nachricht kam.
 */
export interface Gespraech {
  messages: ChatMessage[];
  isLoading: boolean;
  isError: boolean;
  sende: (body: string) => Promise<void>;
}

function fehlertext(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "Unbekannter Fehler.";
}

export function useGespraech({
  threadId,
  myId,
  /**
   * Ob das Gespräch dem Mitglied gerade GEGENÜBERLIEGT. Steuert **nur** den
   * Lesestand, nicht das Laden: ein minimiertes Fenster ruft mit `false` auf
   * und lädt seinen Verlauf trotzdem.
   *
   * Der Grund fürs Laden ist nicht der Zähler an seiner Titelzeile — der kommt
   * aus `unread_message_counts()` und steht unabhängig davon. Er ist der
   * Merge-Pfad des globalen Abos: das schreibt nur fort, was schon im Cache
   * liegt. Ohne Eintrag fiele jede Nachricht weg, die während des
   * Minimiertseins eintrifft, und das Aufziehen zeigte einen Verlauf, dem genau
   * die neuen Zeilen fehlen.
   */
  aktiv,
}: {
  threadId: string;
  myId: string;
  aktiv: boolean;
}): Gespraech {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: messagesQueryKey(threadId),
    queryFn: () => fetchMessages(threadId),
    enabled: Boolean(threadId),
  });

  const messages = query.data ?? [];

  // Der Lesestand hängt an der letzten FREMDEN Nachricht, und das ist der Punkt,
  // an dem dieser Hook zwei Stellen aus `ChatPage` zu einer macht: dort stand
  // ein Effect an `activeId` (Öffnen) und ein zweiter Aufruf im Realtime-Abo
  // (je eingehender fremder Zeile).
  //
  // Die Zahl der Schreibvorgänge bleibt dieselbe, und `use-gespraech.test.tsx`
  // zählt sie: drei Zeilen beim Öffnen ergeben EINEN Aufruf, eine eigene
  // Nachricht KEINEN, eine fremde genau einen.
  //
  // **Diese Messung gilt für den Hook allein**, und das war beim ersten Mal zu
  // wenig: `ChatPage` markierte in seinem eigenen Realtime-Abo weiter mit, also
  // schrieb dort jede eingehende Fremdzeile ZWEIMAL. Die Diff-Review (opencode,
  // HIGH) hat es gefunden. Der doppelte Aufruf ist entfallen — der Lesestand
  // der Vollansicht kommt seitdem ausschliesslich von hier.
  //
  // Eine Abhängigkeit an `messages.length` täte das nicht: sie zählte die eigene
  // Nachricht mit, und beim Öffnen eines Gesprächs mit dreissig Zeilen bliebe es
  // trotzdem bei einem Aufruf — sie ist nicht falsch, aber sie misst die falsche
  // Sache und wird beim nächsten Umbau zur Falle.
  //
  // `isSuccess` in der Bedingung ist NICHT Vorsicht, sondern der Unterschied
  // zwischen einem und zwei Schreibvorgängen — und der Test hat es gefunden,
  // nicht das Nachdenken. Ohne ihn läuft der Effect zweimal: einmal auf dem
  // ersten Anstrich, wo `letzteFremde` noch `undefined` ist, und einmal, wenn
  // der Verlauf da ist und sich der Wert ändert.
  //
  // Nebenwirkung, und zwar die richtige Richtung: scheitert das Laden, wird
  // NICHT als gelesen markiert. `ChatPage` tat das bisher trotzdem — es setzte
  // den Lesestand auf ein Gespräch, dessen Inhalt es dem Mitglied gar nicht
  // zeigen konnte, und der Zähler zeigte danach nicht mehr darauf.
  const letzteFremde = messages.findLast((m) => m.senderId !== myId)?.id;
  useEffect(() => {
    if (!threadId || !myId || !aktiv || !query.isSuccess) return;
    void markThreadRead(threadId, myId)
      .then(() => queryClient.invalidateQueries({ queryKey: unreadQueryKey(myId) }))
      // Ein fehlgeschlagenes Markieren darf das Gespräch nicht kosten. Es bleibt
      // ungelesen, der Zähler zeigt weiter darauf — der sichere Ausgang.
      .catch(() => {});
  }, [threadId, myId, aktiv, letzteFremde, query.isSuccess, queryClient]);

  async function sende(body: string) {
    if (!threadId || !myId) return;
    const optimistic: ChatMessage = {
      id: `optimistic-${crypto.randomUUID()}`,
      threadId,
      senderId: myId,
      body,
      createdAt: new Date().toISOString(),
      pending: true,
    };
    queryClient.setQueryData<ChatMessage[]>(messagesQueryKey(threadId), (prev) => [
      ...(prev ?? []),
      optimistic,
    ]);

    try {
      const echt = await sendMessage({ threadId, senderId: myId, body });
      // Die echte Zeile gleicht die optimistische Blase ab; das Realtime-Echo
      // bleibt darüber idempotent.
      queryClient.setQueryData<ChatMessage[]>(messagesQueryKey(threadId), (prev) =>
        mergeMessage(prev ?? [], echt),
      );
      void queryClient.invalidateQueries({ queryKey: threadsQueryKey(myId) });
    } catch (error) {
      queryClient.setQueryData<ChatMessage[]>(messagesQueryKey(threadId), (prev) =>
        (prev ?? []).filter((m) => m.id !== optimistic.id),
      );
      toast({
        title: "Nachricht nicht gesendet",
        description: fehlertext(error),
        variant: "error",
      });
    }
  }

  return { messages, isLoading: query.isLoading, isError: query.isError, sende };
}
