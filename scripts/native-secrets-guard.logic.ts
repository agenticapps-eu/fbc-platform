/**
 * Welche Dateien native Geheimnisse sind (AGE-642 B2).
 *
 * Dieses Repo ist **öffentlich**. Ein einmal gepushtes Signaturgeheimnis ist
 * verbrannt, auch nach `git rm` — die Antwort darauf ist eine Rotation im
 * Apple- bzw. Google-Portal, kein Löschen. Am 23.08. ist genau dieser Fall
 * schon einmal eingetreten, und der erste Suchlauf danach fand die Dateien
 * **nicht**.
 *
 * `.gitignore` und dieser Wächter tun deshalb NICHT dasselbe: `.gitignore`
 * verhindert das versehentliche Hinzufügen, dieser Wächter findet, was trotzdem
 * hineingeraten ist — per `git add -f`, über eine Lücke im Muster, oder weil
 * die Datei älter ist als die Ignorierzeile. Die Listen dürfen sich deshalb
 * überschneiden; die eine ersetzt die andere nicht.
 *
 * Die Liste ist eine **Verbotsliste**, und das ist hier richtig herum: die
 * Menge der Signaturformate ist klein, benannt und ändert sich fast nie,
 * während die Menge der harmlosen Dateien das ganze Repo ist. Bei der
 * Erstlast-Prüfung (`entry-chunk-guard.logic.ts`) liegt es genau umgekehrt.
 */
export type Treffer = { pfad: string; grund: string };

type Regel = { trifft: (pfad: string, name: string) => boolean; grund: string };

const REGELN: Regel[] = [
  {
    // Android-Signierschlüssel. Wer ihn hat, kann ein Update veröffentlichen,
    // das Play als echt annimmt.
    trifft: (_p, name) => name.endsWith(".keystore") || name.endsWith(".jks"),
    grund: "Android-Keystore (Signierschlüssel)",
  },
  {
    // Kein Schlüssel, aber der Zettel daneben: Pfad UND Passwörter im
    // Klartext. Die Endung `.properties` teilt sie mit `gradle.properties`
    // und `local.properties`, deshalb wird auf den vollen Namen geprüft.
    trifft: (_p, name) => name === "key.properties",
    grund: "Gradle-Signierkonfiguration (Keystore-Passwörter im Klartext)",
  },
  {
    // Apple gibt ihn genau EINMAL heraus und er gilt teamweit für jede App.
    trifft: (_p, name) => name.endsWith(".p8"),
    grund: "APNs-Auth-Key (teamweit, nicht erneut herunterladbar)",
  },
  {
    trifft: (_p, name) => name.endsWith(".p12") || name.endsWith(".pfx"),
    grund: "Zertifikat mit privatem Schlüssel",
  },
  {
    // iOS-Signierung. Teilt keine Endung mit den Zeilen darüber und fällt
    // deshalb sonst durch jedes Muster.
    trifft: (_p, name) => name.endsWith(".mobileprovision") || name.endsWith(".provisionprofile"),
    grund: "iOS Provisioning Profile",
  },
  {
    trifft: (_p, name) => name === "google-services.json",
    grund: "Firebase-Konfiguration (Android)",
  },
  {
    trifft: (_p, name) => name === "GoogleService-Info.plist",
    grund: "Firebase-Konfiguration (iOS)",
  },
  {
    // Kommt als `.json` und fällt damit durch jede Endungsprüfung. Google
    // benennt ihn `<projekt>-firebase-adminsdk-<hash>-<hash>.json`; geprüft
    // wird der Mittelteil, damit auch die umbenannte Fassung hängen bleibt.
    trifft: (_p, name) => name.includes("firebase-adminsdk") && name.endsWith(".json"),
    grund: "Firebase-Dienstschlüssel (privater Schlüssel im Klartext)",
  },
];

/**
 * Gibt die Pfade zurück, die ein natives Geheimnis sind. Leere Liste heißt:
 * der übergebene Baum trägt keins.
 *
 * `pfade` sind Dateipfade relativ zur Repo-Wurzel — ein **Baum**, kein Diff.
 * Wer hier den Diff eines Commits übergibt, prüft nur, was dieser Commit
 * anfasst, und übersieht jedes Geheimnis, das schon liegt.
 */
export function nativeGeheimnisseImBaum(pfade: string[]): Treffer[] {
  const treffer: Treffer[] = [];

  for (const pfad of pfade) {
    const name = pfad.split("/").pop() ?? pfad;
    const regel = REGELN.find((r) => r.trifft(pfad, name));
    if (regel) treffer.push({ pfad, grund: regel.grund });
  }

  return treffer.sort((a, b) => a.pfad.localeCompare(b.pfad));
}
