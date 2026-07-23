import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../components/ui/Toast";

vi.mock("../lib/platform-settings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/platform-settings")>();
  return { ...actual, fetchPlatformSettings: vi.fn(), updateOpenContact: vi.fn() };
});
import { fetchPlatformSettings, updateOpenContact } from "../lib/platform-settings";
import AdminSettingsPage from "./AdminSettingsPage";

const mockedFetch = vi.mocked(fetchPlatformSettings);
const mockedUpdate = vi.mocked(updateOpenContact);

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
