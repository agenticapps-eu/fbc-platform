import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ChatMessage, ChatThread } from "../../lib/chat";

/**
 * Ein angedocktes Chatfenster (AGE-639).
 *
 * **Was hier geprüft wird, ist das, was sich ÄNDERT** — nicht ein zugänglicher
 * Name, den es vorher schon gab. Das ist die Lehre aus AGE-638, wo fünf von
 * sechs neuen Tests gegen den ALTEN Code grün waren: die alten Schalter hiessen
 * schon so. Hier zielen die Zusagen deshalb auf Zahlen von Treffern, auf das
 * Verschwinden des Verlaufs und auf Namen, die den Gesprächspartner nennen.
 */

// jsdom kennt `scrollIntoView` nicht; `Conversation` ruft es beim Montieren.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

const fetchMessages = vi.fn<(threadId: string) => Promise<ChatMessage[]>>();

vi.mock("../../lib/chat", async (importOriginal) => {
  const echt = await importOriginal<typeof import("../../lib/chat")>();
  return {
    ...echt,
    fetchMessages: (threadId: string) => fetchMessages(threadId),
    markThreadRead: async () => {},
    sendMessage: async () => {
      throw new Error("in diesem Test nicht benutzt");
    },
  };
});

const { ChatFenster } = await import("./ChatFenster");
const { ToastProvider } = await import("../ui/Toast");

const ICH = "ich";

function thread(id: string, name: string): ChatThread {
  return {
    id,
    partner: { id: `p-${id}`, name, avatarUrl: null, company: "Muster GmbH", tier: null },
    lastMessage: null,
    lastActivityAt: "2026-08-01T10:00:00Z",
  };
}

const handler = {
  onMinimiere: vi.fn(),
  onZiehAuf: vi.fn(),
  onSchliesse: vi.fn(),
  onBeruehre: vi.fn(),
};

function montiere(fenster: Array<{ t: ChatThread; minimiert?: boolean; ungelesen?: number }>) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        {fenster.map(({ t, minimiert = false, ungelesen = 0 }) => (
          <ChatFenster
            key={t.id}
            thread={t}
            myId={ICH}
            minimiert={minimiert}
            ungelesen={ungelesen}
            {...handler}
          />
        ))}
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  fetchMessages.mockReset();
  fetchMessages.mockResolvedValue([]);
  Object.values(handler).forEach((h) => h.mockReset());
});

describe("ChatFenster — mehrere nebeneinander", () => {
  it("trägt je Fenster eine eigene Sendezeile", async () => {
    // DIE Zusage dieses Changes: mehrere Gespräche GLEICHZEITIG. Ein Test auf
    // „es gibt eine Sendezeile" wäre gegen die Vollansicht schon grün gewesen.
    montiere([
      { t: thread("t1", "Anna Berger") },
      { t: thread("t2", "Chris Mai") },
      { t: thread("t3", "Doro Klein") },
    ]);

    // `findAllByRole` löst beim ERSTEN Treffer auf — mit drei unabhängigen
    // Abfragen wäre der Test dann grün, sobald ein einziges Fenster geladen hat,
    // und misst damit genau nicht die Zusage. Auf die Zahl warten.
    await waitFor(() =>
      expect(screen.getAllByRole("textbox", { name: "Nachricht schreiben" })).toHaveLength(3),
    );
  });

  it("benennt seine Schalter nach dem Gesprächspartner, nicht generisch", async () => {
    // Drei Fenster dürfen nicht drei gleichnamige Schalter zeigen — sonst weiss
    // eine Vorlesesoftware nicht, welches Gespräch sie schliesst.
    montiere([{ t: thread("t1", "Anna Berger") }, { t: thread("t2", "Chris Mai") }]);

    expect(
      await screen.findByRole("button", { name: "Gespräch mit Anna Berger schliessen" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Gespräch mit Chris Mai schliessen" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Gespräch mit Anna Berger minimieren" }),
    ).toBeInTheDocument();
  });

  it("nennt den Partner in der Titelzeile GENAU EINMAL", async () => {
    // Die Titelzeile des Fensters IST der Kopf des Gesprächs. Nähme es den Kopf
    // von `Conversation` dazu, stünde der Name zweimal übereinander.
    montiere([{ t: thread("t1", "Anna Berger") }]);
    await screen.findByRole("textbox", { name: "Nachricht schreiben" });

    expect(screen.getAllByText("Anna Berger")).toHaveLength(1);
  });
});

