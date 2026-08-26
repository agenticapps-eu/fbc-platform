import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { LEVELS, LEVEL_ORDER } from "../config/levels";
import { extractFirstVideo, type FeedPost } from "../lib/feed";
import { AuthFixture, fakeAuthValue } from "../test/auth-fixtures";
import HomePage, { PostPreview } from "./HomePage";
import { REGISTRIEREN_PFAD } from "./LoginPage";

/** Regression: YouTube-Links wurden auf der Startseite als nackte URL angezeigt
 *  statt eingebettet (im Community-Feed aber schon). PostPreview bettet jetzt
 *  wie der Feed ein und nimmt die URL aus dem Vorschautext. */
function makePost(body: string): FeedPost {
  return {
    id: "p1",
    author: { id: "a1", name: "Ein Mitglied", avatarUrl: null, tier: null },
    body,
    hashtags: [],
    visibility: "public",
    createdAt: new Date("2026-07-23T08:00:00Z").toISOString(),
    likeCount: 0,
    commentCount: 0,
    likedByMe: false,
    savedByMe: false,
    media: [],
    // Die Fixtur leitet `videoUrl` aus dem Body ab, weil die DATENBANK das tut
    // (trg_posts_video_url → erste_video_url, 20260813090000). Ein fest
    // gesetzter Wert liesse den Test an der Fixtur haengen statt am Verhalten.
    // Dass beide Erkenner deckungsgleich sind, misst
    // scripts/probe-c9-parser-paritaet.ts — hier darf man sich darauf stuetzen.
    videoUrl: extractFirstVideo(body)?.url ?? null,
    kind: "member",
    event: null,
  };
}

function renderPreview(body: string) {
  return render(
    <MemoryRouter>
      <PostPreview post={makePost(body)} isLoggedIn={false} />
    </MemoryRouter>,
  );
}

describe("PostPreview — Startseiten-Vorschau", () => {
  it("bettet einen YouTube-Link ein und zeigt nicht die nackte URL", () => {
    renderPreview("Einfach mal entspannen! https://www.youtube.com/watch?v=dQw4w9WgXcQ");

    // Seit AGE-611 steht hier zunächst die Einwilligungsfläche statt des
    // Rahmens — auf DIESER Seite, die ausgeloggt erreichbar ist, ist das der
    // ganze Punkt. Der Rahmen kommt erst nach der Aktivierung.
    expect(document.querySelector("iframe")).toBeNull();
    const knopf = screen.getByRole("button", { name: /Video von YouTube laden/i });

    fireEvent.click(knopf);
    const iframe = document.querySelector("iframe");
    expect(iframe).not.toBeNull();
    expect(iframe?.getAttribute("src")).toContain("youtube-nocookie.com/embed/dQw4w9WgXcQ");

    // Der rohe Watch-Link darf nicht mehr im Text stehen; der übrige Text bleibt.
    // Diese Zusage ist von AGE-611 unberührt und bleibt deshalb stehen.
    expect(screen.queryByText(/youtube\.com\/watch/)).toBeNull();
    expect(screen.getByText(/Einfach mal entspannen!/)).toBeInTheDocument();
  });

  it("lädt den Anbieter nicht, solange die Fläche nicht aktiviert wurde", () => {
    // Die Regressionsschwelle für den Befund aus AGE-611: ein Besucher OHNE
    // Konto darf mit dem blossen Seitenaufruf keinen Drittanbieter-Aufruf
    // auslösen. jsdom stellt keine Verbindungen her — geprüft wird deshalb das
    // Fehlen des Rahmens, der sie auslösen würde.
    renderPreview("Kurzvorstellung https://vimeo.com/76979871");

    expect(document.querySelector("iframe")).toBeNull();
    expect(screen.getByRole("button", { name: /Video von Vimeo laden/i })).toBeInTheDocument();
  });

  it("zeigt reinen Text ohne Embed, wenn kein Video enthalten ist", () => {
    renderPreview("Nur Text, kein Video.");

    expect(document.querySelector("iframe")).toBeNull();
    expect(screen.getByText("Nur Text, kein Video.")).toBeInTheDocument();
  });
});

