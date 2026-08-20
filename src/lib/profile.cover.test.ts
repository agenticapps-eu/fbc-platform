import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Was beim Speichern eines Hintergrundbildes wirklich passiert (AGE-498).
 *
 * Gemockt ist ausschließlich der Rand zur Datenbank — nicht eigener Code. Die
 * Aussagen sind: in WELCHEN Bucket geht der Upload, WAS steht danach in
 * `cover_url`, und was passiert, wenn kein Bild dabei ist.
 */

const uploads: { bucket: string; path: string }[] = [];
let updatePayload: Record<string, unknown> | null = null;

vi.mock("./supabase", () => ({
  supabase: {
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string) => {
          uploads.push({ bucket, path });
          return { error: null };
        },
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `https://cdn.test/${bucket}/${path}` },
        }),
      }),
    },
    from: () => ({
      update: (payload: Record<string, unknown>) => {
        updatePayload = payload;
        return {
          eq: () => ({
            select: () => ({
              single: async () => ({
                data: { profile_completion: 42, avatar_url: null, cover_url: null },
                error: null,
              }),
            }),
          }),
        };
      },
      delete: () => ({ eq: async () => ({ error: null }) }),
      insert: async () => ({ error: null }),
      // Die Kontaktzeile geht seit AGE-537 im selben Aufruf mit; ohne diesen
      // Rand liefe der Test in „upsert is not a function".
      upsert: async () => ({ error: null }),
    }),
    rpc: async () => ({ error: null }),
  },
}));

vi.mock("./matches", () => ({ recomputeMyMatches: async () => {} }));

import { saveProfile, type ProfileFormValues } from "./profile";

const UID = "11111111-1111-1111-1111-111111111111";

function werte(over: Partial<ProfileFormValues> = {}): ProfileFormValues {
  return {
    name: "Testi",
    region: "Berlin",
    company: "Firma",
    short_bio: "Kurz",
    avatar_url: null,
    cover_url: null,
    branche: "",
    headline: "",
    roles: [],
    competencies: [],
    website: "",
    dev_focus: "",
    socials: { linkedin: "", instagram: "", xing: "", facebook: "", youtube: "", twitter: "" },
    interests: [],
    goals: [],
    videos: [],
    // Die Kontaktzeile (AGE-537). Sie geht denselben `saveProfile`-Weg; hier
    // leer, weil dieser Test das Hintergrundbild prüft und nicht sie.
    contact: {
      email: "",
      phone: "",
      street: "",
      postal_code: "",
      city: "",
      state: "",
      country: "",
    },
    ...over,
  };
}

beforeEach(() => {
  uploads.length = 0;
  updatePayload = null;
});

describe("saveProfile — Hintergrundbild", () => {
  it("lädt in den covers-Bucket unter der eigenen Kennung und schreibt cover_url", async () => {
    await saveProfile(UID, werte(), null, new Blob(["x"]));

    expect(uploads).toHaveLength(1);
    expect(uploads[0].bucket).toBe("covers");
    // Der erste Pfadabschnitt MUSS die eigene uid sein — daran hängt die
    // Bucket-Policy, nicht an einer Namenskonvention.
    expect(uploads[0].path.split("/")[0]).toBe(UID);
    expect(uploads[0].path.endsWith(".webp")).toBe(true);
    expect(updatePayload?.cover_url).toBe(`https://cdn.test/covers/${uploads[0].path}`);
  });

  it("lässt cover_url unangetastet, wenn kein Bild dabei ist", async () => {
    await saveProfile(UID, werte({ cover_url: "https://cdn.test/covers/alt.webp" }), null, null);

    expect(uploads).toHaveLength(0);
    expect(updatePayload?.cover_url).toBe("https://cdn.test/covers/alt.webp");
  });

  it("entfernt das Bild, indem es die Verknüpfung löst — nicht das Objekt", async () => {
    await saveProfile(UID, werte({ cover_url: null }), null, null);

    expect(updatePayload?.cover_url).toBeNull();
    // Kein remove()-Aufruf: das Objekt bleibt im Bucket, genau wie beim Avatar.
    expect(uploads).toHaveLength(0);
  });

  it("hält Avatar und Cover in getrennten Buckets", async () => {
    await saveProfile(UID, werte(), new Blob(["a"]), new Blob(["c"]));

    expect(uploads.map((u) => u.bucket).sort()).toEqual(["avatars", "covers"]);
  });
});
