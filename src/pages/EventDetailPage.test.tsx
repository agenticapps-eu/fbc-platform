import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthFixture, authAsTier, fakeAuthValue } from "../test/auth-fixtures";
import { ToastProvider } from "../components/ui/Toast";
import type { AttendeeFace, EventListItem } from "../lib/events";

/**
 * Gemockt wird NUR der Netzweg (`fetch*` und das Signieren), nie die reine
 * Logik: `formatEventSpan` und `selectSimilarEvents` laufen echt. Sonst prüfte
 * diese Datei ihre eigenen Rückgabewerte statt der Seite.
 */
vi.mock("../lib/events", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/events")>();
  return {
    ...actual,
    fetchEvent: vi.fn(),
    fetchEvents: vi.fn(),
    fetchEventAttendees: vi.fn(),
    fetchAttendees: vi.fn(),
  };
});
vi.mock("../lib/event-cover", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/event-cover")>();
  return { ...actual, signEventCovers: vi.fn(async () => ({})) };
});

import { signEventCovers } from "../lib/event-cover";
const mSign = vi.mocked(signEventCovers);

import { fetchEvent, fetchEvents, fetchEventAttendees, fetchAttendees } from "../lib/events";
import EventDetailPage from "./EventDetailPage";

const mEvent = vi.mocked(fetchEvent);
const mEvents = vi.mocked(fetchEvents);
const mFaces = vi.mocked(fetchEventAttendees);
const mAttendees = vi.mocked(fetchAttendees);

function evt(over: Partial<EventListItem> = {}): EventListItem {
  return {
    id: "e1",
    title: "FBC Online-Treffen",
    type: "online",
    startsAt: new Date(2026, 6, 29, 20, 0).toISOString(),
    endsAt: new Date(2026, 6, 29, 21, 0).toISOString(),
    location: "Online (Zoom)",
    description: "Unser regelmäßiges Online-Treffen für alle Mitglieder.",
    coverPath: null,
    topics: ["Aktuelle Club-News", "Neue Mitglieder begrüßen"],
    visibility: "members",
    capacity: null,
    host: null,
    registeredCount: 0,
    waitlistCount: 0,
    myStatus: null,
    ...over,
  };
}

function gesicht(id: string): AttendeeFace {
  return { profileId: id, name: `Mitglied ${id}`, avatarUrl: null, status: "registered" };
}

function renderPage(eingeloggt: boolean) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AuthFixture value={eingeloggt ? authAsTier("impact") : fakeAuthValue()}>
        <ToastProvider>
          <MemoryRouter initialEntries={["/events/e1"]}>
            <Routes>
              <Route path="/events/:id" element={<EventDetailPage />} />
            </Routes>
          </MemoryRouter>
        </ToastProvider>
      </AuthFixture>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mEvents.mockResolvedValue([]);
  mFaces.mockResolvedValue([]);
  mAttendees.mockResolvedValue([]);
});

describe("EventDetailPage — Zeitspanne", () => {
  it("zeigt ein Datum mit zwei Uhrzeiten, wenn das Event an einem Tag liegt", async () => {
    mEvent.mockResolvedValue(evt());
    renderPage(true);
    const wann = await screen.findByText(/20:00 – 21:00 Uhr/);
    expect(wann).toBeInTheDocument();
  });

  it("zeigt ohne Ende nur den Beginn", async () => {
    mEvent.mockResolvedValue(evt({ endsAt: null }));
    renderPage(true);
    expect(await screen.findByText(/20:00 Uhr/)).toBeInTheDocument();
    expect(screen.queryByText(/–/)).not.toBeInTheDocument();
  });
});

