/**
 * Erzeugt `android/app/google-services.json` aus Infisical (AGE-642).
 *
 *   infisical run --env=dev -- pnpm android:firebase
 *
 * Die Datei darf nicht im Repo liegen (`.gitignore`, `native-secrets-guard`),
 * muss aber vor jedem Android-Bau auf der Platte stehen — `android/app/build
 * .gradle` bricht sonst ab. Warum das so ist und warum genau eine Sache
 * geprueft wird, steht in `firebase-config.logic.ts`.
 *
 * Die erwartete Projektkennung wird NICHT hier hingeschrieben, sondern aus
 * `FCM_SERVICE_ACCOUNT` gelesen — demselben Dienstkonto, mit dem `send-push`
 * zustellt. Ein Literal an dieser Stelle waere eine zweite Wahrheit, die beim
 * Projektwechsel still zurueckbliebe.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { pruefeGoogleServices } from "./firebase-config.logic";

const ZIEL = "android/app/google-services.json";

function main(): void {
  const dienstkonto = process.env.FCM_SERVICE_ACCOUNT;
  if (dienstkonto === undefined || dienstkonto.trim() === "") {
    throw new Error(
      "FCM_SERVICE_ACCOUNT fehlt (Herkunft: Infisical, Umgebung dev). Ohne es " +
        "ist nicht pruefbar, ob die Konfiguration zum richtigen Firebase-Projekt gehoert.",
    );
  }
  const erwartetesProjekt = JSON.parse(dienstkonto).project_id as string;

  const { fehler, datei } = pruefeGoogleServices(
    process.env.GOOGLE_SERVICES_JSON,
    erwartetesProjekt,
  );
  if (fehler !== null) throw new Error(`firebase-config: ${fehler} Es wurde nichts geschrieben.`);

  mkdirSync(dirname(ZIEL), { recursive: true });
  writeFileSync(ZIEL, datei);
  console.log(`${ZIEL} geschrieben — Firebase-Projekt ${erwartetesProjekt}.`);
}

main();
