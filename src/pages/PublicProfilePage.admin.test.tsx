import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthFixture, authAsTier } from "../test/auth-fixtures";
import { ToastProvider } from "../components/ui/Toast";

vi.mock("../lib/public-profile", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/public-profile")>();
  return { ...actual, fetchPublicProfile: vi.fn() };
});
import { fetchPublicProfile } from "../lib/public-profile";

vi.mock("../lib/platform-settings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/platform-settings")>();
  return { ...actual, fetchPlatformSettings: vi.fn() };
});
import { fetchPlatformSettings } from "../lib/platform-settings";

vi.mock("../lib/contact-requests", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/contact-requests")>();
  return { ...actual, fetchContactState: vi.fn() };
});

import PublicProfilePage from "./PublicProfilePage";

const ZIEL = "66666666-6666-6666-6666-666666666666";

beforeEach(() => {
  vi.mocked(fetchPublicProfile).mockReset().mockResolvedValue({
    publicProfile: {
      id: ZIEL,
      name: "Fremdes Mitglied",
      avatar_url: null,
      cover_url: null,
      region: "Berlin",
      company: "Firma",
      short_bio: "Kurz",
      tier: "impact",
      roles: [],
    },
    extended: null,
  });
  vi.mocked(fetchPlatformSettings).mockReset().mockResolvedValue({ openContact: false });
});

function renderPage(staffRole: "admin" | null) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthFixture value={{ ...authAsTier("impact"), staffRole }}>
        <ToastProvider>
          <MemoryRouter initialEntries={[`/p/${ZIEL}`]}>
            <Routes>
              <Route path="/p/:id" element={<PublicProfilePage />} />
            </Routes>
          </MemoryRouter>
        </ToastProvider>
      </AuthFixture>
    </QueryClientProvider>,
  );
}

/**
 * Der Button ist KOMFORT, nicht die Grenze — die ist `is_admin()` im Rumpf der
 * RPCs und wird in rls_test.sql §18 mit einem direkten Aufruf geprüft. Hier geht
 * es nur darum, dass ein normales Mitglied den Weg gar nicht erst angeboten
 * bekommt.
 */
describe("PublicProfilePage — Admin-Bearbeitung (AGE-498)", () => {
  it("zeigt einem Admin den Bearbeiten-Weg", async () => {
    renderPage("admin");
    const link = await screen.findByRole("link", { name: /als admin bearbeiten/i });
    expect(link).toHaveAttribute("href", `/admin/mitglied/${ZIEL}`);
  });

  it("zeigt ihn einem normalen Mitglied nicht", async () => {
    renderPage(null);
    await screen.findByText("Fremdes Mitglied");
    expect(screen.queryByRole("link", { name: /als admin bearbeiten/i })).not.toBeInTheDocument();
  });
});
