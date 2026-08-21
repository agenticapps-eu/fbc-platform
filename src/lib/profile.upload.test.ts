import { describe, expect, it, vi } from "vitest";

/**
 * Was `uploadBild` in die Spalte schreibt (AGE-580, Stufe 2).
 *
 * Bis zu dieser Change gab es die absolute URL aus `getPublicUrl` zurück — mit
 * der Projektkennung darin. Ab jetzt den Pfad.
 *
 * Der zweite, weniger offensichtliche Teil ist der wichtigere: **ohne neuen
 * Blob gab die Funktion den alten Wert unverändert zurück**, und `saveProfile`
 * schreibt ihn bedingungslos zurück. Ein Editor, der vor der Migration geladen
 * wurde, trüge die alte absolute URL also wieder ein. Deshalb kanonisiert
 * dieser Pfad jetzt ebenfalls.
 *
 * Gemockt ist ausschließlich der Rand zur Ablage.
 */

const uploads: { bucket: string; path: string }[] = [];

vi.mock("./supabase", () => ({
  supabase: {
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string) => {
          uploads.push({ bucket, path });
          return { error: null };
        },
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `https://projekt.test/storage/v1/object/public/${bucket}/${path}` },
        }),
      }),
    },
  },
}));

const { uploadBild } = await import("./profile");

describe("uploadBild — mit neuem Bild", () => {
  it("gibt den Pfad zurück, nicht die URL", async () => {
    const ergebnis = await uploadBild("avatars", "uid-1", new Blob(["x"]), null);
    expect(ergebnis).not.toMatch(/^https?:/);
    expect(ergebnis).toMatch(/^uid-1\//);
  });

  it("legt das Objekt unter demselben Pfad ab, den es zurückgibt", async () => {
    uploads.length = 0;
    const ergebnis = await uploadBild("covers", "uid-2", new Blob(["x"]), null);
    // Sonst zeigte die Spalte auf ein Objekt, das anderswo liegt — und keine
    // Zeilenzählung merkte etwas davon.
    expect(uploads).toEqual([{ bucket: "covers", path: ergebnis }]);
  });
});

describe("uploadBild — ohne neues Bild kanonisiert es den Altwert", () => {
  it("macht aus einer absoluten Eigen-URL den Pfad", async () => {
    const alt = "https://projekt.test/storage/v1/object/public/avatars/uid-3/1.webp";
    expect(await uploadBild("avatars", "uid-3", null, alt)).toBe("uid-3/1.webp");
  });

  it("lädt dabei nichts hoch", async () => {
    uploads.length = 0;
    await uploadBild("avatars", "uid-3", null, "uid-3/1.webp");
    expect(uploads).toEqual([]);
  });

  it("lässt einen Pfad in Ruhe", async () => {
    expect(await uploadBild("avatars", "uid-4", null, "uid-4/9.webp")).toBe("uid-4/9.webp");
  });

  it("lässt ein fremd gehostetes Bild in Ruhe", async () => {
    // Der Demo-Seed schreibt i.pravatar.cc. Zuschneiden gäbe es nicht zu
    // schneiden, aber es darf auch nicht verlorengehen.
    const fremd = "https://i.pravatar.cc/300?u=x";
    expect(await uploadBild("avatars", "uid-5", null, fremd)).toBe(fremd);
  });

  it("gibt null zurück, wenn nie ein Bild da war", async () => {
    expect(await uploadBild("avatars", "uid-6", null, null)).toBeNull();
  });
});
