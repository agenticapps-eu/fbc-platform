import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../components/ui/Toast";

vi.mock("../lib/platform-settings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/platform-settings")>();
  return { ...actual, fetchPlatformSettings: vi.fn(), updateOpenContact: vi.fn() };
});
import { fetchPlatformSettings, updateOpenContact } from "../lib/platform-settings";
vi.mock("../lib/feedback", () => ({ fetchAdminFeedback: vi.fn() }));
import { fetchAdminFeedback } from "../lib/feedback";
import AdminSettingsPage from "./AdminSettingsPage";

const mockedFetch = vi.mocked(fetchPlatformSettings);
const mockedUpdate = vi.mocked(updateOpenContact);
const mockedAdminFeedback = vi.mocked(fetchAdminFeedback);

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AdminSettingsPage />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockedFetch.mockReset();
  mockedUpdate.mockReset();
  mockedUpdate.mockResolvedValue(undefined);
  mockedAdminFeedback.mockReset();
  mockedAdminFeedback.mockResolvedValue([]);
});

describe("AdminSettingsPage (AGE-455)", () => {
  it("zeigt den open_contact-Toggle im aktuellen Zustand", async () => {
    mockedFetch.mockResolvedValue({ openContact: true });
    renderPage();

    const toggle = await screen.findByRole("switch", {
      name: "Kontaktanfragen für alle freischalten",
    });
    expect(toggle).toHaveAttribute("aria-checked", "true");
  });

  it("schaltet den Flag beim Klick um", async () => {
    mockedFetch.mockResolvedValue({ openContact: true });
    renderPage();

    const toggle = await screen.findByRole("switch", {
      name: "Kontaktanfragen für alle freischalten",
    });
    fireEvent.click(toggle);
    await waitFor(() => expect(mockedUpdate).toHaveBeenCalledWith(false));
  });
});

describe("QM-Feedback in der Administration (AGE-578)", () => {
  it("zeigt die Feedback-Sicht mit Inhalt und Autor", async () => {
    mockedFetch.mockResolvedValue({ openContact: true });
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
    renderPage();

    expect(await screen.findByText("QM-Feedback")).toBeInTheDocument();
    expect(await screen.findByText("Der Compass ist klar")).toBeInTheDocument();
    expect(screen.getByText("Anna Müller", { exact: false })).toBeInTheDocument();
  });

  // Die Seite hängt hinter RequireAdmin (App.tsx), das staffRole !== "admin" auf
  // "/" umleitet — deshalb fragt die Card hier NICHT mehr selbst nach der Rolle.
  // Diese Zusage hält fest, dass sie dafür auch wirklich bedingungslos rendert:
  // ein zurückgebliebenes Gating würde sie beim Admin-Fixture nicht auffallen.
  it("rendert die Sicht ohne eigene Rollenabfrage", async () => {
    mockedFetch.mockResolvedValue({ openContact: false });
    renderPage();

    expect(await screen.findByText("QM-Feedback")).toBeInTheDocument();
    expect(mockedAdminFeedback).toHaveBeenCalled();
  });
});
