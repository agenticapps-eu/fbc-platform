import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../components/ui/Toast";
import type { AuthContextValue } from "../providers/auth-context";
import { AuthFixture, authAsTier, fakeAuthValue } from "../test/auth-fixtures";
import type { PublicProfileData } from "../lib/public-profile";

// Die Datenschicht wird gemockt: getestet wird der Render-Vertrag der Seite gegenüber
// dem, was die RLS zurückgibt (extended === null ⇒ nur öffentlich; extended gesetzt ⇒
// erweiterte Sicht). Die RLS selbst ist auf DB-Ebene per SQL verifiziert.
vi.mock("../lib/public-profile", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/public-profile")>();
  return { ...actual, fetchPublicProfile: vi.fn() };
});
// Auch die Kontaktbeziehung wird gemockt: getestet wird der Render-Vertrag der Seite
// gegenüber dem, was die RLS zurückgibt (contact nur bei accepted). Die RLS selbst ist
// auf DB-Ebene verifiziert.
vi.mock("../lib/contact-requests", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/contact-requests")>();
  return { ...actual, fetchContactRelation: vi.fn(), sendContactRequest: vi.fn() };
});
vi.mock("../lib/platform-settings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/platform-settings")>();
  return { ...actual, fetchPlatformSettings: vi.fn() };
});
import { fetchPublicProfile } from "../lib/public-profile";
import {
  fetchContactRelation,
  sendContactRequest,
  type ContactRelation,
} from "../lib/contact-requests";
import { fetchPlatformSettings } from "../lib/platform-settings";
import PublicProfilePage from "./PublicProfilePage";

const mockedFetch = vi.mocked(fetchPublicProfile);
const mockedRelation = vi.mocked(fetchContactRelation);
const mockedSend = vi.mocked(sendContactRequest);
const mockedPlatform = vi.mocked(fetchPlatformSettings);

const NO_RELATION: ContactRelation = { request: null, contact: null, matchId: null };

const PROFILE_ID = "5e195a30-0000-0000-0000-000000000001";

const publicProfile = {
  id: PROFILE_ID,
  name: "Legacy Demo",
  avatar_url: null,
  cover_url: null,
  region: "Berlin",
  company: "Legacy GmbH",
  short_bio: "Begleitet Unternehmer beim Aufbau von Ökosystemen.",
  tier: "impact",
  roles: ["Unternehmer", "Investor"],
};

const discoverView: PublicProfileData = { publicProfile, extended: null };

const fullView: PublicProfileData = {
  publicProfile,
  extended: {
    headline: null,
    branche: null,
    member_since: null,
    posts: [],
    potential_score: 842,
    competencies: ["M&A", "Mentoring"],
    videos: [],
    interests: [{ theme: "tun", label: "Unternehmensaufbau" }],
    offers: [
      {
        id: "o1",
        category: null,
        theme: "haben",
        title: "Beteiligungskapital",
        description: "Eigenkapital.",
        source: "editor",
      },
    ],
    needs: [
      {
        id: "n1",
        category: null,
        theme: "wirken",
        title: "Impact-Projekte",
        description: "DACH-Raum.",
        source: "editor",
      },
    ],
  },
};

function renderPage(value: AuthContextValue) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
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

beforeEach(() => {
  mockedFetch.mockReset();
  mockedRelation.mockReset();
  mockedRelation.mockResolvedValue(NO_RELATION);
  mockedSend.mockReset();
  mockedPlatform.mockReset();
  mockedPlatform.mockResolvedValue({ openContact: false });
});

