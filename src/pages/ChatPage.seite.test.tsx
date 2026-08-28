import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "../components/ui/Toast";
import { AuthFixture, authAsTier } from "../test/auth-fixtures";
import type { ChatThread, ChatThreadSeite } from "../lib/chat";

/**
 * `/chat` lädt seitenweise und bietet den Weg zu den weiteren Gesprächen
 * (AGE-627, Band 2).
 *
 * Gemockt ist die Datenschicht, nicht die Seite: `fetchThreads` und die drei
 * Nachbarn sind der Rand zur Datenbank. Die reinen Helfer aus `chat.ts` bleiben
 * echt (`importOriginal`) — eine Attrappe auf die eigene Abbildungsfunktion
 * prüfte am Ende nur noch die Attrappe.
 *
 * Die Zusage lautet auf den KNOPF, nicht auf die Zahl: eine Grenze, hinter der
 * kein Weg steht, ist keine Seite, sondern eine stille Kappung.
 */

const fetchThreads = vi.fn<(uid: string, opts?: { offset?: number }) => Promise<ChatThreadSeite>>();

vi.mock("../lib/chat", async (importOriginal) => {
  const echt = await importOriginal<typeof import("../lib/chat")>();
  return {
    ...echt,
    fetchThreads: (uid: string, opts?: { offset?: number }) => fetchThreads(uid, opts),
    fetchMessages: async () => ({ messages: [], erschoepft: true }),
    fetchUnreadCounts: async () => ({
      gesamt: 0,
      jeThread: new Map<string, number>(),
      hatUngelesen: () => false,
    }),
    markThreadRead: async () => {},
    subscribeToAllMessages: () => () => {},
    subscribeToThread: () => () => {},
  };
});

const { default: ChatPage } = await import("./ChatPage");

function thread(id: string): ChatThread {
  return {
    id,
    partner: { id: `p-${id}`, name: `Partner ${id}`, avatarUrl: null, company: null, tier: null },
    lastMessage: { body: "Hallo", createdAt: "2026-08-01T10:00:00Z", fromMe: false },
    lastActivityAt: "2026-08-01T10:00:00Z",
  };
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <AuthFixture value={authAsTier("impact")}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter initialEntries={["/chat"]}>
            <ChatPage />
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    </AuthFixture>,
  );
}

beforeEach(() => {
  fetchThreads.mockReset();
});

describe("ChatPage — begrenzte Seite mit Weg dahinter", () => {
  it("bietet die weiteren Gespräche an, solange ein Versatz folgt", async () => {
    fetchThreads.mockResolvedValue({ threads: [thread("t1")], nextOffset: 20 });
    renderPage();

    expect(await screen.findByRole("button", { name: "Weitere Gespräche" })).toBeInTheDocument();
  });

  it("bietet sie NICHT an, wenn die Liste vollständig ist", async () => {
    fetchThreads.mockResolvedValue({ threads: [thread("t1")], nextOffset: null });
    renderPage();

    // Positivkontrolle: die Liste ist da — die Abwesenheit des Knopfes unten ist
    // damit von „nichts gerendert" unterscheidbar.
    expect(await screen.findByText("Partner t1")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Weitere Gespräche" })).not.toBeInTheDocument();
  });

  it("lädt die nächste Seite mit dem gemeldeten Versatz und hängt sie an", async () => {
    fetchThreads
      .mockResolvedValueOnce({ threads: [thread("t1")], nextOffset: 20 })
      .mockResolvedValueOnce({ threads: [thread("t2")], nextOffset: null });
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Weitere Gespräche" }));

    await waitFor(() => expect(screen.getByText("Partner t2")).toBeInTheDocument());
    // Die erste Seite bleibt stehen — nachladen heisst anhängen, nicht ersetzen.
    expect(screen.getByText("Partner t1")).toBeInTheDocument();
    expect(fetchThreads).toHaveBeenNthCalledWith(2, "test-user", { offset: 20 });
  });
});
