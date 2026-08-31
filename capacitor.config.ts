import type { CapacitorConfig } from "@capacitor/cli";

// ══ DIE ENDPUNKTE DES LUFTWEGS (AGE-642, Phase D3) ═════════════════════════
// Der Projekt-Host steht NICHT als Zeichenkette in dieser Datei. Das Repo ist
// oeffentlich und schreibt die Projektkennung nirgends aus — `docs/secrets.md`
// fuehrt sie durchgehend als `<project-ref>`. Er kommt aus derselben Quelle wie
// in `scripts/ota-buendel.ts`, das denselben Bucket beschreibt.
//
// **Und er wird verlangt, nicht ersetzt.** Eine Vorgabe waere hier die
// gefaehrlichste Zeile der Datei: bleibt `updateUrl` leer, schaltet das Plugin
// den Luftweg nicht ab, sondern faellt auf `https://plugin.capgo.app/updates`
// zurueck (`CapacitorUpdaterPlugin.java:98-100`, `.swift:101-103`) — mitsamt
// `device_id` und `app_id` jedes Geraets, an einen Dritten, aus einer
// Abwesenheit heraus, die in keinem Diff steht. Also lieber ein lautes `cap
// sync`, das abbricht.
function endpunkt(name: string): string {
  const basis = process.env.VITE_SUPABASE_URL;
  if (basis === undefined || basis.trim() === "") {
    throw new Error(
      "VITE_SUPABASE_URL fehlt (Herkunft: Infisical, Umgebung prod). Ohne sie " +
        "zeigten updateUrl, channelUrl und statsUrl auf plugin.capgo.app.",
    );
  }
  return `${basis.replace(/\/$/, "")}/functions/v1/${name}`;
}

// Der oeffentliche Teil des OTA-Schluesselpaars. Er GEHOERT ins oeffentliche
// Repo: er steckt ohnehin in jeder ausgelieferten App, und was er leistet, ist
// Echtheit, nicht Vertraulichkeit (Entwurf §8). Der private Teil liegt in
// Infisical `prod` als `CAPGO_PRIVATE_KEY` und nirgends sonst.
//
// Zwei Messungen am 31.08. an @capgo/capacitor-updater@8.51.15, beide gegen
// einen STILLEN Fehlschlag:
//
// 1. **PKCS#1, und die Kopfzeile wird woertlich geprueft.** `decryptFile` bricht
//    ohne Ausnahme ab, wenn der Schluessel nicht mit `-----BEGIN RSA PUBLIC
//    KEY-----` beginnt (`CryptoCipher.java:145`) — es folgt ein `return`, kein
//    `throw`. Das Buendel bliebe Chiffrat, das Entpacken scheiterte, und der
//    Grund stuende in keinem Log auf unserer Seite. Ein Schluessel im
//    verbreiteteren X.509-Format (`BEGIN PUBLIC KEY`) faellt genau so.
// 2. **2048 Bit.** Gemessen: Modulus 2048, und das Gegenstueck dazu ist die
//    512-Zeichen-Bedingung an `ota_buendel.checksum`.
//
// Bewacht von `scripts/capacitor-config.test.ts`.
const OTA_PUBLIC_KEY = [
  "-----BEGIN RSA PUBLIC KEY-----",
  "MIIBCgKCAQEA0tyQBOT7Ifomznj2wsSpy8H9q1/IItWB3Qm6RgfzlD8IP+fYPQJw",
  "9nOrNyOVbVtYGMVsqk462mWzUi3/N6DRVP+lYIbGBuaFldzVyH9KiJ6kncXVYShE",
  "8uSRCSYa3qsdNSG8/aHr/gl6ORreA6UzgLcDuoR7SL7v3e6aUlQ2WBXTTj6ktGWg",
  "c9IwaEsLOplXVb+fA2522psdnj7Wf2hmNS5RQMfI95BeVvfNQh0AlX1tb1aS6QuL",
  "PQ1WFfQFjrDo/BVTX3t/mrmv9gulUiadaMGTwpd19zzeRJCVe6wpX82iIe5g4Mba",
  "PmUg7UhOnlcY4m8lb+SDxc1AAgn0KE7k3QIDAQAB",
  "-----END RSA PUBLIC KEY-----",
].join("\n");

