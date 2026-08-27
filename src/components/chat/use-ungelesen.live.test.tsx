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

type Eingang = { threadId: string; senderId: string; id?: string; body?: string };

let beiNachricht: ((n: Eingang) => void) | null = null;
const abbestellen = vi.fn();
const abonnieren = vi.fn((cb: (n: Eingang) => void) => {
  beiNachricht = cb;
  return abbestellen;
});

vi.mock("../../lib/chat", async (original) => ({
  ...(await original<typeof import("../../lib/chat")>()),
  subscribeToAllMessages: (cb: (n: Eingang) => void) => abonnieren(cb),
}));

const { useUngelesenLive } = await import("./use-ungelesen");
const { messagesQueryKey, threadsQueryKey, unreadQueryKey } = await import("../../lib/chat");
type ChatMessage = import("../../lib/chat").ChatMessage;

const UID = "test-user";
const KEINE: ReadonlySet<string> = new Set();

function Huelle({ pfad, sichtbar = KEINE }: { pfad: string; sichtbar?: ReadonlySet<string> }) {
  useUngelesenLive(UID, pfad, sichtbar);
  return null;
}

function renderHook(pfad = "/aktivitaet", sichtbar: ReadonlySet<string> = KEINE) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidiert = vi.spyOn(queryClient, "invalidateQueries");
  const ergebnis = render(
    <QueryClientProvider client={queryClient}>
      <Huelle pfad={pfad} sichtbar={sichtbar} />
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

describe("useUngelesenLive — die angedockten Chatfenster (AGE-639)", () => {
  const eingang: Eingang = {
    id: "m-neu",
    threadId: "t1",
    senderId: "wer-anders",
    body: "frisch",
  };

  it("stellt in einen VORHANDENEN Verlauf zu — ohne einen zweiten Kanal", () => {
    // DIE Zusage des Changes: drei offene Fenster halten dieselbe Zahl von
    // Abos wie null offene. Ein Abo je Fenster wäre der naheliegende Weg
    // gewesen, und `chat.ts:207` warnt ausdrücklich davor.
    const { queryClient } = renderHook();
    queryClient.setQueryData<ChatMessage[]>(messagesQueryKey("t1"), []);

    act(() => beiNachricht!(eingang));

    expect(queryClient.getQueryData<ChatMessage[]>(messagesQueryKey("t1"))).toHaveLength(1);
    expect(abonnieren).toHaveBeenCalledTimes(1);
  });

  it("legt für einen Thread, den niemand zeigt, KEINEN Verlauf an", () => {
    // `prev ? … : prev`. Sonst füllte jede eingehende Nachricht den Cache mit
    // Verläufen, die keine Fläche je abruft.
    const { queryClient } = renderHook();

    act(() => beiNachricht!(eingang));

    expect(queryClient.getQueryData(messagesQueryKey("t1"))).toBeUndefined();
  });

  it("überspringt die Neuzählung für ein AUFGEZOGENES Fenster", () => {
    // Sonst springt die Blase auf 1 und fällt beim nächsten Abgleich zurück —
    // dasselbe Zucken, gegen das die Pfad-Bedingung gebaut ist.
    const { invalidiert } = renderHook("/mitglieder", new Set(["t1"]));

    act(() => beiNachricht!(eingang));
    act(() => void vi.advanceTimersByTime(500));

    expect(schluessel(invalidiert)).toEqual([]);
  });

  it("zählt für ein MINIMIERTES Fenster sehr wohl neu", () => {
    // Die Positivkontrolle zur Zeile darüber, und zugleich die Zusage selbst:
    // ein minimiertes Gespräch ist nicht gelesen worden. Es steht nicht in der
    // Menge — die Hülle nimmt nur die aufgezogenen auf.
    const { invalidiert } = renderHook("/mitglieder", KEINE);

    act(() => beiNachricht!(eingang));
    act(() => void vi.advanceTimersByTime(500));

    expect(schluessel(invalidiert)).toEqual(
      expect.arrayContaining([JSON.stringify(unreadQueryKey(UID))]),
    );
  });

  it("baut den Kanal NICHT neu auf, wenn ein Fenster aufgeht", () => {
    // Die Menge liegt in einer Ref, nicht in der Abhängigkeitsliste. Stünde sie
    // dort, kostete jedes geöffnete Fenster einen Kanalwechsel — und ein neuer
    // Kanal heisst hier eine Lücke, in der nichts ankommt.
    const { rerender, queryClient } = renderHook("/mitglieder", KEINE);
    rerender(
      <QueryClientProvider client={queryClient}>
        <Huelle pfad="/mitglieder" sichtbar={new Set(["t1"])} />
      </QueryClientProvider>,
    );

    expect(abonnieren).toHaveBeenCalledTimes(1);

    // Und die neue Menge WIRKT trotzdem — ohne diese Zeile wäre der Test auch
    // grün, wenn die Ref nie nachgeführt würde.
    const { invalidiert } = { invalidiert: vi.spyOn(queryClient, "invalidateQueries") };
    act(() => beiNachricht!(eingang));
    act(() => void vi.advanceTimersByTime(500));
    expect(schluessel(invalidiert)).toEqual([]);
  });
});
