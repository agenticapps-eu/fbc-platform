import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CommunityFeed from "./CommunityFeed";
import { ToastProvider } from "../ui/Toast";
import { fetchFeed, fetchPostById, type FeedPost } from "../../lib/feed";
import { AuthFixture, fakeAuthValue } from "../../test/auth-fixtures";

/**
 * Der Deeplink `?post=<id>` (AGE-587, Abschnitt 7).
 *
 * WARUM DER BEITRAG GEHOLT UND NICHT GESUCHT WIRD:
 * Der erste Entwurf wollte bis zu fünf Feed-Seiten durchlaufen und dort suchen.
 * Der Plan-Review hat gezeigt, dass diese Bauart ihrer eigenen Zusage
 * widerspricht: ein SICHTBARER Beitrag auf Seite 6 wäre unerreichbar gewesen,
 * und zwar durch korrekten Code. Jetzt wird er über seine Kennung geholt — eine
 * Anfrage, jeder sichtbare Beitrag erreichbar, unabhängig vom Alter.
 *
 * Gemockt wird nur der Datenweg; alles andere aus `lib/feed` bleibt echt.
 */
vi.mock("../../lib/feed", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/feed")>()),
  fetchFeed: vi.fn(),
  fetchPostById: vi.fn(),
}));

function post(overrides: Partial<FeedPost> = {}): FeedPost {
  return {
    id: "p1",
    author: { id: "a1", name: "Detlev Meier", avatarUrl: null, tier: "impact" },
    body: "Gestern beim #Netzwerken viel gelernt.",
    hashtags: ["netzwerken"],
    visibility: "public",
    createdAt: new Date("2026-08-01T10:00:00Z").toISOString(),
    likeCount: 0,
    commentCount: 0,
    likedByMe: false,
    savedByMe: false,
    videoUrl: null,
    kind: "member",
    event: null,
    media: [],
    ...overrides,
  };
}

const IM_FEED = post({ id: "p1", body: "Gestern beim Netzwerken viel gelernt." });
const ALT = post({
  id: "p-alt",
  body: "Ein sehr alter Beitrag von ganz unten.",
  createdAt: new Date("2019-01-01T10:00:00Z").toISOString(),
});

function renderAt(pfad: string, queryClient?: QueryClient) {
  const client =
    queryClient ??
    new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  return render(
    <AuthFixture value={fakeAuthValue()}>
      <QueryClientProvider client={client}>
        <ToastProvider>
          <MemoryRouter initialEntries={[pfad]}>
            <CommunityFeed />
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    </AuthFixture>,
  );
}

beforeEach(() => {
  vi.mocked(fetchFeed).mockReset();
  vi.mocked(fetchPostById).mockReset();
  vi.mocked(fetchFeed).mockResolvedValue({ posts: [IM_FEED], nextCursor: null });
  vi.mocked(fetchPostById).mockResolvedValue(null);
});

describe("Der verlinkte Beitrag steht oben (7.5)", () => {
  it("holt ihn über seine Kennung und stellt ihn dem Feed voran", async () => {
    vi.mocked(fetchPostById).mockResolvedValue(ALT);

    renderAt("/aktivitaet?post=p-alt");

    await screen.findByText(/ganz unten/);
    expect(vi.mocked(fetchPostById)).toHaveBeenCalledWith(null, "p-alt");

    // Die Reihenfolge ist die Zusage, nicht bloss die Anwesenheit: der
    // verlinkte Beitrag ist ALT und stünde im Feed sonst ganz unten — oder,
    // wie beim verworfenen Entwurf, gar nicht.
    const texte = screen.getAllByText(/ganz unten|viel gelernt/).map((e) => e.textContent);
    expect(texte[0]).toMatch(/ganz unten/);
  });

  it("ändert ohne Parameter gar nichts — und fragt dann auch nicht", async () => {
    renderAt("/aktivitaet");

    await screen.findByText(/viel gelernt/);
    expect(vi.mocked(fetchPostById)).not.toHaveBeenCalled();
  });
});

describe("Er steht genau einmal da (7.3, 7.8)", () => {
  /**
   * Ein Beitrag, der oben UND in der Liste steht, sieht wie ein
   * Dublettenfehler aus — und wäre einer.
   */
  it("filtert den vorangestellten Beitrag aus der Liste darunter heraus", async () => {
    vi.mocked(fetchFeed).mockResolvedValue({ posts: [IM_FEED], nextCursor: null });
    vi.mocked(fetchPostById).mockResolvedValue(IM_FEED);

    renderAt("/aktivitaet?post=p1");

    await screen.findByText(/viel gelernt/);
    await waitFor(() => expect(vi.mocked(fetchPostById)).toHaveBeenCalled());
    expect(screen.getAllByText(/viel gelernt/)).toHaveLength(1);
  });
});

