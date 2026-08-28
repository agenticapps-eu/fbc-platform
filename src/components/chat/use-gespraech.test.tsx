import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ChatMessage, ChatVerlaufCursor, ChatVerlaufSeite } from "../../lib/chat";

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
    (
      threadId: string,
      opts?: { limit?: number; before?: ChatVerlaufCursor },
    ) => Promise<ChatVerlaufSeite>
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
    fetchMessages: (threadId: string, opts?: { limit?: number; before?: ChatVerlaufCursor }) =>
      fetchMessages(threadId, opts),
    markThreadRead: (threadId: string, uid: string) => markThreadRead(threadId, uid),
    sendMessage: (input: { threadId: string; senderId: string; body: string }) =>
      sendMessage(input),
  };
});

const { useGespraech } = await import("./use-gespraech");
const { ToastProvider } = await import("../ui/Toast");
const { VERLAUF_SEITE, messagesQueryKey } = await import("../../lib/chat");

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

    // Der Cursor geht über ZWEI Spalten — `created_at` allein ist keine totale
    // Ordnung, und ein Cursor auf der halben Ordnung überspringt bei Gleichstand
    // Zeilen, die danach nie wieder erreichbar sind (Diff-Review).
    expect(fetchMessages).toHaveBeenLastCalledWith("t1", {
      before: { createdAt: neu.createdAt, id: neu.id },
    });
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
    await act(async () => {
      ersteAntwort({ messages: [neu], erschoepft: false });
    });

    // Sie nimmt die nachgeladene Zeile nicht weg.
    expect(stand().messages.map((m) => m.id)).toEqual(["1", "z"]);
    // Beide Wege sind wirklich gelaufen — sonst prüfte die Zusage oben einen
    // Zustand, den niemand angetastet hat.
    expect(fetchMessages).toHaveBeenCalledTimes(2);
  });

  // Was von HIGH 2 der Plan-Review geblieben ist — und was NICHT.
  //
  // Der Befund war: eine Neuabfrage darf die Feststellung „nichts Älteres mehr"
  // nicht versehentlich zurücknehmen. Die Antwort darauf war zwei Fassungen lang
  // eine Sperrklinke, die einmal gesetzt nie zurückfiel. Beide Begründungen
  // dafür haben die Diff-Reviewer widerlegt (siehe `use-gespraech.ts`), und die
  // Klinke hatte einen Fehlerfall, der NICHT heilt.
  //
  // Geblieben ist der einfache Wert — und die Zusage, die wirklich zählt: die
  // `limit + 1`-Sonde macht `erschoepft` unabhängig davon, wie gross die
  // Neuabfrage angefragt hat. Genau das misst dieser Test, und zwar in der
  // Konstellation aus dem Befund: alles geladen, Neuabfrage fragt
  // `max(VERLAUF_SEITE, geladen)` an.
  it("bleibt erschöpft, wenn eine Neuabfrage genau so viele Zeilen zurückgibt wie geladen", async () => {
    fetchMessages.mockResolvedValue({ messages: [alt("1"), neu], erschoepft: true });
    const { queryClient } = montiere(true);
    await waitFor(() => expect(stand().messages).toHaveLength(2));
    expect(stand().hatAeltere).toBe(false);

    // Die Neuabfrage sieht dieselben zwei Zeilen. Die Sonde hat nichts
    // Überzähliges gefunden, also bleibt `erschoepft` wahr — ohne Klinke.
    await act(async () => {
      await queryClient.refetchQueries({ queryKey: messagesQueryKey("t1") });
    });

    expect(fetchMessages).toHaveBeenLastCalledWith("t1", { limit: VERLAUF_SEITE });
    expect(stand().hatAeltere).toBe(false);
  });

  // Die Gegenrichtung, sonst belegt die Zusage oben nur, dass `hatAeltere`
  // konstant falsch ist — genau der Vakuumtest, den codex an anderer Stelle
  // gefunden hat.
  it("bietet den Weg wieder an, wenn eine Neuabfrage Älteres meldet", async () => {
    fetchMessages.mockResolvedValue({ messages: [neu], erschoepft: true });
    const { queryClient } = montiere(true);
    await waitFor(() => expect(stand().hatAeltere).toBe(false));

    fetchMessages.mockResolvedValue({ messages: [neu], erschoepft: false });
    await act(async () => {
      await queryClient.refetchQueries({ queryKey: messagesQueryKey("t1") });
    });

    expect(stand().hatAeltere).toBe(true);
  });

  // Doppelklick. Der Test prüfte zuerst nur das deduplizierte ERGEBNIS — codex
  // hat zu Recht bemängelt, dass die Zusage „der zweite läuft gar nicht erst
  // los" damit ungemessen blieb. Sie hing an `laedtAeltere`, und das ist ein
  // Zustand: zwei Aufrufe vor dem nächsten Anstrich sähen beide `false`.
  // Gemessen wird jetzt die ANZAHL DER ANFRAGEN.
  it("stellt beim Doppelklick genau EINE Anfrage", async () => {
    fetchMessages.mockResolvedValue({ messages: [neu], erschoepft: false });
    montiere(true);
    await waitFor(() => expect(stand().messages).toHaveLength(1));

    fetchMessages.mockClear();
    fetchMessages.mockResolvedValue({ messages: [alt("1")], erschoepft: false });
    await act(async () => {
      await Promise.all([stand().ladeAeltere(), stand().ladeAeltere()]);
    });

    expect(fetchMessages).toHaveBeenCalledTimes(1);
    expect(stand().messages.map((m) => m.id)).toEqual(["1", "z"]);
  });

  // Reproduktionsversuch zu codex HOCH 1: die Neuabfrage hat ihr Ergebnis SCHON
  // berechnet — also den Cache gelesen, als die älteren Zeilen noch nicht drin
  // waren — und erst DANACH schreibt `ladeAeltere`. Setzt React Query danach
  // noch ein, verschwinden die älteren wieder.
  it("verliert nachgeladene Zeilen auch dann nicht, wenn die Neuabfrage zuerst auflöst", async () => {
    fetchMessages.mockResolvedValue({ messages: [neu], erschoepft: false });
    const { queryClient } = montiere(true);
    await waitFor(() => expect(stand().messages).toHaveLength(1));

    let neuabfrageAntwort!: (s: ChatVerlaufSeite) => void;
    let aeltereAntwort!: (s: ChatVerlaufSeite) => void;
    fetchMessages
      .mockImplementationOnce(
        () => new Promise<ChatVerlaufSeite>((res) => (neuabfrageAntwort = res)),
      )
      .mockImplementationOnce(() => new Promise<ChatVerlaufSeite>((res) => (aeltereAntwort = res)));

    let neuabfrage!: Promise<unknown>;
    let nachladen!: Promise<void>;
    await act(async () => {
      neuabfrage = queryClient.refetchQueries({ queryKey: messagesQueryKey("t1") });
      await Promise.resolve();
      nachladen = stand().ladeAeltere();
      await Promise.resolve();
    });

    await act(async () => {
      // Die Reihenfolge IST der Befund: erst die Neuabfrage, dann das Nachladen.
      neuabfrageAntwort({ messages: [neu], erschoepft: false });
      aeltereAntwort({ messages: [alt("1")], erschoepft: true });
      await neuabfrage;
      await nachladen;
    });

    expect(stand().messages.map((m) => m.id)).toEqual(["1", "z"]);
  });

  it("bietet keinen Weg zu älteren an, wenn der Verlauf leer ist", async () => {
    fetchMessages.mockResolvedValue({ messages: [], erschoepft: false });
    montiere(true);
    await waitFor(() => expect(stand().isLoading).toBe(false));

    expect(stand().hatAeltere).toBe(false);
  });

  // Die Positivkontrolle dazu — sie fehlte, und der Test darüber war damit ein
  // Vakuumtest: eine Umsetzung mit konstant `hatAeltere: false` hätte ihn
  // bestanden (codex, NIEDRIG). Der Kommentar behauptete sie sogar, ohne dass
  // sie dastand.
  it("bietet ihn an, sobald Inhalt da und die Seite nicht erschöpft ist", async () => {
    fetchMessages.mockResolvedValue({ messages: [neu], erschoepft: false });
    montiere(true);

    await waitFor(() => expect(stand().hatAeltere).toBe(true));
  });

  // Ein fehlgeschlagener HINTERGRUND-Refetch darf den Weg zu älteren Nachrichten
  // nicht kosten.
  //
  // **Anlass war ein Befund, der so nicht stimmt** (codex, MITTEL): React Query v5
  // setze dabei den Status auf `error`, weshalb ein `hatAeltere` mit
  // `query.isSuccess` den Knopf verschwinden liesse. Nachgemessen — der Status
  // bleibt `success`, solange Daten dastehen; die erste Fassung dieses Tests ist
  // an genau dieser Zusage rot geworden und hat den Befund widerlegt.
  //
  // Die Änderung bleibt trotzdem: `hatAeltere` hängt jetzt an dem, worum es geht
  // (ist etwas da, ist es erschöpft), und nicht am Zustand der letzten Abfrage.
  // Ein Zusammenhang, der zufällig gerade richtig herauskommt, ist einer, der
  // beim nächsten Bibliotheks-Update kippt.
  it("behält den Weg zu älteren, wenn eine Neuabfrage scheitert", async () => {
    fetchMessages.mockResolvedValue({ messages: [neu], erschoepft: false });
    const { queryClient } = montiere(true);
    await waitFor(() => expect(stand().hatAeltere).toBe(true));

    fetchMessages.mockRejectedValue(new Error("offline"));
    await act(async () => {
      await queryClient.refetchQueries({ queryKey: messagesQueryKey("t1") });
    });

    expect(stand().messages).toHaveLength(1);
    expect(stand().hatAeltere).toBe(true);
  });
});
