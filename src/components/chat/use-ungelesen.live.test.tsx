import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Das eine globale Abo hält BEIDES aktuell (AGE-627, Band 3).
 *
 * Vorher invalidierte `useUngelesenLive` nur den Zähler. Der sichtbare Fehler
 * wäre gewesen: die Blase an der Kopfzeile bewegt sich, Vorschautext und
 * Reihenfolge der Unterhaltungsliste bleiben stehen. Ein Panel, dessen Zahl
 * läuft und dessen Liste nicht, sieht kaputt aus — und ist es auch.
 *
 * **Kein zweites Abo.** `subscribeToAllMessages` baut den Kanalnamen mit
 * `crypto.randomUUID()` (`chat.ts:206`); ein zweiter Aufruf macht ausdrücklich
 * einen ZWEITEN Kanal auf. Deshalb steht hier die Zusage „genau eines über die
 * ganze Lebensdauer" als eigener Test, und zwar über einen Pfadwechsel hinweg —
 * genau der Fall, den die Ref im Hook abfängt.
 */

let beiNachricht: ((n: { threadId: string; senderId: string }) => void) | null = null;
const abbestellen = vi.fn();
const abonnieren = vi.fn((cb: (n: { threadId: string; senderId: string }) => void) => {
  beiNachricht = cb;
  return abbestellen;
});

vi.mock("../../lib/chat", async (original) => ({
  ...(await original<typeof import("../../lib/chat")>()),
  subscribeToAllMessages: (cb: (n: { threadId: string; senderId: string }) => void) =>
    abonnieren(cb),
}));

const { useUngelesenLive } = await import("./use-ungelesen");
const { threadsQueryKey, unreadQueryKey } = await import("../../lib/chat");

const UID = "test-user";

function Huelle({ pfad }: { pfad: string }) {
  useUngelesenLive(UID, pfad);
  return null;
}

function renderHook(pfad = "/aktivitaet") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidiert = vi.spyOn(queryClient, "invalidateQueries");
  const ergebnis = render(
    <QueryClientProvider client={queryClient}>
      <Huelle pfad={pfad} />
    </QueryClientProvider>,
  );
  return { ...ergebnis, invalidiert, queryClient };
}

/** Die Schlüssel, die nach dem Entprellen invalidiert wurden. */
function schluessel(invalidiert: { mock: { calls: unknown[][] } }) {
  return invalidiert.mock.calls.map((c) =>
    JSON.stringify((c[0] as { queryKey: unknown }).queryKey),
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  abonnieren.mockClear();
  abbestellen.mockClear();
  beiNachricht = null;
});
afterEach(() => {
  vi.useRealTimers();
});

describe("useUngelesenLive — ein Abo, zwei Schlüssel", () => {
  it("invalidiert bei einer eingehenden Nachricht Zähler UND Threads-Seite", () => {
    const { invalidiert } = renderHook();

    act(() => beiNachricht!({ threadId: "t1", senderId: "wer-anders" }));
    act(() => void vi.advanceTimersByTime(500));

    expect(schluessel(invalidiert)).toEqual(
      expect.arrayContaining([
        JSON.stringify(unreadQueryKey(UID)),
        JSON.stringify(threadsQueryKey(UID)),
      ]),
    );
  });

  it("überspringt beides, wenn das Gespräch gerade offen ist", () => {
    // Positivkontrolle zur Zusage oben: hier fällt dieselbe Nachricht in den
    // offenen Pfad, und dann fragt `ChatPage` ohnehin neu ab — NACH seinem
    // Schreibvorgang. Ohne diesen Test wäre „invalidiert" von „invalidiert
    // immer" nicht zu trennen.
    const { invalidiert } = renderHook("/chat/t1");

    act(() => beiNachricht!({ threadId: "t1", senderId: "wer-anders" }));
    act(() => void vi.advanceTimersByTime(500));

    expect(schluessel(invalidiert)).toEqual([]);
  });

  it("öffnet über die ganze Lebensdauer genau EIN Abo, auch über Pfadwechsel", () => {
    // DERSELBE QueryClient über den Pfadwechsel hinweg — ein neuer stünde in
    // der Abhängigkeitsliste des Effects und löste ein Neu-Abonnieren aus, das
    // mit dem Pfad nichts zu tun hätte. Der Test misst den Pfad, nicht ihn.
    const { rerender, unmount, queryClient } = renderHook("/aktivitaet");
    rerender(
      <QueryClientProvider client={queryClient}>
        <Huelle pfad="/mitglieder" />
      </QueryClientProvider>,
    );

    expect(abonnieren).toHaveBeenCalledTimes(1);
    unmount();
    expect(abbestellen).toHaveBeenCalledTimes(1);
  });
});