describe("Der Feed lädt davon unbeeindruckt (7.2, 7.7)", () => {
  /**
   * Die scharfe Fassung: EIN Query-Client, zwei Aufbauten — einmal ohne und
   * einmal mit `?post=`. Trüge der Parameter den Schlüssel der Feed-Abfrage
   * mit, wäre der zweite Aufbau eine ANDERE Abfrage und `fetchFeed` liefe ein
   * zweites Mal. Jeder Deeplink verwürfe damit den geladenen Feed.
   *
   * Geprüft wird also am Verhalten des Zwischenspeichers und nicht an der Form
   * des Schlüssels — eine Assertion auf `feedSeitenKey(...)` bliebe grün, wenn
   * die Komponente den Parameter woanders in den Schlüssel mischte.
   */
  it("behält denselben Schlüssel mit und ohne Parameter", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });

    const ersteAnsicht = renderAt("/aktivitaet", client);
    await screen.findByText(/viel gelernt/);
    const nachErstem = vi.mocked(fetchFeed).mock.calls.length;
    ersteAnsicht.unmount();

    renderAt("/aktivitaet?post=p-alt", client);
    await screen.findByText(/viel gelernt/);

    expect(vi.mocked(fetchFeed).mock.calls.length).toBe(nachErstem);
  });
});

describe("Unsichtbar und nicht vorhanden sind ununterscheidbar (7.4, 7.6)", () => {
  /**
   * Verglichen werden die ZWEI LÄUFE MITEINANDER, nicht gegen ein Muster.
   *
   * Eine Musterprüfung („beide zeigen etwas, das /nicht verfügbar/ trifft")
   * liesse zwei VERSCHIEDENE Meldungen zu, die beide passen — und genau daran
   * liesse sich ablesen, ob es den Beitrag gibt (Befund codex). Die einzige
   * Fassung, die das ausschliesst, ist Zeichengleichheit.
   *
   * Dass beide Läufe `null` bekommen, ist keine Vereinfachung des Tests: die
   * RLS liefert für einen unsichtbaren Beitrag dieselben null Zeilen wie für
   * einen erfundenen, aus derselben Anfrage. Es gibt keinen zweiten Weg,
   * dessen Verhalten hier zu prüfen wäre.
   */
  /**
   * Der Fortschritt der Einblend-Animation (`Stagger`) steht als
   * `opacity: 0…1` im Markup und hängt an der UHR, nicht an der Eingabe. Beim
   * ersten Lauf war er 0, beim zweiten 1 — ein Unterschied, der über den
   * verlinkten Beitrag nichts aussagt und den Vergleich in beide Richtungen
   * flatterig machte. Genau dieser eine Wert wird eingeebnet, sonst nichts:
   * jede andere Abweichung im Baum soll den Test weiter rot machen.
   */
  const ohneAnimationsstand = (html: string) => html.replace(/opacity: [\d.]+/g, "opacity: <lauf>");

  async function lauf(id: string) {
    vi.mocked(fetchPostById).mockResolvedValue(null);
    const ansicht = renderAt(`/aktivitaet?post=${id}`);
    await screen.findByText(/nicht verfügbar/i);
    const html = ohneAnimationsstand(ansicht.container.innerHTML);
    const aufrufe = vi.mocked(fetchPostById).mock.calls.length;
    ansicht.unmount();
    return { html, aufrufe };
  }

  it("erzeugt für einen unsichtbaren und einen erfundenen Beitrag dieselbe Fläche", async () => {
    const unsichtbar = await lauf("11111111-1111-1111-1111-111111111111");
    vi.mocked(fetchPostById).mockClear();
    const erfunden = await lauf("22222222-2222-2222-2222-222222222222");

    expect(erfunden.html).toBe(unsichtbar.html);
    expect(erfunden.aufrufe).toBe(unsichtbar.aufrufe);
  });

  it("zeigt den Feed trotzdem — die Meldung ersetzt ihn nicht", async () => {
    renderAt("/aktivitaet?post=gibtsnicht");

    expect(await screen.findByText(/nicht verfügbar/i)).toBeInTheDocument();
    expect(screen.getByText(/viel gelernt/)).toBeInTheDocument();
  });
});
