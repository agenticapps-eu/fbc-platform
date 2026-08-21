import { describe, expect, it } from "vitest";

import { BILDQUELLE, BILDSPALTEN, bildauftraege, fehlendeBildspalten } from "./wp_bilder";

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
  // Die beiden Kantenlängen stehen hier WÖRTLICH und nicht als `KANTE.*`.
  // Vorher war `KANTE.cover` Eingabe UND Erwartungswert: eine Änderung von 1600
  // auf irgendeinen anderen Wert liess den Test grün, obwohl sie die fachliche
  // Festlegung kippt. (Befund LOW, codex, 16.08.)
  it("hält die fachlich festgelegten Kantenlängen", () => {
    expect(KANTE.avatar).toBe(512);
    expect(KANTE.cover).toBe(1600);
  });

  it("verkleinert ein zu grosses Bild auf die Obergrenze", async () => {
    const ordner = frisch();
    const quelle = await bild(join(ordner, "gross.jpg"), 4032);
    const ziel = join(ordner, "gross.webp");

    const ergebnis = await wandleBild({ quelle, ziel, maxKante: 1600 });

    expect(ergebnis.stand).toBe("gewandelt");
    const { width, format } = await sharp(ziel).metadata();
    expect(width).toBe(1600);
    expect(format).toBe("webp");
  });

  it("wandelt eine halbe Zieldatei neu, statt sie als vorhanden zu nehmen", async () => {
    // Die Zwischenablage von vor dem 16.08. entstand ohne Zwischennamen. Eine
    // abgebrochene Wandlung liegt dort unter dem ENDNAMEN — `existsSync` sagt
    // ja, der Upload geht durch, und im Profil steht ein abgeschnittenes Bild.
    // (Befund MEDIUM, codex.)
    const ordner = frisch();
    const quelle = await bild(join(ordner, "gross.jpg"), 2000);
    const ziel = join(ordner, "gross.webp");
    writeFileSync(ziel, Buffer.from("RIFF halb, kein Bild"));

    const ergebnis = await wandleBild({ quelle, ziel, maxKante: 1600 });

    expect(ergebnis.stand).toBe("gewandelt");
    const { width, format } = await sharp(ziel).metadata();
    expect(format).toBe("webp");
    expect(width).toBe(1600);
  });

  it("lässt eine vollständige Zieldatei unangetastet", async () => {
    // Die Gegenrichtung: ohne sie prüfte der Test oben auch dann grün, wenn die
    // Wandlung JEDE vorhandene Datei überschriebe — und der Wiederholungslauf
    // über 110 Bilder rechnete jedes Mal alles neu.
    const ordner = frisch();
    const quelle = await bild(join(ordner, "gross.jpg"), 2000);
    const ziel = join(ordner, "gross.webp");
    await wandleBild({ quelle, ziel, maxKante: 1600 });
    const vorher = readFileSync(ziel);

    const ergebnis = await wandleBild({ quelle, ziel, maxKante: 1600 });

    expect(ergebnis.stand).toBe("vorhanden");
    expect(readFileSync(ziel).equals(vorher)).toBe(true);
  });

  it("lässt keinen Zwischennamen liegen", async () => {
    const ordner = frisch();
    const quelle = await bild(join(ordner, "gross.jpg"), 2000);
    const ziel = join(ordner, "gross.webp");

    await wandleBild({ quelle, ziel, maxKante: 1600 });

    expect(existsSync(`${ziel}.halb`)).toBe(false);
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

  // „überspringt ein bereits gewandeltes Bild" stand hier bis zum 16.08. und
  // legte als Zieldatei die Zeichenkette „SCHON DA" ab — kein Bild. Er sicherte
  // damit genau das Verhalten ab, das der Befund MEDIUM (codex) benennt: dass
  // blosse Existenz als Erfolg gilt. Ersetzt durch die beiden Fälle oben, die
  // mit einer ECHTEN gewandelten Datei und mit einer halben arbeiten.

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

// ── Das Ablegen im Bucket (6.3) ─────────────────────────────────────────────

import { beforeAll } from "vitest";

import { BUCKET, type Bildart, OBJEKTNAME, ladeBildHoch, webpAblage } from "./wp_bilder";

const BASIS = "http://127.0.0.1:54321";
const KONTO = "b6f27715-8566-4fb5-8b19-3a1cf14d7270";

/** Eine echte WebP-Datei — `ladeBildHoch` liest sie von der Platte. */
let ECHTES_WEBP: string;

beforeAll(async () => {
  ECHTES_WEBP = join(frisch(), "profile_photo.webp");
  await sharp({
    create: { width: 64, height: 64, channels: 3, background: { r: 30, g: 90, b: 60 } },
  })
    .webp()
    .toFile(ECHTES_WEBP);
});

/** Der Grund, wo es einen gibt — `hochgeladen` und `vorhanden` tragen keinen. */
const grundVon = (e: Awaited<ReturnType<typeof ladeBildHoch>>) =>
  e.stand === "fehlt" ? e.grund : undefined;

/** Eine Antwort des Storage-Dienstes. Gemessen, nicht erfunden — s. design.md. */
function storage(status: number, koerper: unknown) {
  return async () => new Response(JSON.stringify(koerper), { status });
}

function roh(
  hole: (url: string, init?: RequestInit) => Promise<Response>,
  art: Bildart = "profil",
  datei = ECHTES_WEBP,
) {
  return ladeBildHoch({ datei, art, uid: KONTO, basis: BASIS, schluessel: "geheim" }, hole);
}

/**
 * Wie `roh`, beantwortet die Vorab-Frage aber selbst mit „liegt nicht" — so
 * prüft jeder Test darunter den Upload-Weg. Die Frage selbst hat ihre eigenen
 * Tests („erst fragen, dann senden").
 */
function hoch(
  hole: (url: string, init?: RequestInit) => Promise<Response>,
  art: Bildart = "profil",
  datei = ECHTES_WEBP,
) {
  return roh(
    async (url, init) =>
      (init?.method ?? "GET") === "HEAD" ? new Response(null, { status: 400 }) : hole(url, init),
    art,
    datei,
  );
}

describe("webpAblage", () => {
  it("setzt die Endung auf .webp, egal welche die Quelle führt", () => {
    for (const endung of ["jpg", "jpeg", "png"]) {
      expect(webpAblage(`/ausserhalb/354/profile_photo.${endung}`)).toBe(
        "/ausserhalb/354/profile_photo.webp",
      );
    }
  });
});

describe("ladeBildHoch — wohin es geht", () => {
  it("legt das Profilbild als import-avatar.webp im Bucket avatars ab", async () => {
    let gesehen = "";
    const ergebnis = await hoch(async (url) => {
      gesehen = url;
      return new Response(JSON.stringify({ Key: "…" }), { status: 200 });
    });

    expect(gesehen).toBe(`${BASIS}/storage/v1/object/avatars/${KONTO}/import-avatar.webp`);
    expect(ergebnis.stand).toBe("hochgeladen");
  });

  it("legt das Headerbild als import-cover.webp im Bucket covers ab", async () => {
    let gesehen = "";
    await hoch(async (url) => {
      gesehen = url;
      return new Response(JSON.stringify({ Key: "…" }), { status: 200 });
    }, "cover");

    expect(gesehen).toBe(`${BASIS}/storage/v1/object/covers/${KONTO}/import-cover.webp`);
  });

  it("gibt den PFAD zurück — er geht in profiles.avatar_url (AGE-580)", async () => {
    // Bis AGE-580 stand hier die absolute URL, mit der Projektkennung darin.
    // Unter einer neuen Kennung zeigte sie ins Leere. Die absolute URL wird
    // weiter GEBRAUCHT — für den HEAD-Check auf ein vorhandenes Objekt — aber
    // sie wird nicht mehr gespeichert.
    const ergebnis = await hoch(storage(200, { Key: "…" }));

    expect(ergebnis).toEqual({
      stand: "hochgeladen",
      pfad: `${KONTO}/import-avatar.webp`,
    });
  });

  it("gibt den Pfad auch zurück, wenn das Objekt schon da ist (HEAD)", async () => {
    // `roh`, nicht `hoch`: `hoch` beantwortet die Vorab-Frage selbst mit 400,
    // damit die Tests darunter den Upload-Weg prüfen.
    const ergebnis = await roh(async (_url, init) =>
      init?.method === "HEAD"
        ? new Response(null, { status: 200 })
        : new Response(null, { status: 500 }),
    );

    expect(ergebnis).toEqual({ stand: "vorhanden", pfad: `${KONTO}/import-avatar.webp` });
  });

  it("gibt den Pfad auch beim 409/Duplicate zurück", async () => {
    const ergebnis = await hoch(async (_url, init) =>
      init?.method === "HEAD"
        ? new Response(null, { status: 404 })
        : new Response(JSON.stringify({ error: "Duplicate" }), { status: 400 }),
    );

    expect(ergebnis).toEqual({ stand: "vorhanden", pfad: `${KONTO}/import-avatar.webp` });
  });

  it("schickt den Schlüssel und den Bildtyp mit — covers lässt nur image/webp zu", async () => {
    let kopf: Record<string, string> = {};
    await hoch(async (_url, init) => {
      kopf = init?.headers as Record<string, string>;
      return new Response(JSON.stringify({ Key: "…" }), { status: 200 });
    });

    expect(kopf["Authorization"]).toBe("Bearer geheim");
    expect(kopf["Content-Type"]).toBe("image/webp");
  });

  it("bindet den Objektnamen NICHT an den Dateinamen der Quelle", async () => {
    // Der Objektname ist unser Merker für „schon gelegt". Käme er aus der
    // Quelle, legte ein neu gezogener Export mit anderem Dateinamen beim
    // zweiten Lauf ein ZWEITES Objekt an und überschriebe die URL.
    const andersBenannt = join(frisch(), "voellig-anders.webp");
    writeFileSync(andersBenannt, readFileSync(ECHTES_WEBP));

    let gesehen = "";
    await hoch(
      async (url) => {
        gesehen = url;
        return new Response(JSON.stringify({ Key: "…" }), { status: 200 });
      },
      "profil",
      andersBenannt,
    );

    expect(gesehen).toContain(OBJEKTNAME.profil);
    expect(gesehen).not.toContain("voellig-anders");
  });
});

describe("ladeBildHoch — der zweite Lauf bricht nicht ab", () => {
  it('hält HTTP 400 mit „Duplicate" im Rumpf für „vorhanden", nicht für einen Fehler', async () => {
    // DIE FALLE, am lokalen Stack gemessen (15.08.): der Storage-Dienst
    // antwortet auf ein vorhandenes Objekt mit HTTP **400**, und erst im Rumpf
    // steht `{"statusCode":"409","error":"Duplicate"}`. Ein Vergleich gegen
    // `status === 409` meldete jeden Datensatz des zweiten Laufs als
    // gescheitert — grüner Test, rote Wirklichkeit.
    const ergebnis = await hoch(
      storage(400, {
        statusCode: "409",
        error: "Duplicate",
        message: "The resource already exists",
      }),
    );

    expect(ergebnis.stand).toBe("vorhanden");
  });

  it('hält auch einen echten HTTP 409 für „vorhanden"', async () => {
    // Die Storage-Fassung muss lokal und in DEV/PROD nicht dieselbe sein.
    // OHNE `error: "Duplicate"` im Rumpf — sonst prüft dieser Test den
    // Rumpf-Zweig ein zweites Mal und den Status-Vergleich nie. Genau das war
    // er in der ersten Fassung, aufgedeckt von der Mutations-Gegenprobe.
    const ergebnis = await hoch(storage(409, { message: "already exists" }));

    expect(ergebnis.stand).toBe("vorhanden");
  });

  it("ersetzt ein vorhandenes Objekt NICHT", async () => {
    let versuche = 0;
    await hoch(async () => {
      versuche++;
      return new Response(JSON.stringify({ error: "Duplicate" }), { status: 400 });
    });

    expect(versuche).toBe(1);
  });
});

describe("ladeBildHoch — was den Lauf nicht beenden darf (6.4)", () => {
  it("meldet eine fehlende gewandelte Datei als Befund, statt zu werfen", async () => {
    // Der Fall der Kennung 326: 1×1 px, von `wandleBild` als untauglich
    // abgewiesen — es gibt keine .webp. Das Mitglied wird trotzdem angelegt.
    let gefragt = false;
    const ergebnis = await hoch(
      async () => {
        gefragt = true;
        return new Response("{}", { status: 200 });
      },
      "profil",
      join(frisch(), "gibtesnicht.webp"),
    );

    expect(ergebnis.stand).toBe("fehlt");
    expect(gefragt).toBe(false);
    // Der GRUND muss den Fall benennen. Ohne diese Zusicherung ist der Test
    // aus dem falschen Grund grün: nimmt man den Wächter weg, wirft
    // `readFileSync` und wird als „Netzfehler" gefangen — `stand` bliebe
    // `fehlt` und `gefragt` bliebe `false`. Von der Gegenprobe aufgedeckt.
    expect(grundVon(ergebnis)).toContain("Zwischenablage");
  });

  it("meldet einen abgewiesenen Upload als Befund, statt zu werfen", async () => {
    const ergebnis = await hoch(storage(413, { error: "PayloadTooLarge" }));

    expect(ergebnis.stand).toBe("fehlt");
    expect(grundVon(ergebnis)).toContain("413");
  });

  it("meldet einen Netzfehler als Befund, statt den Lauf zu beenden", async () => {
    const ergebnis = await hoch(async () => {
      throw new Error("ECONNREFUSED");
    });

    expect(ergebnis.stand).toBe("fehlt");
  });

  it("trägt keinen Rumpftext in den Grund — er zitiert den Objektpfad (4.7)", async () => {
    const ergebnis = await hoch(
      storage(400, {
        error: "InvalidRequest",
        message: `The object avatars/${KONTO}/import-avatar.webp is bad`,
      }),
    );

    expect(grundVon(ergebnis)).not.toContain(KONTO);
  });
});

describe("BUCKET und OBJEKTNAME", () => {
  it("trennt die beiden Bildarten sauber", () => {
    expect(BUCKET).toEqual({ profil: "avatars", cover: "covers" });
    expect(OBJEKTNAME).toEqual({ profil: "import-avatar.webp", cover: "import-cover.webp" });
  });
});

describe("ladeBildHoch — erst fragen, dann senden", () => {
  it("sendet die Datei gar nicht, wenn das Objekt schon liegt", async () => {
    // DER GRUND, am lokalen Stack gemessen (15.08.): schickt man den vollen
    // Rumpf und wird mit `400 Duplicate` abgewiesen, BEVOR der Dienst ihn
    // ausgelesen hat, bleibt die Verbindung mit ungelesenem Rumpf zurück. Über
    // 110 Anfragen hinweg hingen so vier reproduzierbar 60 Sekunden und
    // endeten in Kongs „upstream server is timing out" — obwohl das Objekt lag.
    const wege: string[] = [];
    const ergebnis = await roh(async (url, init) => {
      wege.push(`${init?.method ?? "GET"} ${url}`);
      return new Response(null, { status: 200 });
    });

    expect(ergebnis.stand).toBe("vorhanden");
    expect(wege).toHaveLength(1);
    expect(wege[0]).toBe(
      `HEAD ${BASIS}/storage/v1/object/public/avatars/${KONTO}/import-avatar.webp`,
    );
  });

  it("lädt hoch, wo nichts liegt", async () => {
    const methoden: string[] = [];
    const ergebnis = await roh(async (_url, init) => {
      const methode = init?.method ?? "GET";
      methoden.push(methode);
      return methode === "HEAD"
        ? new Response(null, { status: 400 })
        : new Response(JSON.stringify({ Key: "…" }), { status: 200 });
    });

    expect(methoden).toEqual(["HEAD", "POST"]);
    expect(ergebnis.stand).toBe("hochgeladen");
  });

  it("lässt den Upload entscheiden, wenn die Frage selbst scheitert", async () => {
    // Die Frage ist der schnelle Weg, nicht die Instanz. Ein Netzfehler auf dem
    // HEAD darf ein Bild nicht verhindern — der POST weist ein vorhandenes
    // Objekt ohnehin ab.
    let ersteFrage = true;
    const ergebnis = await roh(async (_url, init) => {
      if ((init?.method ?? "GET") === "HEAD") {
        if (ersteFrage) {
          ersteFrage = false;
          throw new Error("ECONNRESET");
        }
      }
      return new Response(JSON.stringify({ Key: "…" }), { status: 200 });
    });

    expect(ergebnis.stand).toBe("hochgeladen");
  });
});

describe("ladeBildHoch — das Ersetzen ist unmöglich gemacht, nicht nur unterlassen", () => {
  it("schickt KEIN x-upsert — sein Fehlen IST die Zusicherung aus 6.3", async () => {
    // Aus dem Code-Review (MEDIUM-5): der Test „ersetzt ein vorhandenes Objekt
    // NICHT" zählte nur, dass ein POST stattfindet. Ein versehentlich
    // hinzugefügtes `x-upsert: true` blieb grün, obwohl es genau die
    // Anforderung aufhebt, um die es geht.
    let kopf: Record<string, string> = {};
    await hoch(async (_url, init) => {
      kopf = init?.headers as Record<string, string>;
      return new Response(JSON.stringify({ Key: "…" }), { status: 200 });
    });

    const namen = Object.keys(kopf).map((k) => k.toLowerCase());
    expect(namen).not.toContain("x-upsert");
  });

  it("bricht einen hängenden Aufruf ab, statt den Lauf anzuhalten", async () => {
    // Aus dem Code-Review (MEDIUM-4): auf genau dieser Fläche sind 60-Sekunden-
    // Hänger belegt. Ohne Zeitgrenze hält ein einziger einen Lauf über 70
    // Datensätze unbegrenzt an, ohne eine Zeile Ausgabe.
    let signalGesehen: AbortSignal | undefined;
    await hoch(async (_url, init) => {
      signalGesehen = init?.signal ?? undefined;
      return new Response(JSON.stringify({ Key: "…" }), { status: 200 });
    });

    expect(signalGesehen).toBeInstanceOf(AbortSignal);
  });

  it("meldet ein Rechteproblem auf der Zwischenablage NICHT als Netzfehler", async () => {
    // Aus dem Code-Review (LOW-6): `readFileSync` stand im try um den POST, ein
    // EACCES kam deshalb als „Netzfehler" heraus — und der Bericht riete dann
    // „ein weiterer Lauf klärt es", was bei einem Rechteproblem nie stimmt.
    const ordner = frisch();
    const gesperrt = join(ordner, "gesperrt.webp");
    writeFileSync(gesperrt, "x", { mode: 0o000 });

    const ergebnis = await hoch(
      async () => new Response(JSON.stringify({ Key: "…" }), { status: 200 }),
      "profil",
      gesperrt,
    );

    expect(ergebnis.stand).toBe("fehlt");
    expect(grundVon(ergebnis)).not.toContain("Netzfehler");
    expect(grundVon(ergebnis)).toContain("nicht lesbar");
  });
});

// ── Befund MEDIUM des Diff-Reviews (codex, 16.08.) ──────────────────────────
describe("fehlendeBildspalten", () => {
  it("meldet nichts, wenn alle drei Spalten stehen", () => {
    expect(
      fehlendeBildspalten(["user_login", "source_user_id", "profile_photo", "cover_photo"]),
    ).toEqual([]);
  });

  it("nennt jede fehlende Spalte einzeln", () => {
    // Ein umbenannter Export meldete sonst erfolgreich „0 Bilder" — mit Ausgang
    // 0, also wie ein geglückter Lauf. Nach Abschaltung der alten Seite ist das
    // nicht mehr behebbar.
    expect(fehlendeBildspalten(["user_login"])).toEqual([
      "source_user_id",
      "profile_photo",
      "cover_photo",
    ]);
    expect(fehlendeBildspalten(["source_user_id", "profile_photo"])).toEqual(["cover_photo"]);
  });

  it("übersieht eine Spalte nicht wegen des BOM oder eines Leerzeichens", () => {
    // Die echte Datei beginnt mit einem BOM, das am Namen der ersten Spalte
    // klebt — dieselbe Falle wie in `pruefeKopfzeile`.
    expect(fehlendeBildspalten(["﻿source_user_id", " profile_photo", "cover_photo "])).toEqual([]);
  });

  it("prüft genau die Spalten, die `bildauftraege` liest", () => {
    // Die Liste wird aus derselben Quelle abgeleitet wie die Verwendung. Stünde
    // sie daneben, prüfte dieser Test zwei Kopien gegeneinander und beide
    // dürften abdriften.
    for (const spalte of BILDSPALTEN) {
      const row = {
        source_user_id: "42",
        profile_photo: "a.jpg",
        cover_photo: "b.jpg",
      } as Record<string, string>;
      delete row[spalte];
      const auftraege = bildauftraege({ row, basis: "https://x.test", zwischenablage: "/tmp/z" });
      expect(auftraege.length).toBeLessThan(2);
    }
  });
});
