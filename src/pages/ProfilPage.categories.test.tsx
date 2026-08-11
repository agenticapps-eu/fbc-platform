import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthFixture, authAsTier } from "../test/auth-fixtures";
import { ToastProvider } from "../components/ui/Toast";

vi.mock("../lib/profile", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/profile")>();
  return { ...actual, fetchProfileEditorData: vi.fn(), saveProfile: vi.fn() };
});
import { fetchProfileEditorData, type ProfileFormValues } from "../lib/profile";

vi.mock("../lib/profile-categories", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/profile-categories")>();
  return { ...actual, fetchCategorySelection: vi.fn(), saveCategorySelection: vi.fn() };
});
import { fetchCategorySelection, saveCategorySelection } from "../lib/profile-categories";

import ProfilPage from "./ProfilPage";

const mockedProfile = vi.mocked(fetchProfileEditorData);
const mockedCategories = vi.mocked(fetchCategorySelection);
const mockedSave = vi.mocked(saveCategorySelection);

const PROFILE: ProfileFormValues = {
  name: "Bea Lorenz",
  region: "",
  company: "",
  short_bio: "",
  avatar_url: null,
  cover_url: null,
  branche: "",
  headline: "",
  roles: [],
  competencies: [],
  website: "",
  dev_focus: "",
  socials: { linkedin: "", instagram: "", xing: "" },
  interests: [],
  goals: [],
  videos: [],
};

beforeEach(() => {
  mockedProfile.mockReset();
  mockedProfile.mockResolvedValue(PROFILE);
  mockedCategories.mockReset();
  mockedSave.mockReset();
});

/** Das Profil lädt; nur die Kategorien-Abfrage variiert je Fall. */
function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthFixture value={authAsTier("impact")}>
        <ToastProvider>
          <MemoryRouter>
            <ProfilPage />
          </MemoryRouter>
        </ToastProvider>
      </AuthFixture>
    </QueryClientProvider>,
  );
}

describe("ProfilPage — Kompass-Kategorien (AGE-494)", () => {
  it("meldet einen Ladefehler sichtbar, statt den Block wortlos zu verschlucken", async () => {
    mockedCategories.mockRejectedValue(new Error("network down"));
    renderPage();

    // Der Block hängt an `selection = edited ?? data ?? null`. Im Fehlerfall ist
    // `data` undefined — eine `!selection`-Prüfung VOR `isError` gäbe still `null`
    // zurück und das Mitglied sähe nie, dass etwas fehlgeschlagen ist.
    expect(await screen.findByText("Kategorien konnten nicht geladen werden.")).toBeInTheDocument();
  });

  it("zeigt die Chips, sobald die Kategorien geladen sind", async () => {
    mockedCategories.mockResolvedValue({ offers: [], needs: [] });
    renderPage();

    expect(
      await screen.findByRole("heading", { name: "Ich biete & ich suche" }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.queryByText("Kategorien konnten nicht geladen werden."),
      ).not.toBeInTheDocument(),
    );
  });

  /* Der partielle Unique-Index auf (profile_id, category) where source='chip'
   * ist die einzige Absicherung gegen doppelte Chip-Zeilen — saveCategorySelection
   * gleicht bewusst nicht atomar ab. Er schlägt also im Normalbetrieb zu
   * (zweiter Tab, veralteter Lesestand), und dann darf der Postgres-Wortlaut
   * nicht ins Mitgliederinterface durchschlagen. */
  it("übersetzt eine Unique-Verletzung, statt den Postgres-Wortlaut zu zeigen", async () => {
    mockedCategories.mockResolvedValue({ offers: [], needs: [] });
    mockedSave.mockRejectedValue(
      Object.assign(
        new Error('duplicate key value violates unique constraint "offers_chip_unique"'),
        { code: "23505" },
      ),
    );
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Kategorien speichern" }));

    expect(await screen.findByText(/bereits gespeichert/i)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("duplicate key value");
    expect(document.body.textContent).not.toContain("unique constraint");
  });
});
