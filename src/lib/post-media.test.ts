import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Bilder eines Beitrags: hochladen und signieren (AGE-528, Task 5.2).
 *
 * Gemockt ist ausschließlich der Rand zum Storage. Die Aussagen sind: WOHIN
 * geht der Upload, wie VIELE Signatur-Aufrufe entstehen pro Feed-Seite, und was
 * passiert mit einem einzelnen abgelehnten Pfad — der Fall, den die Sonde
 * gemessen hat (EVIDENCE.md, Fall F: 4 von 5).
 */

const uploads: { bucket: string; path: string; contentType?: string }[] = [];
let signaturAufrufe: { pfade: string[]; sekunden: number }[] = [];
let signaturAntwort: {
  data: { error: string | null; path: string | null; signedUrl: string | null }[] | null;
  error: { message: string } | null;
} = { data: [], error: null };

vi.mock("./supabase", () => ({
  supabase: {
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string, _blob: Blob, opts?: { contentType?: string }) => {
          uploads.push({ bucket, path, contentType: opts?.contentType });
          return { error: null };
        },
        createSignedUrls: async (pfade: string[], sekunden: number) => {
          signaturAufrufe.push({ pfade, sekunden });
          return signaturAntwort;
        },
      }),
    },
  },
}));

const captureException = vi.fn();
vi.mock("@sentry/react", () => ({ captureException: (...args: unknown[]) => captureException(...args) }));

import {
  POST_MEDIA_BUCKET,
  SIGNATUR_GUELTIGKEIT_SEK,
  SIGNATUR_STALE_MS,
  signPostMedia,
  uploadPostMedia,
} from "./post-media";

const UID = "11111111-1111-1111-1111-111111111111";
const POST = "22222222-2222-2222-2222-222222222222";

const bild = (width: number, height: number) => ({ blob: new Blob(["x"]), width, height });

beforeEach(() => {
  uploads.length = 0;
  signaturAufrufe = [];
  signaturAntwort = { data: [], error: null };
  captureException.mockClear();
});

describe("uploadPostMedia", () => {
  it("legt jedes Bild unter {uid}/{postId}/{i}-{ts}.webp ab und gibt die Zeilen geordnet zurück", async () => {
    const zeilen = await uploadPostMedia({ uid: UID, postId: POST, bilder: [bild(1600, 1200), bild(800, 800)] });

    expect(uploads.map((u) => u.bucket)).toEqual([POST_MEDIA_BUCKET, POST_MEDIA_BUCKET]);
    // Der ERSTE Pfadabschnitt trägt die Policy — nicht eine Namenskonvention.
    expect(uploads[0].path).toMatch(new RegExp(`^${UID}/${POST}/0-\\d+\\.webp$`));
    expect(uploads[1].path).toMatch(new RegExp(`^${UID}/${POST}/1-\\d+\\.webp$`));
    expect(uploads.every((u) => u.contentType === "image/webp")).toBe(true);

    expect(zeilen).toEqual([
      { storage_path: uploads[0].path, sort: 0, width: 1600, height: 1200 },
      { storage_path: uploads[1].path, sort: 1, width: 800, height: 800 },
    ]);
  });
});

describe("signPostMedia", () => {
  it("fordert die Signaturen einer Feed-Seite in EINEM Aufruf an, nicht je Bild", async () => {
    const pfade = [`${UID}/${POST}/0-1.webp`, `${UID}/${POST}/1-1.webp`];
    signaturAntwort = {
      data: pfade.map((p) => ({ error: null, path: p, signedUrl: `https://sig.test/${p}` })),
      error: null,
    };

    const urls = await signPostMedia(pfade);

    expect(signaturAufrufe).toHaveLength(1);
    expect(signaturAufrufe[0]).toEqual({ pfade, sekunden: SIGNATUR_GUELTIGKEIT_SEK });
    expect(urls).toEqual({
      [pfade[0]]: `https://sig.test/${pfade[0]}`,
      [pfade[1]]: `https://sig.test/${pfade[1]}`,
    });
  });

  it("ein abgelehnter Pfad lässt die übrigen stehen und wird NICHT an Sentry gemeldet", async () => {
    // Gemessen in EVIDENCE.md, Fall F. Der Storage meldet „Object not found",
    // wo er „nicht erlaubt" meint — für ein Bild, das den Betrachter nichts
    // angeht, ist das der Normalfall. Wer es meldet, meldet Rauschen (5.2b).
    signaturAntwort = {
      data: [
        { error: null, path: "a.webp", signedUrl: "https://sig.test/a" },
        { error: "Object not found", path: "verboten.webp", signedUrl: null },
        { error: null, path: "b.webp", signedUrl: "https://sig.test/b" },
      ],
      error: null,
    };

    const urls = await signPostMedia(["a.webp", "verboten.webp", "b.webp"]);

    expect(urls).toEqual({ "a.webp": "https://sig.test/a", "b.webp": "https://sig.test/b" });
    expect(captureException).not.toHaveBeenCalled();
  });

  it("ein Fehlschlag des GANZEN Aufrufs geht sehr wohl an Sentry und wirft nicht", async () => {
    // Anders als die Einzelablehnung: hier ist etwas kaputt (Grant, Bucket,
    // Netz). Der Feed zeigt die Beiträge dann ohne Bilder statt gar nicht —
    // dasselbe Muster wie die Zähler-RPC in feed.ts.
    signaturAntwort = { data: null, error: { message: "Bucket not found" } };

    await expect(signPostMedia(["a.webp"])).resolves.toEqual({});
    expect(captureException).toHaveBeenCalledTimes(1);
  });

  it("fragt ohne Pfade gar nicht erst an", async () => {
    await expect(signPostMedia([])).resolves.toEqual({});
    expect(signaturAufrufe).toHaveLength(0);
  });

  it("cacht knapp unter der Gültigkeit, damit der Browser dieselbe URL sieht", () => {
    // 1 h Gültigkeit / 50 min staleTime (design.md, „Signatur"). Ohne diesen
    // Abstand ändert sich der Cache-Key pro Render und jedes Bild lädt neu.
    expect(SIGNATUR_GUELTIGKEIT_SEK).toBe(3600);
    expect(SIGNATUR_STALE_MS).toBe(50 * 60 * 1000);
    expect(SIGNATUR_STALE_MS).toBeLessThan(SIGNATUR_GUELTIGKEIT_SEK * 1000);
  });
});
