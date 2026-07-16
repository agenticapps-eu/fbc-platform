import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthFixture, fakeAuthValue } from "../test/auth-fixtures";
import type { AuthContextValue } from "../providers/auth-context";
import { ToastProvider } from "../components/ui/Toast";

vi.mock("../lib/member-settings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/member-settings")>();
  return {
    ...actual,
    fetchMemberSettings: vi.fn(),
    saveMemberSettings: vi.fn(),
  };
});
import {
  fetchMemberSettings,
  saveMemberSettings,
  DEFAULT_MEMBER_SETTINGS,
} from "../lib/member-settings";
vi.mock("../lib/feedback", () => ({ fetchAdminFeedback: vi.fn() }));
import { fetchAdminFeedback } from "../lib/feedback";
import EinstellungenPage from "./EinstellungenPage";

const mockedFetch = vi.mocked(fetchMemberSettings);
const mockedSave = vi.mocked(saveMemberSettings);
const mockedAdminFeedback = vi.mocked(fetchAdminFeedback);

beforeEach(() => {
  mockedFetch.mockReset();
  mockedFetch.mockResolvedValue(DEFAULT_MEMBER_SETTINGS);
  mockedSave.mockReset();
  mockedSave.mockResolvedValue();
  mockedAdminFeedback.mockReset();
  mockedAdminFeedback.mockResolvedValue([]);
});

function renderPage(staffRole: string | null = null) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const value = fakeAuthValue({
    user: { id: "u1", email: "legacy@fbcdemo.de" } as AuthContextValue["user"],
    tier: "legacy",
    levelRank: 7,
    staffRole,
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
    await waitFor(() =>
      expect(mockedSave).toHaveBeenCalledWith("u1", {
        ...DEFAULT_MEMBER_SETTINGS,
        visible_in_directory: false,
      }),
    );
  });

  it("zeigt die QM-Feedback-Card mit Inhalt und Autor für einen Admin (AGE-358)", async () => {
    mockedAdminFeedback.mockResolvedValue([
      {
        id: "f1",
        rating: 4,
        likes: "Der Compass ist klar",
        misses: null,
        idea: null,
        route: "/compass",
        ref_type: null,
        created_at: "2026-07-16T10:00:00Z",
        author_name: "Anna Müller",
      },
    ]);
    renderPage("admin");
    expect(await screen.findByText("QM-Feedback")).toBeInTheDocument();
    expect(await screen.findByText("Der Compass ist klar")).toBeInTheDocument();
    expect(screen.getByText("Anna Müller", { exact: false })).toBeInTheDocument();
  });

  it("zeigt die QM-Feedback-Card NICHT für ein gewöhnliches Mitglied", async () => {
    renderPage(null);
    await screen.findByRole("heading", { name: "Einstellungen" });
    expect(screen.queryByText("QM-Feedback")).toBeNull();
    expect(mockedAdminFeedback).not.toHaveBeenCalled();
  });

  it("zeigt die QM-Feedback-Card NICHT für einen matching_manager — QM ist nicht die Deal-Queue", async () => {
    renderPage("matching_manager");
    await screen.findByRole("heading", { name: "Einstellungen" });
    expect(screen.queryByText("QM-Feedback")).toBeNull();
    expect(mockedAdminFeedback).not.toHaveBeenCalled();
  });
});
