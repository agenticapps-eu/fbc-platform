#!/usr/bin/env tsx
/**
 * Vorabmessung fuer C8 (AGE-531), Aufgabe 1.4 — NUR LESEND.
 *
 *   infisical run --env=prod -- tsx scripts/probe-c8-starts-at-preflight.ts
 *
 * DIE FRAGE. Migration A setzt `public.events.starts_at` auf `not null`. In DEV
 * steht dem nichts im Weg (9 Zeilen, 0 ohne Termin, gemessen 2026-08-12). Fuer
 * PROD war das bislang eine ANNAHME — und eine Annahme, die erst beim
 * `db push` gegen PROD auffiele, ist kein Rollout-Plan (Befund aus dem
 * Plan-Review, codex, SEVERITY MEDIUM).
 *
 * Diese Sonde beantwortet sie vorher. Sie liest, und sie kann nichts anderes:
 * die Transaktion steht auf `default_transaction_read_only`, es gibt keinen
 * einzigen schreibenden Befehl, und ein `statement_timeout` begrenzt jede
 * Abfrage.
 *
 * Sie meldet zusaetzlich, was Migration A sonst noch beruehrt — die
 * visibility-Verteilung und die bestehenden Check-Constraints —, damit der
 * Abgleich DEV/PROD an einer Stelle steht statt in drei Laeufen.
 *
 * Das Zielprojekt wird ausgegeben, bevor irgendetwas passiert.
 */
import pg from "pg";
import { readFileSync } from "node:fs";

const url = process.env.SUPABASE_DB_URL_PROD;
if (!url)
  throw new Error("SUPABASE_DB_URL_PROD fehlt — mit `infisical run --env=prod --` aufrufen.");

const ref = url.match(/postgres\.([a-z0-9]+)/)?.[1] ?? "unbekannt";
console.log(`Zielprojekt: ${ref} — NUR LESEND, keine Schreibbefehle in dieser Datei.`);

const db = new pg.Client({
  connectionString: url,
  ssl: { ca: readFileSync("scripts/supabase-root-2021-ca.crt", "utf8") },
});

function zeig(titel: string, rows: unknown[]) {
  console.log(`\n### ${titel}`);
  for (const r of rows) console.log("  " + JSON.stringify(r));
}

async function main() {
  await db.connect();
  await db.query("set default_transaction_read_only = on");
  await db.query("set statement_timeout = '30s'");

  const zeilen = await db.query(
    `select count(*)::int as gesamt,
            count(*) filter (where starts_at is null)::int as ohne_starts_at
       from public.events`,
  );
  zeig("events: gesamt / ohne starts_at", zeilen.rows);

  zeig(
    "events: visibility-Verteilung",
    (await db.query(`select visibility, count(*)::int from public.events group by 1 order by 1`))
      .rows,
  );

  zeig(
    "events: bestehende Check-Constraints",
    (
      await db.query(
        `select conname, pg_get_constraintdef(oid) as definition
           from pg_constraint
          where conrelid = 'public.events'::regclass and contype = 'c'
          order by conname`,
      )
    ).rows,
  );

  zeig(
    "storage.buckets",
    (await db.query(`select id, public, file_size_limit from storage.buckets order by id`)).rows,
  );

  const blocker = zeilen.rows[0].ohne_starts_at as number;
  console.log(
    blocker === 0
      ? "\nERGEBNIS: `alter column starts_at set not null` laeuft in PROD durch."
      : `\nERGEBNIS: ${blocker} Zeile(n) ohne Termin — set not null BRICHT in PROD. Erst nachziehen.`,
  );

  await db.end();
}

main();
