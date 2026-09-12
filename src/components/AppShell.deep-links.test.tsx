import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * DASS der Deep-Link-Zuhörer an der Hülle hängt (AGE-643, §6.3).
 *
 * Die Übersetzung selbst ist nebenan geprüft, mit Mutations-Gegenprobe
 * (`src/lib/deep-links.test.ts`). Was dort NICHT belegt werden kann, ist die
 * Verdrahtung: ein Modul, das ausgewertet wird, ist kein Zuhörer, der hängt.
 * Genau diese Lücke schliesst diese Datei — und die Zusage lautet „beim
 * Montieren", nicht „nach dem Anmelden": der Aktivierungslink kommt bei
 * geschlossener App an.
 */
const { deepLinkZuhoerer, abraeumen } = vi.hoisted(() => {
  const abraeumen = vi.fn();
  return { deepLinkZuhoerer: vi.fn(() => abraeumen), abraeumen };
});
vi.mock("../lib/deep-links", async (original) => ({
  ...(await original<typeof import("../lib/deep-links")>()),
  deepLinkZuhoerer,
}));

vi.mock("../lib/push", () => ({
  pushEinrichten: vi.fn(async () => "web"),
  pushKanalAnlegen: vi.fn(async () => "entfaellt"),
  pushLebenszeichen: vi.fn(async () => "web"),
  pushZielZuhoerer: vi.fn(async () => {}),
}));

vi.mock("../lib/chat", async (original) => ({
  ...(await original<typeof import("../lib/chat")>()),
  fetchThreads: async () => ({ threads: [], nextOffset: null }),
  fetchMessages: async () => ({ messages: [], erschoepft: true }),
  fetchUnreadCounts: async () => ({
    gesamt: 0,
    jeThread: new Map<string, number>(),
    hatUngelesen: () => false,
  }),
  markThreadRead: async () => {},
  subscribeToAllMessages: () => () => {},
  subscribeToThread: () => () => {},
}));

const { default: App } = await import("../App");
const { ToastProvider } = await import("./ui/Toast");
const { AuthFixture, fakeAuthValue } = await import("../test/auth-fixtures");
const { LEVEL_RANK } = await import("../config/levels");
type AuthContextValue = import("../providers/auth-context").AuthContextValue;

const MITGLIED = fakeAuthValue({
  user: { id: "test-user", email: "bea@demo.local" } as AuthContextValue["user"],
  tier: "impact",
  levelRank: LEVEL_RANK.impact,
});
const GAST = fakeAuthValue();

function renderApp(value: AuthContextValue) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <AuthFixture value={value}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter initialEntries={["/aktivitaet"]}>
            <App />
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    </AuthFixture>,
  );
}

beforeEach(() => {
  deepLinkZuhoerer.mockClear();
  abraeumen.mockClear();
});

describe("Der Deep-Link-Zuhörer hängt an der Hülle (AGE-643)", () => {
  it("hängt beim Montieren", async () => {
    renderApp(MITGLIED);
    await waitFor(() => expect(deepLinkZuhoerer).toHaveBeenCalledTimes(1));
  });

  it("geht beim Abräumen wieder ab", async () => {
    const { unmount } = renderApp(MITGLIED);
    await waitFor(() => expect(deepLinkZuhoerer).toHaveBeenCalledTimes(1));

    unmount();
    expect(abraeumen).toHaveBeenCalledTimes(1);
  });

  it("hängt auch ohne Anmeldung", async () => {
    // DER FALL, UM DEN ES GEHT. Ein Aktivierungslink erreicht ein Gerät, auf
    // dem niemand angemeldet ist — hinge der Zuhörer am Konto, fiele der Sprung
    // genau dort aus, wo er am meisten bedeutet.
    renderApp(GAST);
    await screen.findByRole("main");
    expect(deepLinkZuhoerer).toHaveBeenCalledTimes(1);
  });
});