/**
 * Die ganze Gästeseite, nicht nur eine Vorschaukarte (AGE-616 / AGE-541).
 *
 * Vor diesem Block rendert diese Datei ausschließlich <PostPreview>. Sie hätte
 * das Entfernen der erfundenen Kacheln also gar nicht bemerken können — „die
 * bestehenden Tests prüfen" wäre hier keine Abdeckung gewesen, sondern ein
 * grüner Lauf ohne Aussage. Gefunden in der Plan-Review.
 *
 * Was hier NICHT geprüft werden kann: die Breakpoints. jsdom rechnet kein
 * Layout, `lg:` ist für es eine Zeichenkette. Ob die Schiene wirklich neben dem
 * Leseinhalt steht, misst nur der Browser (AGE-607).
 */
describe("Öffentliche Startseite — Gästeansicht", () => {
  function zeigeGaesteseite() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <AuthFixture value={fakeAuthValue()}>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={["/"]}>
            <HomePage />
          </MemoryRouter>
        </QueryClientProvider>
      </AuthFixture>,
    );
  }

  it("zeigt keine erfundene Mitglieder- oder Eventzahl", () => {
    zeigeGaesteseite();

    // Beide standen als feste Zeichenketten im JSX, aus keiner Abfrage.
    expect(screen.queryByText("120+")).toBeNull();
    expect(screen.queryByText("24")).toBeNull();
    expect(screen.queryByText(/Events 2026/)).toBeNull();
  });

  it("zeigt keine Zitate, die einem unbenannten Archetyp zugeschrieben sind", () => {
    zeigeGaesteseite();

    expect(screen.queryByText(/Ein Impact-Mitglied/)).toBeNull();
    expect(screen.queryByText(/Ein Focus-Mitglied/)).toBeNull();
    expect(screen.queryByText(/Stimmen aus dem Club/)).toBeNull();
  });

  it("nennt in der Schiene alle Stufen aus der Anwendung, in ihrer Reihenfolge", () => {
    zeigeGaesteseite();

    // Gegen LEVEL_ORDER geprüft, nicht gegen eine abgeschriebene Liste: eine
    // zweite Liste driftet von dem weg, was die Plattform tatsächlich verkauft.
    const sichtbar = LEVEL_ORDER.map((key) => screen.getByText(LEVELS[key].label));
    expect(sichtbar).toHaveLength(LEVEL_ORDER.length);

    // Reihenfolge: jede Stufe steht im Dokument vor der nächsten.
    for (let i = 0; i < sichtbar.length - 1; i++) {
      const stellung = sichtbar[i].compareDocumentPosition(sichtbar[i + 1]);
      expect(stellung & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it("nennt zu jeder Stufe, was sie freischaltet und was sie kostet", () => {
    zeigeGaesteseite();

    expect(screen.getByText(LEVELS.discover.summary)).toBeInTheDocument();
    // Preis mit Intervall, nicht als nackte Zahl.
    expect(screen.getByText(/150/)).toBeInTheDocument();
    // Die kostenlosen Stufen sagen das, statt „0 €" zu zeigen.
    expect(screen.getAllByText(/kostenlos/i).length).toBeGreaterThan(0);
  });

  it("führt die Einladung in die Registrierung, nicht in den Login", () => {
    zeigeGaesteseite();

    // „Mitglied werden" landete bis AGE-616 im LOGIN-Formular: `mode` war
    // lokaler Zustand ohne Adresse. Ein Knopf, der zum Beitritt einlädt und
    // ein Anmeldeformular zeigt, verlangt etwas Unmögliches.
    const einladungen = screen.getAllByRole("link", { name: /Mitglied werden/i });
    expect(einladungen.length).toBeGreaterThan(0);
    for (const link of einladungen) {
      expect(link.getAttribute("href")).toBe(REGISTRIEREN_PFAD);
    }
  });
});
