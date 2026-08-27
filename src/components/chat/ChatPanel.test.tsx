import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Der Inhalt der Nachrichten-Leiste (AGE-627, Band 6).
 *
 * **Drei Zustände, nicht einer.** Der Fehler, gegen den dieser Test gebaut ist,
 * ist `data ?? []`: ein RLS-Fehler sähe dann aus wie „keine Kontakte", und ein
 * Mitglied läse, seine Kontakte hätten ihm nichts geschrieben, während in
 * Wahrheit gar nichts gelesen wurde. Die Zusagen „lädt", „scheitert" und „ist
 * leer" stehen deshalb einzeln da — sie sind im Browser nicht auseinander zu
 * halten, weil man einen RLS-Fehler dort nicht auf Zuruf herstellt.
 */

type Seite = import("../../lib/chat").ChatThreadSeite;
type Thread = import("../../lib/chat").ChatThread;

const fetchThreads = vi.fn<(uid: string, opts?: { offset?: number }) => Promise<Seite>>();

vi.mock("../../lib/chat", async (original) => ({
  ...(await original<typeof import("../../lib/chat")>()),
  fetchThreads: (uid: string, opts?: { offset?: number }) => fetchThreads(uid, opts),
}));

const { ChatPanel } = await import("./ChatPanel");

function thread(id: string, name: string): Thread {
  return {
    id,
    partner: { id: `p-${id}`, name, avatarUrl: null, company: null, tier: null },
    lastMessage: { body: "Hallo", createdAt: "2026-08-01T10:00:00Z", fromMe: false },
    lastActivityAt: "2026-08-01T10:00:00Z",
  };
}

const gewaehlt = vi.fn();

function renderPanel(ungelesen = new Map<string, number>()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ChatPanel
          uid="test-user"
          activeId={null}
          onSelect={gewaehlt}
          ungelesenJeThread={ungelesen}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  fetchThreads.mockReset();
  gewaehlt.mockReset();
});

describe("ChatPanel — drei Zustände", () => {
  it("sagt, dass geladen wird", () => {
    fetchThreads.mockReturnValue(new Promise(() => {}));
    renderPanel();
    expect(screen.getByText("Gespräche werden geladen…")).toBeInTheDocument();
  });

  it("sagt, dass es gescheitert ist — und nennt es NICHT Leere", async () => {
    fetchThreads.mockRejectedValue(new Error("permission denied"));
    renderPanel();

    expect(await screen.findByText(/konnten nicht geladen werden/)).toBeInTheDocument();
    // Die Zusage, die zählt: der leere Zustand darf hier NICHT stehen.
    expect(screen.queryByText(/Noch kein Gespräch/)).not.toBeInTheDocument();
  });

  it("lädt jemanden ein, wenn es wirklich nichts gibt", async () => {
    fetchThreads.mockResolvedValue({ threads: [], nextOffset: null });
    renderPanel();

    expect(await screen.findByText(/Noch kein Gespräch/)).toBeInTheDocument();
    // Kein Stufen-Wall: Nachrichten tragen keine Mitgliedsstufe.
    expect(screen.getByRole("link", { name: "Mitglieder entdecken" })).toHaveAttribute(
      "href",
      "/mitglieder",
    );
  });
});

describe("ChatPanel — die Liste", () => {
  it("meldet die Wahl eines Gesprächs an die Hülle weiter", async () => {
    fetchThreads.mockResolvedValue({ threads: [thread("t1", "Anna Becker")], nextOffset: null });
    renderPanel();

    fireEvent.click(await screen.findByRole("button", { name: "Anna Becker" }));
    expect(gewaehlt).toHaveBeenCalledWith("t1");
  });

  it("rendert die Null NICHT — ein Marker steht nur, wo etwas ungelesen ist", async () => {
    fetchThreads.mockResolvedValue({
      threads: [thread("t1", "Anna Becker"), thread("t2", "Ben Klar")],
      nextOffset: null,
    });
    renderPanel(new Map([["t1", 2]]));

    // Die Zahl steht im NAMEN, nicht nur als Farbfleck.
    expect(await screen.findByRole("button", { name: "Anna Becker, 2 ungelesen" })).toBeVisible();
    // Positivkontrolle daneben: der zweite Thread trägt gar keine Zahl.
    expect(screen.getByRole("button", { name: "Ben Klar" })).toBeVisible();
  });

  it("bietet die weiteren Gespräche an und hängt sie an", async () => {
    fetchThreads
      .mockResolvedValueOnce({ threads: [thread("t1", "Anna Becker")], nextOffset: 20 })
      .mockResolvedValueOnce({ threads: [thread("t2", "Ben Klar")], nextOffset: null });
    renderPanel();

    fireEvent.click(await screen.findByRole("button", { name: "Weitere Gespräche" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Ben Klar" })).toBeVisible());
    expect(screen.getByRole("button", { name: "Anna Becker" })).toBeVisible();
    expect(fetchThreads).toHaveBeenNthCalledWith(2, "test-user", { offset: 20 });
  });

  it("bietet sie nicht an, wenn die Liste vollständig ist", async () => {
    fetchThreads.mockResolvedValue({ threads: [thread("t1", "Anna Becker")], nextOffset: null });
    renderPanel();

    expect(await screen.findByRole("button", { name: "Anna Becker" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Weitere Gespräche" })).not.toBeInTheDocument();
  });
});
