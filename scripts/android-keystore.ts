/**
 * Erzeugt `android/key.properties` und `android/app/upload-keystore.jks` aus
 * Infisical (AGE-642 B3).
 *
 *   infisical run --env=prod -- pnpm android:keystore
 *
 * Beide Dateien duerfen nicht im Repo liegen (`.gitignore`,
 * `native-secrets-guard`), muessen aber vor jedem RELEASE-Bau auf der Platte
 * stehen — `android/app/build.gradle` bricht sonst ab. Ein Debug-Bau braucht
 * sie nicht; der taegliche Rundlauf am Geraet laeuft also ohne dieses Skript.
 *
 * Warum die Regeln nebenan stehen: `android-keystore.logic.ts`.
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { KEYSTORE_DATEI, pruefeKeystore } from "./android-keystore.logic";

const PROPERTIES_ZIEL = "android/key.properties";
const KEYSTORE_ZIEL = `android/app/${KEYSTORE_DATEI}`;

function main(): void {
  const { fehler, properties, keystore } = pruefeKeystore(process.env);
  if (fehler !== null) throw new Error(`android-keystore: ${fehler} Es wurde nichts geschrieben.`);

  mkdirSync(dirname(KEYSTORE_ZIEL), { recursive: true });

  // ERST loeschen, DANN mit `mode` neu anlegen. `mode` in `writeFileSync` wirkt
  // nur beim ANLEGEN — auf eine bestehende Datei ist es wirkungslos, und eine
  // aus einem frueheren Lauf mit weiteren Rechten behielte sie stillschweigend.
  // Ein `chmod` danach waere die andere Loesung und liesse ein Zeitfenster, in
  // dem die Passwoerter weltlesbar dastehen.
  for (const [ziel, inhalt] of [
    [KEYSTORE_ZIEL, keystore],
    [PROPERTIES_ZIEL, properties],
  ] as const) {
    rmSync(ziel, { force: true });
    writeFileSync(ziel, inhalt, { mode: 0o600 });
  }

  // Der Alias steht bewusst NICHT in der Ausgabe. Ein Runner-Log ist fuer
  // jeden lesbar, der das Repo lesen kann.
  console.log(`${PROPERTIES_ZIEL} und ${KEYSTORE_ZIEL} geschrieben (${keystore.length} Bytes).`);
}

main();
