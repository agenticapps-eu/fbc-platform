import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "../components/ui/Toast";
import { AuthFixture, authAsTier } from "../test/auth-fixtures";
import type { ChatMessage, ChatThreadSeite } from "../lib/chat";

/**
 * Der Lesestand der Vollansicht wird GENAU EINMAL vorgerückt (AGE-639).
 *
 * Bis zu diesem Change stand er an zwei Stellen in `ChatPage`: einem Effect an
 * `activeId` und einem Aufruf im Realtime-Abo. Der geteilte Hook `useGespraech`
 * hat den ersten ersetzt — und der zweite blieb zunächst stehen. Jede eingehende
 * fremde Nachricht schrieb dann ZWEIMAL.
 *
 * Gefunden hat es die Diff-Review (opencode, HIGH), und sie hat damit zugleich
 * einen Kommentar widerlegt, der „gleich viele Schreibvorgänge" behauptete: die
 * Messung dazu lief gegen den Hook ALLEIN, nicht gegen diese Seite mit ihrem
 * eigenen Abo. Dieser Test misst die Seite.
 */

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

const markThreadRead = vi.fn<(threadId: string, uid: string) => Promise<void>>();
let beiThreadNachricht: ((m: ChatMessage) => void) | null = null;

vi.mock("../lib/chat", async (importOriginal) => {
  const echt = await importOriginal<typeof import("../lib/chat")>();
  return {
    ...echt,
    fetchThreads: async (): Promise<ChatThreadSeite> => ({
      threads: [
        {
          id: "t1",
          partner: { id: "p1", name: "Anna Berger", avatarUrl: null, company: null, tier: null },
          lastMessage: null,
          lastActivityAt: "2026-08-01T09:00:00Z",
        },
      ],
      nextOffset: null,
    }),
    fetchMessages: async () => ({ messages: [] as ChatMessage[], erschoepft: true }),
    fetchUnreadCounts: async () => ({
      gesamt: 0,
      jeThread: new Map<string, number>(),
      hatUngelesen: () => false,
    }),
    markThreadRead: (threadId: string, uid: string) => markThreadRead(threadId, uid),
    subscribeToAllMessages: () => () => {},
    subscribeToThread: (_id: string, cb: (m: ChatMessage) => void) => {
      beiThreadNachricht = cb;
      return () => {
        beiThreadNachricht = null;
      };
    },
  };
});

const { default: ChatPage } = await import("./ChatPage");

const ICH = "test-user";

function renderSeite() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <AuthFixture value={authAsTier("impact")}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter initialEntries={["/chat/t1"]}>
            <Routes>
              <Route path="/chat/:threadId" element={<ChatPage />} />
            </Routes>
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    </AuthFixture>,
  );
}

beforeEach(() => {
  markThreadRead.mockReset();
  markThreadRead.mockResolvedValue(undefined);
  beiThreadNachricht = null;
});

describe("ChatPage — der Lesestand rückt genau einmal vor", () => {
  it("schreibt beim Öffnen EINEN Upsert, nicht zwei", async () => {
    renderSeite();
    await screen.findByRole("textbox", { name: "Nachricht schreiben" });
    await waitFor(() => expect(markThreadRead).toHaveBeenCalledWith("t1", ICH));

    // Ein bisschen Luft, damit ein zweiter Aufruf noch landen könnte.
    await new Promise((r) => setTimeout(r, 50));
    expect(markThreadRead).toHaveBeenCalledTimes(1);
  });

  it("schreibt je eingehender FREMDER Nachricht EINEN Upsert, nicht zwei", async () => {
    // Genau der Befund: das Abo spielt die Nachricht in den Cache, der Hook
    // sieht eine neue letzte fremde Zeile und markiert. Markierte das Abo
    // zusätzlich selbst, wären es zwei.
    renderSeite();
    await screen.findByRole("textbox", { name: "Nachricht schreiben" });
    await waitFor(() => expect(markThreadRead).toHaveBeenCalledTimes(1));

    act(() =>
      beiThreadNachricht!({
        id: "m-neu",
        threadId: "t1",
        senderId: "p1",
        body: "Frisch herein",
        createdAt: "2026-08-01T10:00:00Z",
      }),
    );

    await waitFor(() => expect(markThreadRead).toHaveBeenCalledTimes(2));
    // Und die Nachricht ist auch angekommen — eine Zählung ohne diese
    // Positivkontrolle wäre auch grün, wenn das Abo gar nichts täte.
    expect(await screen.findByText("Frisch herein")).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 50));
    expect(markThreadRead).toHaveBeenCalledTimes(2);
  });

  it("schreibt für eine EIGENE eingehende Nachricht gar nicht nach", async () => {
    renderSeite();
    await screen.findByRole("textbox", { name: "Nachricht schreiben" });
    await waitFor(() => expect(markThreadRead).toHaveBeenCalledTimes(1));

    act(() =>
      beiThreadNachricht!({
        id: "m-eigen",
        threadId: "t1",
        senderId: ICH,
        body: "Von mir",
        createdAt: "2026-08-01T10:00:00Z",
      }),
    );

    expect(await screen.findByText("Von mir")).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 50));
    expect(markThreadRead).toHaveBeenCalledTimes(1);
  });
});
