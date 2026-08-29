import type { QueryClientConfig } from "@tanstack/react-query";

/**
 * Wie aggressiv React Query nachlädt (AGE-642).
 *
 * Bis hierher lief `new QueryClient()` ohne Konfiguration, also auf den
 * Vorgaben der Bibliothek: `staleTime: 0` und `refetchOnWindowFocus: true`.
 * Im Browser ist das eine gute Wahl — ein Tabwechsel kostet nichts.
 *
 * **In einer WebView ist es eine andere Rechnung.** Der Focus-Manager von
 * React Query hängt an `visibilitychange`, und das feuert bei jedem
 * Zurückwechseln in die App. Mit `staleTime: 0` gilt dabei jede Abfrage sofort
 * als veraltet, also holt sie neu — über Mobilfunk, auch wenn jemand nur kurz
 * auf eine Nachricht geschaut hat.
 *
 * Deshalb nativ zwei Änderungen, und nur nativ (Donald, 28.08.: „nur nativ
 * zähmen, Web unverändert" — dieselbe Weiche wie beim Sitzungsspeicher):
 *
 * - **`refetchOnWindowFocus: false`.** Das Zurückwechseln allein löst nichts
 *   mehr aus. Der Preis ist kleiner, als er klingt: der Chat hängt an Realtime
 *   und bleibt aktuell, und jede *Navigation* montiert die Zielseite neu und
 *   holt dann ohnehin.
 * - **`staleTime: 30_000`.** Ohne eine Frist würde jede Neumontage sofort
 *   wieder laden, und die Ersparnis wäre auf den einen Fall zusammengeschrumpft,
 *   den `refetchOnWindowFocus` abdeckt.
 *
 * Bewusst NICHT angefasst: `refetchOnReconnect` bleibt auf der Vorgabe `true`.
 * Nach einem Funkloch ist Nachladen genau richtig, das ist der Fall, in dem die
 * Daten wirklich falsch sein können.
 */
export function queryVorgaben(nativ: boolean): QueryClientConfig {
  if (!nativ) return {};

  return {
    defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
  };
}
