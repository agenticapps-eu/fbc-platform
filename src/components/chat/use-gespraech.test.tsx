import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ChatMessage, ChatVerlaufSeite } from "../../lib/chat";

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

const fetchMessages =
  vi.fn<
    (threadId: string, opts?: { limit?: number; before?: string }) => Promise<ChatVerlaufSeite>
  >();

/** Eine vollständige Seite: alles geladen, nichts Älteres mehr da (AGE-655). */
const seite = (messages: ChatMessage[]): ChatVerlaufSeite => ({ messages, erschoepft: true });
const markThreadRead = vi.fn<(threadId: string, uid: string) => Promise<void>>();
const sendMessage =
  vi.fn<(input: { threadId: string; senderId: string; body: string }) => Promise<ChatMessage>>();

vi.mock("../../lib/chat", async (importOriginal) => {
  const echt = await importOriginal<typeof import("../../lib/chat")>();
  return {
    ...echt,
    fetchMessages: (threadId: string, opts?: { limit?: number; before?: string }) =>
      fetchMessages(threadId, opts),
    markThreadRead: (threadId: string, uid: string) => markThreadRead(threadId, uid),
    sendMessage: (input: { threadId: string; senderId: string; body: string }) =>
      sendMessage(input),
  };
});

const { useGespraech } = await import("./use-gespraech");
const { ToastProvider } = await import("../ui/Toast");
const { VERLAUF_SEITE, messagesQueryKey, verlaufErschoepftQueryKey } =
  await import("../../lib/chat");

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
  fetchMessages.mockResolvedValue(seite([]));
  markThreadRead.mockReset();
  markThreadRead.mockResolvedValue(undefined);
  sendMessage.mockReset();
});

describe("useGespraech — Verlauf", () => {
  it("lädt den Verlauf des Threads", async () => {
    fetchMessages.mockResolvedValue(seite([nachricht("a", "wer-anders")]));
    montiere(true);

    await waitFor(() => expect(stand().messages).toHaveLength(1));
    expect(fetchMessages).toHaveBeenCalledWith("t1", { limit: VERLAUF_SEITE });
  });

  it("lädt ihn AUCH, wenn das Gespräch nicht aktiv ist", async () => {
    // Ein minimiertes Fenster lädt trotzdem. Der tragende Grund ist der
    // Merge-Pfad des globalen Abos: es schreibt nur fort, was schon im Cache
    // liegt. Ohne Eintrag fielen alle Nachrichten weg, die während des
    // Minimiertseins eintreffen — und das Aufziehen zeigte einen Verlauf, dem
    // genau die neuen Zeilen fehlen.
    fetchMessages.mockResolvedValue(seite([nachricht("a", "wer-anders")]));
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
    fetchMessages.mockResolvedValue(seite([nachricht("a", "wer-anders")]));
    montiere(false);

    // Auf den geladenen Verlauf warten, sonst misst die Verneinung nur, dass
    // noch nichts passiert ist.
    await waitFor(() => expect(stand().messages).toHaveLength(1));
    expect(markThreadRead).not.toHaveBeenCalled();
  });

  it("rückt ihn beim Aufziehen nach — ein zweiter Aufruf, kein Neuladen", async () => {
    fetchMessages.mockResolvedValue(seite([nachricht("a", "wer-anders")]));
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
    fetchMessages.mockResolvedValue(
      seite([nachricht("a", "wer-anders"), nachricht("bb", ICH), nachricht("ccc", "wer-anders")]),
    );
    const { queryClient } = montiere(true);
    await waitFor(() => expect(markThreadRead).toHaveBeenCalledTimes(1));

    // Eine EIGENE Nachricht kommt dazu → kein weiterer Schreibvorgang.
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
    fetchMessages.mockResolvedValue(seite([nachricht("a", "wer-anders")]));
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

  // AGE-645. Die Ersetzung sitzt HIER und nicht in `Conversation.submit()`,
  // damit optimistische Blase und Datenbankzeile denselben String tragen —
  // strukturell, nicht per Konvention. Der Test prüft beide Seiten in EINEM
  // Lauf; genau das war der Befund aus der Plan-Review.
  it("ersetzt Emoticons, und zwar in der Blase UND im Insert", async () => {
    let aufloesen: ((m: ChatMessage) => void) | null = null;
    sendMessage.mockImplementation(
      () =>
        new Promise<ChatMessage>((res) => {
          aufloesen = res;
        }),
    );
    montiere(true);
    await waitFor(() => expect(stand().messages).toEqual([]));

    act(() => void stand().sende("Toll :-)."));
    await waitFor(() => expect(stand().messages).toHaveLength(1));

    // Die Blase, die das Mitglied sofort sieht.
    expect(stand().messages[0].body).toBe("Toll 🙂.");
    // Und der Text, der wirklich gespeichert wird.
    expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ body: "Toll 🙂." }));

    act(() => aufloesen!({ ...nachricht("echt", ICH, "Toll 🙂.") }));
    await waitFor(() => expect(stand().messages[0].pending).toBeUndefined());
  });
});

/**
 * AGE-655 — die Seitengrenze. Diese vier Zusagen kommen aus der Plan-Review; die
 * ersten beiden sind die HIGH-Befunde, an denen der erste Entwurf gescheitert
 * ist. Sie sind mit einer Mutations-Gegenprobe gemessen: ersetzt man die
 * Vereinigung durch ein Überschreiben bzw. die Sperrklinke durch eine einfache
 * Zuweisung, werden sie rot.
 */
