import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CommunityFeed from "./CommunityFeed";
import { ToastProvider } from "../ui/Toast";
import { AuthFixture, authAsTier } from "../../test/auth-fixtures";

/**
 * Bilder und Chips an der Beitragskarte (AGE-528, Block 7).
 *
 * GEMOCKT IST NUR SUPABASE. `fetchFeed`, `signPostMedia`, `bildLayout` und
 * `istKuratiert` laufen echt — deshalb misst dieser Test auch das, worauf es
 * beim Signieren ankommt: EIN Aufruf je Feed-Seite, nicht einer je Bild.
 */

let signaturAufrufe: string[][] = [];
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
          contains: () => kette,
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

function renderFeed() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
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
