#!/usr/bin/env tsx
/**
 * Duenner Aufruf um `changed-functions.logic.ts` (AGE-506).
 *
 * Liest geaenderte Pfade von stdin (eine je Zeile, so wie `git diff --name-only`
 * sie liefert) und schreibt die betroffenen Function-Namen nach stdout — eine je
 * Zeile, damit die Shell sie ohne Parser lesen kann.
 *
 * Hier steht mit Absicht KEINE Logik. Alles Entscheidende liegt in
 * `changed-functions.logic.ts` und hat dort einen Test daneben; diese Datei ist
 * nur die Klammer um stdin und stdout.
 */
import { abgeleiteteFunctions } from "./changed-functions.logic";

const eingabe = await new Promise<string>((auf) => {
  let roh = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (stueck) => (roh += stueck));
  process.stdin.on("end", () => auf(roh));
});

const pfade = eingabe
  .split("\n")
  .map((z) => z.trim())
  .filter(Boolean);

const { functions, verworfen, configBeruehrt } = abgeleiteteFunctions(pfade);

// Nicht still fallenlassen: eine Function, die niemand deployt und niemand
// erwaehnt, ist genau der Zustand, den AGE-506 abstellt.
if (verworfen.length) {
  process.stderr.write(
    `::error::Verzeichnisse unter supabase/functions/, die kein gueltiger ` +
      `Function-Name sind und deshalb NICHT ausgeliefert wurden: ${verworfen.join(", ")}\n`,
  );
}

// Als GitHub-Annotation nach stderr: `verify_jwt` steht in config.toml, nicht im
// Function-Code. Aendert sich nur dieser Block, sieht die Ableitung nichts — und
// der Lauf saehe vollstaendig aus, ohne es zu sein.
if (configBeruehrt) {
  process.stderr.write(
    "::warning::supabase/config.toml lag im Merge. Aenderungen an einem " +
      "[functions.X]-Block (z. B. verify_jwt) werden von der Dateiableitung NICHT " +
      "erfasst und muessen von Hand nachgezogen werden.\n",
  );
}

process.stdout.write(functions.join("\n"));
if (functions.length) process.stdout.write("\n");
