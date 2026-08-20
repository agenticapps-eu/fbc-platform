#!/usr/bin/env tsx
/**
 * Aufgabengruppe 3 des Spiegels DEV ← PROD (AGE-576) — der Auszug aus PROD.
 *
 *   infisical run --env=prod -- npx tsx scripts/sync-dev-auszug.ts
 *
 * **Dieser Lauf liest ausschliesslich.** Er öffnet keine Verbindung zu DEV und
 * setzt gegen DEV keinen Befehl ab; die Zusage aus 3.5 ist deshalb keine
 * Vorsichtsmaßnahme, sondern eine Eigenschaft der Form (siehe `planeAuszug`).
 * Trotzdem läuft der Wächter zuerst und über **beide** Seiten: wer die
 * Zugangsdaten vertauscht hat, soll das hier erfahren und nicht in Gruppe 4.
 *
 * Was entsteht (Verzeichnis `0700`, Dateien `0600`, ausserhalb des
 * Arbeitsbaums — das Repository ist öffentlich, der Auszug trägt echte
 * Anschriften):
 *
 *   <ablage>/spiegel-<prodref>-<zeit>/
 *     auth.sql        auth.users + auth.identities, --data-only, --column-inserts
 *     public.sql      Schema public, --data-only, --column-inserts
 *     objekte/<bucket>/<name>     die Objekte der Ablage, byteweise
 *     manifest.json   je Tabelle Zeilen und Hash, je Objekt Größe und Prüfsumme
 *
 * **`manifest.json` ist das Vollständigkeitszeichen.** Es wird als letztes
 * geschrieben; ein abgebrochener Lauf hinterlässt sein Verzeichnis, aber ohne
 * Manifest. Gruppe 4 darf deshalb kein Verzeichnis anfassen, in dem es fehlt —
 * das ist billiger und ehrlicher, als beim Abbruch aufzuräumen und dabei die
 * Spur zu verwischen.
 *
 * DREI ENTSCHEIDUNGEN, DIE IM KOPF STEHEN, WEIL SIE SPÄTER NICHT MEHR SICHTBAR SIND.
 *
 * 1. **Ein Snapshot für alles.** Die lesende Transaktion exportiert ihren
 *    Snapshot; beide `pg_dump`-Läufe und jede Zählung des Manifests hängen sich
 *    daran. Ohne das beschriebe das Manifest einen anderen Stand als die Datei
 *    daneben — und die Abnahme in Gruppe 5 könnte einen fehlerhaften Rücklauf
 *    nicht mehr von einer Bewegung auf PROD unterscheiden.
 *
 * 2. **Die Objektliste kommt aus `storage.objects`, nicht aus `list()`.** Die
 *    API-Liste synthetisiert Präfixe, die man rekursiv absteigen muss, und
 *    blättert nach `offset` — zwei Fehlerquellen, die die Tabelle nicht hat:
 *    dort steht jeder Schlüssel voll ausgeschrieben. Geblättert wird trotzdem,
 *    per Keyset, und die Seitengröße ist kleiner als der Bestand gewählt.
 *
 * 3. **Die Prüfsumme wird selbst gerechnet.** `metadata->>'eTag'` steht mit im
 *    Manifest, taugt aber nur als Vergleich mit PROD. Was Gruppe 5 braucht,
 *    ist die Zusage "die Datei auf der Platte ist die, die PROD hatte" — dafür
 *    zählt der sha256 über die tatsächlich empfangenen Bytes, plus ein
 *    Abgleich der Länge gegen die gemeldete Größe.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { chmod, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";
import pg from "pg";

import {
  alleObjekte,
  auszugName,
  planeAuszug,
  pruefeAblageort,
  sichererPfad,
  SQL_DATEIEN,
  zerlegeUrl,
  type Objekt,
} from "./sync-dev-auszug.logic";
import { pruefeLauf, wertMitNamen, type Zugang } from "./sync-dev.logic";

const HIER = dirname(fileURLToPath(import.meta.url));
const ARBEITSBAUM = resolve(HIER, "..");
const CA = join(HIER, "supabase-root-2021-ca.crt");
/** Kleiner als der heutige Bestand (125), damit die Seitengrenze wirklich fällt. */
const SEITENGROESSE = 50;
/** Gemessen in Aufgabe 1.6: der Umfang ist `users` + `identities`, sonst nichts. */
const AUTH_TABELLEN = ["auth.users", "auth.identities"];

// Die Typannotation steht am const, nicht am Rumpf: nur dann verengt
// TypeScript nach einem `ende(...)` und erspart jedem Aufrufer ein `if`.
const ende: (grund: string) => never = (grund) => {
  console.error(`::error::${grund}`);
  process.exit(1);
};

