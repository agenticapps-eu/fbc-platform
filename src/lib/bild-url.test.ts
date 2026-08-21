import { describe, expect, it, vi } from "vitest";

/**
 * Der Auflöser für Profil- und Hintergrundbilder (AGE-580).
 *
 * Die Spalten `profiles.avatar_url` und `profiles.cover_url` trugen bis zu
 * dieser Change absolute URLs mit der Projektkennung darin. Künftig steht dort
 * der Pfad, und die URL entsteht beim Anzeigen.
 *
 * Gemockt ist ausschließlich der Rand zur Ablage. Die tragende Aussage dieser
 * Datei ist NICHT „ein Pfad wird zur URL" — das ist der leichte Teil — sondern
 * die Gegenrichtung: **was schon ein URI-Schema trägt, wird unverändert
 * durchgereicht.** Drei reale Eingaben hängen daran, und eine Whitelist
 * einzelner Schemata hätte die dritte beschädigt.
 */

vi.mock("./supabase", () => ({
  supabase: {
    storage: {
      from: (bucket: string) => ({
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `https://projekt.test/storage/v1/object/public/${bucket}/${path}` },
        }),
      }),
    },
  },
}));

import { bildPfad, bildUrl } from "./bild-url";

describe("bildUrl — nackte Pfade bekommen Bucket und Host", () => {
  it("setzt den avatars-Bucket vor einen Pfad", () => {
    expect(bildUrl("avatars", "abc-123/1699999999.webp")).toBe(
      "https://projekt.test/storage/v1/object/public/avatars/abc-123/1699999999.webp",
    );
  });

  it("setzt den covers-Bucket vor einen Pfad", () => {
    expect(bildUrl("covers", "abc-123/1699999999.webp")).toBe(
      "https://projekt.test/storage/v1/object/public/covers/abc-123/1699999999.webp",
    );
  });

  it("verwechselt die Buckets nicht", () => {
    // Sonst zeigte ein Hintergrundbild auf ein Profilbild-Objekt, das es nicht
    // gibt — und die Zeilenzählung sähe trotzdem richtig aus.
    expect(bildUrl("covers", "x/1.webp")).not.toBe(bildUrl("avatars", "x/1.webp"));
  });
});

describe("bildUrl — was ein Schema trägt, bleibt unangetastet", () => {
  it("reicht eine absolute Supabase-URL durch (Bestandszeile vor der Migration)", () => {
    const bestand =
      "https://viwntbodrtqxgmqyxluh.supabase.co/storage/v1/object/public/avatars/a/1.webp";
    expect(bildUrl("avatars", bestand)).toBe(bestand);
  });

  it("reicht eine http-URL des lokalen Stacks durch", () => {
    // Der lokale Stack läuft auf Port 54321 (supabase/config.toml). Eine
    // Whitelist aus https/blob/data hätte genau diese Werte beschädigt —
    // deshalb wird am VORHANDENEN Schema erkannt, nicht an einer Liste.
    const lokal = "http://127.0.0.1:54321/storage/v1/object/public/avatars/a/1.webp";
    expect(bildUrl("avatars", lokal)).toBe(lokal);
  });

  it("reicht eine blob:-Vorschau durch", () => {
    // ProfilPage rendert `preview ?? values.avatar_url` durch DIESELBE Stelle.
    // Ein Auflöser, der stur den Bucket-Host voranstellt, zerlegt die Vorschau
    // beim Hochladen — und jsdom sähe es nie, weil es kein Bild lädt.
    const vorschau = "blob:http://localhost:5173/9f1c-4d2e";
    expect(bildUrl("avatars", vorschau)).toBe(vorschau);
  });

  it("reicht ein fremd gehostetes Bild durch", () => {
    // Der Demo-Seed schreibt i.pravatar.cc — gar kein Supabase-Storage.
    const fremd = "https://i.pravatar.cc/300?u=00000000-0000-0000-0000-000000000238";
    expect(bildUrl("avatars", fremd)).toBe(fremd);
  });

  it("reicht eine data:-URL durch", () => {
    // Heute entsteht keine (alle Vorschauen nutzen createObjectURL). Der Test
    // steht, weil die Regel am Schema hängt und nicht an einer Aufzählung.
    const data = "data:image/webp;base64,UklGRg==";
    expect(bildUrl("avatars", data)).toBe(data);
  });
});

describe("bildUrl — leere Werte", () => {
  it("gibt null zurück für null", () => {
    expect(bildUrl("avatars", null)).toBeNull();
  });

  it("gibt null zurück für den leeren String", () => {
    // Sonst entstünde die URL des Bucket-Wurzelverzeichnisses und daraus ein
    // kaputtes <img> statt der Initialen.
    expect(bildUrl("avatars", "")).toBeNull();
  });
});

describe("bildPfad — die Umkehrung, gegen die Nachzügler", () => {
  it("macht aus einer eigenen Storage-URL den Pfad", () => {
    expect(
      bildPfad("avatars", "https://projekt.test/storage/v1/object/public/avatars/a/1.webp"),
    ).toBe("a/1.webp");
  });

  it("lässt einen Pfad, der schon einer ist, in Ruhe", () => {
    // Idempotenz — sonst schnitte ein zweiter Lauf am falschen Ende.
    expect(bildPfad("avatars", "a/1.webp")).toBe("a/1.webp");
  });

  it("lässt eine URL eines FREMDEN Hosts unangetastet", () => {
    // Selbe Bucket-Bezeichnung, andere Instanz. Zuschneiden ergäbe einen Pfad,
    // unter dem hier nichts liegt — aus einem gültigen Wert würde ein toter.
    const fremd = "https://fremd.supabase.co/storage/v1/object/public/avatars/a/1.webp";
    expect(bildPfad("avatars", fremd)).toBe(fremd);
  });

  it("lässt ein fremd gehostetes Bild unangetastet", () => {
    const fremd = "https://i.pravatar.cc/300?u=x";
    expect(bildPfad("avatars", fremd)).toBe(fremd);
  });

  it("schneidet nicht über Bucket-Grenzen hinweg", () => {
    // Eine covers-URL, die als avatar_url gespeichert würde, ist ein Fehler —
    // aber ein stiller Zuschnitt machte daraus einen unrettbaren.
    const coversUrl = "https://projekt.test/storage/v1/object/public/covers/a/1.webp";
    expect(bildPfad("avatars", coversUrl)).toBe(coversUrl);
  });

  it("lässt eine blob:-Vorschau unangetastet", () => {
    const vorschau = "blob:http://localhost:5173/9f1c";
    expect(bildPfad("avatars", vorschau)).toBe(vorschau);
  });

  it("gibt null für null zurück", () => {
    expect(bildPfad("avatars", null)).toBeNull();
  });

  it("ist die Umkehrung von bildUrl", () => {
    // Die tragende Eigenschaft: was der Auflöser baut, nimmt der Kanonisierer
    // wieder auseinander. Genau diese Inversion braucht auch die Migration.
    const pfad = "abc-123/1699999999.webp";
    expect(bildPfad("avatars", bildUrl("avatars", pfad))).toBe(pfad);
    expect(bildPfad("covers", bildUrl("covers", pfad))).toBe(pfad);
  });
});
