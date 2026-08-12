import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../providers/auth-context";
import { coverSignaturKey, signEventCovers, SIGNATUR_STALE_MS } from "../../lib/event-cover";
import type { EventListItem } from "../../lib/events";

/**
 * Signierte URLs für die Titelbilder einer Liste von Events — in EINEM Aufruf.
 *
 * Der Grund, warum das ein Haken ist und keine Abfrage je Kachel: eine
 * Übersicht mit zwölf Kacheln machte sonst zwölf Signieranfragen. Der
 * Storage-Endpunkt nimmt eine Pfadliste entgegen, also nimmt er sie auch.
 *
 * Der Schlüssel hängt am PRINCIPAL: welche Cover sich signieren lassen,
 * entscheidet `event_cover_lesbar` anhand von `auth.uid()`. Ohne die uid im
 * Schlüssel bekäme der nächste Betrachter die Antwort des vorigen.
 *
 * Fehlt ein Pfad im Ergebnis, zeigt die Kachel ihren Platzhalter — das ist der
 * Normalfall für ein Event, dessen Bild der Betrachter nicht sehen darf, und
 * kein Fehler. Ein Fehlschlag der ganzen Abfrage nimmt nur die Bilder mit, nie
 * die Liste.
 */
export function useEventCovers(events: EventListItem[]): Record<string, string> {
  const { user } = useAuth();
  const pfade = [...new Set(events.map((e) => e.coverPath).filter((p): p is string => !!p))];
  const { data } = useQuery({
    queryKey: coverSignaturKey(user?.id ?? null, pfade),
    queryFn: () => signEventCovers(pfade),
    enabled: pfade.length > 0,
    staleTime: SIGNATUR_STALE_MS,
  });
  return data ?? {};
}
