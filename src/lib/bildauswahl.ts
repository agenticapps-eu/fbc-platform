import { Camera, EncodingType, MediaTypeSelection } from "@capacitor/camera";
import { CapacitorUpdater } from "@capgo/capacitor-updater";

/**
 * Woher ein Bild kommt (AGE-642 C3).
 *
 * **Die Rueckfrage stellt die App selbst, nicht das System.** Capacitor 8 hat
 * `getPhoto` samt eingebauter Kamera/Galerie-Rueckfrage als veraltet markiert
 * und verweist dafuer auf eine eigene Oberflaeche. Der Ersatz sind zwei
 * getrennte Aufrufe — `takePhoto` und `chooseFromGallery` — und nur der zweite
 * kann Mehrfachauswahl. Genau deshalb steht die Wahl hier als eigener Typ und
 * nicht als Option eines einzigen Aufrufs.
 */
export type Bildquelle = "kamera" | "mediathek";

export type Bildauswahl =
  /** Im Web: das bestehende Dateifeld ausloesen, sein `onChange` liefert weiter. */
  | { art: "dateifeld" }
  /** Nativ: erst fragen, woher — dann der passende Aufruf. */
  | { art: "rueckfrage"; mehrere: boolean; limit: number };

/**
 * Welchen Weg die Bildauswahl nimmt.
 *
 * Steht hier und nicht im Klick-Handler, weil die nativen Aufrufe in jsdom nie
 * etwas tun: ein Test, der auf sie wartet, waere gruen, weil nichts passiert —
 * dieselbe Falle wie beim `backButton` und bei `env(safe-area-inset-*)`.
 *
 * @param nativ `Capacitor.isNativePlatform()`
 * @param mehrere ob die aufrufende Flaeche mehrere Bilder annimmt
 * @param frei wie viele Bilder dort noch hineinpassen
 */
export function entscheideBildauswahl({
  nativ,
  mehrere,
  frei,
}: {
  nativ: boolean;
  mehrere: boolean;
  frei: number;
}): Bildauswahl {
  if (!nativ) return { art: "dateifeld" };
  // `limit` ist der REST, nicht das Maximum. Im Web haelt der Dateidialog die
  // Grenze selbst; nativ haelt sie niemand, und `waehleBilder` verwuerfe den
  // Ueberschuss stumm — das Mitglied saehe vier von zwanzig Bildern ankommen
  // und keinen Grund dafuer.
  return { art: "rueckfrage", mehrere, limit: mehrere ? frei : 1 };
}

/**
 * Holt die Bilder von der gewaehlten Quelle — nur nativ aufzurufen.
 *
 * `EncodingType.JPEG` ist keine Vorliebe, sondern die Lehre aus dem 17.08.:
 * ein HEIC vom iPhone zeigte im Zuschnitt eine leere Flaeche und einen toten
 * Knopf, ohne ein Wort (siehe `AvatarCropper.tsx`). `chooseFromGallery` kennt
 * die Option nicht — dort bleibt es beim Zweig, den `AvatarCropper` fuer genau
 * diesen Fall schon hat.
 *
 * Ein Abbruch ist kein Fehler, sondern der haeufigste Ausgang: beide Aufrufe
 * werfen dabei, und daraus wird eine leere Liste.
 *
 * ══ WARUM HIER DIE OTA-UEBERNAHME ANGEHALTEN WIRD ══════════════════════════
 *
 * Gemessen am 04.09. am Pixel 11 Pro, und es war drei Tage lang als
 * Activity-Lebenszyklus-Fehler fehlgedeutet:
 *
 * `capacitor.config.ts` setzt weder `autoUpdate` noch `directUpdate`, es gelten
 * also die Vorgaben `true`/`false`. Ein geladenes Buendel wird damit NICHT
 * sofort uebernommen, sondern beim naechsten `handleOnStart` — bei der Rueckkehr
 * aus dem GESTOPPTEN Zustand. Die Kamera ist eine Vollbild-Activity und stoppt
 * uns; die Uebernahme laedt die WebView neu; und damit stirbt das `await` unten
 * mitsamt dem React-Zustand des Aufrufers. Kein Ergebnis, kein `catch`, kein
 * Wort — genau das Bild, das ein Mitglied als „nichts passiert" meldet.
 *
 * Der Mediathek-Weg blieb verschont, weil der Fotos-Picker ein DURCHSCHEINENDES
 * Blatt ist: pausiert, nie gestoppt, also kein `handleOnStart`. Das ist kein
 * Trost, sondern der Grund, warum der Fehler sprunghaft wirkte — er trifft nur,
 * wenn gerade ein Buendel bereitliegt, also in den Minuten nach einem Deploy.
 *
 * `kind: "kill"` schiebt die Uebernahme bis zum echten Neustart. Wird die App
 * waehrenddessen wirklich abgeraeumt, greift sie beim naechsten Start — dann ist
 * der Rundlauf ohnehin verloren, und das ist kein Rueckschritt.
 *
 * **HIER und nicht in `useBildauswahl`**: das ist die einzige Stelle, an der ein
 * nativer Aufruf die App verlaesst. Seit C3 gehen alle Bildwege durch sie.
 */
export async function bilderVonQuelle(
  quelle: Bildquelle,
  { mehrere, limit }: { mehrere: boolean; limit: number },
): Promise<File[]> {
  // Beide Aufrufe duerfen NIE werfen. Ein Aufschub, der die Bildauswahl
  // abbricht, waere schlimmer als gar keiner: er erzeugte denselben stummen
  // Ausgang, den er verhindern soll — `waehlen()` im Hook fuehrt kein `catch`.
  try {
    await CapacitorUpdater.setMultiDelay({ delayConditions: [{ kind: "kill" }] });
  } catch (e) {
    console.error("[bildauswahl] OTA-Aufschub nicht gesetzt:", (e as Error).message);
  }

  try {
    return await hole(quelle, mehrere, limit);
  } finally {
    try {
      await CapacitorUpdater.cancelDelay();
    } catch (e) {
      console.error("[bildauswahl] OTA-Aufschub nicht zurueckgenommen:", (e as Error).message);
    }
  }
}

/** Der bisherige Rumpf, unveraendert — nur damit der Aufschub oben ein
 *  `finally` bekommt, das jeden Ausgang einschliesst. */
async function hole(quelle: Bildquelle, mehrere: boolean, limit: number): Promise<File[]> {
  let pfade: string[];
  try {
    if (quelle === "kamera") {
      const foto = await Camera.takePhoto({
        encodingType: EncodingType.JPEG,
        correctOrientation: true,
      });
      pfade = [foto.webPath ?? foto.uri ?? ""];
    } else {
      const { results } = await Camera.chooseFromGallery({
        mediaType: MediaTypeSelection.Photo,
        allowMultipleSelection: mehrere,
        limit,
        correctOrientation: true,
      });
      pfade = results.map((r) => r.webPath ?? r.uri ?? "");
    }
  } catch {
    return [];
  }

  const dateien: File[] = [];
  for (const [i, pfad] of pfade.entries()) {
    if (!pfad) continue;
    const blob = await (await fetch(pfad)).blob();
    const typ = blob.type || "image/jpeg";
    // Der Name ist rein kosmetisch: JEDER Weg dahinter kodiert um — der
    // Zuschnitt nach `image/webp`, der Feed ueber `shrinkToWebp`. Weder Name
    // noch MIME erreichen je den Speicher.
    dateien.push(
      new File([blob], `aufnahme-${i + 1}.${typ.split("/")[1] ?? "jpg"}`, { type: typ }),
    );
  }
  return dateien;
}
