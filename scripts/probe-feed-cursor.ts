#!/usr/bin/env tsx
/**
 * Beweis-Sonde fuer C7 (AGE-528), Task 5.5.
 *
 *   tsx scripts/probe-feed-cursor.ts
 *
 * DIE FRAGE. `fetchFeed` blaettert ueber einen Keyset-Cursor und baut dafuer
 * einen PostgREST-Ausdruck zusammen:
 *
 *   or(created_at.lt.<ts>,and(created_at.eq.<ts>,id.lt.<id>))
 *
 * Der Unit-Test sichert diese ZEICHENKETTE zu — mehr kann er nicht. Ob
 * PostgREST sie annimmt und ob dabei kein Beitrag verlorengeht, ist damit
 * nicht gemessen. Ein falsch geklammerter Ausdruck faellt erst zur Laufzeit
 * auf, als 400 auf der Seite, die niemand testet. Genau die Klasse Fehler, die
 * in diesem Repo schon einmal drei Testsuiten und zwei Reviews ueberstanden
 * hat (`service_role` haelt keine Tabellenrechte).
 *
 * DER FALL, DER TRAEGT. Zwei Beitraege mit IDENTISCHEM `created_at`, getrennt
 * durch die Seitengrenze. Ein Cursor nur ueber die Zeit ueberspringt den
 * zweiten still: er steht weder auf Seite 1 noch auf Seite 2. Beim Import der
 * ~70 Konten zum Start ist das der wahrscheinliche Fall, nicht der exotische.
 *
 * Deshalb misst die Sonde BEIDE Fassungen gegen dieselben Daten — die gebaute
 * und die naive. Ein gruener Lauf der einen sagt nichts, wenn die andere
 * genauso gruen waere.
 *
 * NUR LOKAL. Adresse und API-URL sind fest verdrahtet, nicht aus der Umgebung
 * gelesen. Die Sonde legt Zeilen an und raeumt sie wieder ab; gegen DEV oder
 * PROD darf das nie laufen.
 */
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

// ── Fest verdrahtet. Nicht konfigurierbar, mit Absicht. ─────────────────────
const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const API_URL = "http://127.0.0.1:54321";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

/** Derselbe Zeitstempel fuer zwei Beitraege — der Fall, um den es geht. */
const GLEICH = "2026-08-12T12:00:00Z";
const AELTER = "2026-08-12T11:00:00Z";

/** Seitengroesse 1: nur so faellt die Seitengrenze ZWISCHEN die beiden
 *  zeitgleichen Beitraege. Bei groesseren Seiten stehen sie zufaellig auf
 *  derselben Seite, und dann verliert auch der naive Cursor nichts — ein
 *  gruener Lauf, der nichts zeigt. Erst gemessen, dann gewusst. */
const SEITE = 1;

const db = new pg.Client(DB_URL);
const anon = createClient(API_URL, ANON_KEY);

const uid = crypto.randomUUID();
const ids = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()].sort().reverse();
let erfolg = true;

function pruefe(name: string, ok: boolean, gemessen: string) {
  if (!ok) erfolg = false;
  console.log(`${ok ? "  OK  " : " FEHL "} ${name}: ${gemessen}`);
}

