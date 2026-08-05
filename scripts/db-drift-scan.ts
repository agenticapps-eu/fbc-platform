#!/usr/bin/env tsx
/**
 * Objekt-Drift-Scan (AGE-496 Task 12.2).
 *
 *   scripts/db-drift-scan.ts [<db-url>]
 *   (ohne Argument: $SUPABASE_DB_URL_PROD)
 *
 * Laeuft bei jedem `migrate-prod` mit — nicht nur beim Aufsetzen. Der Grund
 * steht in `db-drift-scan.logic.ts`: wird der Webhook-Trigger geloescht,
 * stirbt der Mailversand still.
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";

import { findeObjektDrift, type Bestand } from "./db-drift-scan.logic";

/**
 * Objekte, die bewusst in keiner Migration stehen und trotzdem da sein
 * MUESSEN. Der Bearer-Token des Webhooks liegt inline in der Funktion, und
 * dieses Repo ist oeffentlich — deshalb steht das Paar nicht in `migrations/`.
 * Vorlage zum Wiederherstellen: `docs/secrets.md`.
 */
const ERWARTET_OHNE_MIGRATION = [
  "notify_contact_request_webhook",
  "contact_requests_email_webhook",
];

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");

function rot(nachricht: string): never {
  console.error(`::error::${nachricht}`);
  process.exit(1);
}

const dbUrl = process.argv[2] || process.env.SUPABASE_DB_URL_PROD;
if (!dbUrl) rot("Keine Verbindungs-URL. Der Scan kann nicht messen und wird deshalb rot.");

const migrationsDir = join(REPO, "supabase", "migrations");
const migrationsText = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .map((f) => readFileSync(join(migrationsDir, f), "utf8"))
  .join("\n")
  .toLowerCase();

/**
 * Sicher per Vorgabe, Ausnahmen ausdruecklich — dieselbe Regel wie im
 * Demo-Seed (`supabase/seed/demo_seed.ts`), nur mit eigenen Variablennamen.
 * Nie stillschweigend abschalten.
 */
function ssl(url: string): pg.ClientConfig["ssl"] {
  if (url.includes("localhost") || url.includes("127.0.0.1")) return false;
  const ca = process.env.DB_SCAN_CA_CERT;
  if (ca) return { ca: readFileSync(ca, "utf8"), rejectUnauthorized: true };
  if (process.env.DB_SCAN_TLS_INSECURE === "1") {
    console.warn(
      "⚠️  TLS-Pruefung abgeschaltet (DB_SCAN_TLS_INSECURE=1): die Verbindung ist " +
        "verschluesselt, der Server aber NICHT authentifiziert. Nur im vertrauten Netz.",
    );
    return { rejectUnauthorized: false };
  }
  return { rejectUnauthorized: true };
}

const client = new pg.Client({ connectionString: dbUrl, ssl: ssl(dbUrl) });
await client.connect();

// Nacheinander, nicht parallel: ein pg.Client fuehrt genau eine Abfrage
// gleichzeitig aus.
const funktionen = await client.query<{ name: string }>(
  `select p.proname as name from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' order by 1`,
);
const trigger = await client.query<{ name: string }>(
  `select t.tgname as name from pg_trigger t
     join pg_class c on c.oid = t.tgrelid
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and not t.tgisinternal order by 1`,
);
const tabellen = await client.query<{ name: string }>(
  `select c.relname as name from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') order by 1`,
);
// Views und Materialized Views: eine von Hand angelegte View auf `profiles`
// umgeht deren Zeilensichtbarkeit. Die erste Fassung fragte nur relkind='r' ab.
const views = await client.query<{ name: string }>(
  `select c.relname as name from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('v', 'm') order by 1`,
);
// RLS ist laut CLAUDE.md die Sicherheitsgrenze des Projekts. Eine von Hand
// hinzugefuegte Policy war fuer den Scan bisher unsichtbar.
// (Eine ENTFERNTE Policy findet er weiterhin nicht — siehe Grenze 4 im Kopf
// von db-drift-scan.logic.ts.)
const policies = await client.query<{ name: string }>(
  `select policyname as name from pg_policies where schemaname = 'public' order by 1`,
);
await client.end();

const bestand: Bestand = {
  funktionen: funktionen.rows.map((r) => r.name),
  trigger: trigger.rows.map((r) => r.name),
  tabellen: tabellen.rows.map((r) => r.name),
  views: views.rows.map((r) => r.name),
  policies: policies.rows.map((r) => r.name),
};

// Ein Name gilt als "in einer Migration", wenn er dort woertlich vorkommt.
// Bewusst grob: der Scan soll Vergessenes finden, nicht SQL parsen.
const alleNamen = [
  ...bestand.funktionen,
  ...bestand.trigger,
  ...bestand.tabellen,
  ...bestand.views,
  ...bestand.policies,
];
const inMigrationen = alleNamen.filter((n) =>
  new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(migrationsText),
);

let drift;
try {
  drift = findeObjektDrift(bestand, inMigrationen, ERWARTET_OHNE_MIGRATION);
} catch (e) {
  rot((e as Error).message);
}

console.log(
  `Bestand: ${bestand.funktionen.length} Funktionen, ${bestand.trigger.length} Trigger, ` +
    `${bestand.tabellen.length} Tabellen, ${bestand.views.length} Views, ` +
    `${bestand.policies.length} Policies.`,
);

if (drift.length > 0) {
  for (const d of drift) {
    console.error(
      d.art === "unbekannt"
        ? `::error::DRIFT — ${d.typ} "${d.name}" steht in keiner Migration. War jemand am Dashboard?`
        : `::error::DRIFT — "${d.name}" FEHLT. Es steht bewusst in keiner Migration und muss von Hand ` +
            "wiederhergestellt werden (Vorlage: docs/secrets.md). Ohne es stirbt der Mailversand still.",
    );
  }
  rot(`${drift.length} Objekt-Abweichung(en).`);
}

console.log("OK — keine Objekt-Abweichung.");