describe("ChatFenster — minimiert", () => {
  it("legt Verlauf und Sendezeile weg, behält aber den Namen", async () => {
    fetchMessages.mockResolvedValue([
      {
        id: "m1",
        threadId: "t1",
        senderId: "p-t1",
        body: "Hallo aus dem Verlauf",
        createdAt: "2026-08-01T10:00:00Z",
      },
    ]);
    const { rerender } = montiere([{ t: thread("t1", "Anna Berger") }]);
    expect(await screen.findByText("Hallo aus dem Verlauf")).toBeInTheDocument();

    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <ToastProvider>
          <ChatFenster
            thread={thread("t1", "Anna Berger")}
            myId={ICH}
            minimiert
            ungelesen={0}
            {...handler}
          />
        </ToastProvider>
      </QueryClientProvider>,
    );

    expect(screen.queryByText("Hallo aus dem Verlauf")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Nachricht schreiben" })).not.toBeInTheDocument();
    // Der Name bleibt — genau das unterscheidet die Titelzeile von einer Blase.
    expect(screen.getByText("Anna Berger")).toBeInTheDocument();
  });

  it("zeigt minimiert den Ungelesen-Zähler, und der steht im Namen des Schalters", () => {
    montiere([{ t: thread("t1", "Anna Berger"), minimiert: true, ungelesen: 4 }]);

    // Farbe trägt nie allein eine Bedeutung, und eine Ziffer ohne Gegenstand ist
    // für eine Vorlesesoftware nichts.
    expect(
      screen.getByRole("button", { name: "Gespräch mit Anna Berger aufziehen, 4 ungelesen" }),
    ).toBeInTheDocument();
  });

  it("zeigt eine Null NICHT", () => {
    montiere([{ t: thread("t1", "Anna Berger"), minimiert: true, ungelesen: 0 }]);
    expect(
      screen.getByRole("button", { name: "Gespräch mit Anna Berger aufziehen" }),
    ).toBeInTheDocument();
  });

  it("lädt seinen Verlauf trotzdem", async () => {
    // Der tragende Grund ist der Merge-Pfad des globalen Abos: es schreibt nur
    // fort, was schon im Cache liegt. Ohne Eintrag fiele jede Nachricht weg, die
    // während des Minimiertseins eintrifft.
    montiere([{ t: thread("t1", "Anna Berger"), minimiert: true }]);
    await waitFor(() => expect(fetchMessages).toHaveBeenCalledWith("t1"));
  });
});

describe("ChatFenster — die Schalter melden sich", () => {
  it("minimiert, zieht auf und schliesst", async () => {
    montiere([{ t: thread("t1", "Anna Berger") }]);
    fireEvent.click(
      await screen.findByRole("button", { name: "Gespräch mit Anna Berger minimieren" }),
    );
    expect(handler.onMinimiere).toHaveBeenCalledWith("t1");

    fireEvent.click(screen.getByRole("button", { name: "Gespräch mit Anna Berger schliessen" }));
    expect(handler.onSchliesse).toHaveBeenCalledWith("t1");
  });

  it("meldet Zeigerkontakt als BERÜHREN — sonst räumt das nächste Gespräch dieses hier", async () => {
    montiere([{ t: thread("t1", "Anna Berger") }]);
    const eingabe = await screen.findByRole("textbox", { name: "Nachricht schreiben" });

    fireEvent.mouseDown(eingabe);
    expect(handler.onBeruehre).toHaveBeenCalledWith("t1");
  });

  it("meldet auch Fokuskontakt — der Weg über die Tastatur", async () => {
    montiere([{ t: thread("t1", "Anna Berger") }]);
    const eingabe = await screen.findByRole("textbox", { name: "Nachricht schreiben" });

    fireEvent.focus(eingabe);
    expect(handler.onBeruehre).toHaveBeenCalledWith("t1");
  });
});

describe("ChatFenster — drei Zustände, nicht einer", () => {
  it("meldet einen Fehlschlag als Fehler, nicht als leeres Gespräch", async () => {
    fetchMessages.mockRejectedValue(new Error("kaputt"));
    montiere([{ t: thread("t1", "Anna Berger") }]);

    expect(await screen.findByText(/konnte nicht geladen werden/i)).toBeInTheDocument();
    // Eine Fehlmeldung darf nicht als „schreib die erste" erscheinen.
    expect(screen.queryByText(/schreibe die erste/i)).not.toBeInTheDocument();
  });
});
