/**
 * Die Regeln hinter `pnpm android:keystore` (AGE-642 B3).
 *
 * ══ WAS DIESE DATEI IST ════════════════════════════════════════════════════
 * Ein Release-Bau muss signiert sein — ein Geraet nimmt eine unsignierte App
 * nicht an, und Play nimmt sie erst recht nicht. Das Signaturmaterial darf
 * aber nicht im Repo liegen: es ist oeffentlich.
 *
 * Zwei Schichten decken das ab, und sie tun VERSCHIEDENES:
 *
 * - `.gitignore` fuehrt `*.jks` (Z. 51) und `key.properties` (Z. 64). Das ist
 *   die Schicht, die fuer die hier erzeugten Dateien greift.
 * - Der `native-secrets-guard` faengt, was per `git add -f` oder ueber eine
 *   Musterluecke trotzdem hineingeraet. Er sieht verfolgte und
 *   unverfolgt-nicht-ignorierte Dateien an — **ignorierte ausdruecklich
 *   nicht.** Auf die von diesem Skript geschriebenen Dateien schlaegt er
 *   also bewusst NICHT an; taete er es, waere er auf jedem Rechner rot, der
 *   bauen kann, und ein immer roter Waechter wird abgeschaltet.
 *
 * Das ist der Widerspruch aus B3, aufgeloest: der Keystore entsteht vor dem Bau
 * aus Infisical, unter einer Ignorierzeile, und verschwindet mit dem Runner.
 *
 * ══ WAS HIER GEPRUEFT WIRD, UND WARUM GERADE DAS ═══════════════════════════
 * Nicht geprueft wird, was Gradle ohnehin laut sagt: ein falsches Passwort
 * („Keystore was tampered with"), ein falscher Alias („No key with alias").
 * Beides bricht den Lauf mit einer Meldung ab, die die Ursache nennt.
 *
 * Geprueft wird, was Gradle SPAET oder UNVERSTAENDLICH sagt:
 *
 * - Ein **fehlender** Wert. Gradle meldete `storePassword == null` aus einer
 *   Datei, die es nur gibt, weil dieses Skript sie geschrieben hat — der
 *   Hinweis auf Infisical stuende nirgends. Deshalb wird jeder der vier Werte
 *   einzeln beim Namen genannt, mit Herkunft und Aufruf.
 * - Ein **verstuemmeltes** Base64. Node dekodiert grosszuegig und ignoriert
 *   Zeichen ausserhalb des Alphabets — ein abgeschnittenes Secret ergaebe also
 *   klaglos eine Datei, und der Befund fiele als „Invalid keystore format"
 *   mitten in einem Gradle-Stacktrace an.
 * - **Weissraum** um die Werte. Java streift fuehrenden Weissraum im Wert
 *   einer Properties-Datei still ab; ein aus Infisical kopiertes ` geheim`
 *   waere stumm ein anderes Passwort als das im Keystore.
 * - Ein **Backslash** im Passwort. In einer Java-Properties-Datei ist er das
 *   Fluchtzeichen: `a\b` laendet als `ab` im Speicher. Der Bericht zeigte dann
 *   auf ein falsches Passwort bei einem Keystore, der stimmt.
 *
 * ══ WAS BEWUSST NICHT GEPRUEFT WIRD ════════════════════════════════════════
 * Ob es DER richtige Keystore ist — also der, dessen Zertifikat Play als
 * Upload-Schluessel kennt. Das braeuchte einen Fingerabdruck als zweite
 * Wahrheit im Repo, und der Fehlerfall ist nicht still: Play lehnt den Upload
 * mit genau dieser Begruendung ab. Kommt es je vor, gehoert der Fingerabdruck
 * hierher — heute waere er Ballast.
 */

/**
 * Der Dateiname unter `android/app/`. Relativ, nicht absolut: `build.gradle`
 * loest ihn mit `file(...)` gegen das App-Modul auf, und ein absoluter Pfad
 * aus der Erzeugung zeigte auf dem Runner ins Leere.
 */
