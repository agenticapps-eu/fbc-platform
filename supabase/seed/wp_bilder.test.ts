import { describe, expect, it } from "vitest";

import { BILDQUELLE, bildauftraege } from "./wp_bilder";

const ABLAGE = "/ausserhalb/wp-import-bilder";

function auftraege(werte: Record<string, string>) {
  return bildauftraege({
    row: { source_user_id: "354", profile_photo: "", cover_photo: "", ...werte },
    basis: BILDQUELLE,
    zwischenablage: ABLAGE,
  });
}

describe("bildauftraege — die URL", () => {
  it("setzt sie aus Kennung und Dateiname zusammen", () => {
    const [auftrag] = auftraege({ profile_photo: "profile_photo.jpg" });

    expect(auftrag.url).toBe(
      "https://fairbusinessworld.de/wp-content/uploads/ultimatemember/354/profile_photo.jpg",
    );
  });

  it("nimmt die Endung aus dem Datensatz, statt sie zu raten", () => {
    // Drei Endungen kommen vor; `jpeg` allein trifft 7 Datensätze (Design).
    for (const endung of ["jpg", "png", "jpeg"]) {
      const [auftrag] = auftraege({ profile_photo: `profile_photo.${endung}` });
      expect(auftrag.url.endsWith(`.${endung}`)).toBe(true);
    }
  });

  it("fragt niemals die verkleinerte Ableitung an", () => {
    // Das Altsystem legt `-190x190` daneben; sie verschenkt 96 % der
    // Bildinformation. Träge ein neu gezogener Export den Ableitungsnamen, würde
    // die Verkleinerung importiert, ohne dass etwas auffiele.
    const [auftrag] = auftraege({ profile_photo: "profile_photo-190x190.jpg" });

    expect(auftrag.url).not.toContain("190x190");
    expect(auftrag.url.endsWith("/profile_photo.jpg")).toBe(true);
  });

  it("hängt kein Grössensuffix an einen Namen an, der keines trägt", () => {
    const [auftrag] = auftraege({ profile_photo: "profile_photo.jpg" });

    expect(auftrag.url).not.toMatch(/-\d+x\d+/);
  });
});

describe("bildauftraege — die beiden Bildarten", () => {
  it("erzeugt je einen Auftrag für Profil- und Headerbild", () => {
    const ergebnis = auftraege({
      profile_photo: "profile_photo.jpg",
      cover_photo: "cover_photo.png",
    });

    expect(ergebnis.map((a) => a.art)).toEqual(["profil", "cover"]);
    expect(ergebnis.map((a) => a.datei)).toEqual(["profile_photo.jpg", "cover_photo.png"]);
  });

  it("legt beide getrennt in der Zwischenablage ab, unter der Kennung", () => {
    const ergebnis = auftraege({
      profile_photo: "profile_photo.jpg",
      cover_photo: "cover_photo.png",
    });

    expect(ergebnis[0].ablage).toBe("/ausserhalb/wp-import-bilder/354/profile_photo.jpg");
    expect(ergebnis[1].ablage).toBe("/ausserhalb/wp-import-bilder/354/cover_photo.png");
  });

  it("lässt ein fehlendes Headerbild das Profilbild nicht mitnehmen", () => {
    // 57 Mitglieder haben ein Profilbild, 53 ein Headerbild — die Mengen sind
    // nicht deckungsgleich.
    const ergebnis = auftraege({ profile_photo: "profile_photo.jpg", cover_photo: "" });

    expect(ergebnis).toHaveLength(1);
    expect(ergebnis[0].art).toBe("profil");
  });

  it("erzeugt gar keinen Auftrag, wo kein Bild genannt ist", () => {
    expect(auftraege({})).toEqual([]);
  });
});

