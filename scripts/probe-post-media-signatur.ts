#!/usr/bin/env tsx
/**
 * Beweis-Sonde fuer C7 (AGE-528), Task 1.0/1.0b.
 *
 *   tsx scripts/probe-post-media-signatur.ts
 *
 * DIE FRAGE. Der ganze Change haengt an einer Annahme, die nirgends gemessen
 * ist: Bekommt `anon` — ein ausgeloggter Besucher mit dem anon-Key — vom
 * Storage eine SIGNIERTE URL fuer ein Objekt in einem PRIVATEN Bucket, wenn
 * eine SELECT-Policy auf `storage.objects` es erlaubt? Und wird sie verweigert,
 * wenn die Policy es nicht erlaubt?
 *
 * Faellt die Antwort negativ aus, ist der gewaehlte Weg (ein privater Bucket
 * mit signierten URLs, design.md) nicht gangbar und der Rueckfallweg (Edge
 * Function mit service_role) muss vor Block 2 entschieden werden. Genau deshalb
 * laeuft diese Sonde VOR der ersten Migration.
 *
 * WARUM EIN WEGWERF-AUFBAU. Die Zieltabellen gibt es noch nicht. Gemessen wird
 * der MECHANISMUS von Supabase Storage, nicht unser Schema — deshalb baut die
 * Sonde einen minimalen Aufbau mit demselben Muster (privater Bucket +
 * SECURITY-DEFINER-Praedikat + SELECT-Policy fuer anon) und raeumt ihn wieder
 * ab. Ein Aufbau, der dem Ziel gleicht, aber nichts von ihm voraussetzt.
 *
 * WARUM DIE ZEILE UND NICHT DER PFAD GEFRAGT WIRD. Aus dem Plan-Review
 * (REVIEWS.md, gemini): der Objektname ist frei waehlbar, die INSERT-Policy
 * prueft nur seinen ersten Abschnitt. Das Praedikat schlaegt deshalb ueber
 * `storage_path` nach und zerlegt den Pfad nie. Fall D misst genau das.
 *
 * NUR LOKAL. Adresse und API-URL sind fest verdrahtet, nicht aus der Umgebung
 * gelesen: ein Waechter, der nur einen Hostnamen prueft, haelt nichts, wenn
 * jemand die Variable anders setzt. Weicht etwas ab, bricht die Sonde ab,
 * bevor sie irgendetwas anlegt.
 */
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

// ── Fest verdrahtet. Nicht konfigurierbar, mit Absicht. ─────────────────────
const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const API_URL = "http://127.0.0.1:54321";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const BUCKET = "probe-post-media";
const UID = "00000000-0000-4000-8000-0000000000c7";

let fehler = 0;
function pruefe(name: string, erwartet: string, tatsaechlich: string, ok: boolean) {
  if (ok) {
    console.log(`  OK    ${name}\n        erwartet: ${erwartet}\n        gemessen: ${tatsaechlich}`);
  } else {
    fehler += 1;
    console.log(`  FEHLT ${name}\n        erwartet: ${erwartet}\n        gemessen: ${tatsaechlich}`);
  }
}

const anon = createClient(API_URL, ANON_KEY);
const dienst = createClient(API_URL, SERVICE_KEY);

async function aufbau(db: pg.Client) {
  // Bucket ueber die Storage-API, nicht per SQL: `storage.protect_delete()`
  // verbietet direktes Loeschen in den Storage-Tabellen, und ein Aufbau, der
  // sich nicht symmetrisch abraeumen laesst, bleibt beim naechsten Lauf liegen.
  await dienst.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: 1048576,
    allowedMimeTypes: ["image/webp"],
  });

  await db.query(`
    create table if not exists public.probe_media (
      storage_path text primary key,
      visibility   text not null
    );

    -- Das Praedikat: ueber die ZEILE nachschlagen, den Pfad nie zerlegen.
    create or replace function public.probe_lesbar(objektname text)
      returns boolean language sql stable security definer set search_path = '' as $$
      select exists (
        select 1 from public.probe_media m
        where m.storage_path = objektname and m.visibility = 'public'
      );
    $$;
    revoke execute on function public.probe_lesbar(text) from public;
    grant execute on function public.probe_lesbar(text) to anon, authenticated;

    drop policy if exists probe_select_anon on storage.objects;
    create policy probe_select_anon on storage.objects
      for select to anon
      using ( bucket_id = '${BUCKET}' and public.probe_lesbar(name) );
  `);
}