describe("useGespraech — ältere Nachrichten nachladen", () => {
  const alt = (id: string) => ({
    ...nachricht(id, "wer-anders"),
    createdAt: `2026-07-0${id}T10:00:00Z`,
  });
  const neu = { ...nachricht("z", "wer-anders"), createdAt: "2026-08-01T10:00:00Z" };

  it("holt die Seite VOR der ältesten geladenen Nachricht", async () => {
    fetchMessages.mockResolvedValue({ messages: [neu], erschoepft: false });
    montiere(true);
    await waitFor(() => expect(stand().messages).toHaveLength(1));

    fetchMessages.mockResolvedValue({ messages: [alt("1")], erschoepft: true });
    await act(async () => await stand().ladeAeltere());

    expect(fetchMessages).toHaveBeenLastCalledWith("t1", { before: neu.createdAt });
    expect(stand().messages.map((m) => m.id)).toEqual(["1", "z"]);
  });

  // HIGH 1 aus der Plan-Review. React Query ERSETZT die Daten, wenn die
  // `queryFn` auflöst. Löst eine Abfrage, die vor dem Nachladen losgelaufen ist,
  // danach auf, nähme sie die nachgeladenen Zeilen wieder weg — und zwar
  // bevorzugt beim Eintreffen einer Nachricht, also genau im Fall, den die
  // Zusage sichern soll. Gemessen wird am ERGEBNIS, nicht an der Anfragegrösse.
  it("verliert nachgeladene Zeilen nicht an eine Abfrage, die vorher losgelaufen ist", async () => {
    let ersteAntwort!: (s: ChatVerlaufSeite) => void;
    fetchMessages.mockReturnValueOnce(
      new Promise<ChatVerlaufSeite>((res) => {
        ersteAntwort = res;
      }),
    );
    const { queryClient } = montiere(true);

    // Das Nachladen kommt an, während die erste Abfrage noch offen ist.
    queryClient.setQueryData(messagesQueryKey("t1"), [neu]);
    fetchMessages.mockResolvedValue({ messages: [alt("1")], erschoepft: true });
    await act(async () => await stand().ladeAeltere());
    expect(stand().messages).toHaveLength(2);

    // …und erst JETZT antwortet sie, mit nur der neuesten Seite.
    //
    // Die Antwort trägt eine Zeile, die noch NICHT im Cache steht. Ohne sie wäre
    // dieser Test ein Vakuumtest: `waitFor` wäre beim ersten Versuch grün — also
    // bevor die veraltete Antwort überhaupt schreibt — und bliebe auch dann
    // grün, wenn sie danach alles überschreibt. Gemessen mit der Mutation
    // „ersetzen statt vereinigen": ohne diese Positivkontrolle bleibt der Test
    // grün, mit ihr wird er rot.
    const spaeter = { ...nachricht("y", "wer-anders"), createdAt: "2026-08-02T10:00:00Z" };
    await act(async () => {
      ersteAntwort({ messages: [neu, spaeter], erschoepft: false });
    });

    // Erst warten, bis die veraltete Antwort NACHWEISLICH geschrieben hat …
    await waitFor(() => expect(stand().messages.map((m) => m.id)).toContain("y"));
    // … und dann prüfen, dass sie dabei nichts weggenommen hat.
    expect(stand().messages.map((m) => m.id)).toEqual(["1", "z", "y"]);
  });

  // HIGH 2. Ein vollständig geladener Thread fragt bei der Neuabfrage
  // `max(VERLAUF_SEITE, geladen)` an und bekommt genau so viele Zeilen zurück —
  // sein `erschoepft` ist dann schlicht nicht aussagekräftig und darf die schon
  // getroffene Feststellung nicht zurücknehmen.
  it("dreht eine gesetzte Sperrklinke nicht zurück", async () => {
    fetchMessages.mockResolvedValue({ messages: [neu], erschoepft: true });
    const { queryClient } = montiere(true);
    await waitFor(() => expect(stand().hatAeltere).toBe(false));

    await act(async () => {
      queryClient.setQueryData(messagesQueryKey("t1"), [neu]);
      fetchMessages.mockResolvedValue({ messages: [neu], erschoepft: false });
      await queryClient.refetchQueries({ queryKey: messagesQueryKey("t1") });
    });

    expect(queryClient.getQueryData(verlaufErschoepftQueryKey("t1"))).toBe(true);
    expect(stand().hatAeltere).toBe(false);
  });

  it("erzeugt beim Doppelklick keine doppelten Zeilen", async () => {
    fetchMessages.mockResolvedValue({ messages: [neu], erschoepft: false });
    montiere(true);
    await waitFor(() => expect(stand().messages).toHaveLength(1));

    fetchMessages.mockResolvedValue({ messages: [alt("1")], erschoepft: false });
    await act(async () => {
      await Promise.all([stand().ladeAeltere(), stand().ladeAeltere()]);
    });

    expect(stand().messages.map((m) => m.id)).toEqual(["1", "z"]);
  });

  it("bietet keinen Weg zu älteren an, wenn der Verlauf leer ist", async () => {
    fetchMessages.mockResolvedValue({ messages: [], erschoepft: false });
    montiere(true);
    await waitFor(() => expect(stand().isLoading).toBe(false));

    // Positivkontrolle daneben: mit Inhalt und unerschöpfter Seite steht er da.
    expect(stand().hatAeltere).toBe(false);
  });
});
