import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ChatMessage } from "../../lib/chat";

/**
 * Ein Gespräch, eine Definition — für die Vollansicht und für ein Fenster
 * (AGE-639).
 *
 * Bis hierher lagen Verlauf, Lesestand und optimistisches Senden als rund
 * siebzig Zeilen in `ChatPage`. Ein zweites Gespräch daneben hätte sie kopiert,
 * und AGE-638 hat gerade erst aufgeräumt, was daraus wird: zwei Flächen, die
 * dasselbe tun sollen und es aus zwei Quelltexten tun, laufen auseinander.
 *
 * **Was hier NICHT geprüft wird:** das Realtime-Abo. Es bleibt, wo es ist —
 * `subscribeToThread` in `ChatPage` und das eine globale Abo in der Hülle. Der
 * Hook liest und schreibt nur den Cache, den beide bedienen.
 */

const fetchMessages = vi.fn<(threadId: string) => Promise<ChatMessage[]>>();
const markThreadRead = vi.fn<(threadId: string, uid: string) => Promise<void>>();
const sendMessage =
  vi.fn<(input: { threadId: string; senderId: string; body: string }) => Promise<ChatMessage>>();

vi.mock("../../lib/chat", async (importOriginal) => {
  const echt = await importOriginal<typeof import("../../lib/chat")>();
  return {
    ...echt,
    fetchMessages: (threadId: string) => fetchMessages(threadId),
    markThreadRead: (threadId: string, uid: string) => markThreadRead(threadId, uid),
    sendMessage: (input: { threadId: string; senderId: string; body: string }) =>
      sendMessage(input),
  };
});

const { useGespraech } = await import("./use-gespraech");
const { ToastProvider } = await import("../ui/Toast");

const ICH = "ich";

function nachricht(id: string, senderId: string, body = `Text ${id}`): ChatMessage {
  return {
    id,
    threadId: "t1",
    senderId,
    body,
    createdAt: `2026-08-01T10:0${id.length}:00Z`,
  };
}

/** `renderHook` mit `wrapper` statt einer eigenen Sonde: eine äussere Variable
 *  **während des Renderns** zu beschreiben ist ein Nebeneffekt, und unter
 *  Concurrent Rendering kann ein Anstrich verworfen werden. Die ESLint-Regel
 *  `react-hooks/globals` hat auf die erste Fassung gezeigt. */
type Stand = ReturnType<typeof useGespraech>;
let hook: { result: { current: Stand }; rerender: (props: { aktiv: boolean }) => void };
const stand = () => hook.result.current;

function montiere(aktiv: boolean, threadId = "t1") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  hook = renderHook(
    ({ aktiv }: { aktiv: boolean }) => useGespraech({ threadId, myId: ICH, aktiv }),
    {
      initialProps: { aktiv },
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          <ToastProvider>{children}</ToastProvider>
        </QueryClientProvider>
      ),
    },
  );
  return { ...hook, queryClient };
}

beforeEach(() => {
  fetchMessages.mockReset();
  fetchMessages.mockResolvedValue([]);
  markThreadRead.mockReset();
  markThreadRead.mockResolvedValue(undefined);
  sendMessage.mockReset();
});

describe("useGespraech — Verlauf", () => {
  it("lädt den Verlauf des Threads", async () => {
    fetchMessages.mockResolvedValue([nachricht("a", "wer-anders")]);
    montiere(true);

    await waitFor(() => expect(stand().messages).toHaveLength(1));
    expect(fetchMessages).toHaveBeenCalledWith("t1");
  });

  it("lädt ihn AUCH, wenn das Gespräch nicht aktiv ist", async () => {
    // Ein minimiertes Fenster lädt trotzdem. Der tragende Grund ist der
    // Merge-Pfad des globalen Abos: es schreibt nur fort, was schon im Cache
    // liegt. Ohne Eintrag fielen alle Nachrichten weg, die während des
    // Minimiertseins eintreffen — und das Aufziehen zeigte einen Verlauf, dem
    // genau die neuen Zeilen fehlen.
    fetchMessages.mockResolvedValue([nachricht("a", "wer-anders")]);
    montiere(false);

    await waitFor(() => expect(stand().messages).toHaveLength(1));
  });

  it("meldet einen Fehlschlag als Fehler, nicht als Leere", async () => {
    fetchMessages.mockRejectedValue(new Error("kaputt"));
    montiere(true);

    await waitFor(() => expect(stand().isError).toBe(true));
    // Positivkontrolle zur Verneinung: ohne sie wäre der Test auch grün, wenn
    // der Hook gar nichts täte.
    expect(stand().messages).toEqual([]);
  });
});