/** Eine Seite lesen — exakt die Abfrage aus src/lib/feed.ts. */
async function seite(groesse: number, cursor: { createdAt: string; id: string } | null) {
  let q = anon
    .from("posts")
    .select("id, created_at")
    .in("id", ids)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(groesse);
  if (cursor) {
    q = q.or(
      `created_at.lt.${cursor.createdAt},` +
        `and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
    );
  }
  const { data, error } = await q;
  if (error) throw new Error(`PostgREST: ${error.message}`);
  return data ?? [];
}

/** Die naive Fassung, gegen die gemessen wird: Cursor nur ueber die Zeit. */
async function seiteNaiv(groesse: number, cursor: { createdAt: string } | null) {
  let q = anon
    .from("posts")
    .select("id, created_at")
    .in("id", ids)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(groesse);
  if (cursor) q = q.lt("created_at", cursor.createdAt);
  const { data, error } = await q;
  if (error) throw new Error(`PostgREST: ${error.message}`);
  return data ?? [];
}

async function alleSeiten(
  lies: (
    groesse: number,
    cursor: { createdAt: string; id: string } | null,
  ) => Promise<{ id: string; created_at: string }[]>,
) {
  const gesehen: string[] = [];
  let cursor: { createdAt: string; id: string } | null = null;
  for (let runde = 0; runde < 5; runde++) {
    const zeilen = await lies(SEITE, cursor);
    gesehen.push(...zeilen.map((z) => z.id));
    if (zeilen.length < SEITE) break;
    const letzte = zeilen[zeilen.length - 1];
    cursor = { createdAt: letzte.created_at, id: letzte.id };
  }
  return gesehen;
}

try {
  await db.connect();
  // Derselbe Waechter wie in probe-post-media-signatur.ts: der lokale Stack
  // laeuft im Docker-Netz, `inet_server_addr()` meldet dort 172.x — nicht
  // 127.0.0.1. Ein Waechter, der nur letzteres zulaesst, sperrt genau den Fall
  // aus, fuer den er gedacht ist.
  const wirt = (await db.query("select inet_server_addr()::text as adresse")).rows[0].adresse;
  if (wirt !== null && wirt !== "127.0.0.1" && !wirt.startsWith("172.") && wirt !== "::1") {
    throw new Error(`Nicht der lokale Stack (${wirt}) — Abbruch vor dem ersten Schreiben.`);
  }

  // Wegwerf-Konto samt Profil; die Beitraege haengen per FK daran.
  await db.query(
    `insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
       email_confirmed_at, created_at, updated_at)
     values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       $2, '', now(), now(), now())`,
    [uid, `cursor-sonde-${uid}@example.test`],
  );
  await db.query(
    `insert into public.profiles (id, name, tier) values ($1, 'Cursor-Sonde', 'impact')
     on conflict (id) do nothing`,
    [uid],
  );
  await db.query(
    `insert into public.posts (id, author_id, body, visibility, created_at) values
       ($1, $4, 'A (gleicher Zeitstempel)', 'public', $5),
       ($2, $4, 'B (gleicher Zeitstempel)', 'public', $5),
       ($3, $4, 'C (aelter)',               'public', $6)`,
    [ids[0], ids[1], ids[2], uid, GLEICH, AELTER],
  );

  console.log(`\nSeitengroesse ${SEITE}, drei Beitraege — zwei davon zeitgleich.\n`);

  const gebaut = await alleSeiten(seite);
  pruefe(
    "gebauter Cursor: PostgREST nimmt or(...,and(...)) an",
    gebaut.length > 0,
    `${gebaut.length} Zeilen ohne 400`,
  );
  pruefe(
    "gebauter Cursor: jeder Beitrag genau einmal",
    gebaut.length === 3 && new Set(gebaut).size === 3,
    `${gebaut.length} von 3, davon ${new Set(gebaut).size} verschieden`,
  );

  const naiv = await alleSeiten((groesse, cursor) => seiteNaiv(groesse, cursor));
  pruefe(
    "Gegenprobe: der naive Cursor verliert den zeitgleichen Beitrag",
    naiv.length === 2,
    `${naiv.length} von 3 — fehlt: ${ids.filter((i) => !naiv.includes(i)).length}`,
  );
} catch (fehler) {
  erfolg = false;
  console.error("\nABBRUCH:", fehler instanceof Error ? fehler.message : fehler);
} finally {
  await db.query("delete from public.posts where id = any($1)", [ids]).catch(() => {});
  await db.query("delete from public.profiles where id = $1", [uid]).catch(() => {});
  await db.query("delete from auth.users where id = $1", [uid]).catch(() => {});
  await db.end().catch(() => {});
}

console.log(erfolg ? "\nALLE PRUEFUNGEN ERFUELLT\n" : "\nMINDESTENS EINE PRUEFUNG GEFEHLT\n");
process.exit(erfolg ? 0 : 1);
