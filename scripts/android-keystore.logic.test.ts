import { describe, expect, it } from "vitest";

import { pruefeKeystore } from "./android-keystore.logic";

/**
 * `android/key.properties` und der Keystore selbst liegen nicht im Repo
 * (`.gitignore`, und der `native-secrets-guard` meldet beide). Sie werden vor
 * einem Release-Bau aus Infisical erzeugt — dasselbe Muster wie
 * `google-services.json`.
 *
 * Was hier geprueft wird, ist das, was der Gradle-Lauf NICHT frueh genug sagt.
 * Ein falsches Passwort und ein falscher Alias brechen dort laut ab; dafuer
 * braucht es hier nichts. Ein **verstuemmeltes** Base64 dagegen wird bis in
 * `signingConfigs` durchgereicht und faellt erst als „Invalid keystore format"
 * auf, mitten in einem Gradle-Stacktrace, ohne Hinweis auf das Secret.
 */

/** PKCS#12 ist DER: eine SEQUENCE mit langer Laengenangabe — `30 82 …`. */
const P12 = Buffer.from([0x30, 0x82, 0x0a, 0x0b, 0x02, 0x01, 0x03]).toString("base64");
/** Das aeltere JKS-Format traegt eine eigene Magie. */
const JKS = Buffer.from([0xfe, 0xed, 0xfe, 0xed, 0x00, 0x00, 0x00, 0x02]).toString("base64");

const VOLLSTAENDIG = {
  ANDROID_KEYSTORE_BASE64: P12,
  ANDROID_KEYSTORE_PASSWORD: "s3hr-geheim",
  ANDROID_KEY_ALIAS: "upload",
  ANDROID_KEY_PASSWORD: "s3hr-geheim",
};

describe("pruefeKeystore", () => {
  it("nimmt einen vollstaendigen Satz an und schreibt nichts weg", () => {
    const { fehler, properties, keystore } = pruefeKeystore(VOLLSTAENDIG);
    expect(fehler).toBeNull();
    expect(properties).toContain("keyAlias=upload");
    expect(keystore.length).toBeGreaterThan(0);
  });

  it("akzeptiert auch das aeltere JKS-Format", () => {
    const { fehler } = pruefeKeystore({ ...VOLLSTAENDIG, ANDROID_KEYSTORE_BASE64: JKS });
    expect(fehler).toBeNull();
  });

  // Jede der vier einzeln: eine Sammelmeldung („ein Wert fehlt") zwingt zum
  // Raten, und geraten wird beim Einrichten einer neuen Umgebung, nicht im
  // eingespielten Betrieb.
  it.each([
    "ANDROID_KEYSTORE_BASE64",
    "ANDROID_KEYSTORE_PASSWORD",
    "ANDROID_KEY_ALIAS",
    "ANDROID_KEY_PASSWORD",
  ])("nennt %s beim Namen, wenn er fehlt, dazu Herkunft und Aufruf", (name) => {
    const { fehler } = pruefeKeystore({ ...VOLLSTAENDIG, [name]: undefined });
    expect(fehler).toContain(name);
    expect(fehler).toContain("Infisical");
    expect(fehler).toContain("pnpm android:keystore");
  });

  it("behandelt eine leere Zeichenkette wie ein Fehlen", () => {
    const { fehler } = pruefeKeystore({ ...VOLLSTAENDIG, ANDROID_KEY_ALIAS: "   " });
    expect(fehler).toContain("ANDROID_KEY_ALIAS");
  });

  it("meldet ein Base64, das gar keinen Keystore enthaelt", () => {
    const fremd = Buffer.from("PK das hier ist ein Zip").toString("base64");
    const { fehler } = pruefeKeystore({ ...VOLLSTAENDIG, ANDROID_KEYSTORE_BASE64: fremd });
    expect(fehler).toContain("kein Android-Keystore");
  });

  // Ohne diese Zeile schreibt ein abgeschnittenes Secret klaglos eine Datei,
  // die Gradle spaeter nicht lesen kann.
  it("meldet ein verstuemmeltes Base64", () => {
    const { fehler } = pruefeKeystore({
      ...VOLLSTAENDIG,
      ANDROID_KEYSTORE_BASE64: "!!!kein-base64",
    });
    expect(fehler).toContain("Base64");
  });

  it("schreibt nichts, solange ein Fehler steht", () => {
    const { keystore, properties } = pruefeKeystore({
      ...VOLLSTAENDIG,
      ANDROID_KEYSTORE_PASSWORD: undefined,
    });
    expect(keystore.length).toBe(0);
    expect(properties).toBe("");
  });

  /**
   * `key.properties` ist eine **Java**-Properties-Datei. Dort ist `\` das
   * Fluchtzeichen: ein Passwort `a\b` laende als `ab` im Speicher, und Gradle
   * meldete dann ein falsches Passwort fuer einen Keystore, der stimmt — der
   * teuerste denkbare Fehlerbericht, weil er auf die falsche Ursache zeigt.
   */
  it("verdoppelt Backslashes in beiden Passwoertern", () => {
    const { properties } = pruefeKeystore({
      ...VOLLSTAENDIG,
      ANDROID_KEYSTORE_PASSWORD: "a\\b",
      ANDROID_KEY_PASSWORD: "c\\d",
    });
    expect(properties).toContain("storePassword=a\\\\b");
    expect(properties).toContain("keyPassword=c\\\\d");
  });

  /**
   * `storeFile` ist relativ zum **App-Modul** — `android/app/build.gradle`
   * loest ihn mit `file(...)` auf. Ein absoluter Pfad landete sonst aus der
   * Erzeugung im Klartext in einer Datei, die auf jedem anderen Rechner und
   * auf dem Runner ins Leere zeigt.
   */
  it("haelt storeFile relativ zum App-Modul", () => {
    const { properties } = pruefeKeystore(VOLLSTAENDIG);
    const zeile = properties.split("\n").find((z) => z.startsWith("storeFile="));
    expect(zeile).toBe("storeFile=upload-keystore.jks");
  });

  /**
   * Aus Infisical kopierte Werte tragen regelmaessig einen Zeilenumbruch oder
   * ein fuehrendes Leerzeichen mit. Java streift fuehrenden Weissraum im WERT
   * still ab — ein Passwort ` geheim` waere also stumm ein anderes als das im
   * Keystore, und der Bericht laesse auf ein falsches Passwort schliessen.
   */
  it("streift Weissraum um die Werte ab", () => {
    const { properties } = pruefeKeystore({
      ...VOLLSTAENDIG,
      ANDROID_KEY_ALIAS: "  upload\n",
    });
    expect(properties).toContain("keyAlias=upload\n");
  });
});
