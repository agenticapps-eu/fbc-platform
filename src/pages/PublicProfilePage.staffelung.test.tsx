import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../components/ui/Toast";
import type { AuthContextValue } from "../providers/auth-context";
import { AuthFixture, authAsTier, fakeAuthValue } from "../test/auth-fixtures";
import type { PublicProfileData } from "../lib/public-profile";

/**
 * AGE-598, Aufgabengruppe 7 — die Oberfläche der Kontaktanfrage.
 *
 * Seit `20260902180000_kontaktanfrage_staffelung.sql` gilt statt „ab Rang 4":
 *
 *   `basic`       gar nicht
 *   `connect`     nur an GENAU `connect`
 *   ab `discover` an alle
 *
 * Die Seite muss das benennen, nicht bloss den Knopf wegnehmen. Und sie muss
 * es UNTERSCHEIDBAR benennen: ein `basic`-Konto und ein `connect`-Konto stehen
 * vor verschiedenen Hürden, und eine gemeinsame Meldung beantwortete für
 * beide die falsche Frage.
 *
 * Der Ziel-Stufe wegen zwei Fixtures: dasselbe `connect`-Konto darf das eine
 * Profil anschreiben und das andere nicht. Ein Test mit nur einem Ziel sähe
 * die Regel nie, die vom ZIEL abhängt — dieselbe Lücke, die pgTAP mit sechs
 * Absenderstufen gegen zwei Zielstufen schliesst.
 *
 * Die Sicherheitsgrenze bleibt `cr_insert_self`; hier wird Komfort gemessen.
 */
vi.mock("../lib/public-profile", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/public-profile")>();
  return { ...actual, fetchPublicProfile: vi.fn() };
});
vi.mock("../lib/contact-requests", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/contact-requests")>();
  return { ...actual, fetchContactRelation: vi.fn(), sendContactRequest: vi.fn() };
});
vi.mock("../lib/platform-settings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/platform-settings")>();
  return { ...actual, fetchPlatformSettings: vi.fn() };
});
import { fetchPublicProfile } from "../lib/public-profile";
import { fetchContactRelation, type ContactRelation } from "../lib/contact-requests";
import { fetchPlatformSettings } from "../lib/platform-settings";
import PublicProfilePage from "./PublicProfilePage";

const mockedFetch = vi.mocked(fetchPublicProfile);
const mockedRelation = vi.mocked(fetchContactRelation);
const mockedPlatform = vi.mocked(fetchPlatformSettings);

const NO_RELATION: ContactRelation = { request: null, contact: null, matchId: null };
const PROFILE_ID = "5e195a30-0000-0000-0000-000000000001";

function sicht(tier: string): PublicProfileData {
  return {
    publicProfile: {
      id: PROFILE_ID,
      name: "Legacy Demo",
      avatar_url: null,
      cover_url: null,
      region: "Berlin",
      company: "Legacy GmbH",
      short_bio: "Begleitet Unternehmer beim Aufbau von Ökosystemen.",
      tier,
      roles: ["Unternehmer"],
    },
    extended: null,
  };
}

function renderPage(value: AuthContextValue) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <AuthFixture value={value}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter initialEntries={[`/p/${PROFILE_ID}`]}>
            <Routes>
              <Route path="/p/:id" element={<PublicProfilePage />} />
            </Routes>
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    </AuthFixture>,
  );
}

const KNOPF = { name: "Kontaktanfrage senden" };
/* Der Anker steht IN der Kontaktkarte. Auf den Firmennamen zu warten wäre
   kein Beleg dafür, dass die Karte schon gerendert ist — und eine Verneinung
   („kein Knopf") wäre dann grün, bevor überhaupt etwas dastand. */
const KONTAKTKARTE = "E-Mail, Telefon und Anschrift werden nie automatisch angezeigt.";

/* Und die Zusagen gelten IN dieser Karte. „Discover" steht auf derselben Seite
   ein zweites Mal — die Karte der erweiterten Felder nennt dieselbe Stufe für
   eine ganz andere Schwelle. Ein `getByText(/Discover/)` über die ganze Seite
   fand deshalb zwei Treffer und hätte, mit `getAllByText` beruhigt, auch dann
   gehalten, wenn in der Kontaktkarte gar nichts stünde. */
function kontaktkarte(): HTMLElement {
  return screen.getByText(KONTAKTKARTE).parentElement!;
}

beforeEach(() => {
  mockedFetch.mockReset();
  mockedRelation.mockReset();
  mockedRelation.mockResolvedValue(NO_RELATION);
  mockedPlatform.mockReset();
  // Geschlossener Modus — nur dort wirkt die Staffelung überhaupt. Bei offenem
  // Schalter darf jeder jeden anschreiben, und der Test misste nichts.
  mockedPlatform.mockResolvedValue({ openContact: false });
});

