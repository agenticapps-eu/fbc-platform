#!/usr/bin/env tsx
/**
 * Beweis-Sonde für C8 (AGE-531), Aufgabe 9.4.
 *
 *   pnpm exec tsx scripts/probe-event-cover-signatur.ts
 *
 * DIE FRAGE. Der Abnahmepunkt von AGE-531 lautet: „Titelbild eines
 * `members`-Events ist ohne Session nicht abrufbar." pgTAP kann das nicht
 * beantworten. Es prüft `event_cover_lesbar()` und die Policy auf
 * `storage.objects` — aber ob der STORAGE-DIENST daraus tatsächlich eine
 * Signatur verweigert, ist eine andere Frage, und sie fällt sonst erst zur
 * Laufzeit auf. Genau die Klasse Fehler, die in diesem Repo schon einmal drei
 * Testsuiten und zwei Reviews überstanden hat (`service_role` hält keine
 * Tabellenrechte).
 *
 * Dasselbe gilt für `file_size_limit` und `allowed_mime_types`: die stehen am
 * Bucket, durchgesetzt werden sie vom Dienst. Eine Datenbank sieht davon nichts.
 *
 * ACHT FÄLLE, alle durch die echte Storage-API:
 *   1. anon signiert Cover eines `public`-Events        → erlaubt, Abruf 200
 *   2. anon signiert Cover eines `members`-Events       → verweigert
 *   3. bestätigtes Mitglied, `members`-Event            → erlaubt
 *   4. eingeloggt, NICHT bestätigt                      → verweigert
 *   5. Objekt ohne events-Zeile (verwaist)              → verweigert
 *   6. fremder Pfad an eigenem `public`-Event (Diebstahl) → verweigert
 *   7. Upload > 2 MiB                                   → abgelehnt
 *   8. Upload, der kein WebP ist                        → abgelehnt
 *
 * ABBAU. Jeder Lauf schreibt unter ein EIGENES Präfix und löscht am Ende genau
 * diese Objekte — nicht `emptyBucket`. Aus dem Plan-Review (gemini): das
 * Leeren eines ganzen Buckets ist gehostet nicht sofort wirksam, und in C7 blieb
 * dadurch ein Wegwerf-Bucket in DEV stehen, während die Sonde „alles erfüllt"
 * meldete. Ein gezieltes `remove([pfad])` ist verlässlicher und räumt nur das
 * Eigene ab.
 *
 * NUR LOKAL. Adresse und Schlüssel sind fest verdrahtet, nicht aus der Umgebung
 * gelesen. Die Sonde legt Konten, Events und Objekte an; gegen DEV oder PROD
 * darf das nie laufen.
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

const BUCKET = "event-covers";
/** Eigenes Präfix je Lauf — die Grundlage des gezielten Abbaus. */
const LAUF = crypto.randomUUID().slice(0, 8);