describe("useGespraech — Lesestand", () => {
  it("rückt ihn vor, wenn das Gespräch aktiv ist", async () => {
    montiere(true);
    await waitFor(() => expect(markThreadRead).toHaveBeenCalledWith("t1", ICH));
  });

  it("rückt ihn NICHT vor, wenn es das nicht ist", async () => {
    fetchMessages.mockResolvedValue([nachricht("a", "wer-anders")]);
    montiere(false);

    // Auf den geladenen Verlauf warten, sonst misst die Verneinung nur, dass
    // noch nichts passiert ist.
    await waitFor(() => expect(stand().messages).toHaveLength(1));
    expect(markThreadRead).not.toHaveBeenCalled();
  });

  it("rückt ihn beim Aufziehen nach — ein zweiter Aufruf, kein Neuladen", async () => {
    fetchMessages.mockResolvedValue([nachricht("a", "wer-anders")]);
    const { rerender } = montiere(false);
    await waitFor(() => expect(stand().messages).toHaveLength(1));
    expect(markThreadRead).not.toHaveBeenCalled();

    act(() => rerender({ aktiv: true }));

    await waitFor(() => expect(markThreadRead).toHaveBeenCalledTimes(1));
    // Der Verlauf wird NICHT erneut geholt: er lag schon im Cache.
    expect(fetchMessages).toHaveBeenCalledTimes(1);
  });

  it("schreibt je EINGEHENDER FREMDER Nachricht, nicht je Zeile und nicht beim eigenen Senden", async () => {
    // Das ist der Messpunkt, den die Plan-Review verlangt hat: die Behauptung
    // „gleich viele Schreibvorgänge wie vorher" ist sonst eine Behauptung.
    //
    // Drei Zeilen auf einmal beim Öffnen → EIN Schreibvorgang. Genau wie der
    // Effect an `activeId` es in `ChatPage` bisher tat.
    fetchMessages.mockResolvedValue([
      nachricht("a", "wer-anders"),
      nachricht("bb", ICH),
      nachricht("ccc", "wer-anders"),
    ]);
    const { queryClient } = montiere(true);
    await waitFor(() => expect(markThreadRead).toHaveBeenCalledTimes(1));

    // Eine EIGENE Nachricht kommt dazu → kein weiterer Schreibvorgang.
    const { messagesQueryKey } = await import("../../lib/chat");
    act(() => {
      queryClient.setQueryData<ChatMessage[]>(messagesQueryKey("t1"), (prev) => [
        ...(prev ?? []),
        nachricht("dddd", ICH),
      ]);
    });
    await waitFor(() => expect(stand().messages).toHaveLength(4));
    expect(markThreadRead).toHaveBeenCalledTimes(1);

    // Eine FREMDE kommt dazu → genau einer.
    act(() => {
      queryClient.setQueryData<ChatMessage[]>(messagesQueryKey("t1"), (prev) => [
        ...(prev ?? []),
        nachricht("eeeee", "wer-anders"),
      ]);
    });
    await waitFor(() => expect(markThreadRead).toHaveBeenCalledTimes(2));
  });

  it("überlebt einen Fehlschlag beim Markieren", async () => {
    markThreadRead.mockRejectedValue(new Error("42501"));
    fetchMessages.mockResolvedValue([nachricht("a", "wer-anders")]);
    montiere(true);

    // Das Gespräch darf nicht an seiner Buchführung scheitern.
    await waitFor(() => expect(stand().messages).toHaveLength(1));
    expect(stand().isError).toBe(false);
  });
});

describe("useGespraech — Senden", () => {
  it("zeigt die Blase sofort und ersetzt sie durch die echte Zeile", async () => {
    let aufloesen: ((m: ChatMessage) => void) | null = null;
    sendMessage.mockImplementation(
      () =>
        new Promise<ChatMessage>((res) => {
          aufloesen = res;
        }),
    );
    montiere(true);
    await waitFor(() => expect(stand().messages).toEqual([]));

    act(() => void stand().sende("Servus"));
    await waitFor(() => expect(stand().messages).toHaveLength(1));
    expect(stand().messages[0].pending).toBe(true);
    expect(stand().messages[0].body).toBe("Servus");

    act(() => aufloesen!({ ...nachricht("echt", ICH, "Servus") }));
    await waitFor(() => expect(stand().messages[0].pending).toBeUndefined());
    expect(stand().messages).toHaveLength(1);
  });

  it("nimmt die Blase bei einem Fehlschlag zurück", async () => {
    sendMessage.mockRejectedValue(new Error("Kontakt nicht mehr freigegeben"));
    montiere(true);
    await waitFor(() => expect(stand().messages).toEqual([]));

    await act(async () => {
      await stand().sende("Geht nicht");
    });

    expect(stand().messages).toEqual([]);
  });

  it("sendet nichts ohne Thread oder ohne Kennung", async () => {
    montiere(true, "");
    await act(async () => {
      await stand().sende("ins Leere");
    });
    expect(sendMessage).not.toHaveBeenCalled();
  });
});