describe("EventDetailPage — Teilnehmerreihe", () => {
  it("zeigt fünf Gesichter und den Rest als +n", async () => {
    mEvent.mockResolvedValue(evt({ registeredCount: 64 }));
    mFaces.mockResolvedValue(["a", "b", "c", "d", "e", "f", "g"].map(gesicht));
    renderPage(true);
    expect(await screen.findByText("Teilnehmer (64)")).toBeInTheDocument();
    expect(screen.getByText("+59")).toBeInTheDocument();
  });

  it("zeigt dem Host keine Abmeldungen und keine Warteliste als Gesichter", async () => {
    // Befund aus dem Diff-Review (codex, MEDIUM). `event_attendees` gibt dem
    // HOST jeden Status heraus — das braucht er für sein Werkzeug. Die
    // Avatarreihe ist aber die Antwort auf „wer kommt", und da hat eine
    // Abmeldung nichts verloren. Der pgTAP-Fall prüft die RPC, dieser hier die
    // Reihe; die React-Tests fuhren vorher nur mit `registered`-Fixtures und
    // konnten den Fehler deshalb nicht sehen.
    mEvent.mockResolvedValue(evt({ registeredCount: 2 }));
    mFaces.mockResolvedValue([
      { ...gesicht("a"), name: "Kommt Wirklich" },
      { ...gesicht("b"), name: "Hat Abgesagt", status: "cancelled" },
      { ...gesicht("c"), name: "Steht Auf Warteliste", status: "waitlist" },
    ]);
    renderPage(true);
    expect(await screen.findByText("Teilnehmer (2)")).toBeInTheDocument();
    expect(screen.getByTitle("Kommt Wirklich")).toBeInTheDocument();
    expect(screen.queryByTitle("Hat Abgesagt")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Steht Auf Warteliste")).not.toBeInTheDocument();
  });

  it("nennt die volle Zahl, auch wenn weniger Gesichter auflösbar sind", async () => {
    // Der Kern der Datenschutz-Entscheidung: `event_attendees` lässt Mitglieder
    // ohne öffentliches Profil aus, die Zahl bleibt vollständig. Würde die Seite
    // die Zahl aus den Zeilen rechnen, verschwänden diese Menschen auch aus der
    // Statistik — und die Anzeige wäre schlicht falsch.
    mEvent.mockResolvedValue(evt({ registeredCount: 10 }));
    mFaces.mockResolvedValue([gesicht("a"), gesicht("b")]);
    renderPage(true);
    expect(await screen.findByText("Teilnehmer (10)")).toBeInTheDocument();
    expect(screen.getByText("+8")).toBeInTheDocument();
  });
});

describe("EventDetailPage — Layout nach Mockup", () => {
  const host = {
    kind: "profile" as const,
    id: "h1",
    name: "Detlev Krause",
    avatarUrl: null,
    tier: "impact",
    company: "DK Real Invest eG",
    roles: ["Vorstand"],
    shortBio: "Deal Keeper und Vorstand der DK Real Invest eG.",
  };

  it("zeigt die Sichtbarkeit als Satz, nicht als Rohwert", async () => {
    // Die Frage stellt sich genau dann, wenn jemand ans Anmelden denkt. Das
    // Mockup führt die Zeile; die erste Fassung sagte dazu gar nichts.
    mEvent.mockResolvedValue(evt({ visibility: "members" }));
    renderPage(true);
    expect(await screen.findByText(/Nur für Mitglieder/)).toBeInTheDocument();
  });

  it("sagt bei einem öffentlichen Event, dass es offen ist", async () => {
    mEvent.mockResolvedValue(evt({ visibility: "public" }));
    renderPage(true);
    expect(await screen.findByText(/Offen für alle Mitglieder/)).toBeInTheDocument();
  });

  it("gibt dem Veranstalter eine Karte mit Rolle, Firma und Kurzbio", async () => {
    mEvent.mockResolvedValue(evt({ host }));
    renderPage(true);
    // Auf die Karte eingrenzen: „DK Real Invest eG" steht auch in der Kurzbio,
    // eine Seiten-weite Suche fände zwei Treffer und sagte nichts über den Ort.
    const karte = (await screen.findByRole("heading", { name: "Veranstalter" }))
      .parentElement as HTMLElement;
    expect(within(karte).getByText(/Vorstand · DK Real Invest eG/)).toBeInTheDocument();
    expect(within(karte).getByText(/Deal Keeper und Vorstand/)).toBeInTheDocument();
    expect(within(karte).getByRole("link", { name: /Profil ansehen/ })).toHaveAttribute(
      "href",
      "/p/h1",
    );
  });

  it("lässt bei einem Host ohne Firma und Bio keine leeren Zeilen stehen", async () => {
    mEvent.mockResolvedValue(
      evt({ host: { ...host, company: null, roles: null, shortBio: null } }),
    );
    renderPage(true);
    const karte = (await screen.findByRole("heading", { name: "Veranstalter" }))
      .parentElement as HTMLElement;
    expect(within(karte).queryByText(/DK Real Invest/)).not.toBeInTheDocument();
    expect(within(karte).queryByText(/Deal Keeper/)).not.toBeInTheDocument();
    // Name und „Profil ansehen" bleiben — die Karte ist nicht leer, nur knapp.
    expect(within(karte).getByText("Detlev Krause")).toBeInTheDocument();
    expect(within(karte).getByRole("link", { name: /Profil ansehen/ })).toBeInTheDocument();
  });

  it("verlinkt von den ähnlichen Events auf die volle Liste", async () => {
    const self = evt();
    const anderes = evt({
      id: "e2",
      title: "Zweites Treffen",
      startsAt: new Date(Date.now() + 5 * 86400000).toISOString(),
      endsAt: null,
    });
    mEvent.mockResolvedValue(self);
    mEvents.mockResolvedValue([self, anderes]);
    renderPage(true);
    expect(await screen.findByRole("link", { name: /Alle Events anzeigen/ })).toHaveAttribute(
      "href",
      "/events",
    );
  });
});

describe("EventDetailPage — ohne Session", () => {
  it("fragt weder Teilnehmer noch Host ab, zeigt das Event aber", async () => {
    mEvent.mockResolvedValue(evt({ registeredCount: 12, visibility: "public" }));
    renderPage(false);
    expect(
      await screen.findByRole("heading", { level: 1, name: "FBC Online-Treffen" }),
    ).toBeInTheDocument();
    expect(mFaces).not.toHaveBeenCalled();
    expect(screen.queryByText(/^Teilnehmer \(/)).not.toBeInTheDocument();
  });
});

describe("EventDetailPage — ähnliche Events", () => {
  it("zeigt andere Events, aber nie das eigene", async () => {
    const self = evt();
    const anderes = evt({
      id: "e2",
      title: "Zweites Online-Treffen",
      startsAt: new Date(Date.now() + 5 * 86400000).toISOString(),
      endsAt: null,
    });
    mEvent.mockResolvedValue(self);
    mEvents.mockResolvedValue([self, anderes]);
    renderPage(true);
    expect(await screen.findByText("Ähnliche Events")).toBeInTheDocument();
    expect(screen.getByText("Zweites Online-Treffen")).toBeInTheDocument();
    // Schärfer als eine Textzählung (der Titel steht seit der Brotkrume zweimal
    // auf der Seite): es gibt KEINEN Link auf das eigene Event. Genau das ist
    // gemeint — eine Kachel ist ein Link auf `/events/<id>`.
    expect(screen.queryByRole("link", { name: /FBC Online-Treffen/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Zweites Online-Treffen/ })).toBeInTheDocument();
  });

  it("signiert Header und ähnliche Events in EINEM Stapel", async () => {
    // Die Zusicherung aus dem Spec-Delta: ein Signieraufruf je Ansicht, nicht
    // einer je Komponente. Die erste Fassung machte zwei — Header und
    // „Ähnliche Events" riefen den Haken je für sich auf. Befund aus dem
    // Diff-Review; ohne diese Zusicherung wächst die Zahl still mit jedem
    // weiteren Block, der ein Cover zeigt.
    const self = evt({ coverPath: "uid/self.webp" });
    const anderes = evt({
      id: "e2",
      title: "Zweites Treffen",
      coverPath: "uid/andere.webp",
      startsAt: new Date(Date.now() + 5 * 86400000).toISOString(),
      endsAt: null,
    });
    mEvent.mockResolvedValue(self);
    mEvents.mockResolvedValue([self, anderes]);
    renderPage(true);
    await screen.findByText("Zweites Treffen");
    expect(mSign).toHaveBeenCalledTimes(1);
    expect(mSign.mock.calls[0][0].sort()).toEqual(["uid/andere.webp", "uid/self.webp"]);
  });

  it("holt die Liste selbst, wenn die Übersicht nie geladen wurde", async () => {
    // Deeplink, Neuladen, Lesezeichen: der Cache ist leer. Aus dem Plan-Review —
    // die erste Fassung las nur aus dem Cache und zeigte dann stillschweigend
    // nichts.
    mEvent.mockResolvedValue(evt());
    renderPage(true);
    await screen.findByRole("heading", { level: 1, name: "FBC Online-Treffen" });
    expect(mEvents).toHaveBeenCalled();
  });
});
