import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import {
  fetchUnreadCounts,
  mergeMessage,
  messagesQueryKey,
  subscribeToAllMessages,
  threadsQueryKey,
  unreadQueryKey,
  type ChatMessage,
  type UngelesenStand,
} from "../../lib/chat";

/**
 * Der Ungelesen-Stand für alle drei Flächen: Kuvert in der Kopfzeile, Kachel auf
 * `/profil`, Markierung in der Thread-Liste (AGE-583).
 *
 * EIN Query-Schlüssel für alle drei. React Query bündelt gleiche Schlüssel, es
 * entsteht also trotz dreier Aufrufer eine Abfrage — und, was wichtiger ist,
 * die drei Flächen können nicht auseinanderlaufen. Genau das ist hier schon
 * einmal passiert, als eine Zahl und eine Liste Verschiedenes behaupteten.
 */
export function useUngelesen(uid: string | null): { stand: UngelesenStand; isError: boolean } {
  const { data, isError } = useQuery({
    // Der leere Schlüssel wird nie abgefragt (`enabled` unten) — er existiert
    // nur, weil useQuery einen braucht, bevor die Kennung feststeht.
    queryKey: unreadQueryKey(uid ?? ""),
    queryFn: fetchUnreadCounts,
    enabled: !!uid,
  });
  const leer: UngelesenStand = {
    gesamt: 0,
    jeThread: new Map(),
    hatUngelesen: () => false,
  };
  return { stand: data ?? leer, isError };
}

/** Wie lange nach der letzten eingehenden Nachricht gewartet wird, bevor neu
 *  gezählt wird. Ein Schwall von zehn Nachrichten löst so EINEN Aufruf aus,
 *  nicht zehn (Plan-Review, LOW). 400 ms bleiben unter der Schwelle, ab der
 *  eine Zahl „hängt". */
const ENTPRELLUNG_MS = 400;

/**
 * Hält den Zähler ohne Neuladen aktuell. Gehört an GENAU EINE Stelle — die
 * Anwendungshülle —, sonst öffnet jede Fläche ihren eigenen Kanal.
 *
 * Gefiltert wird über die RLS, nicht über einen Thread-Filter: der Zähler muss
 * auf jeder Seite stimmen, nicht nur im offenen Gespräch.
 *
 * `offenerPfad` ist der aktuelle Pfad, und er ist hier kein Beiwerk.
 *
 * **Aus der Diff-Review (opencode, MEDIUM):** dieselbe eingehende Nachricht
 * löst ZWEI Dinge aus — dieses Abo (entprellt, 400 ms) und, wenn das Gespräch
 * offen ist, das Vorrücken des Lesestands in `ChatPage`. Braucht der
 * Schreibvorgang länger als die Entprellung, landet die Neuabfrage ZUERST, mit
 * der Nachricht noch als ungelesen: die Blase springt auf 1 und wieder weg.
 * Genau das Zucken, das die Anforderung ausschliesst.
 *
 * Die Lösung braucht keinen geteilten Zustand, weil die Adresse ihn schon
 * trägt: welches Gespräch offen ist, steht in `/chat/:threadId`. Gehört die
 * Nachricht dorthin, überspringt dieses Abo die Neuabfrage — `ChatPage` fragt
 * ohnehin neu ab, und zwar NACH seinem Schreibvorgang.
 */