describe("Öffentliche Profilseite (AGE-239)", () => {
  it("zeigt Basic nur öffentliche Felder (Name, Rollen, Tier) — keine erweiterten Blöcke", async () => {
    mockedFetch.mockResolvedValue(discoverView);
    renderPage(authAsTier("basic"));

    expect(await screen.findByRole("heading", { name: "Legacy Demo" })).toBeInTheDocument();
    expect(screen.getByText("Investor")).toBeInTheDocument();
    expect(screen.getByText(/Impact Member/i)).toBeInTheDocument();

    // Erweiterte Blöcke fehlen — die RLS gab sie nicht frei (extended === null).
    // Geprüft an „Hobbys" statt am Erfolgsradar: der ist seit AGE-597 fort, und
    // eine Zusage über eine Fläche, die es nirgends mehr gibt, wäre konstant
    // erfüllt und prüfte nichts.
    expect(screen.queryByRole("heading", { name: "Hobbys" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Kompetenzen" })).not.toBeInTheDocument();
    expect(screen.queryByText("842")).not.toBeInTheDocument();
    // Kein Kontakt-Senden-Button für Basic; stattdessen der Upgrade-Hinweis-Block.
    expect(screen.queryByRole("button", { name: "Kontaktanfrage senden" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Erweiterte Profilangaben" })).toBeInTheDocument();
  });

  // AGE-534, Sichtprobe 7.8: die importierten Biografien sind mehrzeilig (35 von
  // 48, die längste 3877 Zeichen). Ohne `whitespace-pre-line` faltet HTML jeden
  // Umbruch zu einem Leerzeichen, und aus fünf Absätzen wird eine Textwand.
  //
  // jsdom rechnet kein CSS, dieser Test kann den Umbruch also NICHT sehen — er
  // hält die Klasse fest, die ihn im Browser bewirkt. Den sichtbaren Beleg gibt
  // nur die Sichtprobe (7.8).
  it("bewahrt die Absätze der Biografie und der Angebote", async () => {
    mockedFetch.mockResolvedValue(fullView);
    renderPage(authAsTier("discover"));

    const bio = await screen.findByText(publicProfile.short_bio);
    expect(bio.className).toContain("whitespace-pre-line");
    expect(screen.getByText("DACH-Raum.").className).toContain("whitespace-pre-line");
  });

  // AGE-534: die importierten Biografien sind bis 3877 Zeichen lang; ausgeklappt
  // schöben sie alles andere aus dem Bild. Drei Zeilen und ein „Mehr anzeigen".
  //
  // jsdom RECHNET KEIN LAYOUT — `scrollHeight` und `clientHeight` sind dort
  // beide 0, und ohne Nachhilfe fände dieser Test nie einen gekürzten Text.
  // Gestellt wird deshalb genau das, was jsdom fehlt (die zwei Masse des
  // Browsers), nicht eigener Code. Dass die Kürzung SICHTBAR eintritt, belegt
  // allein die Sichtprobe.
  describe("lange Biografie", () => {
    function stelleLayout(scrollHeight: number, clientHeight: number) {
      const alt = {
        scroll: Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollHeight"),
        client: Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight"),
      };
      Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
        configurable: true,
        get: () => scrollHeight,
      });
      Object.defineProperty(HTMLElement.prototype, "clientHeight", {
        configurable: true,
        get: () => clientHeight,
      });
      return () => {
        if (alt.scroll) Object.defineProperty(HTMLElement.prototype, "scrollHeight", alt.scroll);
        if (alt.client) Object.defineProperty(HTMLElement.prototype, "clientHeight", alt.client);
      };
    }

    it("kürzt auf drei Zeilen und klappt auf Klick auf", async () => {
      const zurueck = stelleLayout(600, 60);
      try {
        mockedFetch.mockResolvedValue(fullView);
        renderPage(authAsTier("discover"));

        const bio = await screen.findByText(publicProfile.short_bio);
        expect(bio.className).toContain("line-clamp-3");

        const mehr = screen.getByRole("button", { name: /mehr anzeigen/i });
        fireEvent.click(mehr);

        expect(screen.getByText(publicProfile.short_bio).className).not.toContain("line-clamp-3");
        expect(screen.getByRole("button", { name: /weniger anzeigen/i })).toBeInTheDocument();
      } finally {
        zurueck();
      }
    });

    it("zeigt bei einer kurzen Biografie keinen Aufklapp-Weg", async () => {
      // Sonst stünde unter einem Zweizeiler ein „Mehr anzeigen", das nichts
      // aufklappt — der Grund, warum überhaupt gemessen wird.
      const zurueck = stelleLayout(60, 60);
      try {
        mockedFetch.mockResolvedValue(fullView);
        renderPage(authAsTier("discover"));

        await screen.findByText(publicProfile.short_bio);
        expect(screen.queryByRole("button", { name: /mehr anzeigen/i })).not.toBeInTheDocument();
      } finally {
        zurueck();
      }
    });
  });

  // §2 trennt zwei Schwellen, die bis AGE-311 beide auf Prime lagen: das
  // „vollständige Verzeichnis" (erweiterte Felder, ab `discover`) und das
  // Kontaktrecht (ab `exchange`). Genau diese Lücke ist der verteidigbare Kern —
  // Sichtbarkeit ist kein Kontaktrecht —, deshalb je ein eigener Test.
  it("zeigt Discover die erweiterten Felder, aber KEINEN Kontaktanfrage-Button", async () => {
    mockedFetch.mockResolvedValue(fullView);
    renderPage(authAsTier("discover"));

    // „Hobbys" (aus `profile_interests`) steht stellvertretend für die
    // erweiterten Angaben — bis AGE-597 stand hier der Erfolgsradar. Er ist
    // entfallen, die SCHWELLE, die dieser Test prüft, ist es nicht: sie darf
    // nicht mit der Anzeige verschwinden (Befund codex im Plan-Review).
    expect(await screen.findByRole("heading", { name: "Hobbys" })).toBeInTheDocument();
    // AGE-498: „Kompetenzen" ist als eigene Karte weggefallen — sie steht jetzt
    // unter „Beruf", und „Such- & Bieteprofil" heißt nach dem Mockup „Ich biete"
    // und „Ich suche". Die SCHWELLE, die dieser Test prüft, ist unverändert:
    // Discover sieht die erweiterten Felder, darf aber nicht anschreiben.
    expect(screen.getByRole("heading", { name: "Beruf" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ich biete" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ich suche" })).toBeInTheDocument();
    expect(screen.getByText("842")).toBeInTheDocument();
    expect(screen.getByText("Beteiligungskapital")).toBeInTheDocument();
    expect(screen.getByText("Impact-Projekte")).toBeInTheDocument();

    // Sehen ja, anschreiben nein.
    expect(screen.queryByRole("button", { name: "Kontaktanfrage senden" })).not.toBeInTheDocument();
    expect(screen.getByText(/Kontaktanfragen sind ab der Mitgliedsstufe/)).toBeInTheDocument();
    expect(screen.getByText("Exchange")).toBeInTheDocument();
  });

  it("zeigt Exchange zusätzlich den Kontaktanfrage-Button", async () => {
    mockedFetch.mockResolvedValue(fullView);
    renderPage(authAsTier("exchange"));

    expect(await screen.findByRole("heading", { name: "Hobbys" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Kontaktanfrage senden" })).toBeInTheDocument();
  });

  it("zeigt auf dem eigenen Profil „Profil bearbeiten“ statt eines Kontakt-Buttons", async () => {
    mockedFetch.mockResolvedValue(fullView);
    renderPage(
      fakeAuthValue({
        user: { id: PROFILE_ID } as AuthContextValue["user"],
        tier: "impact",
        levelRank: 6,
      }),
    );

    expect(await screen.findByRole("link", { name: "Profil bearbeiten" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Kontaktanfrage senden" })).not.toBeInTheDocument();
  });

  it("zeigt vor Annahme keine Kontaktdaten — Hinweis ist präsent, keine E-Mail/Telefon", async () => {
    mockedFetch.mockResolvedValue(fullView);
    renderPage(authAsTier("exchange"));

    expect(
      await screen.findByText("E-Mail, Telefon und Anschrift werden nie automatisch angezeigt."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Kontakt freigegeben/)).not.toBeInTheDocument();
  });

  it("zeigt Kontaktdaten ERST nach Annahme (RLS gibt `contact` nur bei accepted zurück)", async () => {
    mockedFetch.mockResolvedValue(fullView);
    mockedRelation.mockResolvedValue({
      request: { id: "cr1", status: "accepted", outgoing: true },
      contact: {
        email: "legacy@example.com",
        phone: "+49 30 1234567",
        street: null,
        postal_code: null,
        city: null,
        state: null,
        country: null,
      },
      matchId: null,
    });
    renderPage(authAsTier("exchange"));

    expect(await screen.findByText("Kontakt freigegeben")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "legacy@example.com" })).toHaveAttribute(
      "href",
      "mailto:legacy@example.com",
    );
    expect(screen.getByRole("link", { name: "+49 30 1234567" })).toHaveAttribute(
      "href",
      "tel:+49 30 1234567",
    );
    // Im freigegebenen Zustand verschwindet der Senden-Button.
    expect(screen.queryByRole("button", { name: "Kontaktanfrage senden" })).not.toBeInTheDocument();
  });

  it("zeigt bei open_contact auch Basic den Kontaktanfrage-Button (AGE-455)", async () => {
    mockedFetch.mockResolvedValue(fullView);
    mockedPlatform.mockResolvedValue({ openContact: true });
    renderPage(authAsTier("basic"));

    expect(
      await screen.findByRole("button", { name: "Kontaktanfrage senden" }),
    ).toBeInTheDocument();
  });

  it("zeigt bei RLS-Ablehnung (42501) eine freundliche Meldung, nicht den rohen Fehler (AGE-455)", async () => {
    mockedFetch.mockResolvedValue(fullView);
    mockedSend.mockRejectedValue({
      code: "42501",
      message: 'new row violates row-level security policy for table "contact_requests"',
    });
    renderPage(authAsTier("exchange"));

    fireEvent.click(await screen.findByRole("button", { name: "Kontaktanfrage senden" }));
    fireEvent.click(await screen.findByRole("button", { name: "Anfrage senden" }));

    expect(await screen.findByText(/nur über ein gemeinsames Match möglich/)).toBeInTheDocument();
    expect(screen.queryByText(/row-level security/)).not.toBeInTheDocument();
  });
});

/**
 * Die Aktivitäten-Karte führt in den Feed (AGE-587, Abschnitt 8).
 *
 * DIESELBE Zusage steht in `ProfilAnsichtPage.test.tsx` für „Meine Beiträge".
 * Das Spec-Delta sagt „jede Zeile, auf JEDEM Profil", und der erste Plan
 * verlinkte nur diese Seite hier — die eigene wäre stumm geblieben (Befund
 * codex). Wer eine der beiden Zusagen ändert, soll die andere finden.
 */
describe("Aktivitäten-Karte: jede Zeile führt zu ihrem Beitrag (AGE-587)", () => {
  const mitBeitraegen = (posts: { id: string; body: string; created_at: string }[]) => ({
    ...fullView,
    extended: { ...fullView.extended!, posts },
  });

  it("macht jede Zeile zu einem Link auf IHREN Beitrag", async () => {
    mockedFetch.mockResolvedValue(
      mitBeitraegen([
        { id: "post-eins", body: "Erster Gedanke", created_at: "2026-08-01T10:00:00Z" },
        { id: "post-zwei", body: "Zweiter Gedanke", created_at: "2026-08-02T10:00:00Z" },
      ]),
    );
    renderPage(authAsTier("discover"));

    // Auf IHREN — nicht beide auf denselben und nicht beide auf den Feed.
    expect(await screen.findByRole("link", { name: /Erster Gedanke/ })).toHaveAttribute(
      "href",
      "/aktivitaet?post=post-eins",
    );
    expect(screen.getByRole("link", { name: /Zweiter Gedanke/ })).toHaveAttribute(
      "href",
      "/aktivitaet?post=post-zwei",
    );
  });

  /**
   * Ein `div` mit `onClick` bestünde `fireEvent.click` und wäre trotzdem nicht
   * bedienbar: keine Tastatur, kein Kontextmenü, kein „in neuem Tab öffnen"
   * (Befund gemini). Geprüft wird deshalb die ROLLE, nicht ein Klick.
   */
  it("ist ein echtes Verweiselement, kein anklickbarer Kasten", async () => {
    mockedFetch.mockResolvedValue(
      mitBeitraegen([{ id: "p1", body: "Ein Gedanke", created_at: "2026-08-01T10:00:00Z" }]),
    );
    renderPage(authAsTier("discover"));

    const link = await screen.findByRole("link", { name: /Ein Gedanke/ });
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href");
  });

  /**
   * „Beitrag ohne Text" und NICHT „Beitrag mit Bild": `create_post_with_media`
   * nimmt leeren Text UND leere Medien an, und das Spalten-UPDATE-Recht aus
   * AGE-582 lässt ein Mitglied den eigenen Text nachträglich leeren, ohne dass
   * Bilder entstünden. Die Karte behauptete sonst etwas, das sie nicht geprüft
   * hat (Befund codex, Donalds Entscheidung vom 25.08.).
   */
  it("gibt einer textlosen Zeile einen Ersatztext, statt leer zu bleiben", async () => {
    mockedFetch.mockResolvedValue(
      mitBeitraegen([{ id: "p-leer", body: "", created_at: "2026-08-01T10:00:00Z" }]),
    );
    renderPage(authAsTier("discover"));

    const link = await screen.findByRole("link", { name: /Beitrag ohne Text/ });
    expect(link).toHaveAttribute("href", "/aktivitaet?post=p-leer");
    expect(screen.queryByText(/Beitrag mit Bild/)).not.toBeInTheDocument();
  });
});
