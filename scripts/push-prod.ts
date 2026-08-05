#!/usr/bin/env tsx
/**
 * Geführter Schreibzugriff auf das PROD-Supabase-Projekt (AGE-496, Task 3).
 *
 *   pnpm db:push:prod       Migrationen anwenden
 *   pnpm config:push:prod   supabase/config.toml anwenden
 *
 * Beide Wege bestimmen ihr Ziel **explizit** (`--db-url` bzw. `--project-ref`).
 * `supabase link` wird nie aufgerufen: der Link ist ein unsichtbarer Zustand
 * auf der Platte, und genau daran hing der alte `db:push` — ein `--env=prod`
 * allein hätte weiter auf das DEV-Projekt geschrieben.
 *
 * Die Prüfung ist zweistufig; die Logik dahinter steht in
 * `db-push-prod.logic.ts` und ist dort getestet.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { evaluateStage1, evaluateStage2 } from "./db-push-prod.logic";

const HERE = dirname(fileURLToPath(import.meta.url));
const REF_FILE = join(HERE, "prod-project-ref.txt");

function die(reason: string): never {
  console.error(`\n✖ Abbruch: ${reason}\n`);
  process.exit(1);
}

const target = process.argv[2];
if (target !== "db" && target !== "config") {
  die(`Unbekanntes Ziel "${target ?? ""}". Erwartet: db | config`);
}
const args = process.argv.slice(3);

// ── Stufe 1 — maschinell, ohne Menschen ────────────────────────────────────
// Läuft, bevor irgendetwas angezeigt wird. Wer hier scheitert, sieht keinen
// Host und wird nichts bestätigen.

const expectedRef = readFileSync(REF_FILE, "utf8").trim();
const dbUrl = process.env.SUPABASE_DB_URL_PROD;

const stage1 = evaluateStage1({ dbUrl, expectedRef, args });
if (stage1.kind === "abort") die(stage1.reason);

const ref = stage1.ref;
// Stufe 1 bricht bei fehlender URL ab — ab hier liegt sie vor.
const url = dbUrl as string;

// ── Stufe 2 — durch den Menschen ───────────────────────────────────────────

// Den TATSAECHLICH aufgeloesten Host zeigen, nicht den aus dem Ref
// zusammengesetzten. Ein fester `db.<ref>.supabase.co` waere eine Behauptung:
// die Verbindung laeuft ueber den Session-Pooler, dessen Host pro Projekt
// verschieden ist (das neue liegt auf aws-0, das alte auf aws-1). Wer eine
// falsche Zeile bestaetigt, hat nichts bestaetigt.
let ziel = "<Host nicht ableitbar>";
try {
  const p = new URL(url);
  ziel = `${p.hostname}:${p.port || "5432"}`;
} catch {
  /* Stufe 1 hat den Ref bereits belegt; die Anzeige bleibt unscharf. */
}

console.log(`\nZiel: Supabase-Projekt ${ref}`);
console.log(`Host: ${ziel}`);
console.log(`Aktion: ${target === "db" ? "supabase db push" : "supabase config push"}\n`);

if (target === "db") {
  console.log("Was angewendet würde (--dry-run):\n");
  const dry = spawnSync("supabase", ["db", "push", "--db-url", url, "--dry-run"], {
    stdio: "inherit",
  });
  if (dry.status !== 0) die("Der Dry-Run ist fehlgeschlagen. Es wurde nichts angewendet.");
}

if (!process.stdin.isTTY) {
  die("Kein Terminal — die Bestätigung kann nicht eingeholt werden. Nichts angewendet.");
}

const rl = createInterface({ input: process.stdin, output: process.stdout });
const typed = await rl.question(
  `\nZum Anwenden den Projekt-Ref eintippen (${ref.length} Zeichen): `,
);
rl.close();

const stage2 = evaluateStage2({ ref, typed });
if (stage2.kind === "abort") die(stage2.reason);

// ── Anwenden ───────────────────────────────────────────────────────────────

const cmd =
  target === "db" ? ["db", "push", "--db-url", url] : ["config", "push", "--project-ref", ref];

// Die Verbindungs-URL traegt das DB-Passwort — sie wird nie ausgegeben.
console.log(`\n→ supabase ${cmd.join(" ").replaceAll(url, "***")}`);
const run = spawnSync("supabase", cmd, { stdio: "inherit" });
process.exit(run.status ?? 1);
