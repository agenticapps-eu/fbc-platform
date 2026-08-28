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
};

export default config;
