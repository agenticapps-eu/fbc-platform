import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CommunityFeed from "./CommunityFeed";
import { ToastProvider } from "../ui/Toast";
import { feedQueryKey } from "../../lib/feed";
import { AuthFixture, authAsTier } from "../../test/auth-fixtures";

/**
 * Bilder und Chips an der Beitragskarte (AGE-528, Block 7).
 *
 * GEMOCKT IST NUR SUPABASE. `fetchFeed`, `signPostMedia`, `bildLayout` und
 * `istKuratiert` laufen echt — deshalb misst dieser Test auch das, worauf es
 * beim Signieren ankommt: EIN Aufruf je Feed-Seite, nicht einer je Bild.
 */

let signaturAufrufe: string[][] = [];
let containsAufrufe: [string, unknown][] = [];
let postZeilen: Record<string, unknown>[] = [];
let mediaZeilen: Record<string, unknown>[] = [];
let abgelehnt: string[] = [];

const AUTOR = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const TAGS = [{ key: "netzwerken", label: "Netzwerken", sort: 10 }];

vi.mock("../../lib/supabase", () => {
  const zeilen = (table: string): unknown[] => {
    if (table === "posts") return postZeilen;
    if (table === "post_media") return mediaZeilen;
    if (table === "tags") return TAGS;
    if (table === "profiles_public")
      return [{ id: AUTOR, name: "Beatrice Sommer", avatar_url: null, tier: "impact" }];
    return [];
  };
  return {
    supabase: {
      from: (table: string) => {
        const kette = {
          select: () => kette,
          order: () => kette,
          limit: () => kette,
          or: () => kette,
          contains: (spalte: string, wert: unknown) => {
            containsAufrufe.push([spalte, wert]);
            return kette;
          },
          eq: () => kette,
          in: () => kette,
          then: (auf: (r: { data: unknown; error: null }) => unknown) =>
            Promise.resolve({ data: zeilen(table), error: null }).then(auf),
        };
        return kette;
      },
      rpc: async () => ({ data: [], error: null }),
      storage: {
        from: () => ({
          createSignedUrls: async (pfade: string[]) => {
            signaturAufrufe.push(pfade);
            return {
              data: pfade.map((p) => ({
                error: abgelehnt.includes(p) ? "Object not found" : null,
                path: p,
                signedUrl: abgelehnt.includes(p) ? null : `https://sig.test/${p}`,
              })),
              error: null,
            };
          },
        }),
      },
    },
  };
});

function post(id: string, over: Record<string, unknown> = {}) {
  return {
    id,
    author_id: AUTOR,
    body: "Großartiger Erlebnistag in den Allgäuer Alpen!",
    hashtags: ["netzwerken", "allgäu"],
    visibility: "members",
    created_at: "2026-08-12T10:00:00Z",
    ...over,
  };
}

function media(postId: string, anzahl: number) {
  return Array.from({ length: anzahl }, (_, i) => ({
    post_id: postId,
    storage_path: `${AUTOR}/${postId}/${i}-1.webp`,
    sort: i,
    width: 1600,
    height: 1200,
  }));
}

function renderFeed(vorbelegen?: (qc: QueryClient) => void) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vorbelegen?.(queryClient);
  render(
    <AuthFixture value={authAsTier("impact")}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter>
            <CommunityFeed />
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    </AuthFixture>,
  );
}

beforeEach(() => {
  signaturAufrufe = [];
  containsAufrufe = [];
  postZeilen = [];
  mediaZeilen = [];
  abgelehnt = [];
});

