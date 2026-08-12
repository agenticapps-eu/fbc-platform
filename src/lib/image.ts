/**
 * Bilder für Beiträge verkleinern und nach WebP wandeln (AGE-528).
 *
 * Die Grenzen stehen in `design.md`, „Bildgrenzen": Maximalkante 1600 px,
 * Qualität 0,82. Serverseitig hält der Bucket `post-media` 1 MiB und
 * `image/webp` fest — dieser Client-Schritt ist Bequemlichkeit, nicht die
 * Sicherheitsgrenze. Ein 1600-px-WebP bei 0,82 liegt bei 100–250 kB.
 *
 * Die Rechnung ist absichtlich von der Zeichnung getrennt: jsdom hat keinen
 * 2D-Kontext, also ist nur `zielMasse` prüfbar (image.test.ts). `shrinkToWebp`
 * wird von der Sichtprobe getragen — bis auf seinen Fehlerzweig, der in jsdom
 * ohne Weiteres erreichbar ist.
 */

export const MAX_KANTE = 1600;
export const QUALITAET = 0.82;

/**
 * Dieselbe Grenze, die der Bucket `post-media` serverseitig hält
 * (`file_size_limit = 1048576`). Sie steht hier NICHT, damit sie gilt — sie
 * gilt am Bucket —, sondern damit ihr Bruch am richtigen Ort auffällt: beim
 * Auswählen des Bildes und nicht als roher Storage-Fehler, nachdem der Beitrag
 * geschrieben und „Posten" gedrückt ist.
 */
export const MAX_BYTES = 1048576;

/**
 * Eine Meldung für alle drei Fehlerwege (unlesbares Format, kein Canvas, keine
 * Kodierung). Sie unterscheiden sich für den Nutzer nicht: er wählt in jedem
 * Fall ein anderes Bild.
 */
export const BILD_UNLESBAR =
  "Dieses Bild konnte nicht verarbeitet werden. Bitte ein anderes wählen (JPEG, PNG oder WebP).";

/** Eigene Meldung, weil hier etwas anderes zu tun ist: ein anderes Bild wählen. */
export const BILD_ZU_GROSS =
  "Dieses Bild bleibt auch verkleinert über 1 MB. Bitte ein anderes wählen.";

export interface Masse {
  width: number;
  height: number;
}

/**
 * Zielmaße unter Erhalt des Seitenverhältnisses, ohne Zuschnitt und ohne
 * Vergrößern. Kein Ergebnis ist kleiner als 1 px — ein Canvas mit Kante 0
 * wirft beim Zeichnen.
 */
export function zielMasse(width: number, height: number, maxKante = MAX_KANTE): Masse {
  const lange = Math.max(width, height);
  if (lange <= maxKante) return { width, height };
  const faktor = maxKante / lange;
  return {
    width: Math.max(1, Math.round(width * faktor)),
    height: Math.max(1, Math.round(height * faktor)),
  };
}

/**
 * Verkleinert ein gewähltes Bild und gibt es als WebP samt seiner Maße zurück.
 * Die Maße wandern in `post_media`, damit die Karte ihr Layout bestimmen kann,
 * ohne die Datei zu laden.
 *
 * Scheitert irgendein Schritt, wirft die Funktion `BILD_UNLESBAR` — der
 * Aufrufer zeigt die Meldung und lädt gar nichts hoch (Task 5.1a).
 */
export async function shrinkToWebp(
  datei: Blob,
  maxKante = MAX_KANTE,
): Promise<{ blob: Blob; width: number; height: number }> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(datei);
  } catch {
    throw new Error(BILD_UNLESBAR);
  }

  const { width, height } = zielMasse(bitmap.width, bitmap.height, maxKante);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error(BILD_UNLESBAR);
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  // Die Maße allein garantieren die Dateigröße nicht: ein rauschiges Foto kann
  // auch bei 1600 px über 1 MiB liegen, und der Bucket lehnt es dann ab. Also
  // messen statt schätzen — und notfalls mit weniger Qualität nachkodieren.
  // Drei Anläufe, dann ist es an der Datei und nicht an der Einstellung.
  for (let qualitaet = QUALITAET; qualitaet >= 0.4; qualitaet -= 0.2) {
    const blob = await new Promise<Blob | null>((auf) =>
      canvas.toBlob(auf, "image/webp", qualitaet),
    );
    if (!blob) throw new Error(BILD_UNLESBAR);
    if (blob.size <= MAX_BYTES) return { blob, width, height };
  }
  throw new Error(BILD_ZU_GROSS);
}