// Die App-ID ist hier keine freie Wahl mehr. Sie liegt bereits als
// `APNS_BUNDLE_ID` in den Supabase-Secrets — am 28.08. per SHA-256 gegen
// Infisical abgeglichen (`docs/secrets.md`) — und ist damit das `apns-topic`,
// gegen das Apple jedes Gerätetoken prüft. Ein abweichender Wert an dieser
// Stelle bräche den Push aus AGE-641, und zwar erst am echten Gerät.
//
// `webDir` ist Vites Standard-Ausgabe; `vite.config.ts` setzt kein `outDir`.
const config: CapacitorConfig = {
  appId: "com.effbeezee.app",
  appName: "eff.bee.zee",
  webDir: "dist",
  plugins: {
    CapacitorUpdater: {
      // ══ DIE VERTRAGSNUMMER DER NATIVEN SCHALE ═══════════════════════════
      // NICHT die Version der Anwendung. Sie beantwortet eine einzige Frage:
      // welche nativen Fähigkeiten darf ein per Luftweg geliefertes Bündel
      // voraussetzen?
      //
      // **Die Regel:** diese Zahl steigt in JEDEM Pull Request, der ein
      // Capacitor-Plugin hinzufügt, entfernt oder seine native Fassung hebt.
      // Ein solcher PR geht über den Store. Wer sie vergisst, liefert per OTA
      // JavaScript aus, das eine Fähigkeit aufruft, die auf dem Gerät nicht
      // existiert — und zwar erst beim Aufruf, nicht beim Start.
      //
      // **Warum hier:** `capacitor.config.json` landet in
      // `android/app/src/main/assets/` und `ios/App/App/` — NEBEN `public/`,
      // nicht darin. OTA tauscht `public/`. Diese Zahl ist damit unabweisbar
      // Sache der Schale und nur über einen Store-Build änderbar.
      //
      // **Warum semver-förmig und nicht `1`:** derselbe Wert wird auf dem
      // Gerät als Semver geparst (`CapacitorUpdaterPlugin.java:730`,
      // `.swift:262`). Eine blanke Zahl liesse `currentVersionNative` auf iOS
      // still auf `0.0.0` stehen. Also 1.0.0 -> 2.0.0.
      //
      // Gelesen wird sie heute schon: von `scripts/ota-buendel.ts`, das jedes
      // Bündel damit stempelt. Sie ist also keine tote Konfiguration, auch
      // wenn das Plugin selbst erst mit D3 dazukommt.
      version: "1.0.0",

      // Die drei Endpunkte. Alle drei, auch die zwei, die wir nicht brauchen —
      // siehe `endpunkt()` oben: eine Auslassung ist keine Abschaltung.
      updateUrl: endpunkt("ota-update"),
      channelUrl: endpunkt("ota-channel"),
      statsUrl: endpunkt("ota-stats"),

      // Setzt `publicKey`, MUSS die Antwort eine `checksum` tragen, sonst wird
      // die Installation mit `checksum_required` abgelehnt (Entwurf §8). Die
      // Manifest-Tabelle erzwingt sie als `not null` — die beiden Zeilen
      // gehoeren zusammen.
      publicKey: OTA_PUBLIC_KEY,

      // ══ DER RÜCKWEG BRAUCHT EIN GEDÄCHTNIS (AGE-642, Phase D4) ══════════
      // Die Vorgabe ist `true`, und sie macht aus dem Rueckfall eine
      // ENDLOSSCHLEIFE. Am 31.08. an 8.51.15 auf beiden Plattformen gemessen:
      //
      // 1. `checkRevert()` setzt das kaputte Buendel auf ERROR und rollt
      //    zurueck (`.swift:3353` ff., `.java:5141` ff.).
      // 2. Danach nimmt `autoDeleteFailed` dieses ERROR wieder zurueck, in
      //    zwei Schritten: erst synchron auf DELETING (`.swift:3382`,
      //    `.java:5171`), dann beim Loeschen mit `removeInfo: false` auf
      //    DELETED (`CapgoUpdater.swift:2325`, `CapgoUpdater.java:1632`).
      //    Nach beiden Schritten ist der Status alles, nur nicht ERROR.
      // 3. Beim naechsten Start fragt das Plugin den Endpunkt und findet die
      //    Fassung im Verzeichnis wieder. Beide Plattformen kennen zwei
      //    Zweige — nur in verschiedener Reihenfolge: `isErrorStatus()` wuerde
      //    ABBRECHEN (`.swift:4391`, `.java:4915`), der DELETED-Zweig wirft
      //    die Registrierung weg und LAEDT DASSELBE BUENDEL ERNEUT
      //    (`.swift:4364-4379`, `.java:4999`). Der Status ist DELETED, also
      //    greift auf beiden der zweite.
      //
      // Das laeuft bei jedem Start weiter, unbegrenzt: installieren,
      // scheitern, zurueckrollen, neu laden. Der Abbruch-Zweig aus (3) ist
      // mit der Vorgabe toter Code — er greift nur, wenn das Buendel mit
      // seinem ERROR liegen bleiben darf.
      //
      // **Und der Endpunkt aus D3 kann das nicht auffangen.**
      // `ota_buendel_neuestes` liefert, was STRENG spaeter eingetragen wurde
      // als das, was laeuft. Nach dem Rueckfall laeuft wieder die aeltere
      // Fassung — das kaputte Buendel ist damit weiterhin „spaeter" und wird
      // wieder angeboten. Die Schleife ist nur auf dem Geraet zu brechen.
      //
      // Der Preis: je gescheiterter Fassung bleiben Ordner und Registrierung
      // liegen, und das Plugin raeumt sie NIE ab — `autoDeletePrevious` trifft
      // nur das vorige erfolgreiche Buendel (`CapgoUpdater.swift:2748` ff.),
      // eine Obergrenze fuer ERROR-Buendel gibt es nicht. Begrenzt ist das
      // also allein durch die Zahl kaputter Veroeffentlichungen. Der Gegenwert
      // ist, dass „faellt auf die vorige Fassung zurueck" auch beim ZWEITEN
      // Start noch gilt. Bewacht von `scripts/capacitor-config.test.ts`.
      //
      // **Was das Gedaechtnis umgeht:** der manuelle `CapacitorUpdater
      // .download()` loescht ein ERROR-Buendel ausdruecklich vor dem neuen
      // Versuch (`CapgoUpdater.java:1433` und `:1488`). Heute ruft ihn niemand — `src/`
      // kennt nur `notifyAppReady()` in `src/lib/ota.ts`. Wer ihn einbaut,
      // hebt diese Zusage auf.
      autoDeleteFailed: false,
    },
  },
};

export default config;
