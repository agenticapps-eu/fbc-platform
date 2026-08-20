#!/usr/bin/env tsx
/**
 * Gruppe 1, Aufgabe 1.12 — Manifest des Vorher-Stands. NUR LESEN.
 *
 *   infisical run --env=prod -- tsx scripts/mess-spiegel-manifest.ts prod > manifest-prod.json
 *
 * Je Tabelle Zeilenzahl UND Zeilenhash, je Objekt Groesse und Pruefsumme.
 * Der Zeilenhash ist reihenfolgeunabhaengig (sortiert ueber die Zeilenhashes),
 * damit zwei Einspielungen desselben Auszugs denselben Wert ergeben, auch wenn
 * pg_restore die physische Reihenfolge aendert.
 *
 * Die Objektpruefsumme kommt aus `metadata->>'eTag'` — ohne die Objekte zu
 * laden. Fuer den Abgleich reicht das: derselbe Inhalt ergibt dasselbe eTag.
 */
import { readFile } from "node:fs/promises";
import pg from "pg";

const seite = process.argv[2];
if (seite !== "prod" && seite !== "dev") throw new Error("Argument: prod|dev");
const url = seite === "prod" ? process.env.SUPABASE_DB_URL_PROD : process.env.SUPABASE_DB_URL_DEV;
if (!url) throw new Error(`URL fuer ${seite} fehlt`);
const ref = new URL(url).username.replace(/^postgres\./, "");
const erwartet = (await readFile(`scripts/${seite}-project-ref.txt`, "utf8")).trim();
if (ref !== erwartet) throw new Error(`Kennung ${ref} != ${erwartet}`);

const db = new pg.Client({ connectionString: url, ssl: { ca: await readFile("scripts/supabase-root-2021-ca.crt", "utf8") } });
await db.connect();
await db.query("set default_transaction_read_only = on");

const tabellen: Record<string, { zeilen: number; hash: string }> = {};
for (const schema of ["public", "auth"]) {
  const namen = schema === "auth"
    ? ["users", "identities"]
    : (await db.query(`select table_name from information_schema.tables
                        where table_schema='public' and table_type='BASE TABLE' order by 1`)).rows.map((r) => r.table_name);
  for (const t of namen) {
    const r = (await db.query(
      `select count(*)::int as zeilen,
              coalesce(md5(string_agg(h, '' order by h)), '-') as hash
         from (select md5(x::text) as h from ${schema}."${t}" x) s`)).rows[0];
    tabellen[`${schema}.${t}`] = { zeilen: r.zeilen, hash: r.hash };
  }
}

const objekte = (await db.query(
  `select bucket_id, name, (metadata->>'size')::bigint as groesse, metadata->>'eTag' as etag
     from storage.objects order by bucket_id, name`)).rows;

/**
 * Die Bucket-Liste kommt aus `storage.buckets`, NICHT aus den Objekten: ein
 * Bucket, der leer wird, verschwaende sonst still aus dem Manifest, statt mit
 * `objekte: 0` dazustehen — und genau diese Abweichung soll die Abnahme sehen.
 */
const buckets: Record<string, { objekte: number; bytes: number; hash: string }> = {};
for (const b of (await db.query(`select id from storage.buckets order by id`)).rows)
  buckets[b.id] = { objekte: 0, bytes: 0, hash: "" };
for (const o of objekte) {
  const b = (buckets[o.bucket_id] ??= { objekte: 0, bytes: 0, hash: "" });
  b.objekte += 1;
  b.bytes += Number(o.groesse ?? 0);
}
const { createHash } = await import("node:crypto");
for (const id of Object.keys(buckets)) {
  const h = createHash("md5");
  for (const o of objekte.filter((x) => x.bucket_id === id)) h.update(`${o.name}\0${o.groesse}\0${o.etag}\n`);
  buckets[id].hash = h.digest("hex");
}

console.log(JSON.stringify({ seite, ref, tabellen, buckets, objekte: objekte.length }, null, 2));
await db.end();