async function abbau(db: pg.Client) {
  await db.query(`
    drop policy if exists probe_select_anon on storage.objects;
    drop function if exists public.probe_lesbar(text);
    drop table if exists public.probe_media;
  `);
  // Objekte und Bucket ueber die API — SQL-DELETE blockt storage.protect_delete().
  await dienst.storage.emptyBucket(BUCKET);
  await dienst.storage.deleteBucket(BUCKET);
}

/** Ein winziges gueltiges WebP (RIFF-Kopf reicht — der Bucket prueft den MIME-Typ). */
function bildBytes(): Blob {
  return new Blob([new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00])], {
    type: "image/webp",
  });
}

async function main() {
  console.log("== Sonde: darf anon aus einem privaten Bucket signieren? ==");
  console.log(`   Ziel: ${DB_URL} (LOKAL, fest verdrahtet)\n`);

  const db = new pg.Client({ connectionString: DB_URL });
  await db.connect();

  const wirt = (await db.query("select inet_server_addr()::text as adresse")).rows[0].adresse;
  if (wirt !== null && wirt !== "127.0.0.1" && !wirt.startsWith("172.") && wirt !== "::1") {
    console.error(`::error::Nicht der lokale Stack (inet_server_addr = ${wirt}). Abbruch.`);
    process.exit(1);
  }

  await abbau(db); // Reste eines frueheren Laufs
  await aufbau(db);

  const pfad = `${UID}/probe/${Date.now()}.webp`;
  const up = await dienst.storage.from(BUCKET).upload(pfad, bildBytes(), {
    contentType: "image/webp",
  });
  if (up.error) {
    console.error(`::error::Upload fehlgeschlagen: ${up.error.message}`);
    await abbau(db);
    process.exit(1);
  }

  // ── A · Beitrag ist public → anon darf signieren UND abrufen ──────────────
  console.log("A · Objekt gehoert zu einem 'public'-Beitrag");
  await db.query("insert into public.probe_media values ($1, 'public')", [pfad]);

  const a = await anon.storage.from(BUCKET).createSignedUrl(pfad, 3600);
  pruefe(
    "anon bekommt eine Signatur",
    "signierte URL",
    a.error ? `Fehler: ${a.error.message}` : "signierte URL erhalten",
    !a.error && !!a.data?.signedUrl,
  );

  if (a.data?.signedUrl) {
    const r = await fetch(a.data.signedUrl);
    pruefe("die signierte URL liefert das Bild", "HTTP 200", `HTTP ${r.status}`, r.status === 200);
  }

  // Die rohe oeffentliche Bucket-URL darf NICHTS liefern (Abnahme, design.md).
  const rohe = `${API_URL}/storage/v1/object/public/${BUCKET}/${pfad}`;
  const rr = await fetch(rohe);
  pruefe(
    "die ROHE oeffentliche URL liefert nichts",
    "HTTP 4xx",
    `HTTP ${rr.status}`,
    rr.status >= 400,
  );

  // ── B · Beitrag ist members → anon darf NICHT signieren ───────────────────
  console.log("\nB · Dasselbe Objekt gehoert zu einem 'members'-Beitrag");
  await db.query("update public.probe_media set visibility = 'members' where storage_path = $1", [
    pfad,
  ]);

  const b = await anon.storage.from(BUCKET).createSignedUrl(pfad, 3600);
  pruefe(
    "anon bekommt KEINE Signatur",
    "Ablehnung",
    b.error ? `abgelehnt: ${b.error.message}` : "SIGNATUR ERHALTEN — Leck!",
    !!b.error || !b.data?.signedUrl,
  );

  // ── C · keine Zeile → fuer niemanden signierbar ───────────────────────────
  console.log("\nC · Objekt ohne zugehoerige Zeile (verwaist)");
  await db.query("delete from public.probe_media where storage_path = $1", [pfad]);

  const c = await anon.storage.from(BUCKET).createSignedUrl(pfad, 3600);
  pruefe(
    "verwaistes Objekt ist nicht signierbar",
    "Ablehnung",
    c.error ? `abgelehnt: ${c.error.message}` : "SIGNATUR ERHALTEN — Leck!",
    !!c.error || !c.data?.signedUrl,
  );

  // ── D · gefaelschter Pfad erschleicht keine Sichtbarkeit ──────────────────
  console.log("\nD · Gefaelschter Pfad: eigenes Praefix, fremde Beitragskennung im Namen");
  const echterPfad = `${UID}/echt/${Date.now()}.webp`;
  const faelschung = `${UID}/${echterPfad.split("/")[1]}-nachgebaut/${Date.now()}.webp`;
  await dienst.storage.from(BUCKET).upload(echterPfad, bildBytes(), { contentType: "image/webp" });
  await dienst.storage.from(BUCKET).upload(faelschung, bildBytes(), { contentType: "image/webp" });
  await db.query("insert into public.probe_media values ($1, 'public')", [echterPfad]);

  const d = await anon.storage.from(BUCKET).createSignedUrl(faelschung, 3600);
  pruefe(
    "nachgebauter Pfad bekommt keine Signatur",
    "Ablehnung",
    d.error ? `abgelehnt: ${d.error.message}` : "SIGNATUR ERHALTEN — Leck!",
    !!d.error || !d.data?.signedUrl,
  );

  // ── E · Laufzeit eines Stapels mit 120 Pfaden (Task 1.0b) ─────────────────
  console.log("\nE · Laufzeit: ein Stapel mit 120 Pfaden");
  const viele: string[] = [];
  for (let i = 0; i < 120; i += 1) viele.push(`${UID}/last/${i}.webp`);
  await Promise.all(
    viele.map((p) => dienst.storage.from(BUCKET).upload(p, bildBytes(), { contentType: "image/webp" })),
  );
  await db.query(
    `insert into public.probe_media select unnest($1::text[]), 'public' on conflict do nothing`,
    [viele],
  );

  const t0 = performance.now();
  const e = await anon.storage.from(BUCKET).createSignedUrls(viele, 3600);
  const dauer = Math.round(performance.now() - t0);
  const anzahl = (e.data ?? []).filter((x) => x.signedUrl).length;
  pruefe(
    "120 Signaturen in EINEM Aufruf",
    "120 URLs",
    `${anzahl} URLs in ${dauer} ms`,
    !e.error && anzahl === 120,
  );

  // ── F · Teilablehnung im Stapel ───────────────────────────────────────────
  console.log("\nF · Stapel mit einem nicht erlaubten Pfad");
  await db.query("update public.probe_media set visibility = 'members' where storage_path = $1", [
    viele[0],
  ]);
  const f = await anon.storage.from(BUCKET).createSignedUrls(viele.slice(0, 5), 3600);
  const erlaubt = (f.data ?? []).filter((x) => x.signedUrl).length;
  pruefe(
    "der Stapel liefert die erlaubten und laesst den einen aus",
    "4 von 5",
    f.error ? `ganzer Stapel abgelehnt: ${f.error.message}` : `${erlaubt} von 5`,
    !f.error && erlaubt === 4,
  );

  await abbau(db);
  await db.end();

  console.log(`\n== ${fehler === 0 ? "ALLE PRUEFUNGEN ERFUELLT" : `${fehler} PRUEFUNG(EN) OFFEN`} ==`);
  process.exit(fehler === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("::error::", e);
  process.exit(1);
});