describe("bildauftraege — was aus einer fremden Datei kommt, wird geprüft", () => {
  it("weist einen Dateinamen mit Pfadanteil ab", () => {
    // Der Wert stammt aus der Quelldatei und geht in EINEN Dateipfad UND EINE
    // URL. `../` darin schriebe ausserhalb der Zwischenablage.
    expect(auftraege({ profile_photo: "../../../etc/passwd" })).toEqual([]);
    expect(auftraege({ profile_photo: "unter/ordner.jpg" })).toEqual([]);
  });

  it("weist einen Dateinamen ohne brauchbare Endung ab", () => {
    expect(auftraege({ profile_photo: "profile_photo" })).toEqual([]);
    expect(auftraege({ profile_photo: "profile_photo.exe" })).toEqual([]);
  });

  it("weist eine Kennung ab, die kein blosser Bezeichner ist", () => {
    expect(auftraege({ source_user_id: "354/../356", profile_photo: "profile_photo.jpg" })).toEqual(
      [],
    );
  });

  it("erzeugt ohne Kennung keinen Auftrag — der Pfad entsteht aus ihr", () => {
    expect(auftraege({ source_user_id: "", profile_photo: "profile_photo.jpg" })).toEqual([]);
  });
});

// ── Das Holen selbst ────────────────────────────────────────────────────────

import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { holeBild } from "./wp_bilder";

function frisch(): string {
  return mkdtempSync(join(tmpdir(), "wp-bilder-"));
}

function auftrag(ablage: string, datei = "profile_photo.jpg") {
  return bildauftraege({
    row: { source_user_id: "354", profile_photo: datei, cover_photo: "" },
    basis: BILDQUELLE,
    zwischenablage: ablage,
  })[0];
}

/** Ein `fetch`-Ersatz — die Plattformfunktion, nicht unser eigener Code. */
function antwort(status: number, typ: string, koerper = "BILD") {
  return async () =>
    new Response(status === 200 ? koerper : null, {
      status,
      headers: { "content-type": typ },
    });
}

describe("holeBild", () => {
  it("legt das Bild in der Zwischenablage ab", async () => {
    const ablage = frisch();
    const a = auftrag(ablage);

    const ergebnis = await holeBild(a, antwort(200, "image/jpeg"));

    expect(ergebnis.stand).toBe("geholt");
    expect(readFileSync(a.ablage, "utf8")).toBe("BILD");
  });

  it("überspringt ein Bild, das schon in der Zwischenablage liegt", async () => {
    // Der Abschnitt muss wiederholbar sein: die alte Seite ein zweites Mal um
    // 140 Dateien zu bitten, ist nicht nötig — und der zweite Lauf darf nicht
    // an dem scheitern, was der erste angelegt hat.
    const ablage = frisch();
    const a = auftrag(ablage);
    mkdirSync(dirname(a.ablage), { recursive: true });
    writeFileSync(a.ablage, "ERSTER LAUF");

    let gefragt = false;
    const ergebnis = await holeBild(a, async () => {
      gefragt = true;
      return new Response("ZWEITER LAUF", {
        status: 200,
        headers: { "content-type": "image/jpeg" },
      });
    });

    expect(ergebnis.stand).toBe("vorhanden");
    expect(gefragt).toBe(false);
    expect(readFileSync(a.ablage, "utf8")).toBe("ERSTER LAUF");
  });

  it("meldet ein fehlendes Bild als Befund, statt zu werfen", async () => {
    const ablage = frisch();

    const ergebnis = await holeBild(auftrag(ablage), antwort(404, "text/html"));

    expect(ergebnis.stand).toBe("fehlt");
    expect(ergebnis.grund).toContain("404");
  });

  it("nimmt nichts an, was kein Bild ist", async () => {
    // Eine Fehlerseite mit Status 200 ist der Fall, den ein blosser
    // Status-Vergleich durchliesse — und sie landete als „Bild" im Bucket.
    const ablage = frisch();

    const ergebnis = await holeBild(auftrag(ablage), antwort(200, "text/html"));

    expect(ergebnis.stand).toBe("fehlt");
    expect(ergebnis.grund).toContain("text/html");
  });

  it("meldet einen Netzfehler als Befund, statt den Lauf zu beenden", async () => {
    const ablage = frisch();

    const ergebnis = await holeBild(auftrag(ablage), async () => {
      throw new Error("getaddrinfo ENOTFOUND");
    });

    expect(ergebnis.stand).toBe("fehlt");
    expect(ergebnis.grund).toContain("ENOTFOUND");
  });
});

