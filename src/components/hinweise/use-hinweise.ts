import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import {
  fetchHinweise,
  hinweiseQueryKey,
  markiereAlleGelesen,
  markiereHinweisGelesen,
  type Hinweis,
} from "../../lib/hinweise";
import { supabase } from "../../lib/supabase";

/**
 * Die ungelesenen Hinweise des angemeldeten Mitglieds (AGE-620).
 *
 * Gefiltert wird ueber die RLS (`notifications_own`), nicht ueber ein
 * `eq("profile_id", uid)` — eine zweite, schwaechere Kopie derselben Bedingung
 * waere genau das Muster, das den Plan dieses Changes umgeworfen hat.
 */
export function useHinweise(uid: string | null): { hinweise: Hinweis[]; isError: boolean } {
  const { data, isError } = useQuery({
    queryKey: hinweiseQueryKey(uid ?? ""),
    queryFn: fetchHinweise,
    enabled: !!uid,
  });
  return { hinweise: data ?? [], isError };
}

/**
 * Markieren — einzeln und alles. Nach jedem Schreibvorgang wird neu abgefragt,
 * statt den Zwischenspeicher von Hand zu drehen: die Zahl an der Glocke und die
 * Liste darunter kommen aus DEMSELBEN Schluessel und koennen so nicht
 * auseinanderlaufen.
 */
export function useHinweisMarkieren(uid: string | null) {
  const queryClient = useQueryClient();
  const invalidieren = () => {
    void queryClient.invalidateQueries({ queryKey: hinweiseQueryKey(uid ?? "") });
  };

  const einzeln = useMutation({ mutationFn: markiereHinweisGelesen, onSuccess: invalidieren });
  const alle = useMutation({ mutationFn: markiereAlleGelesen, onSuccess: invalidieren });

  return {
    // Der ganze Hinweis, nicht seine Kennung: bei einer Nachricht steht der
    // Eintrag fuer alle ungelesenen Zeilen seines Fadens (AGE-641).
    markiere: (h: Hinweis) => einzeln.mutate(h),
    markiereAlle: () => alle.mutate(),
  };
}

/**
 * Haelt die Zahl ohne Neuladen aktuell. Gehoert an GENAU EINE Stelle — die
 * Anwendungshuelle —, sonst oeffnet jede Flaeche ihren eigenen Kanal.
 *
 * Der Themenname traegt eine Zufallskennung, und das ist keine Zierde: mit einem
 * FESTEN Namen gibt `channel()` beim zweiten Aufruf denselben, bereits
 * abonnierten Kanal zurueck, und `.on()` wirft. Das passiert bei jedem erneuten
 * Montieren — im Entwicklungsmodus schon beim ersten Rendern, im Browser nach
 * jedem Ab- und Anmelden. Der Zaehler waere danach dauerhaft tot, ohne dass
 * sichtbar etwas kaputtginge (gefunden in AGE-583).
 *
 * Keine Entprellung wie beim Nachrichten-Zaehler: dort loest ein Schwall von
 * zehn Nachrichten zehn Ereignisse aus. Ein Hinweis entsteht je Beitrag, Event,
 * Kommentar oder Like — die Rate ist um Groessenordnungen kleiner.
 */
export function useHinweiseLive(uid: string | null): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!uid) return;
    const kanal = supabase
      .channel(`hinweise:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        // Der Filter ist Komfort, keine Grenze — die RLS liefert ohnehin nur
        // eigene Zeilen. Er spart den Weckruf bei fremden Einfuegungen.
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `profile_id=eq.${uid}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: hinweiseQueryKey(uid) });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(kanal);
    };
  }, [uid, queryClient]);
}
