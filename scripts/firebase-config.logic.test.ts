import { describe, expect, it } from "vitest";

import { pruefeGoogleServices } from "./firebase-config.logic";

/**
 * `android/app/google-services.json` bindet die Android-Schale an ein
 * Firebase-Projekt. Sie liegt nicht im Repo (`.gitignore`, und der
 * `native-secrets-guard` meldet sie), sondern wird aus Infisical erzeugt.
 *
 * Geprueft wird hier genau die eine Zusage, die der Gradle-Lauf NICHT gibt.
 * Ein falscher Paketname bricht dort laut ab („No matching client found for
 * package name") — dafuer braucht es hier nichts. Ein Konfigurationsfile eines
 * FREMDEN Firebase-Projekts mit demselben Paketnamen baut dagegen sauber durch:
 * das Geraet loest ein Token bei einem Projekt ein, dessen Dienstkonto wir
 * nicht halten, FCM antwortet `SenderId mismatch`, und `send-push` stuft das
 * als dauerhaft ein und LOESCHT das Geraetetoken. Der Fehler entstuende beim
 * Bauen und faellt beim Zustellen auf, in einer Tabelle.
 */
const GUELTIG = {
  project_info: { project_number: "837618406403", project_id: "effbeezee-f9b48" },
  client: [
    {
      client_info: {
        mobilesdk_app_id: "1:837618406403:android:abc",
        android_client_info: { package_name: "com.effbeezee.app" },
      },
      api_key: [{ current_key: "AIzaKEIN-ECHTER-SCHLUESSEL" }],
    },
  ],
  configuration_version: "1",
};

describe("pruefeGoogleServices", () => {
  it("meldet, wenn der Wert gar nicht gesetzt ist, und nennt Herkunft und Namen", () => {
    const { fehler } = pruefeGoogleServices(undefined, "effbeezee-f9b48");
    expect(fehler).toContain("GOOGLE_SERVICES_JSON");
    expect(fehler).toContain("Infisical");
  });

  it("behandelt eine leere Zeichenkette wie ein Fehlen", () => {
    expect(pruefeGoogleServices("   ", "effbeezee-f9b48").fehler).toContain("GOOGLE_SERVICES_JSON");
  });

  it("meldet, was kein JSON ist", () => {
    const { fehler } = pruefeGoogleServices("{kein json", "effbeezee-f9b48");
    expect(fehler).toMatch(/JSON/i);
  });

  it("meldet ein FREMDES Firebase-Projekt und nennt beide Kennungen", () => {
    const fremd = {
      ...GUELTIG,
      project_info: { ...GUELTIG.project_info, project_id: "anderes-projekt" },
    };
    const { fehler } = pruefeGoogleServices(JSON.stringify(fremd), "effbeezee-f9b48");
    expect(fehler).toContain("anderes-projekt");
    expect(fehler).toContain("effbeezee-f9b48");
  });

  it("meldet eine Konfiguration ohne `project_id` statt sie durchzulassen", () => {
    const ohne = { client: GUELTIG.client };
    expect(pruefeGoogleServices(JSON.stringify(ohne), "effbeezee-f9b48").fehler).toBeTruthy();
  });

  // ── Positivkontrollen ─────────────────────────────────────────────────────
  // Ohne sie waere ein Pruefer, der IMMER meldet, von einem, der prueft, nicht
  // zu unterscheiden.
  it("laesst die passende Konfiguration durch", () => {
    expect(pruefeGoogleServices(JSON.stringify(GUELTIG), "effbeezee-f9b48").fehler).toBeNull();
  });

  it("gibt sie eingerueckt zurueck und inhaltlich unveraendert", () => {
    const { datei } = pruefeGoogleServices(JSON.stringify(GUELTIG), "effbeezee-f9b48");
    expect(datei).toContain("\n  ");
    expect(JSON.parse(datei)).toEqual(GUELTIG);
  });
});
