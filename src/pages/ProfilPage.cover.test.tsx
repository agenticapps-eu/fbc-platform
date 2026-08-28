import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "../components/ui/Toast";
import { AuthFixture, authAsTier } from "../test/auth-fixtures";

vi.mock("../lib/profile", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/profile")>();
  return { ...actual, fetchProfileEditorData: vi.fn(), saveProfile: vi.fn() };
});
import { fetchProfileEditorData, type ProfileFormValues } from "../lib/profile";

vi.mock("../lib/profile-categories", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/profile-categories")>();
  return { ...actual, fetchCategorySelection: vi.fn(), saveCategorySelection: vi.fn() };
});
import { fetchCategorySelection } from "../lib/profile-categories";

import ProfilPage from "./ProfilPage";

/**
 * Die Zuschnitt-Vorschau muss dasselbe zeigen wie der Profilkopf (AGE-600).
 *
 * AGE-596 hat die drei ANZEIGEflächen auf `aspect-[3/1]` + `object-contain`
 * gebracht und die Vorschauen ausdrücklich ausgenommen. Die Folge war, dass die
 * Vorschau etwas anderes zeigte als das Ergebnis daneben: eine feste Höhe über
 * die volle Breite ergab je nach Breakpoint und Fenster ein Feld zwischen etwa
 * **5,8:1 und 7,3:1** statt 3:1 (`h-24` = 96 px, `sm:h-28` = 112 px), dazu
 * `object-cover`. Im Browser gemessen: 646 × 112 = 5,77:1, davon fielen
 * **77,2 % der Bildhöhe** heraus. Direkt nach einem Zuschnitt auf 3:1 sah das
 * Mitglied also ein mittiges Band seines eigenen Zuschnitts, unter der
 * Beschriftung „Zuschnitt 3:1" — ein senkrechter Beschnitt, keine Verzerrung.
 *
 * Warum das als Klassenzusage taugt und nicht als Vakuumtest: **jsdom misst
 * keine Breiten** und lädt kein Bild, die tatsächliche Darstellung ist hier
 * also nicht messbar. Gemessen wird stattdessen genau das, was die drei
 * Anzeigeflächen ihrerseits zusichern (`ProfileHero.test.tsx:117`,
 * `EventCover.test.tsx:58`, `MemberDirectory.test.tsx:346`) — dass Vorschau und
 * Anzeige DIESELBE Regel tragen. Der Augenschein gehört in den Browser und
 * steht in der Abnahme des Vorgangs.
 */

const mockedProfile = vi.mocked(fetchProfileEditorData);
const mockedCategories = vi.mocked(fetchCategorySelection);

const PROFILE: ProfileFormValues = {
  name: "Bea Lorenz",
  region: "",
  company: "",
  short_bio: "",
  avatar_url: null,
  cover_url: "cover.jpg",
  branche: "",
  headline: "",
  roles: [],
  competencies: [],
  website: "",
  dev_focus: "",
  socials: { linkedin: "", instagram: "", xing: "", facebook: "", youtube: "", twitter: "" },
  interests: [],
  goals: [],
  videos: [],
  contact: {
    email: "",
    phone: "",
    street: "",
    postal_code: "",
    city: "",
    state: "",
    country: "",
  },
};

beforeEach(() => {
  mockedProfile.mockReset();
  mockedProfile.mockResolvedValue(PROFILE);
  mockedCategories.mockReset();
  mockedCategories.mockResolvedValue({ offers: [], needs: [] });
});

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

describe("ProfilPage — Zuschnitt-Vorschau des Hintergrundbilds (AGE-600)", () => {
  it("hält 3:1, statt die Höhe festzunageln", async () => {
    renderPage();
    const box = await screen.findByTestId("cover-vorschau");
    expect(box.className).toMatch(/aspect-\[3\/1\]/);
    expect(box.className).not.toMatch(/\bh-24\b/);
    expect(box.className).not.toMatch(/\bsm:h-28\b/);
  });

  it("passt ein statt zu beschneiden — dieselbe Regel wie der Profilkopf", async () => {
    renderPage();
    const box = await screen.findByTestId("cover-vorschau");
    await waitFor(() => expect(box.querySelector("img")).not.toBeNull());
    const img = box.querySelector("img");
    expect(img?.className).toMatch(/object-contain/);
    expect(img?.className).not.toMatch(/object-cover/);
  });
});