describe("Beitragskarte — Bilder", () => {
  it("signiert alle Bilder einer Seite in EINEM Aufruf und zeigt sie mit ihren Maßen", async () => {
    postZeilen = [post("p1"), post("p2")];
    mediaZeilen = [...media("p1", 2), ...media("p2", 1)];

    renderFeed();
    const bilder = await screen.findAllByRole("img");

    // Drei Bilder, zwei Beiträge — aber nur EIN Signatur-Aufruf. Einer je Bild
    // wären bei 20 Beiträgen × 6 Bildern 120 Rundläufe pro Seite.
    expect(signaturAufrufe).toHaveLength(1);
    expect(signaturAufrufe[0]).toHaveLength(3);

    expect(bilder).toHaveLength(3);
    expect(bilder[0]).toHaveAttribute("src", `https://sig.test/${AUTOR}/p1/0-1.webp`);
    // Die Maße stehen am Bild, damit beim Laden nichts springt.
    expect(bilder[0]).toHaveAttribute("width", "1600");
    expect(bilder[0]).toHaveAttribute("height", "1200");
  });

  it("fünf Bilder zeigen vier Kacheln, die vierte trägt den Rest", async () => {
    postZeilen = [post("p1")];
    mediaZeilen = media("p1", 5);

    renderFeed();

    expect(await screen.findByText("+1")).toBeInTheDocument();
    expect(screen.getAllByRole("img")).toHaveLength(4);
  });

  it("öffnet auch die Bilder, die das Raster gar nicht zeichnet", async () => {
    // Der Befund aus dem Diff-Review: Schema, Trigger und Composer erlauben
    // sechs Bilder, das Raster zeigt vier — und die vierte liegt unter dem
    // „+n". Ohne Lightbox veröffentlicht jemand Bilder, die kein Leser
    // erreicht. Die schärfste Zusicherung ist deshalb das FÜNFTE Bild: es wird
    // im Raster nie gezeichnet.
    postZeilen = [post("p1")];
    mediaZeilen = media("p1", 5);

    renderFeed();
    fireEvent.click(await screen.findByRole("button", { name: /bild 4 vergrößern/i }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("img")).toHaveAttribute(
      "src",
      `https://sig.test/${AUTOR}/p1/3-1.webp`,
    );

    fireEvent.click(within(dialog).getByRole("button", { name: /nächstes bild/i }));
    expect(within(dialog).getByRole("img")).toHaveAttribute(
      "src",
      `https://sig.test/${AUTOR}/p1/4-1.webp`,
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("sperrt die Seite dahinter und hält den Fokus im Overlay", async () => {
    // Anschluss 1 von 4 an `useOverlay` (AGE-529). Der Fokusumlauf steht hier
    // bewusst NEBEN der Body-Sperre: die Sperre allein wäre auch grün, wenn der
    // Hook zwar gerufen, sein Ref aber nie an den Container gehängt würde.
    postZeilen = [post("p1")];
    mediaZeilen = media("p1", 5);

    renderFeed();
    fireEvent.click(await screen.findByRole("button", { name: /bild 4 vergrößern/i }));
    const dialog = await screen.findByRole("dialog");

    expect(document.body.style.position).toBe("fixed");

    const knoepfe = within(dialog).getAllByRole("button");
    knoepfe[knoepfe.length - 1].focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(knoepfe[0]);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(document.body.style.position).toBe("");
  });

  it("zeichnet die Lightbox außerhalb der Beitragskarte", async () => {
    // Gefunden in der Sichtprobe zu 9.6, nicht von einem Test: `.fbc-card:hover`
    // setzt `transform: translateY(-2px)` (AGE-492), und ein transformierter
    // Vorfahr ist der Bezugsrahmen für `position: fixed`. Die Lightbox schrumpfte
    // damit auf die Karte — gemessen 847×615 statt 1280×900 —, sobald der Zeiger
    // beim Klick auf der Karte lag, also bei jedem echten Mausklick.
    // In jsdom gibt es kein Layout, deshalb ist die Zusicherung strukturell:
    // zwischen Dialog und Viewport darf keine Karte stehen.
    postZeilen = [post("p1")];
    mediaZeilen = media("p1", 5);

    renderFeed();
    fireEvent.click(await screen.findByRole("button", { name: /bild 4 vergrößern/i }));

    const dialog = await screen.findByRole("dialog");
    expect(dialog.closest(".fbc-card")).toBeNull();
    expect(dialog.parentElement).toBe(document.body);
  });

  it("ein abgelehntes Bild lässt seine Kachel weg — nie den ganzen Beitrag", async () => {
    // Der Fall aus EVIDENCE.md, Fall F: der Storage lehnt EINZELNE Pfade ab.
    // Ein Beitrag, der deshalb ganz verschwände, wäre die schlechtere Antwort.
    postZeilen = [post("p1")];
    mediaZeilen = media("p1", 2);
    abgelehnt = [`${AUTOR}/p1/1-1.webp`];

    renderFeed();

    expect(await screen.findByText(/Erlebnistag/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(1));
  });
});

describe("Beitragskarte — Chips und Sichtbarkeit", () => {
  it("unterscheidet kuratierte von freien Tags, beide bleiben klickbar", async () => {
    postZeilen = [post("p1")];

    renderFeed();

    const kuratiert = await screen.findByRole("button", { name: "#netzwerken" });
    const frei = screen.getByRole("button", { name: "#allgäu" });
    // `allgäu` steht NICHT in `tags` und ist deshalb ein freier Tag — beide
    // bleiben Schaltflächen, beide filtern. Zugesichert wird das über ein
    // `data`-Merkmal statt über Klassennamen: welche Klasse gefüllt und welche
    // Outline zeichnet, ist Umsetzung und gehört in die Sichtprobe (9.5).
    expect(kuratiert).toHaveAttribute("data-kuratiert", "true");
    expect(frei).toHaveAttribute("data-kuratiert", "false");
  });

  it("nennt an einem members-Beitrag, dass er nicht öffentlich ist", async () => {
    postZeilen = [post("p1", { visibility: "members" })];

    renderFeed();

    await screen.findByText(/Erlebnistag/);
    expect(screen.getByText(/nur für mitglieder/i)).toBeInTheDocument();
  });
});

describe("Tag-Filterleiste", () => {
  it("zeigt die aktiven kuratierten Tags und filtert den Feed beim Klick", async () => {
    postZeilen = [post("p1")];

    renderFeed();
    await screen.findByText(/Erlebnistag/);

    // Die Leiste trägt das LABEL, die Chips am Beitrag den normalisierten Wert.
    fireEvent.click(screen.getByRole("button", { name: "Netzwerken" }));

    // Der bestehende Weg, unverändert: `.contains("hashtags", […])` (8.2).
    await waitFor(() => expect(containsAufrufe).toContainEqual(["hashtags", ["netzwerken"]]));
    expect(screen.getByText(/gefiltert nach/i)).toBeInTheDocument();
  });

  it("unterscheidet im leeren Zustand „nichts da“ von „nichts zu diesem Filter“", async () => {
    postZeilen = [];

    renderFeed();
    expect(await screen.findByText(/noch keine beiträge/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Netzwerken" }));

    expect(await screen.findByText(/keine beiträge mit diesem hashtag/i)).toBeInTheDocument();
  });
});

describe("Der Feed teilt seinen Cache-Eintrag mit niemandem", () => {
  it("liest einen Eintrag der Startseite NICHT als eigene Seitenliste", async () => {
    // Startseite und Mitglieder-Übersicht rufen `fetchFeed` über `useQuery` und
    // legen `{posts, nextCursor}` ab. Der Feed selbst ist eine
    // `useInfiniteQuery` und legt `{pages, pageParams}` ab. Unter DEMSELBEN
    // Schlüssel wäre der eine Eintrag für den anderen unlesbar: `data.pages`
    // ist dann `undefined`, `isLoading` aber false — der Feed malte den leeren
    // Zustand über einen vollen Feed.
    postZeilen = [post("p1")];

    renderFeed((qc) =>
      qc.setQueryData(feedQueryKey("test-user", null), {
        posts: [
          {
            id: "vonDerStartseite",
            author: { id: AUTOR, name: "Beatrice Sommer", avatarUrl: null, tier: "impact" },
            body: "Beitrag aus dem Cache der Startseite",
            hashtags: [],
            visibility: "public",
            createdAt: "2026-08-12T10:00:00Z",
            likeCount: 0,
            commentCount: 0,
            likedByMe: false,
            media: [],
          },
        ],
        nextCursor: null,
      }),
    );

    // Sofort nach dem Mount, bevor der eigene Abruf zurück ist: der Feed darf
    // hier NICHT „Noch keine Beiträge" behaupten.
    expect(screen.queryByText(/noch keine beiträge/i)).toBeNull();

    // Und danach steht sein eigener Beitrag da.
    expect(await screen.findByText(/Erlebnistag/)).toBeInTheDocument();
  });
});
