import { join } from "node:path";

import sharp from "sharp";
import { describe, expect, it } from "vitest";

import {
  TITELBILD_BREITE,
  TITELBILD_HOEHE,
  titelbildZuschnitt,
} from "./event_cover_zuschnitt";

/**
 * Der Seed muss Titelbilder liefern, die das Produkt so auch herstellt
 * (AGE-599).
 *
 * Gemessen wird an den **echten** Dateien aus `public/images/`, nicht an
 * erzeugten Attrappen: der Befund lautet, dass genau diese Dateien roh
 * hochgeladen wurden, und eine Attrappe könnte das nicht widerlegen.
 *
 * Die erste Zusage ist die **Positivkontrolle** und steht deshalb zuerst: sie
 * misst, dass die Quellen eben NICHT schon 3:1 sind. Ohne sie wäre der ganze
 * Rest von einem Zuschnitt, der nichts tut, nicht zu unterscheiden.
 */

const BILDER = join(process.cwd(), "public", "images");

/** Die Motive, die der Seed wirklich benutzt (`import_world_seed.ts`, `demo_event_covers.ts`). */
const MOTIVE = [
  "hero-academy.webp",
  "hero-aktivitaet.webp",
  "hero-compass.webp",
  "hero-kontakte.webp",
  "hero-mitglieder.webp",
  "hero-mitgliedschaft.webp",
  "hero-see.webp",
  "hero-start.webp",
];

async function verhaeltnis(quelle: string | Buffer): Promise<number> {
  const { width, height } = await sharp(quelle).metadata();
  if (!width || !height) throw new Error("Kein lesbares Bild");
  return width / height;
}

describe("Titelbild-Zuschnitt für den Demo-Seed (AGE-599)", () => {
  it("Positivkontrolle: die Quellen sind NICHT schon 3:1", async () => {
    const gemessen = await Promise.all(MOTIVE.map((n) => verhaeltnis(join(BILDER, n))));
    for (const v of gemessen) expect(v).toBeLessThan(2);
    // Genau die zwei Sorten aus der Messung vom 25.08.: 1,50:1 und 1,33:1.
    expect(gemessen.some((v) => Math.abs(v - 1.5) < 0.01)).toBe(true);
    expect(gemessen.some((v) => Math.abs(v - 4 / 3) < 0.01)).toBe(true);
  });

  it("macht aus jedem Motiv 3,00:1 — die Abnahme des Vorgangs", async () => {
    for (const name of MOTIVE) {
      const v = await verhaeltnis(await titelbildZuschnitt(join(BILDER, name)));
      expect(Math.abs(v - 3), `${name} liegt bei ${v.toFixed(3)}:1`).toBeLessThan(0.01);
    }
  });

  it("trifft die Maße, die der Zuschneider im Produkt erzeugt", async () => {
    const { width, height, format } = await sharp(
      await titelbildZuschnitt(join(BILDER, "hero-see.webp")),
    ).metadata();
    // `EventCoverPicker` reicht aspect=3 und outWidth=1500 an `AvatarCropper`.
    expect(width).toBe(TITELBILD_BREITE);
    expect(height).toBe(TITELBILD_HOEHE);
    expect(format).toBe("webp");
  });

  it("schneidet mittig, nicht vom Rand her", async () => {
    // Ein Bild im Format der Quellen (1,50:1), dessen MITTE sich von oben und
    // unten unterscheidet: nur ein mittiger Zuschnitt liefert das mittlere
    // Drittel zurück. Ein Zuschnitt „von oben" gäbe hier rot.
    const probe = await sharp({
      create: { width: 1500, height: 1000, channels: 3, background: "#ff0000" },
    })
      .composite([
        {
          input: {
            create: { width: 1500, height: 500, channels: 3, background: "#0000ff" },
          },
          top: 250,
          left: 0,
        },
      ])
      .webp()
      .toBuffer();

    const { data } = await sharp(await titelbildZuschnitt(probe))
      .raw()
      .toBuffer({ resolveWithObject: true });
    // Erstes Pixel der zugeschnittenen Fläche: blau, wenn mittig geschnitten.
    //
    // Nicht auf `[0, 0, 255]` genau: webp ist verlustbehaftet und liefert an
    // dieser Kante gemessen `[23, 2, 216]`. Zugesichert wird deshalb, welcher
    // Kanal führt — das unterscheidet Blau von Rot zuverlässig und hängt nicht
    // an der Kompressionsstufe.
    const [r, g, b] = [data[0], data[1], data[2]];
    expect(b, `gemessen r=${r} g=${g} b=${b}`).toBeGreaterThan(150);
    expect(r, `gemessen r=${r} g=${g} b=${b}`).toBeLessThan(100);
  });
});