export const KEYSTORE_DATEI = "upload-keystore.jks";

/** Die vier Werte, die aus Infisical kommen — in der Reihenfolge der Meldung. */
const ERWARTET = [
  "ANDROID_KEYSTORE_BASE64",
  "ANDROID_KEYSTORE_PASSWORD",
  "ANDROID_KEY_ALIAS",
  "ANDROID_KEY_PASSWORD",
] as const;

export interface KeystorePruefung {
  /** `null`, wenn das Material benutzbar ist — sonst der Grund. */
  fehler: string | null;
  /** Inhalt fuer `android/key.properties`. Leer, wenn `fehler` steht. */
  properties: string;
  /** Der dekodierte Keystore. Leer, wenn `fehler` steht. */
  keystore: Buffer;
}

const LEER: Omit<KeystorePruefung, "fehler"> = { properties: "", keystore: Buffer.alloc(0) };

/** In einer Java-Properties-Datei ist `\` das Fluchtzeichen. */
function fluchten(wert: string): string {
  return wert.replace(/\\/g, "\\\\");
}

/**
 * Ein Keystore ist entweder PKCS#12 (seit Java 9 die Vorgabe von `keytool`) —
 * DER, also eine SEQUENCE mit langer Laengenangabe, `30 82` — oder das aeltere
 * JKS mit eigener Magie `FE ED FE ED`.
 */
function istKeystore(bytes: Buffer): boolean {
  if (bytes.length < 4) return false;
  const p12 = bytes[0] === 0x30 && bytes[1] === 0x82;
  const jks = bytes[0] === 0xfe && bytes[1] === 0xed && bytes[2] === 0xfe && bytes[3] === 0xed;
  return p12 || jks;
}

export function pruefeKeystore(
  umgebung: Partial<Record<(typeof ERWARTET)[number], string | undefined>>,
): KeystorePruefung {
  const werte: Record<string, string> = {};

  for (const name of ERWARTET) {
    const roh = umgebung[name];
    if (roh === undefined || roh.trim() === "") {
      return {
        fehler:
          `${name} fehlt (Herkunft: Infisical, Umgebung prod). ` +
          "Aufruf: `infisical run --env=prod -- pnpm android:keystore`.",
        ...LEER,
      };
    }
    werte[name] = roh.trim();
  }

  // Der Base64-Schnitt: erst die Form pruefen, dann dekodieren. Andersherum
  // dekodierte Node auch Muell — es ignoriert Zeichen ausserhalb des
  // Alphabets, statt zu werfen.
  const roh64 = werte.ANDROID_KEYSTORE_BASE64.replace(/\s/g, "");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(roh64) || roh64.length % 4 !== 0) {
    return {
      fehler:
        "ANDROID_KEYSTORE_BASE64 ist kein gueltiges Base64. Erzeugt wird der " +
        "Wert mit `base64 -i upload-keystore.jks`; ein Zeilenumbruch darin ist " +
        "unschaedlich, ein abgeschnittener Wert nicht.",
      ...LEER,
    };
  }

  const keystore = Buffer.from(roh64, "base64");
  if (!istKeystore(keystore)) {
    return {
      fehler:
        "ANDROID_KEYSTORE_BASE64 dekodiert zu etwas, das kein Android-Keystore " +
        "ist (weder PKCS#12 noch JKS). Vermutlich ist die falsche Datei kodiert " +
        "worden.",
      ...LEER,
    };
  }

  const properties =
    [
      `storeFile=${KEYSTORE_DATEI}`,
      `storePassword=${fluchten(werte.ANDROID_KEYSTORE_PASSWORD)}`,
      `keyAlias=${fluchten(werte.ANDROID_KEY_ALIAS)}`,
      `keyPassword=${fluchten(werte.ANDROID_KEY_PASSWORD)}`,
    ].join("\n") + "\n";

  return { fehler: null, properties, keystore };
}
