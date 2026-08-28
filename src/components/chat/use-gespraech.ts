import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import {
  VERLAUF_SEITE,
  fetchMessages,
  markThreadRead,
  mergeMessage,
  messagesQueryKey,
  sendMessage,
  threadsQueryKey,
  unreadQueryKey,
  vereinigeNachrichten,
  verlaufErschoepftQueryKey,
  type ChatMessage,
} from "../../lib/chat";
import { ersetzeEmoticons } from "../../lib/emoticons";
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
  /** Ob ein Weg zu älteren Nachrichten angeboten werden soll (AGE-655). */
  hatAeltere: boolean;
  /** Ob gerade eine ältere Seite geholt wird — sperrt den Knopf. */
  laedtAeltere: boolean;
  ladeAeltere: () => Promise<void>;
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
  const [laedtAeltere, setLaedtAeltere] = useState(false);

  /**
   * Setzt die Sperrklinke — und zwar nur in eine Richtung. Ein `false` aus einer
   * Neuabfrage darf ein früheres `true` nicht zurücknehmen: hat eine Neuabfrage
   * `max(VERLAUF_SEITE, geladen)` angefragt und genau so viele bekommen, ist ihr
   * `erschoepft` schlicht nicht aussagekräftig.
   */
  function merkeErschoepft(erschoepft: boolean) {
    if (!erschoepft) return;
    queryClient.setQueryData(verlaufErschoepftQueryKey(threadId), true);
  }

  const query = useQuery({
    queryKey: messagesQueryKey(threadId),
    /**
     * Lädt die neueste Seite — mindestens so viele Zeilen, wie schon sichtbar
     * sind — und gibt sie **vereinigt** mit dem aktuellen Stand zurück, statt
     * ihn zu ersetzen.
     *
     * Das Vereinigen ist der Kern und nicht Vorsicht. React Query ersetzt die
     * Daten, wenn die `queryFn` auflöst. Eine Abfrage, die vor einem „Ältere
     * laden" losgelaufen ist und danach antwortet, nähme die nachgeladenen
     * Zeilen wieder weg — und Anlässe dafür gibt es genug: `new QueryClient()`
     * (`src/main.tsx`) läuft auf `refetchOnWindowFocus: true` und
     * `staleTime: 0`, `use-ungelesen` invalidiert, StrictMode montiert doppelt.
     *
     * Der Stand wird **nach** dem Warten erneut gelesen, nicht der von vorhin
     * weiterverwendet: alles, was während des Holens dazukam, gehört dazu.
     */
    queryFn: async () => {
      const vorher = queryClient.getQueryData<ChatMessage[]>(messagesQueryKey(threadId)) ?? [];
      const seite = await fetchMessages(threadId, {
        limit: Math.max(VERLAUF_SEITE, vorher.length),
      });
      merkeErschoepft(seite.erschoepft);
      const inzwischen = queryClient.getQueryData<ChatMessage[]>(messagesQueryKey(threadId)) ?? [];
      return vereinigeNachrichten(inzwischen, seite.messages);
    },
    enabled: Boolean(threadId),
  });

  /**
   * Nur gelesen, nie geholt: diesen Eintrag beschreibt ausschliesslich
   * `setQueryData`. `initialData` **zusammen mit** `staleTime: Infinity` ist
   * dabei der Punkt, nicht Kosmetik — der Eintrag gilt damit als frisch, und die
   * `queryFn` läuft gar nicht erst.
   *
   * Eine `queryFn`, die `false` zurückgibt, war die erste Fassung, und der Test
   * „dreht eine gesetzte Sperrklinke nicht zurück" hat sie erlegt: sie löste
   * **nach** dem `merkeErschoepft(true)` der Nachrichtenabfrage auf und
   * überschrieb es. Derselbe Wettlauf, den die `queryFn` oben durch Vereinigen
   * vermeidet, nur eine Ebene tiefer.
   */
  const erschoepft = useQuery({
    queryKey: verlaufErschoepftQueryKey(threadId),
    queryFn: () => false,
    initialData: false,
    enabled: Boolean(threadId),
    staleTime: Infinity,
  }).data;

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

  async function sende(roherText: string) {
    if (!threadId || !myId) return;
    // Emoticons werden HIER ersetzt, nicht in der Sendezeile (AGE-645). Der
    // Grund ist nicht Bequemlichkeit: unten speisen sich die optimistische
    // Blase und der Insert aus DERSELBEN Variablen, die Gleichheit von
    // Angezeigtem und Gespeichertem ist damit strukturell. In
    // `Conversation.submit()` platziert, hinge sie daran, dass jeder Aufrufer
    // daran denkt — und `useGespraech` hat bereits zwei (`ChatPage`,
    // `ChatFenster`).
    const body = ersetzeEmoticons(roherText);
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

  /**
   * Holt die Seite VOR der ältesten geladenen Nachricht und vereinigt sie in
   * denselben Cache-Eintrag.
   *
   * Vereinigen statt Voranstellen, weil zwei Klicks kurz hintereinander dasselbe
   * `before` lesen und dieselbe Seite holen würden — vorangestellt ergäbe das
   * echte Duplikate mit gleicher `id` und gleichem React-Key. Die Sperre
   * daneben ist die Bedienung, die Vereinigung die Zusage; das eine ersetzt das
   * andere nicht.
   */
  async function ladeAeltere() {
    if (!threadId || laedtAeltere || erschoepft) return;
    const aktuell = queryClient.getQueryData<ChatMessage[]>(messagesQueryKey(threadId)) ?? [];
    const aelteste = aktuell[0];
    if (!aelteste) return;

    setLaedtAeltere(true);
    try {
      const seite = await fetchMessages(threadId, { before: aelteste.createdAt });
      queryClient.setQueryData<ChatMessage[]>(messagesQueryKey(threadId), (prev) =>
        vereinigeNachrichten(prev ?? [], seite.messages),
      );
      merkeErschoepft(seite.erschoepft);
    } catch (error) {
      // Ein fehlgeschlagenes Nachladen darf den sichtbaren Verlauf nicht kosten:
      // es wird nichts weggenommen, der Knopf bleibt stehen, das Mitglied kann
      // es erneut versuchen.
      toast({
        title: "Ältere Nachrichten nicht geladen",
        description: fehlertext(error),
        variant: "error",
      });
    } finally {
      setLaedtAeltere(false);
    }
  }

  return {
    messages,
    isLoading: query.isLoading,
    isError: query.isError,
    sende,
    hatAeltere: query.isSuccess && messages.length > 0 && !erschoepft,
    laedtAeltere,
    ladeAeltere,
  };
}