export function useUngelesenLive(
  uid: string | null,
  offenerPfad: string,
  /**
   * Threads, die dem Mitglied gerade in einem AUFGEZOGENEN Chatfenster
   * gegenüberliegen (AGE-639). Dieselbe Rolle wie `offenerPfad`, nur für die
   * zweite Art, ein Gespräch vor sich zu haben.
   *
   * **Erforderlich, nicht optional.** Ein Vorgabewert hätte den einen Aufrufer
   * stillschweigend beim alten Verhalten gelassen — und genau solche
   * Vorgabewerte entfernt später niemand mehr.
   */
  sichtbareThreads: ReadonlySet<string>,
): void {
  const queryClient = useQueryClient();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Über eine Ref, nicht über die Abhängigkeitsliste: sonst würde jeder
  // Seitenwechsel den Kanal abbauen und neu aufbauen.
  //
  // Und die Zuweisung steht in einem EFFECT, nicht im Rumpf: ein Ref während
  // des Renderns zu beschreiben ist unter Concurrent Rendering unsicher, weil
  // ein Rendern verworfen werden kann. Die ESLint-Regel hat es gemeldet.
  const pfad = useRef(offenerPfad);
  useEffect(() => {
    pfad.current = offenerPfad;
  }, [offenerPfad]);

  // Aus demselben Grund über eine Ref wie der Pfad: die Menge ändert sich mit
  // jedem geöffneten Fenster, und stünde sie in der Abhängigkeitsliste, baute
  // jedes Öffnen den Kanal ab und neu auf.
  const sichtbar = useRef(sichtbareThreads);
  useEffect(() => {
    sichtbar.current = sichtbareThreads;
  }, [sichtbareThreads]);

  useEffect(() => {
    if (!uid) return;
    const unsubscribe = subscribeToAllMessages((nachricht) => {
      // Zuerst zustellen, dann erst über das Zählen entscheiden (AGE-639).
      //
      // `prev ? … : prev` ist die ganze Logik: fortgeschrieben wird NUR ein
      // Cache-Eintrag, den es schon gibt — und den gibt es genau dann, wenn eine
      // Fläche diesen Thread gerade lädt oder zeigt. Dieser Rückruf weiss damit
      // nichts über Fenster, und es entsteht keine zweite Stelle, an der
      // „welche Gespräche sind offen?" beantwortet werden müsste.
      //
      // Auch für ein MINIMIERTES Fenster: es lädt seinen Verlauf, und ohne
      // diese Zeile fehlten ihm beim Aufziehen genau die Zeilen, die während
      // des Minimiertseins kamen.
      //
      // `ChatPage` hat daneben sein eigenes `subscribeToThread`. Das kostet
      // nichts: `mergeMessage` ist über die `id` idempotent.
      queryClient.setQueryData<ChatMessage[]>(messagesQueryKey(nachricht.threadId), (prev) =>
        prev ? mergeMessage(prev, nachricht) : prev,
      );

      if (pfad.current === `/chat/${nachricht.threadId}`) return;
      // Dieselbe Begründung wie beim Pfad: liegt das Gespräch aufgezogen vor
      // einem, rückt dessen eigener Lesestand ohnehin nach — und zwar NACH
      // seinem Schreibvorgang. Eine Neuzählung hier käme davor und liesse die
      // Blase auf 1 springen und zurückfallen.
      if (sichtbar.current.has(nachricht.threadId)) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: unreadQueryKey(uid) });
        // Und die Liste selbst (AGE-627). Ohne diese Zeile bewegte sich die
        // Blase an der Kopfzeile, während Vorschautext und Reihenfolge der
        // Unterhaltungen stehen blieben — eine Fläche, deren Zahl läuft und
        // deren Liste nicht, sieht kaputt aus. KEIN zweites Abo dafür:
        // `subscribeToAllMessages` baut den Kanalnamen mit `randomUUID()`, ein
        // zweiter Aufruf öffnete einen zweiten Kanal.
        void queryClient.invalidateQueries({ queryKey: threadsQueryKey(uid) });
      }, ENTPRELLUNG_MS);
    });
    return () => {
      // Der Zeitgeber wird MIT abgeräumt. Ohne das feuert eine Invalidierung
      // noch, nachdem die Hülle verschwunden ist — beim Abmelden also gegen
      // eine Sitzung, die es nicht mehr gibt.
      if (timer.current) clearTimeout(timer.current);
      unsubscribe();
    };
  }, [uid, queryClient]);
}
