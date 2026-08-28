/**
 * Zustand des Push-Wiederholungslaufs auf einer Seite messen (AGE-641, A5b).
 *
 *   infisical run --env=dev  -- pnpm tsx scripts/probe-age641-pg-cron.ts dev
 *   infisical run --env=prod -- pnpm tsx scripts/probe-age641-pg-cron.ts prod
 *
 * Nur lesend. Der Objekt-Drift-Scan sieht von diesem Weg nur die Haelfte: er
 * prueft `public` und damit `push_wiederholung`, aber weder Extensions noch das
 * Schema `cron` (`db-drift-scan.ts:61-90`). Diese Probe schliesst die Luecke
 * von Hand.
 *
 * Warum eine Probe und kein Test: `cron.job` und `cron.job_run_details` sind
 * Zustand der INSTANZ, nicht des Repositories. Ein gruener Testlauf gegen den
 * lokalen Stack sagt ueber DEV oder PROD nichts.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";

import { evaluateStage1 } from "./db-push-prod.logic";

const HIER = dirname(fileURLToPath(import.meta.url));

const seite = process.argv[2];
if (seite !== "dev" && seite !== "prod") {
  console.error("Aufruf: pnpm tsx scripts/probe-age641-pg-cron.ts <dev|prod>");
  process.exit(1);
}

const url = seite === "prod" ? process.env.SUPABASE_DB_URL_PROD : process.env.SUPABASE_DB_URL_DEV;
if (!url) {
  console.error(
    `SUPABASE_DB_URL_${seite.toUpperCase()} fehlt — mit \`infisical run --env=${seite} --\` starten.`,
  );
  process.exit(1);
}

// Zielkontrolle. `current_user` taugt dafuer NICHT: hinter dem Pooler heisst er
// auf beiden Seiten `postgres`, und der Host ist regionsweit gleich. Was die
// Projekte unterscheidet, ist der Benutzername IN der URL
// (`postgres.<project-ref>`) — dieselbe geprüfte Funktion, die
// `assert-target.ts` und `db:push:prod` benutzen.
const ziel = evaluateStage1({
  dbUrl: url,
  expectedRef: readFileSync(join(HIER, `${seite}-project-ref.txt`), "utf8").trim(),
  args: [],
});
if (ziel.kind === "abort") {
  console.error(`SUPABASE_DB_URL_${seite.toUpperCase()}: ${ziel.reason}`);
  process.exit(1);
}
console.log(`Ziel: ${seite} = ${ziel.ref}`);

function ssl(u: string): pg.ClientConfig["ssl"] {
  if (u.includes("localhost") || u.includes("127.0.0.1")) return false;
  return {
    ca: readFileSync(join(HIER, "supabase-root-2021-ca.crt"), "utf8"),
    rejectUnauthorized: true,
  };
}

async function main() {
  const c = new pg.Client({ connectionString: url!, ssl: ssl(url!) });
  await c.connect();

  const zeig = async (titel: string, sql: string) => {
    const r = await c.query(sql);
    console.log(`\n-- ${titel}`);
    console.log(r.rows.length ? JSON.stringify(r.rows, null, 2) : "(keine Zeile)");
  };

  await zeig(
    "Extensions",
    `select name, default_version, installed_version from pg_available_extensions
      where name in ('pg_cron','pg_net') order by name`,
  );

  // Der Rumpf traegt den Bearer im Klartext — deshalb wird er nie angezeigt,
  // nur befragt.
  await zeig(
    "public.push_wiederholung",
    `select proname, prosecdef as security_definer,
            pg_get_functiondef(p.oid) like '%send-push%' as ruft_send_push,
            pg_get_functiondef(p.oid) like '%modus%faellig%' as modus_faellig
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'push_wiederholung'`,
  );

  await zeig(
    "Client-Rollen mit execute (leer ist richtig)",
    `select r.rolname from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
       join pg_roles r on r.rolname in ('anon', 'authenticated')
      where n.nspname = 'public' and p.proname = 'push_wiederholung'
        and has_function_privilege(r.oid, p.oid, 'execute')`,
  );

  const cron = await c.query("select 1 from pg_namespace where nspname = 'cron'");
  if (cron.rowCount === 0) {
    console.log("\n-- cron\nSchema `cron` fehlt: pg_cron ist nicht installiert.");
    await c.end();
    return;
  }

  await zeig(
    "cron.job",
    "select jobid, jobname, schedule, command, active, database from cron.job order by jobid",
  );

  await zeig(
    "cron.job_run_details (letzte 5)",
    `select runid, jobid, status, return_message, start_time, end_time
       from cron.job_run_details order by start_time desc limit 5`,
  );

  // `net.http_post` ist ASYNCHRON: ein `succeeded` in job_run_details heisst
  // nur, dass das SQL lief — nicht, dass send-push geantwortet hat. Das steht
  // hier.
  //
  // ACHTUNG, und darum steht `created` mit in der Ausgabe: diese Zeilen sind
  // fuer sich genommen KEIN Beleg. Sie koennen aus einem beliebig alten Lauf
  // stammen — auf DEV lag eine `200`-Zeile aus einer Webhook-Probe desselben
  // Vormittags. Ein Beleg entsteht erst, wenn man eine Antwort gegen eine
  // VORHER festgehaltene `max(id)` haelt. Diese Probe nimmt sie nicht ab; sie
  // zeigt nur, was da ist. Wer messen will, merkt sich die Kennung vorher.
  await zeig(
    "net._http_response (letzte 5) — nur Bestand, kein Beleg (siehe Kommentar)",
    `select id, status_code, left(content, 120) as inhalt, created
       from net._http_response order by created desc limit 5`,
  );

  await c.end();
}

main().catch((e) => {
  console.error("FEHLER:", e.message);
  process.exit(1);
});
