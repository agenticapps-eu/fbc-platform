import type { CapacitorConfig } from "@capacitor/cli";

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
    },
  },
};

export default config;
