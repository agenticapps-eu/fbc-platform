#!/usr/bin/env tsx
/**
 * Migrations-Drift-Gate (AGE-496 Task 4.2, schliesst AGE-257).
 *
 * Vergleicht die Migrationshistorie des Repos mit der eines Zielprojekts —
 * in BEIDE Richtungen. Die Auswertung steht in `migration-drift.logic.ts` und
 * ist dort geprueft; hier stehen nur Aufruf und Ausgabe.
 *
 *   scripts/migration-drift-gate.ts [<db-url>]
 *   (ohne Argument: $SUPABASE_DB_URL_PROD)
 *
 * DAS GATE SCHWEIGT NICHT BEI NICHTWISSEN. Fehlt die URL, ist die Datenbank
 * nicht erreichbar oder aendert die CLI ihr Ausgabeformat, schlaegt es fehl.
 * Ein Gate, das bei Nichtwissen gruen wird, baut die Juni-Havarie eine Ebene
 * hoeher nach — und das ist am 2026-08-05 beinahe passiert, als die CLI von
 * einer ASCII-Tabelle auf JSON umstellte.
 */
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { findeDrift, leseMigrationsliste } from "./migration-drift.logic";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");

function rot(nachricht: string): never {
  console.error(`::error::${nachricht}`);
  process.exit(1);
}

const dbUrl = process.argv[2] || process.env.SUPABASE_DB_URL_PROD;
if (!dbUrl) {
  rot("Keine Verbindungs-URL. Das Gate kann nicht messen und wird deshalb rot.");
}

const dateien = readdirSync(join(REPO, "supabase", "migrations")).filter((f) => f.endsWith(".sql"));
if (dateien.length === 0) {
  rot("Keine Migrationsdateien in supabase/migrations gefunden. Falsches Verzeichnis?");
}

// Format explizit anfordern statt auf die Vorgabe zu vertrauen: die haengt von
// der CLI-Version ab und hat sich schon einmal unter uns geaendert.
const lauf = spawnSync(
  "supabase",
  ["migration", "list", "--db-url", dbUrl, "--output-format", "json"],
  { encoding: "utf8" },
);

if (lauf.status !== 0) {
  console.error(lauf.stderr ?? "");
  rot("`supabase migration list` ist fehlgeschlagen. Das Gate kann nicht messen.");
}

let drift;
try {
  drift = findeDrift(leseMigrationsliste(lauf.stdout ?? ""), dateien.length);
} catch (e) {
  rot((e as Error).message);
}

if (drift.length > 0) {
  for (const d of drift) {
    const text =
      d.art === "lokal-nur"
        ? `lokal vorhanden, auf dem Ziel fehlend: ${d.version}`
        : d.art === "remote-nur"
          ? `auf dem Ziel vorhanden, lokal fehlend: ${d.version}`
          : `Reihenfolge weicht ab (lokal/remote): ${d.version}`;
    console.error(`::error::DRIFT — ${text}`);
  }
  rot("Migrationshistorie weicht ab. Erst `migrate-prod` freigeben, dann deployen.");
}

console.log(`OK — ${dateien.length} Migrationen, Historie abweichungsfrei.`);
