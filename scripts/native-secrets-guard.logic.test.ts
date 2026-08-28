import { describe, expect, it } from "vitest";

import { nativeGeheimnisseImBaum } from "./native-secrets-guard.logic";

describe("nativeGeheimnisseImBaum", () => {
  it("meldet einen Keystore, der im Baum liegt", () => {
    const pfade = ["android/app/release.keystore", "android/app/build.gradle"];

    expect(nativeGeheimnisseImBaum(pfade)).toEqual([
      { pfad: "android/app/release.keystore", grund: "Android-Keystore (Signierschlüssel)" },
    ]);
  });

  // Positivkontrolle zur Verneinung: ohne sie wäre ein Wächter, der IMMER
  // alles meldet, von einem, der prüft, nicht zu unterscheiden — und ein
  // Wächter, der immer bricht, wird nach dem zweiten Mal abgeschaltet.
  it("meldet nichts, wenn derselbe Baum den Keystore nicht enthält", () => {
    const pfade = ["android/app/build.gradle", "ios/App/App/Info.plist"];

    expect(nativeGeheimnisseImBaum(pfade)).toEqual([]);
  });

  it("meldet die Gradle-Signierkonfiguration, die Passwörter im Klartext trägt", () => {
    expect(nativeGeheimnisseImBaum(["android/key.properties"]).map((t) => t.pfad)).toEqual([
      "android/key.properties",
    ]);
  });

  it("meldet den APNs-Auth-Key, den Apple genau einmal herausgibt", () => {
    expect(nativeGeheimnisseImBaum(["ios/AuthKey_ABC1234567.p8"]).map((t) => t.pfad)).toEqual([
      "ios/AuthKey_ABC1234567.p8",
    ]);
  });

  it("meldet den Firebase-Dienstschlüssel, auch umbenannt", () => {
    const pfade = [
      "android/app/google-services.json",
      "geheim/fbc-firebase-adminsdk-a1b2c-deadbeef.json",
      "ios/App/App/GoogleService-Info.plist",
    ];

    expect(nativeGeheimnisseImBaum(pfade).map((t) => t.pfad)).toEqual([
      "android/app/google-services.json",
      "geheim/fbc-firebase-adminsdk-a1b2c-deadbeef.json",
      "ios/App/App/GoogleService-Info.plist",
    ]);
  });

  it("meldet ein Provisioning Profile — iOS-Signierung, die keine Endung oben teilt", () => {
    expect(
      nativeGeheimnisseImBaum(["ios/certs/effbeezee_dev.mobileprovision"]).map((t) => t.pfad),
    ).toEqual(["ios/certs/effbeezee_dev.mobileprovision"]);
  });

  // Der Unterschied zwischen einem Wächter und einem Muster-Abgleich: ein
  // Treffer muss sagen, WAS gefunden wurde, sonst muss der Leser raten, ob er
  // rotieren oder nur löschen muss.
  it("nennt zu jedem Treffer einen Grund", () => {
    const treffer = nativeGeheimnisseImBaum(["a.jks", "b.p8"]);

    expect(treffer).toHaveLength(2);
    for (const t of treffer) expect(t.grund.length).toBeGreaterThan(0);
  });

  it("verwechselt harmlose Nachbarn nicht mit Geheimnissen", () => {
    const pfade = [
      // `.properties` allein ist kein Geheimnis — `gradle.properties` und
      // `local.properties` stehen in jedem Android-Projekt.
      "android/gradle.properties",
      "android/local.properties",
      // `.plist` allein auch nicht.
      "ios/App/App/Info.plist",
      "ios/debug.xcconfig",
      // Eine `.json`, die nur zufällig „services" heisst.
      "src/config/services.json",
      // Ein Dokument ÜBER Keystores ist kein Keystore.
      "docs/keystore-anleitung.md",
    ];

    expect(nativeGeheimnisseImBaum(pfade)).toEqual([]);
  });

  it("liefert die Treffer stabil sortiert, damit die Ausgabe vergleichbar bleibt", () => {
    const pfade = ["z/last.p8", "a/first.jks", "m/middle.keystore"];

    expect(nativeGeheimnisseImBaum(pfade).map((t) => t.pfad)).toEqual([
      "a/first.jks",
      "m/middle.keystore",
      "z/last.p8",
    ]);
  });
});
