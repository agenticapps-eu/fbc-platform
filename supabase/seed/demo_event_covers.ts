/**
 * Titelbilder für die Demo-Events (AGE-566).
 *
 *   infisical run --env=dev -- env DEMO_SEED_CONFIRM=fbc-demo tsx supabase/seed/demo_event_covers.ts
 *
 * WARUM EIN EIGENES SKRIPT UND NICHT IM demo_seed:
 * `demo_seed.ts` spricht ausschliesslich Postgres. Ein Titelbild besteht aber
 * aus ZWEI Dingen — einer Zeile in `events.cover_path` UND einem Objekt im
 * Bucket, dessen Bytes nicht in der Datenbank liegen. Der zweite Teil geht nur
 * über die Storage-Schnittstelle, mit einem Schlüssel, den der Seed nicht hat.
 *
 * WOHER DER SCHLÜSSEL KOMMT:
 * `SUPABASE_SERVICE_ROLE_KEY` steht in KEINER Infisical-Umgebung (am 17.08.
 * nachgezählt: dev trägt 26 Geheimnisse, dieses ist nicht darunter). Der
 * Management-PAT `SUPABASE_ACCESS_TOKEN` ist da — über ihn wird der Schlüssel
 * zur Laufzeit geholt und nirgends abgelegt.
 *
 * WOHER DIE BILDER KOMMEN:
 * Aus `public/images/` — den neun Motiven, die das Projekt seit AGE-499 selbst
 * hostet. Lizenz und Herkunft stehen in `public/images/CREDITS.md` (Unsplash,
 * kommerzielle Nutzung erlaubt). Bewusst KEIN neuer Fremdabruf: ein Demo-Bild
 * ohne geklärte Herkunft ist genau das Problem, das jene Datei gelöst hat. Sie
 * sind ausserdem schon `image/webp` — der einzige Typ, den der Bucket annimmt.
 *
 * DIE PFADREGEL IST NICHT VERHANDELBAR:
 * `event_cover_lesbar` verlangt, dass das erste Pfadsegment die `host_id` des
 * Events ist (20260812100200). Ein Bild unter einem anderen Präfix liesse sich
 * nicht signieren und bliebe für JEDEN Betrachter ein grauer Kasten — ohne
 * Fehlermeldung. Der Pfad wird deshalb aus der Datenbank gelesen, nicht geraten.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";

import { assertOptIn, resolveDatabaseUrl } from "./demo_seed.lib";

const HERE = dirname(fileURLToPath(import.meta.url));
const BILDER = join(HERE, "..", "..", "public", "images");
const PROJECT_REF = "foelowldexkcqzewvrcf";
const BUCKET = "event-covers";

/**
 * Event-Kennung → Motiv. Die Zuordnung ist inhaltlich und nicht zufällig: der
 * Kaminabend bekommt das Abendlicht, das Retreat den Bergpfad, der Deep Dive
 * die zwei Menschen am Laptop.
 *
 * `hero-events.webp` fehlt mit Absicht — es ist der Kopf der Events-Seite
 * selbst, und dasselbe Foto darüber und darunter auf einem Bildschirm liest
 * sich als Fehler.
 */
const ZUORDNUNG: Record<string, { datei: string; titel: string }> = {
  "00000000-0000-0000-0000-0000000254e5": { datei: "hero-aktivitaet.webp", titel: "Frühstück" },
  "00000000-0000-0000-0000-0000000254e6": { datei: "hero-kontakte.webp", titel: "Deep Dive" },
  "00000000-0000-0000-0000-0000000254e1": { datei: "hero-academy.webp", titel: "Webinar" },
  "00000000-0000-0000-0000-0000000254e7": { datei: "hero-see.webp", titel: "Kaminabend" },
  "00000000-0000-0000-0000-0000000254e2": { datei: "hero-mitglieder.webp", titel: "Workshop" },
  "00000000-0000-0000-0000-0000000254e3": { datei: "hero-start.webp", titel: "Legacy Dinner" },
  "00000000-0000-0000-0000-0000000254e4": {
    datei: "hero-mitgliedschaft.webp",
    titel: "Mastermind",
  },
  "00000000-0000-0000-0000-0000000254e8": { datei: "hero-compass.webp", titel: "Retreat" },
};

async function serviceKeyHolen(pat: string): Promise<string> {
  const r = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/api-keys`, {
    headers: { Authorization: `Bearer ${pat}` },
  });
  if (!r.ok) throw new Error(`Management-API ${r.status}: ${await r.text()}`);
  const keys = (await r.json()) as Array<{ name: string; api_key: string }>;
  const key = keys.find((k) => k.name === "service_role")?.api_key;
  if (!key) throw new Error("Kein service_role-Schlüssel in der Antwort der Management-API.");
  return key;
}

async function hochladen(
  basis: string,
  key: string,
  pfad: string,
  bytes: Buffer,
): Promise<"neu" | "vorhanden"> {
  const r = await fetch(`${basis}/storage/v1/object/${BUCKET}/${pfad}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
      "Content-Type": "image/webp",
      // `upsert: false` mit Absicht: in privaten Buckets scheitert ein Upsert an
      // der SELECT-Policy, weil ON CONFLICT ein Leserecht auf ein noch nicht
      // verknüpftes Objekt braucht. Ein zweiter Lauf meldet hier schlicht
      // „vorhanden" — das ist die Idempotenz, nicht ein Fehlschlag.
      "x-upsert": "false",
    },
    body: new Uint8Array(bytes),
  });
  if (r.ok) return "neu";
  const text = await r.text();
  if (r.status === 409 || text.includes("already exists")) return "vorhanden";
  throw new Error(`Upload ${pfad}: ${r.status} ${text}`);
}

async function main(): Promise<void> {
  assertOptIn(process.env);
  const pat = process.env.SUPABASE_ACCESS_TOKEN;
  if (!pat)
    throw new Error("SUPABASE_ACCESS_TOKEN fehlt (per `infisical run --env=dev` einspielen).");
  const basis = process.env.VITE_SUPABASE_URL;
  if (!basis) throw new Error("VITE_SUPABASE_URL fehlt.");

  const key = await serviceKeyHolen(pat);
  const client = new pg.Client({
    connectionString: resolveDatabaseUrl(process.env),
    ssl: process.env.DEMO_SEED_TLS_INSECURE === "1" ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();
  try {
    const { rows } = await client.query<{ id: string; host_id: string; title: string }>(
      `select id, host_id, title from public.events where id = any($1::uuid[])`,
      [Object.keys(ZUORDNUNG)],
    );
    for (const ev of rows) {
      const zu = ZUORDNUNG[ev.id];
      if (!ev.host_id) {
        console.log(`  ⚠ ${ev.title}: kein host_id — ohne den ist kein gültiger Pfad möglich.`);
        continue;
      }
      // Erstes Segment = host_id. Siehe die Pfadregel im Kopf dieser Datei.
      const pfad = `${ev.host_id}/demo-${zu.datei}`;
      const bytes = readFileSync(join(BILDER, zu.datei));
      const stand = await hochladen(basis, key, pfad, bytes);
      await client.query(`update public.events set cover_path = $1 where id = $2`, [pfad, ev.id]);
      console.log(`  ✓ ${ev.title.padEnd(42)} ← ${zu.datei} (${stand})`);
    }
    const { rows: offen } = await client.query<{ n: string }>(
      `select count(*)::text n from public.events where starts_at > now() and cover_path is null`,
    );
    console.log(`\nKommende Events ohne Titelbild: ${offen[0].n}`);
  } finally {
    await client.end();
  }
}

main().catch((err: unknown) => {
  console.error(`\n✗ ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
