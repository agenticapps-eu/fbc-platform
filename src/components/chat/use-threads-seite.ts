import { useInfiniteQuery } from "@tanstack/react-query";

import { fetchThreads, threadsQueryKey } from "../../lib/chat";

/**
 * Die Unterhaltungsliste — EINE Definition für beide Flächen (AGE-627).
 *
 * `/chat` und die stehende Leiste rufen diesen Hook mit demselben Schlüssel auf.
 * React Query bündelt sie damit auf einen Cache-Eintrag samt `{pages,
 * pageParams}`: was die eine nachlädt, hat die andere. „Eine Datenquelle, ein
 * Umfang" ist so eine Eigenschaft des Caches und keine Verabredung zwischen
 * zwei Komponenten — und genau das war der Widerspruch, den beide Plan-Reviewer
 * unabhängig voneinander gefunden haben.
 *
 * Eine eingeklappte Leiste darf **nichts** abfragen — sie zeigt nur den Zähler,
 * und den führt `useUngelesen` ohnehin getrennt. Das steht hier bewusst NICHT
 * als Schalter: die Hülle montiert das Panel gar nicht erst, solange es
 * eingeklappt oder unter `lg` verborgen ist. Ein Schalter wäre eine zweite
 * Stelle, an der dieselbe Bedingung stehen müsste.
 */
export function useThreadsSeite(uid: string | null) {
  return useInfiniteQuery({
    // Der leere Schlüssel wird nie abgefragt (`enabled` unten) — er existiert
    // nur, weil useInfiniteQuery einen braucht, bevor die Kennung feststeht.
    queryKey: threadsQueryKey(uid ?? ""),
    queryFn: ({ pageParam }) => fetchThreads(uid!, { offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (letzteSeite) => letzteSeite.nextOffset,
    enabled: Boolean(uid),
  });
}
