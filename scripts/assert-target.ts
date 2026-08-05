#!/usr/bin/env tsx
/**
 * Stufe 1 fuer CI (AGE-496): belegt, dass die Verbindungs-URL einer Umgebung auf
 * genau das Projekt zeigt, das dieser Umgebung zugeordnet ist — und auf kein
 * anderes.
 *
 *   pnpm tsx scripts/assert-target.ts dev    # SUPABASE_DB_URL_DEV  vs. dev-project-ref.txt
 *   pnpm tsx scripts/assert-target.ts prod   # SUPABASE_DB_URL_PROD vs. prod-project-ref.txt
 *
 * Bewusst dieselbe geprüfte Funktion wie `pnpm db:push:prod`, nicht eine zweite
 * Regex im YAML. Ein erster Entwurf suchte dort `db.<ref>.supabase.co` und haette
 * jeden Lauf abgebrochen, sobald die Verbindung ueber den Session-Pooler laeuft —
 * was sie muss, weil GitHub-Runner kein IPv6 sprechen.
 *
 * WARUM AUCH FUER DEV. `migrate-dev` schreibt unbeaufsichtigt bei jedem Merge.
 * Stuende in `SUPABASE_DB_URL_DEV` versehentlich die PROD-URL, liefen Migrationen
 * ohne Bestaetigung auf die Produktivdatenbank — und `drift-gate` waere danach
 * gruen, weil PROD dann ja zum Repo passt. Ein unabhaengiges Review hat diese
 * Luecke am 2026-08-05 gefunden.
 *
 * Gibt Ref und aufgeloesten Host aus, nie die URL: sie traegt das Passwort.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { evaluateStage1 } from "./db-push-prod.logic";

const HIER = dirname(fileURLToPath(import.meta.url));

const umgebung = process.argv[2];
if (umgebung !== "dev" && umgebung !== "prod") {
  console.error(`::error::Unbekannte Umgebung "${umgebung ?? ""}". Erwartet: dev | prod`);
  process.exit(1);
}

const refDatei = join(HIER, `${umgebung}-project-ref.txt`);
const urlName = umgebung === "dev" ? "SUPABASE_DB_URL_DEV" : "SUPABASE_DB_URL_PROD";

const expectedRef = readFileSync(refDatei, "utf8").trim();
const dbUrl = process.env[urlName];

const ergebnis = evaluateStage1({ dbUrl, expectedRef, args: [] });
if (ergebnis.kind === "abort") {
  console.error(`::error::${urlName}: ${ergebnis.reason}`);
  process.exit(1);
}

let host = "<nicht ableitbar>";
try {
  const p = new URL(dbUrl as string);
  host = `${p.hostname}:${p.port || "5432"}`;
} catch {
  /* Der Ref ist bereits belegt; nur die Anzeige bleibt unscharf. */
}

console.log(`Umgebung:                                ${umgebung}`);
console.log(`Sollwert (scripts/${umgebung}-project-ref.txt): ${expectedRef}`);
console.log(`Ziel aus ${urlName}:${" ".repeat(Math.max(1, 24 - urlName.length))}${ergebnis.ref}`);
console.log(`Host:                                    ${host}`);
