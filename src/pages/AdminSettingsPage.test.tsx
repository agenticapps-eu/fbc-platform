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
  mockedAdminFeedback.mockResolvedValue({ feedbacks: [], hatWeitere: false });
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

/**
 * Das QM-Feedback ist NICHT mehr hier (AGE-587).
 *
 * Die Zusage wird GEDREHT und nicht gelöscht — wie AGE-578 es mit
 * `EinstellungenPage.test.tsx` tat, als das Feedback von den Einstellungen
 * hierher zog. Ein gelöschter Test wäre keine Zusage, sondern eine Lücke: die
 * Karte könnte zurückkehren und stünde dann an zwei Orten, ohne dass etwas rot
 * würde.
 */
describe("QM-Feedback ist nicht mehr auf /admin (AGE-587)", () => {
  it("zeigt die Feedback-Karte nicht mehr", async () => {
    mockedFetch.mockResolvedValue({ openContact: true });
    renderPage();

    // Erst warten, bis die Seite wirklich steht — sonst wäre die
    // Abwesenheitsprüfung nur ein Beleg dafür, dass noch nichts gerendert ist.
    await screen.findByRole("switch", { name: "Kontaktanfragen für alle freischalten" });

    expect(screen.queryByText("QM-Feedback")).not.toBeInTheDocument();
  });

  it("holt gar kein Feedback mehr — die Fläche fragt nicht danach", async () => {
    mockedFetch.mockResolvedValue({ openContact: false });
    renderPage();
    await screen.findByRole("switch", { name: "Kontaktanfragen für alle freischalten" });

    expect(mockedAdminFeedback).not.toHaveBeenCalled();
  });
});