const db = new pg.Client(DB_URL);
const admin = createClient(API_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const anon = createClient(API_URL, ANON_KEY);

let erfolg = true;
const angelegt: string[] = [];

function pruefe(name: string, ok: boolean, gemessen: string) {
  if (!ok) erfolg = false;
  console.log(`${ok ? "  OK  " : " FEHL "} ${name}: ${gemessen}`);
}

/** Ein winziges, gültiges WebP (RIFF-Container, 1×1). */
function webpBlob(bytes = 64): Blob {
  const kopf = Uint8Array.from(atob("UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA=="), (c) =>
    c.charCodeAt(0),
  );
  const daten = new Uint8Array(Math.max(bytes, kopf.length));
  daten.set(kopf);
  return new Blob([daten], { type: "image/webp" });
}

async function alsMitglied(email: string, passwort: string) {
  const c = createClient(API_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await c.auth.signInWithPassword({ email, password: passwort });
  if (error) throw new Error(`Login ${email}: ${error.message}`);
  return c;
}

async function main() {
  await db.connect();

  // ── Aufbau ───────────────────────────────────────────────────────────────
  const konten: Record<string, string> = {};
  for (const [schluessel, email] of [
    ["host", `c8sonde-host-${LAUF}@test.local`],
    ["mitglied", `c8sonde-mitglied-${LAUF}@test.local`],
    ["unbestaetigt", `c8sonde-unbest-${LAUF}@test.local`],
    ["dieb", `c8sonde-dieb-${LAUF}@test.local`],
  ] as const) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: "sonde123456",
      email_confirm: true,
    });
    if (error) throw error;
    konten[schluessel] = data.user!.id;
    await db.query(
      `update public.profiles set tier = 'impact', activated_at = now() where id = $1`,
      [data.user!.id],
    );
  }
  // Das unbestätigte Konto: Login möglich, Aktivierung fehlt — genau das Gate.
  await db.query(`update public.profiles set activated_at = null where id = $1`, [
    konten.unbestaetigt,
  ]);

  const hostClient = await alsMitglied(`c8sonde-host-${LAUF}@test.local`, "sonde123456");
  const mitgliedClient = await alsMitglied(`c8sonde-mitglied-${LAUF}@test.local`, "sonde123456");
  const unbestClient = await alsMitglied(`c8sonde-unbest-${LAUF}@test.local`, "sonde123456");
  const diebClient = await alsMitglied(`c8sonde-dieb-${LAUF}@test.local`, "sonde123456");

  const pfad = (name: string) => `${konten.host}/${LAUF}-${name}.webp`;
  for (const name of ["public", "members", "verwaist", "geklaut"]) {
    const p = pfad(name);
    // KEIN `upsert`: das wird zu `on conflict do update`, und ON CONFLICT
    // verlangt Leserecht auf die Zeile — das verneint `event_cover_lesbar()`
    // für ein Objekt, auf das noch kein Event zeigt. Gemessen, nicht vermutet;
    // dieselbe Begründung steht in src/lib/event-cover.ts.
    const { error } = await hostClient.storage.from(BUCKET).upload(p, webpBlob(), {
      contentType: "image/webp",
    });
    if (error) throw new Error(`Upload ${p}: ${error.message}`);
    angelegt.push(p);
  }

  const morgen = new Date(Date.now() + 86400000).toISOString();
  await db.query(
    `insert into public.events (title, host_id, visibility, starts_at, cover_path)
     values ($1,$2,'public',$3,$4), ($5,$2,'members',$3,$6), ($7,$8,'public',$3,$9)`,
    [
      `Sonde public ${LAUF}`,
      konten.host,
      morgen,
      pfad("public"),
      `Sonde members ${LAUF}`,
      pfad("members"),
      // Der Diebstahl: das Event gehört dem Dieb, der Pfad dem Host.
      `Sonde geklaut ${LAUF}`,
      konten.dieb,
      pfad("geklaut"),
    ],
  );

  // ── Die acht Fälle ───────────────────────────────────────────────────────
  console.log(`\n### Signaturen (Bucket ${BUCKET}, Lauf ${LAUF})\n`);

  const s1 = await anon.storage.from(BUCKET).createSignedUrl(pfad("public"), 60);
  let abruf = 0;
  if (s1.data?.signedUrl) abruf = (await fetch(s1.data.signedUrl)).status;
  pruefe(
    "1. anon · Cover eines PUBLIC-Events",
    !!s1.data?.signedUrl && abruf === 200,
    `Signatur=${s1.data?.signedUrl ? "ja" : "nein"} Abruf=${abruf} ${s1.error?.message ?? ""}`,
  );

  const s2 = await anon.storage.from(BUCKET).createSignedUrl(pfad("members"), 60);
  pruefe(
    "2. anon · Cover eines MEMBERS-Events",
    !s2.data?.signedUrl,
    s2.error ? `verweigert: ${s2.error.message}` : "SIGNATUR ERTEILT — Leck!",
  );

  const s3 = await mitgliedClient.storage.from(BUCKET).createSignedUrl(pfad("members"), 60);
  pruefe(
    "3. bestätigtes Mitglied · MEMBERS-Event",
    !!s3.data?.signedUrl,
    s3.data?.signedUrl ? "Signatur erteilt" : `verweigert: ${s3.error?.message}`,
  );

  const s4 = await unbestClient.storage.from(BUCKET).createSignedUrl(pfad("public"), 60);
  pruefe(
    "4. eingeloggt, NICHT bestätigt · PUBLIC-Event",
    !s4.data?.signedUrl,
    s4.error ? `verweigert: ${s4.error.message}` : "SIGNATUR ERTEILT — Gate offen!",
  );

  const s5 = await mitgliedClient.storage.from(BUCKET).createSignedUrl(pfad("verwaist"), 60);
  pruefe(
    "5. verwaistes Objekt (keine events-Zeile)",
    !s5.data?.signedUrl,
    s5.error ? `verweigert: ${s5.error.message}` : "SIGNATUR ERTEILT — Leck!",
  );

  const s6a = await anon.storage.from(BUCKET).createSignedUrl(pfad("geklaut"), 60);
  const s6b = await diebClient.storage.from(BUCKET).createSignedUrl(pfad("geklaut"), 60);
  pruefe(
    "6. fremder Pfad an eigenem PUBLIC-Event (Diebstahl)",
    !s6a.data?.signedUrl && !s6b.data?.signedUrl,
    `anon=${s6a.data?.signedUrl ? "ERTEILT" : "verweigert"} dieb=${s6b.data?.signedUrl ? "ERTEILT" : "verweigert"}`,
  );

  console.log(`\n### Bucket-Grenzen (Dienst, nicht Datenbank)\n`);

  const grossPfad = `${konten.host}/${LAUF}-zugross.webp`;
  const g = await hostClient.storage
    .from(BUCKET)
    .upload(grossPfad, webpBlob(3 * 1024 * 1024), { contentType: "image/webp" });
  if (!g.error) angelegt.push(grossPfad);
  pruefe(
    "7. Upload über 2 MiB",
    !!g.error,
    g.error ? `abgelehnt: ${g.error.message}` : "ANGENOMMEN — Grenze wirkt nicht!",
  );

  const pngPfad = `${konten.host}/${LAUF}-kein-webp.png`;
  const p = await hostClient.storage
    .from(BUCKET)
    .upload(pngPfad, new Blob([new Uint8Array(32)], { type: "image/png" }), {
      contentType: "image/png",
    });
  if (!p.error) angelegt.push(pngPfad);
  pruefe(
    "8. Upload, der kein WebP ist",
    !!p.error,
    p.error ? `abgelehnt: ${p.error.message}` : "ANGENOMMEN — MIME-Grenze wirkt nicht!",
  );

  // ── Abbau: gezielt, geprüft, nicht `emptyBucket` ──────────────────────────
  console.log(`\n### Abbau\n`);
  const { error: delErr } = await admin.storage.from(BUCKET).remove(angelegt);
  const rest = await admin.storage.from(BUCKET).list(konten.host);
  const uebrig = (rest.data ?? []).filter((o) => o.name.startsWith(LAUF));
  pruefe(
    "Objekte dieses Laufs entfernt",
    !delErr && uebrig.length === 0,
    `${angelegt.length} gelöscht, ${uebrig.length} übrig ${delErr?.message ?? ""}`,
  );

  await db.query(`delete from public.events where title like $1`, [`Sonde %${LAUF}`]);
  for (const id of Object.values(konten)) await admin.auth.admin.deleteUser(id);

  console.log(
    `\n${erfolg ? "ALLE PRUEFUNGEN ERFUELLT" : "MINDESTENS EINE PRUEFUNG FEHLGESCHLAGEN"}\n`,
  );
  await db.end();
  process.exit(erfolg ? 0 : 1);
}

main();
