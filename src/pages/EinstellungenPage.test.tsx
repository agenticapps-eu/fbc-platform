import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthFixture, fakeAuthValue } from "../test/auth-fixtures";
import type { AuthContextValue } from "../providers/auth-context";
import { ToastProvider } from "../components/ui/Toast";

vi.mock("../lib/member-settings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/member-settings")>();
  return { ...actual, fetchMemberSettings: vi.fn(), saveMemberSettings: vi.fn() };
});
import {
  fetchMemberSettings,
  saveMemberSettings,
  DEFAULT_MEMBER_SETTINGS,
} from "../lib/member-settings";
import EinstellungenPage from "./EinstellungenPage";

const mockedFetch = vi.mocked(fetchMemberSettings);
const mockedSave = vi.mocked(saveMemberSettings);

beforeEach(() => {
  mockedFetch.mockReset();
  mockedFetch.mockResolvedValue(DEFAULT_MEMBER_SETTINGS);
  mockedSave.mockReset();
  mockedSave.mockResolvedValue();
});

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const value = fakeAuthValue({
    user: { id: "u1", email: "legacy@fbcdemo.de" } as AuthContextValue["user"],
    tier: "legacy",
    levelRank: 7,
  });
  return render(
    <AuthFixture value={value}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter>
            <EinstellungenPage />
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    </AuthFixture>,
  );
}

describe("EinstellungenPage", () => {
  it("zeigt Konto-Infos und persistiert einen Sichtbarkeits-Toggle", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "Einstellungen" })).toBeInTheDocument();
    expect(screen.getByText("legacy@fbcdemo.de")).toBeInTheDocument();
    const toggle = await screen.findByRole("switch", { name: /Im Verzeichnis sichtbar/ });
    fireEvent.click(toggle);
    await waitFor(() => expect(mockedSave).toHaveBeenCalled());
  });
});
