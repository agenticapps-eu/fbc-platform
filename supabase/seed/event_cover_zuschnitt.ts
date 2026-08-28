import sharp from "sharp";

/**
 * Ein Heldenbild auf das Format bringen, das der Zuschneider im Produkt
 * erzeugt (AGE-599).
 *
 * ── WARUM DAS NOETIG IST ────────────────────────────────────────────────────
 * Der Demo-Seed lud die Dateien aus `public/images/` **roh** in den Bucket
 * `event-covers`. Das sind Seiten-Heldenbilder, 1600×1067 bzw. 1600×1200 — sie
 * haben den Zuschneider nie gesehen. Gemessen am 25.08. in den Buckets:
 *
 *   PROD  1 Objekt, 3,00:1  (durch `EventCoverPicker` gegangen)
 *   DEV   8 Objekte, 1,33:1 und 7 × 1,50:1  (aus dem Seed)
 *
 * Seit AGE-596 ist das Bildfeld 3:1 und passt ein statt zu beschneiden. Ein
 * 1,50:1-Bild steht darin mit rund 25 % freier Flaeche je Seite — und zwar
 * genau auf DEV und der Probe-Flaeche, also dort, wo abgenommen wird. Das ist
 * ein Mangel des Seeds, der Material erzeugt, das das Produkt so nie
 * herstellt; nicht ein Mangel des Feldes.
 *
 * ── WARUM NICHT DIE QUELLDATEIEN ERSETZEN ───────────────────────────────────
 * Dieselben Dateien sind die Seitenkoepfe (`src/config/formatHero.ts:41,46`).
 * Dort ist 1,50:1 richtig. Zugeschnitten wird deshalb beim Hochladen, nicht auf
 * der Platte.
 *
 * ── DIE ZAHLEN STAMMEN AUS DEM PRODUKT, NICHT AUS DER LUFT ──────────────────
 * `EventCoverPicker` reicht `aspect={3}` und `outWidth={1500}` an
 * `AvatarCropper`, und der rechnet `outHeight = outWidth / aspect`. 1500×500
 * webp ist also genau das, was ein Mitglied hochlaedt. Aendert sich das dort,
 * muss es sich hier mitaendern — deshalb steht die Herkunft hier und nicht nur
 * die Zahl.
 *
 * `fit: "cover"` mit mittiger Lage entspricht dem, was der Zuschneider
 * voreingestellt zeigt. Ein Mitglied kann den Ausschnitt verschieben; ein Seed
 * hat niemanden, der das taete.
 */
export const TITELBILD_BREITE = 1500;
export const TITELBILD_HOEHE = TITELBILD_BREITE / 3;

export async function titelbildZuschnitt(quelle: string | Buffer): Promise<Buffer> {
  return sharp(quelle)
    .resize({
      width: TITELBILD_BREITE,
      height: TITELBILD_HOEHE,
      fit: "cover",
      position: "centre",
    })
    .webp()
    .toBuffer();
}
