#!/usr/bin/env tsx
/**
 * Stufe 1 fuer CI (AGE-496): belegt, dass `SUPABASE_DB_URL_PROD` auf das
 * Projekt aus `scripts/prod-project-ref.txt` zeigt — und sonst nichts.
 *
 * Bewusst dieselbe Funktion wie `pnpm db:push:prod`, nicht eine zweite Regex
 * im YAML. Ein erster Entwurf suchte dort `db.<ref>.supabase.co` und haette
 * jeden Lauf abgebrochen, sobald die Verbindung ueber den Session-Pooler
 * laeuft — was sie muss, weil GitHub-Runner kein IPv6 sprechen.
 *
 * Gibt Ref und aufgeloesten Host aus, nie die URL: sie traegt das Passwort.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { evaluateStage1 } from "./db-push-prod.logic";

const HIER = dirname(fileURLToPath(import.meta.url));
const expectedRef = readFileSync(join(HIER, "prod-project-ref.txt"), "utf8").trim();
const dbUrl = process.env.SUPABASE_DB_URL_PROD;

const ergebnis = evaluateStage1({ dbUrl, expectedRef, args: [] });
if (ergebnis.kind === "abort") {
  console.error(`::error::${ergebnis.reason}`);
  process.exit(1);
}

let host = "<nicht ableitbar>";
try {
  const p = new URL(dbUrl as string);
  host = `${p.hostname}:${p.port || "5432"}`;
} catch {
  /* Der Ref ist bereits belegt; nur die Anzeige bleibt unscharf. */
}

console.log(`Sollwert (scripts/prod-project-ref.txt): ${expectedRef}`);
console.log(`Ziel aus SUPABASE_DB_URL_PROD:           ${ergebnis.ref}`);
console.log(`Host:                                    ${host}`);
