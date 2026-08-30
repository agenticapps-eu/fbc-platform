import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Veröffentlichen ist EIN Schritt (AGE-528, Task 6.6 / design.md).
 *
 * Gemockt ist nur der Rand zur Datenbank. Die Aussage ist: welche RPC wird mit
 * welchen Argumenten gerufen — insbesondere, dass Beitrag und Bildzeilen
 * zusammen gehen und die getippten Tags aus dem Text kommen.
 */

let rpcAufrufe: { name: string; args: Record<string, unknown> }[] = [];
let rpcFehler: { message: string } | null = null;

vi.mock("./supabase", () => ({
  supabase: {
    rpc: async (name: string, args: Record<string, unknown>) => {
      rpcAufrufe.push({ name, args });
      return { data: args.p_post_id, error: rpcFehler };
    },
  },
}));

import { createPostWithMedia } from "./feed";

const POST = "22222222-2222-2222-2222-222222222222";

beforeEach(() => {
  rpcAufrufe = [];
  rpcFehler = null;
});

describe("createPostWithMedia", () => {
  it("übergibt getippte und geklickte Tags GETRENNT — vereinigt wird in der RPC", async () => {
    await createPostWithMedia({
      postId: POST,
      body: "Gestern beim #Netzwerken viel gelernt.",
      visibility: "members",
      tags: ["netzwerken", "erlebnistag"],
      media: [],
      veroeffentlichtAb: null,
    });

    expect(rpcAufrufe).toHaveLength(1);
    expect(rpcAufrufe[0].name).toBe("create_post_with_media");
    expect(rpcAufrufe[0].args).toEqual({
      p_post_id: POST,
      p_body: "Gestern beim #Netzwerken viel gelernt.",
      p_visibility: "members",
      // Aus dem Text geparst, wie bisher `createPost` es tat.
      p_hashtags: ["netzwerken"],
      // Angeklickt. Die Vereinigung steht in der RPC und ist dort in pgTAP
      // gemessen — sie hier nachzubauen hieße, dieselbe Regel an zwei Stellen
      // zu führen.
      p_tags: ["netzwerken", "erlebnistag"],
      p_media: [],
      // AGE-667: WIRD ÜBERGEBEN, auch für „sofort". Der Parameter trägt in
      // Postgres bewusst keinen Vorgabewert — ein Aufruf mit sechs Argumenten
      // fände die Funktion nicht mehr, statt still die alte Überladung zu
      // treffen. Diese Zeile ist der Beleg, dass der Client ihn immer sendet.
      p_veroeffentlicht_ab: null,
    });
  });

  it("reicht die Bildzeilen in ihrer Reihenfolge durch", async () => {
    await createPostWithMedia({
      postId: POST,
      body: "Zwei Bilder",
      visibility: "members",
      tags: [],
      media: [
        { storage_path: "u/p/0-1.webp", sort: 0, width: 1600, height: 1200 },
        { storage_path: "u/p/1-2.webp", sort: 1, width: 800, height: 800 },
      ],
      veroeffentlichtAb: null,
    });

    expect(rpcAufrufe[0].args.p_media).toEqual([
      { storage_path: "u/p/0-1.webp", sort: 0, width: 1600, height: 1200 },
      { storage_path: "u/p/1-2.webp", sort: 1, width: 800, height: 800 },
    ]);
  });

  it("wirft, wenn die RPC ablehnt — ein halber Beitrag darf nie als Erfolg gelten", async () => {
    rpcFehler = { message: "Kein bestätigter Zugang" };

    await expect(
      createPostWithMedia({
        postId: POST,
        body: "Text",
        visibility: "members",
        tags: [],
        media: [],
        veroeffentlichtAb: null,
      }),
    ).rejects.toMatchObject({ message: "Kein bestätigter Zugang" });
  });
});
