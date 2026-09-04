import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { KEYSTORE_DATEI, pruefeKeystore } from "./android-keystore.logic";

/**
 * AGE-642 B3 — die Naht zwischen dem Erzeuger und dem Leser.
 *
 * `scripts/android-keystore.ts` SCHREIBT `android/key.properties`,
 * `android/app/build.gradle` LIEST sie. Beide Seiten stehen in verschiedenen
 * Sprachen in verschiedenen Dateien, und nichts ausser diesem Test haelt ihre
 * vier Schluesselnamen zusammen.
 *
 * Der Fehlermodus ist zwar laut (Gradle bricht mit `storePassword == null` ab),
 * aber er tritt erst im Release-Bau auf — also im Workflow, nach `cap sync`,
 * nach dem Web-Build, Minuten nachdem jemand hier ein Wort umbenannt hat. Der
 * Test verlegt denselben Befund um diese Minuten nach vorn.
 */
const GRADLE = readFileSync("android/app/build.gradle", "utf8");

const PROPERTIES = pruefeKeystore({
  ANDROID_KEYSTORE_BASE64: Buffer.from([0x30, 0x82, 0x01, 0x02]).toString("base64"),
  ANDROID_KEYSTORE_PASSWORD: "geheim",
  ANDROID_KEY_ALIAS: "upload",
  ANDROID_KEY_PASSWORD: "geheim",
}).properties;

describe("key.properties und build.gradle", () => {
  it.each(["storeFile", "storePassword", "keyAlias", "keyPassword"])(
    "%s wird geschrieben UND gelesen",
    (schluessel) => {
      expect(PROPERTIES).toContain(`${schluessel}=`);
      expect(GRADLE).toContain(`keystoreProperties['${schluessel}']`);
    },
  );

  it("nennt dieselbe Keystore-Datei wie die Erzeugung", () => {
    expect(PROPERTIES).toContain(`storeFile=${KEYSTORE_DATEI}`);
  });

  /**
   * Die Zeile, die den stillen Ausgang verhindert. Ohne `key.properties`
   * erzeugt Gradle mit `signingConfig null` klaglos ein **unsigniertes**
   * Release-Artefakt — der Lauf ist gruen, das Bündel unbrauchbar, und es faellt
   * erst beim Hochladen zu Play auf. Der Bau muss stattdessen abbrechen.
   */
  it("bricht den Release-Bau ab, wenn key.properties fehlt", () => {
    expect(GRADLE).toContain("GradleException");
    expect(GRADLE).toContain("pnpm android:keystore");
  });

  /**
   * Und die Gegenrichtung: ein DEBUG-Bau darf den Keystore nie brauchen. Der
   * taegliche Rundlauf am Geraet laeuft ueber `assembleDebug`, und ein Gradle,
   * das dort nach dem Signaturmaterial verlangt, machte jede Messung von einem
   * Secret abhaengig, das mit ihr nichts zu tun hat.
   */
  it("bindet die Pruefung nur an Release-Aufgaben", () => {
    const auswahl = GRADLE.split("\n").find((z) => z.includes("tasks.matching"));
    expect(auswahl).toBeDefined();
    expect(auswahl).toContain("Release");
    expect(auswahl).not.toContain("Debug");
  });
});