describe("Kontaktanfrage: die Staffelung an der Oberfläche (AGE-598, 7.1)", () => {
  it("nennt einem basic-Konto die Stufe, statt nur den Knopf wegzunehmen", async () => {
    mockedFetch.mockResolvedValue(sicht("impact"));
    renderPage(authAsTier("basic"));

    await screen.findByText(KONTAKTKARTE);
    expect(screen.queryByRole("button", KNOPF)).not.toBeInTheDocument();
    // Die erste Stufe, auf der überhaupt etwas geht, heisst Connect — und dass
    // es dort nur an Connect geht, gehört mit dazu. „Ab Discover" allein wäre
    // bequemer und würde eine Stufe verschweigen, die es gibt.
    const karte = kontaktkarte();
    expect(within(karte).getByText("Connect")).toBeInTheDocument();
    expect(within(karte).getByText("Discover")).toBeInTheDocument();
  });

  it("lässt ein connect-Konto ein connect-Profil anschreiben", async () => {
    mockedFetch.mockResolvedValue(sicht("connect"));
    renderPage(authAsTier("connect"));

    await screen.findByText(KONTAKTKARTE);
    expect(screen.getByRole("button", KNOPF)).toBeInTheDocument();
  });

  it("verwehrt demselben connect-Konto ein impact-Profil — und sagt, warum", async () => {
    mockedFetch.mockResolvedValue(sicht("impact"));
    renderPage(authAsTier("connect"));

    await screen.findByText(KONTAKTKARTE);
    expect(screen.queryByRole("button", KNOPF)).not.toBeInTheDocument();
    // Die Begründung ist eine ANDERE als beim basic-Konto: hier geht schon
    // etwas, nur nicht dieses Profil.
    const karte = kontaktkarte();
    expect(within(karte).getByText(/Mitglieder der Stufe/)).toBeInTheDocument();
    expect(within(karte).getByText("Discover")).toBeInTheDocument();
    // Und ausdruecklich NICHT die basic-Meldung — zwei Huerden, zwei Saetze.
    expect(within(karte).queryByText(/sind ab der Mitgliedsstufe/)).toBeNull();
  });

  /**
   * Die Erweiterung, ausdrücklich. Bis zum 02.09. lag das Kontaktrecht bei
   * `exchange` (Rang 4), und die Bestandszusage in `PublicProfilePage.test.tsx`
   * sagte genau das zu. Sie ist mit dieser Aufgabe umgeschrieben.
   */
  it("gibt einem discover-Konto den Knopf — die Erweiterung", async () => {
    mockedFetch.mockResolvedValue(sicht("impact"));
    renderPage(authAsTier("discover"));

    await screen.findByText(KONTAKTKARTE);
    expect(screen.getByRole("button", KNOPF)).toBeInTheDocument();
  });

  /**
   * Der Fall, den die Datei beim Schreiben nicht hatte und der Diff-Review
   * gefunden hat: `/p/:id` liegt hinter <RequireAuth>, NICHT hinter
   * <MembershipGate>. Die Seite rendert also, bevor die eigene Stufe geladen
   * ist — und `levelRank === null` sieht wie Rang 0 aus.
   *
   * Ohne die Bremse läse ein `discover`-Konto für einen Moment, es dürfe
   * niemanden anschreiben. Eine falsche Auskunft über die eigenen Rechte ist
   * schlimmer als gar keine, und sie steht ausgerechnet vor denen, die
   * aufsteigen sollen.
   */
  it("behauptet keinen Grund, solange die eigene Stufe nicht feststeht", async () => {
    mockedFetch.mockResolvedValue(sicht("impact"));
    // Eingeloggt, aber `levelRank` steht noch nicht — genau der Zustand
    // zwischen <RequireAuth> und dem Eintreffen der Profilzeile.
    renderPage(fakeAuthValue({ user: { id: "test-user" } as AuthContextValue["user"] }));

    await screen.findByText(KONTAKTKARTE);
    const karte = kontaktkarte();
    expect(within(karte).queryByRole("button", KNOPF)).toBeNull();
    // Weder die eine noch die andere Begründung — es steht schlicht nichts da.
    expect(within(karte).queryByText(/Mitgliedsstufe/)).toBeNull();
    expect(within(karte).queryByText(/Mitglieder der Stufe/)).toBeNull();
  });

  /**
   * Positivkontrolle für den Schalter: er steht VOR der Staffelung. Ohne diese
   * Zusage bliebe offen, ob die Oberfläche ihn überhaupt noch liest — und ein
   * `basic`-Konto sähe im offenen Modus eine Wand, die die Datenbank gar nicht
   * aufstellt.
   */
  it("öffnet open_contact auch einem basic-Konto den Knopf", async () => {
    mockedPlatform.mockResolvedValue({ openContact: true });
    mockedFetch.mockResolvedValue(sicht("impact"));
    renderPage(authAsTier("basic"));

    await screen.findByText(KONTAKTKARTE);
    expect(screen.getByRole("button", KNOPF)).toBeInTheDocument();
  });
});