// ── Wandeln: verkleinern und nach WebP ──────────────────────────────────────

import sharp from "sharp";

import { KANTE, wandleBild } from "./wp_bilder";

/** Ein echtes Bild, keine Attrappe — `sharp` liest es wie jedes andere. */
async function bild(pfad: string, kante: number): Promise<string> {
  await sharp({
    create: { width: kante, height: kante, channels: 3, background: { r: 30, g: 90, b: 60 } },
  })
    .jpeg()
    .toFile(pfad);
  return pfad;
}

describe("wandleBild", () => {
  it("verkleinert ein zu grosses Bild auf die Obergrenze", async () => {
    const ordner = frisch();
    const quelle = await bild(join(ordner, "gross.jpg"), 4032);
    const ziel = join(ordner, "gross.webp");

    const ergebnis = await wandleBild({ quelle, ziel, maxKante: KANTE.cover });

    expect(ergebnis.stand).toBe("gewandelt");
    const { width, format } = await sharp(ziel).metadata();
    expect(width).toBe(KANTE.cover);
    expect(format).toBe("webp");
  });

  it("vergrössert ein kleines Bild NICHT", async () => {
    // Gemessen: ein Profilbild ist 195 px. Es auf 512 hochzurechnen, erfände
    // Bildinformation, die es nicht gibt — und sähe im Profil schlechter aus
    // als das kleine Original.
    const ordner = frisch();
    const quelle = await bild(join(ordner, "klein.jpg"), 195);
    const ziel = join(ordner, "klein.webp");

    await wandleBild({ quelle, ziel, maxKante: KANTE.avatar });

    expect((await sharp(ziel).metadata()).width).toBe(195);
  });

  it("weist ein Bild ab, das keines mehr ist", async () => {
    // Ein Profilbild in der echten Quelle ist 1 × 1 Pixel. Die gemessene
    // Verteilung springt von 1 px auf 190 px — dazwischen liegt nichts, was
    // eine Schwelle fälschlich träfe.
    const ordner = frisch();
    const quelle = await bild(join(ordner, "rest.jpg"), 1);

    const ergebnis = await wandleBild({
      quelle,
      ziel: join(ordner, "rest.webp"),
      maxKante: KANTE.avatar,
    });

    expect(ergebnis.stand).toBe("untauglich");
    expect(ergebnis.grund).toContain("1×1");
    expect(existsSync(join(ordner, "rest.webp"))).toBe(false);
  });

  it("überspringt ein bereits gewandeltes Bild", async () => {
    const ordner = frisch();
    const quelle = await bild(join(ordner, "da.jpg"), 300);
    const ziel = join(ordner, "da.webp");
    writeFileSync(ziel, "SCHON DA");

    const ergebnis = await wandleBild({ quelle, ziel, maxKante: KANTE.avatar });

    expect(ergebnis.stand).toBe("vorhanden");
    expect(readFileSync(ziel, "utf8")).toBe("SCHON DA");
  });

  it("meldet eine unlesbare Datei als Befund, statt zu werfen", async () => {
    const ordner = frisch();
    const quelle = join(ordner, "kaputt.jpg");
    writeFileSync(quelle, "das ist kein Bild");

    const ergebnis = await wandleBild({
      quelle,
      ziel: join(ordner, "kaputt.webp"),
      maxKante: KANTE.avatar,
    });

    expect(ergebnis.stand).toBe("untauglich");
  });
});