const gelesen: string[] = [];
function hole(...kandidaten: string[]): string | undefined {
  const treffer = wertMitNamen(process.env, kandidaten);
  if (!treffer) return undefined;
  gelesen.push(treffer.name);
  return treffer.wert;
}

// ── Der Wächter, vor allem anderen ────────────────────────────────────────────
const quelle: Zugang = {
  dbUrl: hole("SUPABASE_DB_URL_PROD"),
  apiUrl: hole("SUPABASE_URL_PROD"),
  serviceKey: hole("SUPABASE_SERVICE_ROLE_KEY_PROD", "SUPABASE_SERVICE_ROLE_KEY"),
};
const ziel: Zugang = {
  dbUrl: hole("SUPABASE_DB_URL_DEV"),
  apiUrl: hole("SUPABASE_URL_DEV"),
  serviceKey: hole("SUPABASE_SERVICE_ROLE_KEY_DEV"),
};
const ref = (u: "prod" | "dev") => readFileSync(join(HIER, `${u}-project-ref.txt`), "utf8").trim();
const prodRef = ref("prod");
const wache = pruefeLauf({ quelle, ziel, prodRef, devRef: ref("dev") });
if (wache.kind === "abbruch") ende(wache.grund);
console.log(`Wächter frei: Quelle ${prodRef} (PROD). Gelesen aus: ${gelesen.join(", ")}`);

// ── Ablageort ─────────────────────────────────────────────────────────────────
const kandidat = process.env.SYNC_ABLAGE ?? join(homedir(), ".fbc-spiegel");
const ort = await pruefeAblageort({ kandidat, arbeitsbaum: ARBEITSBAUM });
if (ort.kind === "abbruch") ende(ort.grund);

const ablage = join(ort.pfad, auszugName(new Date(), prodRef));
await mkdir(ort.pfad, { recursive: true, mode: 0o700 });
await chmod(ort.pfad, 0o700);
// Ohne `recursive`: ein vorhandenes Verzeichnis ist ein Abbruch, kein Überschreiben (3.8).
await mkdir(ablage, { mode: 0o700 });
await chmod(ablage, 0o700);
console.log(`Ablage: ${ablage}`);

const geschrieben: string[] = [];
async function schreibe(pfad: string, inhalt: string | Uint8Array): Promise<void> {
  await mkdir(dirname(pfad), { recursive: true, mode: 0o700 });
  await writeFile(pfad, inhalt, { mode: 0o600 });
  await chmod(pfad, 0o600);
  geschrieben.push(pfad);
}

// ── Verbindung und Snapshot ───────────────────────────────────────────────────
const verbindung = zerlegeUrl(quelle.dbUrl as string);
if (!verbindung) ende("SUPABASE_DB_URL_PROD ist keine Postgres-URL.");

const db = new pg.Client({
  connectionString: quelle.dbUrl,
  ssl: { ca: await readFile(CA, "utf8") },
});
await db.connect();
// Read-only UND repeatable read: das eine schützt PROD, das andere ist die
// Bedingung dafür, dass `pg_export_snapshot()` überhaupt etwas zurückgibt.
await db.query("begin transaction isolation level repeatable read read only");
const snapshot: string = (await db.query("select pg_export_snapshot() as s")).rows[0].s;
const serverVersion: string = (await db.query("select current_setting('server_version') as v"))
  .rows[0].v;
console.log(`Snapshot ${snapshot} · Server ${serverVersion}`);

// ── Auszug ────────────────────────────────────────────────────────────────────
const klient = spawnSync("pg_dump", ["--version"], { encoding: "utf8" });
if (klient.status !== 0) ende("pg_dump ist nicht aufrufbar (PATH?).");
const klientVersion = klient.stdout.trim();
console.log(`Klient: ${klientVersion}`);

const plan = planeAuszug({
  verbindung,
  ziel: ablage,
  caPfad: CA,
  snapshot,
  authTabellen: AUTH_TABELLEN,
});
for (const befehl of plan) {
  const lauf = spawnSync(befehl.programm, befehl.argumente, {
    encoding: "utf8",
    env: { ...process.env, ...befehl.umgebung, PGPASSWORD: verbindung.passwort },
  });
  if (lauf.status !== 0) {
    ende(`${befehl.name}: pg_dump endete mit ${lauf.status}. ${lauf.stderr?.trim() ?? ""}`);
  }
  if (lauf.stderr?.trim()) console.warn(`  ${befehl.name}: ${lauf.stderr.trim()}`);
  await chmod(befehl.ausgabe, 0o600);
  geschrieben.push(befehl.ausgabe);
  console.log(`  ${befehl.name}.sql — ${(await stat(befehl.ausgabe)).size} Bytes`);
}

