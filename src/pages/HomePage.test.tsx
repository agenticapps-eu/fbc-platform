import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { extractFirstVideo, type FeedPost } from "../lib/feed";
import { PostPreview } from "./HomePage";

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
