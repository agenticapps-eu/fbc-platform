#!/usr/bin/env tsx
/**
 * Objekt-Drift-Scan (AGE-496 Task 12.2, erweitert in AGE-679).
 *
 *   scripts/db-drift-scan.ts <dev|prod>
 *
 * Laeuft bei jedem `migrate-prod` mit und seit AGE-679 zusaetzlich stuendlich
 * gegen BEIDE Seiten. Der Grund steht in `db-drift-scan.logic.ts`: wird der
 * Webhook-Trigger geloescht, stirbt der Mailversand still.
 *
 * **Die Seite ist eine Pflichtangabe, und das ist eine Korrektur.** Bis zum
 * 01.09. las diese Datei `process.argv[2] || process.env.SUPABASE_DB_URL_PROD`
 * — ohne Argument mass sie also immer PROD. Ein Waechter mit einem Job je
 * Seite, der das Argument vergisst, pruefte damit PROD zweimal und DEV nie,
 * und beide Laeufe waeren gruen. Gefunden hat das die Plan-Review zu AGE-679.
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";

import { evaluateStage1 } from "./db-push-prod.logic";
import {
  ERWARTET_OHNE_MIGRATION,
  ERWARTETE_ZEITPLAENE,
  findeObjektDrift,
  findeZeitplanDrift,
  type Bestand,
  type ObjektDrift,
  type Zeitplan,
} from "./db-drift-scan.logic";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");

function rot(nachricht: string): never {
  console.error(`::error::${nachricht}`);
  process.exit(1);
}

const seite = process.argv[2];
if (seite !== "dev" && seite !== "prod") {
  rot("Aufruf: pnpm tsx scripts/db-drift-scan.ts <dev|prod> — die Seite ist Pflicht.");
}

const dbUrl = seite === "prod" ? process.env.SUPABASE_DB_URL_PROD : process.env.SUPABASE_DB_URL_DEV;

// Zielkontrolle am Projekt-Ref IN der URL: hinter dem Pooler heisst
// `current_user` auf beiden Seiten `postgres`, und der Host ist regionsweit
// gleich. Dieselbe geprüfte Funktion wie in `assert-target.ts`.
const ziel = evaluateStage1({
  dbUrl,
  expectedRef: readFileSync(join(REPO, "scripts", `${seite}-project-ref.txt`), "utf8").trim(),
  args: [],
});
if (ziel.kind === "abort") rot(`SUPABASE_DB_URL_${seite.toUpperCase()}: ${ziel.reason}`);
// `evaluateStage1` bricht bereits bei fehlender URL ab; die Zeile ist fuer den
// Typpruefer, der das nicht sieht.
if (!dbUrl) rot("Keine Verbindungs-URL. Der Scan kann nicht messen und wird deshalb rot.");
console.log(`Ziel: ${seite} = ${ziel.ref}`);

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
// AGE-679, erstes Loch: das Schema `cron` wurde gar nicht abgefragt. Eine
// abbestellte Zeitplanung fiel damit nicht auf.
const zeitplaene = await client.query<Zeitplan>(
  `select jobname, schedule, active, command from cron.job order by jobname`,
);
// AGE-679, zweites Loch: ein per `alter table … disable trigger` abgeschalteter
// Trigger steht weiter in `pg_trigger`. Fuer die Namenspruefung oben ist er
// vorhanden — sein Versand ist trotzdem tot.
//
// `tgenabled` kennt VIER Werte, und die erste Fassung hat sie in zwei Lager
// geteilt (`<> 'O'`), was einen davon falsch einsortierte — gefunden in der
// Diff-Review:
//
//   O  origin   — feuert im Normalbetrieb                       → aktiv
//   A  always   — feuert auch als Replikat                      → aktiv, MEHR als O
//   D  disabled — feuert nie                                    → tot
//   R  replica  — feuert NUR als Replikat, hier also nie        → tot
//
// Gemeldet werden deshalb nur `D` und `R`. Das ist hier keine Feinheit: dieses
// Projekt legt Trigger zum Stilllegen bewusst auf `session_replication_role`
// um, `A` ist also ein Wert, der vorkommt.
const abgeschaltet = await client.query<{ name: string }>(
  `select t.tgname as name from pg_trigger t
     join pg_class c on c.oid = t.tgrelid
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and not t.tgisinternal and t.tgenabled in ('D', 'R')
    order by 1`,
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

let drift: ObjektDrift[];
try {
  drift = [
    ...findeObjektDrift(bestand, inMigrationen, ERWARTET_OHNE_MIGRATION),
    ...findeZeitplanDrift(
      {
        zeitplaene: zeitplaene.rows,
        abgeschalteteTrigger: abgeschaltet.rows.map((r) => r.name),
      },
      ERWARTETE_ZEITPLAENE,
    ),
  ];
} catch (e) {
  rot((e as Error).message);
}

console.log(
  `Bestand: ${bestand.funktionen.length} Funktionen, ${bestand.trigger.length} Trigger, ` +
    `${bestand.tabellen.length} Tabellen, ${bestand.views.length} Views, ` +
    `${bestand.policies.length} Policies, ${zeitplaene.rows.length} Zeitplanungen ` +
    `(${abgeschaltet.rows.length} abgeschaltete Trigger).`,
);

function meldung(d: ObjektDrift): string {
  switch (d.art) {
    case "unbekannt":
      return `DRIFT — ${d.typ} "${d.name}" steht in keiner Migration. War jemand am Dashboard?`;
    case "fehlt":
      return (
        `DRIFT — "${d.name}" FEHLT. Es steht bewusst in keiner Migration und muss von Hand ` +
        "wiederhergestellt werden (Vorlage: docs/secrets.md). Ohne ihn stirbt der zugehoerige " +
        "Versand still — Mail oder Push, je nach Eintrag."
      );
    // Die beiden Faelle, die eine reine Namenspruefung nie sieht: das Objekt
    // ist da und tut nichts.
    case "abgeschaltet":
      return (
        `DRIFT — ${d.typ} "${d.name}" ist ABGESCHALTET (${d.grund ?? "inaktiv"}). ` +
        "Es steht im Katalog und laeuft trotzdem nicht."
      );
    case "abweichend":
      return `DRIFT — ${d.typ} "${d.name}" weicht ab: ${d.grund ?? "unbekannt"}.`;
  }
}

if (drift.length > 0) {
  for (const d of drift) console.error(`::error::${meldung(d)}`);
  rot(`${drift.length} Objekt-Abweichung(en) auf ${seite}.`);
}

console.log(`OK — keine Objekt-Abweichung auf ${seite}.`);