// ── Manifest: Tabellen ────────────────────────────────────────────────────────
const tabellen: Record<string, { zeilen: number; hash: string }> = {};
const publicTabellen = (
  await db.query(`select table_name from information_schema.tables
                   where table_schema='public' and table_type='BASE TABLE' order by 1`)
).rows.map((r) => r.table_name as string);
for (const voll of [...AUTH_TABELLEN, ...publicTabellen.map((t) => `public.${t}`)]) {
  const [schema, name] = voll.split(".");
  // Reihenfolgeunabhängig: derselbe Auszug ergibt denselben Wert, auch wenn
  // pg_restore die physische Reihenfolge ändert.
  const r = (
    await db.query(`select count(*)::int as zeilen,
                           coalesce(md5(string_agg(h, '' order by h)), '-') as hash
                      from (select md5(x::text) as h from ${schema}."${name}" x) s`)
  ).rows[0];
  tabellen[voll] = { zeilen: r.zeilen, hash: r.hash };
}

// ── Manifest: Objekte, geblättert ─────────────────────────────────────────────
const buckets = (await db.query("select id from storage.buckets order by id")).rows.map(
  (r) => r.id as string,
);
const objekte = await alleObjekte(async (nachBucket, nachName, limit) => {
  const r = await db.query(
    `select bucket_id, name, coalesce((metadata->>'size')::bigint, 0)::int as groesse,
            metadata->>'eTag' as etag, metadata->>'mimetype' as mimetype
       from storage.objects
      where (bucket_id, name) > ($1, $2)
      order by bucket_id, name
      limit $3`,
    [nachBucket, nachName, limit],
  );
  return r.rows as Objekt[];
}, SEITENGROESSE);
console.log(`Objekte laut Katalog: ${objekte.length} in ${buckets.length} Buckets`);

// ── Objekte holen ─────────────────────────────────────────────────────────────
const ablageWurzel = join(ablage, "objekte");
const speicher = createClient(quelle.apiUrl as string, quelle.serviceKey as string, {
  auth: { persistSession: false },
});
const objektManifest: {
  bucket: string;
  name: string;
  groesse: number;
  etag: string | null;
  mimetype: string | null;
  sha256: string;
}[] = [];

for (const o of objekte) {
  const pfad = sichererPfad(ablageWurzel, o.bucket_id, o.name);
  if (pfad.kind === "abbruch") ende(`Objekt abgelehnt: ${pfad.grund}`);

  const { data, error } = await speicher.storage.from(o.bucket_id).download(o.name);
  if (error || !data) ende(`Objekt ${o.bucket_id}/${o.name}: ${error?.message ?? "leer"}`);
  const bytes = new Uint8Array(await data.arrayBuffer());
  if (bytes.byteLength !== o.groesse) {
    ende(
      `Objekt ${o.bucket_id}/${o.name}: ${bytes.byteLength} Bytes, Katalog meldet ${o.groesse}.`,
    );
  }
  await schreibe(pfad.pfad, bytes);
  objektManifest.push({
    bucket: o.bucket_id,
    name: o.name,
    groesse: bytes.byteLength,
    etag: o.etag,
    mimetype: o.mimetype,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
}
console.log(`Objekte geholt: ${objektManifest.length}`);

// ── Prüfsummen der beiden SQL-Dateien ─────────────────────────────────────────
// Der Befund aus dem Diff-Review (6.3): die Objekte gingen byteweise gegen
// sha256, die beiden Dumps nur auf Anwesenheit — und der Rücklauf löscht, bevor
// er einspielt. Gerechnet wird über die Datei auf der Platte, also über genau
// das, was der Rücklauf später liest.
const sqlDateien: Record<string, { groesse: number; sha256: string }> = {};
for (const datei of SQL_DATEIEN) {
  const bytes = await readFile(join(ablage, datei));
  sqlDateien[datei] = {
    groesse: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
  console.log(`${datei}: ${bytes.byteLength} B, sha256 ${sqlDateien[datei].sha256.slice(0, 12)}…`);
}

// ── Manifest schreiben ────────────────────────────────────────────────────────
await schreibe(
  join(ablage, "manifest.json"),
  `${JSON.stringify(
    {
      quelle: prodRef,
      erzeugt: new Date().toISOString(),
      snapshot,
      serverVersion,
      klientVersion,
      authUmfang: AUTH_TABELLEN,
      seitenGroesse: SEITENGROESSE,
      tabellen,
      buckets,
      objekte: objektManifest,
      dateien: sqlDateien,
    },
    null,
    2,
  )}\n`,
);

await db.query("rollback");
await db.end();

const zeilen = Object.values(tabellen).reduce((s, t) => s + t.zeilen, 0);
console.log(
  `\nFertig. ${Object.keys(tabellen).length} Tabellen / ${zeilen} Zeilen, ` +
    `${objektManifest.length} Objekte, ${geschrieben.length} Dateien in ${ablage}`,
);
