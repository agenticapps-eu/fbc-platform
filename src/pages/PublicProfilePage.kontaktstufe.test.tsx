import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../components/ui/Toast";
import type { AuthContextValue } from "../providers/auth-context";
import { AuthFixture, authAsTier, fakeAuthValue } from "../test/auth-fixtures";
import type { PublicProfileData } from "../lib/public-profile";

/**
 * Die Oberfläche der Kontaktanfrage (AGE-598 Gruppe 7, AGE-903).
 *
 * Seit AGE-903 entscheidet allein die ABSENDERstufe:
 *
 *   ab Rang 4 (`discover`)  an JEDEN, unabhängig von dessen Stufe
 *   darunter                an NIEMANDEN
 *
 * Die Staffelung nach Empfängerstufe — „`connect` nur an genau `connect`" —
 * ist ersatzlos entfallen. Diese Datei hiess danach: sie prüft jetzt, dass es
 * die Staffelung NICHT mehr gibt.
 *
 * Die Seite muss die Hürde benennen und nicht bloss den Knopf wegnehmen. Es ist
 * aber nur noch EINE: zwei Meldungen wären jetzt nicht genauer, sondern
 * irreführend — die zweite behauptete eine Bedingung, die es nicht gibt.
 *
 * Die zwei Ziel-Fixtures bleiben, und zwar mit umgekehrter Aufgabe: sie sagen
 * jetzt zu, dass die Zielstufe NICHTS ändert. Ein Test mit nur einem Ziel
 * liesse offen, ob die Staffelung wirklich weg ist oder an diesem einen Ziel
 * bloss nicht auffällt.
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
  // Geschlossener Modus — nur dort wirkt die Stufenschwelle überhaupt. Bei
  // offenem Schalter darf jeder jeden anschreiben, und der Test misste nichts.
  // Auf PROD steht der Schalter auf `true`; eine Sichtprobe an der Oberfläche
  // würde die Schwelle dort also fälschlich bestätigen.
  mockedPlatform.mockResolvedValue({ openContact: false });
});

describe("Kontaktanfrage an der Oberfläche: allein die Absenderstufe (AGE-903)", () => {
  it("nennt einem active-Konto die Stufe, statt nur den Knopf wegzunehmen", async () => {
    mockedFetch.mockResolvedValue(sicht("impact"));
    renderPage(authAsTier("active"));

    await screen.findByText(KONTAKTKARTE);
    expect(screen.queryByRole("button", KNOPF)).not.toBeInTheDocument();
    // Genau EINE Stufe wird genannt, und es ist die Clubstufe. Bis AGE-903
    // standen hier zwei — `Connect` als „dort geht schon etwas" und `Discover`
    // als „dort geht alles". Der erste Satz beschrieb die Staffelung; sie ist
    // weg, und ihn stehen zu lassen behauptete eine Stufe, auf der etwas ginge.
    const karte = kontaktkarte();
    expect(within(karte).getByText("Discover")).toBeInTheDocument();
    expect(within(karte).queryByText("Connect")).toBeNull();
  });

  // AGE-903 — DIESE ZUSAGE IST UMGEDREHT. Sie hiess „lässt ein connect-Konto
  // ein connect-Profil anschreiben" und war die einzige Stelle, an der die
  // Staffelung an der Oberfläche sichtbar wurde. Jetzt sagt sie das Gegenteil
  // zu: Rang 3 darf niemanden anschreiben, auch kein gleichstufiges Profil.
  it("verwehrt einem connect-Konto auch ein connect-Profil", async () => {
    mockedFetch.mockResolvedValue(sicht("connect"));
    renderPage(authAsTier("connect"));

    await screen.findByText(KONTAKTKARTE);
    expect(screen.queryByRole("button", KNOPF)).not.toBeInTheDocument();
    const karte = kontaktkarte();
    expect(within(karte).getByText(/ab der Mitgliedsstufe/)).toBeInTheDocument();
  });

  it("verwehrt demselben connect-Konto ein impact-Profil — mit DERSELBEN Begründung", async () => {
    mockedFetch.mockResolvedValue(sicht("impact"));
    renderPage(authAsTier("connect"));

    await screen.findByText(KONTAKTKARTE);
    expect(screen.queryByRole("button", KNOPF)).not.toBeInTheDocument();
    // Dieselbe Begründung wie beim gleichstufigen Ziel — das IST die Zusage.
    // Stünde hier ein anderer Satz, wäre die Staffelung noch da.
    const karte = kontaktkarte();
    expect(within(karte).getByText(/ab der Mitgliedsstufe/)).toBeInTheDocument();
    // Und ausdrücklich nicht mehr der Staffelungs-Satz.
    expect(within(karte).queryByText(/Mitglieder der Stufe/)).toBeNull();
  });

  /**
   * Die Positivkontrolle an der untersten Clubstufe. Ohne sie wären die drei
   * Verneinungen darüber auch von einer Fläche erfüllt, die den Knopf NIEMANDEM
   * mehr gibt.
   */
  it("gibt einem discover-Konto den Knopf — an jedes Ziel", async () => {
    mockedFetch.mockResolvedValue(sicht("impact"));
    renderPage(authAsTier("discover"));

    await screen.findByText(KONTAKTKARTE);
    expect(screen.getByRole("button", KNOPF)).toBeInTheDocument();
  });

  /**
   * Und dasselbe Konto an ein Ziel AUSSERHALB des Clubs. Das ist die Zusage,
   * dass die Empfängerstufe wirklich nichts mehr entscheidet — die Gegenprobe
   * zur entfallenen Staffelung, von der anderen Seite.
   */
  it("… auch an ein Ziel ausserhalb des Clubs", async () => {
    mockedFetch.mockResolvedValue(sicht("connect"));
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
   * Positivkontrolle für den Schalter: er steht VOR der Stufenschwelle. Ohne
   * diese Zusage bliebe offen, ob die Oberfläche ihn überhaupt noch liest — und
   * ein Konto ausserhalb des Clubs sähe im offenen Modus eine Wand, die die
   * Datenbank gar nicht aufstellt. Auf PROD ist das der Ist-Zustand.
   */
  it("öffnet open_contact auch einem active-Konto den Knopf", async () => {
    mockedPlatform.mockResolvedValue({ openContact: true });
    mockedFetch.mockResolvedValue(sicht("impact"));
    renderPage(authAsTier("active"));

    await screen.findByText(KONTAKTKARTE);
    expect(screen.getByRole("button", KNOPF)).toBeInTheDocument();
  });
});
