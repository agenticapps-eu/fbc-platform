#!/usr/bin/env tsx
/**
 * Der Sichtbarkeits-Beweis fuer C7 (AGE-528), Task 9.3.
 *
 *   tsx scripts/probe-9-3-sichtbarkeit.ts                         # lokal
 *   tsx scripts/probe-9-3-sichtbarkeit.ts --dev=foelowldexkcqzewvrcf
 *
 * DIE FRAGE. Die Sonde aus 1.0c hat den MECHANISMUS gemessen — privater
 * Bucket, SELECT-Policy, Signatur fuer `anon` — an einem Wegwerf-Aufbau, der
 * dem Ziel glich, aber nichts von ihm voraussetzte. Diese hier misst das
 * ECHTE Schema: `post_media`, den Bucket `post-media`, `post_media_lesbar()`
 * und die vier Storage-Policies, so wie sie nach den Migrationen dastehen.
 *
 * Gefuehrt wird die Tabelle aus `design.md`:
 *
 *   | `members` | rohe Storage-URL              | kein Bild              |
 *   | `members` | ausgeloggter Feed             | Beitrag nicht sichtbar |
 *   | `members` | `createSignedUrls` als anon   | ABGELEHNT              |
 *   | `public`  | rohe Storage-URL              | kein Bild (erwartet)   |
 *   | `public`  | ausgeloggt signieren + holen  | Bild kommt an          |
 *
 * Die letzte Zeile fuehrt `design.md` bewusst ueber den gerenderten Feed statt
 * ueber die rohe URL. Der gerenderte Teil geht erst NACH dem deploy-Re-Run —
 * bis dahin steht auf pages.dev das alte Frontend, weil `drift-gate` den
 * Deploy blockt, bis `migrate-prod` lief. Diese Sonde fuehrt deshalb die
 * API-Haelfte: ausgeloggt signieren, holen, Bytes vergleichen. Das ist genau
 * der Weg, den der Feed danach nimmt.
 *
 * WARUM DAS ZIEL HINGESCHRIEBEN WERDEN MUSS. Wie in 1.0c: ein Waechter, der
 * eine Umgebungsvariable prueft, haelt nichts, wenn jemand sie anders setzt.
 * `--dev=` wird gegen `scripts/dev-project-ref.txt` geprueft, alles andere
 * bricht ab, bevor irgendetwas angelegt wird. Ein `--prod=` gibt es nicht.
 *
 * DER ABBAU WIRD NACHGEWIESEN, NICHT BEHAUPTET. DEV bedient die Live-Seite:
 * fuer die Dauer des Laufs steht ein Testbeitrag im Feed der eingeloggten
 * Mitglieder. Am Ende zaehlt die Sonde nach — Beitraege, Bildzeilen,
 * Storage-Objekte, Profil, Konto — und meldet einen liegengebliebenen Rest als
 * eigenen Fehler, getrennt von den Pruefungen.
 */
import { readFile } from "node:fs/promises";

import pg from "pg";
import { createClient } from "@supabase/supabase-js";

const LOKAL = {
  DB_URL: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
  API_URL: "http://127.0.0.1:54321",
  ANON_KEY:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0",
  SERVICE_KEY:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU",
};

const zielRef = process.argv.find((a) => a.startsWith("--dev="))?.slice("--dev=".length);

async function ziel() {
  if (!zielRef) return { ...LOKAL, name: "LOKAL, fest verdrahtet", lokal: true };

  const erwartet = (await readFile("scripts/dev-project-ref.txt", "utf8")).trim();
  if (zielRef !== erwartet) {
    throw new Error(
      `--dev=${zielRef} ist nicht das DEV-Projekt (erwartet ${erwartet}). Abbruch vor dem ersten Schreiben.`,
    );
  }
  const dbUrl = process.env.SUPABASE_DB_URL_DEV;
  const pat = process.env.SUPABASE_ACCESS_TOKEN;
  if (!dbUrl || !pat) {
    throw new Error(
      "SUPABASE_DB_URL_DEV und SUPABASE_ACCESS_TOKEN fehlen — mit `infisical run --env=dev --` starten.",
    );
  }
  const antwort = await fetch(
    `https://api.supabase.com/v1/projects/${zielRef}/api-keys?reveal=true`,
    { headers: { Authorization: `Bearer ${pat}` } },
  );
  if (!antwort.ok) throw new Error(`Management-API: HTTP ${antwort.status}`);
  const schluessel = (await antwort.json()) as { name: string; api_key: string }[];
  const hole = (name: string) => {
    const k = schluessel.find((s) => s.name === name)?.api_key;
    if (!k) throw new Error(`Kein ${name}-Schluessel fuer ${zielRef}`);
    return k;
  };
  return {
    DB_URL: dbUrl,
    API_URL: `https://${zielRef}.supabase.co`,
    ANON_KEY: hole("anon"),
    SERVICE_KEY: hole("service_role"),
    name: `DEV ${zielRef}`,
    lokal: false,
  };
}

const ZIEL = await ziel();
const { DB_URL, API_URL, ANON_KEY, SERVICE_KEY } = ZIEL;

const BUCKET = "post-media";
const PASSWORT = `sonde-9-3-${crypto.randomUUID()}`;
/** 1×1-WebP, 26 Bytes. Klein genug, dass nichts an der Groesse scheitert. */
const WEBP = Buffer.from("UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==", "base64");

let fehler = 0;
let abbauFehler = 0;

function pruefe(name: string, erwartet: string, gemessen: string, ok: boolean) {
  if (!ok) fehler += 1;
  console.log(`  ${ok ? "OK   " : "FEHLT"} ${name}`);
  console.log(`        erwartet: ${erwartet}`);
  console.log(`        gemessen: ${gemessen}`);
}

const anon = createClient(API_URL, ANON_KEY, { auth: { persistSession: false } });
const dienst = createClient(API_URL, SERVICE_KEY, { auth: { persistSession: false } });

const db = new pg.Client({
  connectionString: DB_URL,
  ...(ZIEL.lokal
    ? {}
    : { ssl: { ca: await readFile("scripts/supabase-root-2021-ca.crt", "utf8") } }),
});

let uid = "";
const pfade: Record<string, string> = {};
const beitraege: Record<string, string> = {};

try {
  console.log(`\nZiel: ${ZIEL.name}\n`);
  await db.connect();

  if (WEBP.subarray(0, 4).toString() !== "RIFF" || WEBP.subarray(8, 12).toString() !== "WEBP") {
    throw new Error("Das eingebettete Bild ist kein WebP — Abbruch vor dem ersten Schreiben.");
  }

  // ── Aufbau ────────────────────────────────────────────────────────────────
  const email = `sonde-9-3-${crypto.randomUUID()}@example.test`;
  const { data: konto, error: kontoFehler } = await dienst.auth.admin.createUser({
    email,
    password: PASSWORT,
    email_confirm: true,
  });
  if (kontoFehler || !konto.user) throw new Error(`Konto: ${kontoFehler?.message}`);
  uid = konto.user.id;

  await db.query(
    `insert into public.profiles (id, name, tier, activated_at)
     values ($1, 'Sonde 9.3', 'impact', now())
     on conflict (id) do update set name = 'Sonde 9.3', tier = 'impact', activated_at = now()`,
    [uid],
  );

  const autor = createClient(API_URL, ANON_KEY, { auth: { persistSession: false } });
  const login = await autor.auth.signInWithPassword({ email, password: PASSWORT });
  if (login.error) throw new Error(`Login: ${login.error.message}`);

  for (const sicht of ["members", "public"] as const) {
    const postId = crypto.randomUUID();
    const pfad = `${uid}/${postId}/0-${Date.now()}.webp`;
    const hoch = await autor.storage
      .from(BUCKET)
      .upload(pfad, WEBP, { contentType: "image/webp" });
    if (hoch.error) throw new Error(`Upload (${sicht}): ${hoch.error.message}`);

    const rpc = await autor.rpc("create_post_with_media", {
      p_post_id: postId,
      p_body: `Sonde 9.3 — ${sicht}. Wird sofort wieder abgeraeumt.`,
      p_visibility: sicht,
      p_hashtags: [],
      p_tags: [],
      p_media: [{ storage_path: pfad, sort: 0, width: 1, height: 1 }],
    });
    if (rpc.error) throw new Error(`RPC (${sicht}): ${rpc.error.message}`);
    pfade[sicht] = pfad;
    beitraege[sicht] = postId;
  }
  console.log(`Aufbau: zwei Beitraege (${beitraege.members}, ${beitraege.public})\n`);

  // ── Die fuenf Zeilen aus design.md, alle als anon ─────────────────────────
  console.log("Der Beweis, ausgeloggt (nur der anon-Key, keine Sitzung):\n");

  for (const sicht of ["members", "public"] as const) {
    const roh = await fetch(`${API_URL}/storage/v1/object/public/${BUCKET}/${pfade[sicht]}`);
    const istBild = roh.ok && (roh.headers.get("content-type") ?? "").startsWith("image/");
    pruefe(
      `${sicht}: rohe Storage-URL`,
      sicht === "members" ? "kein Bild" : "kein Bild (erwartet, der Bucket ist privat)",
      `HTTP ${roh.status}, content-type ${roh.headers.get("content-type") ?? "—"}`,
      !istBild,
    );
  }

  const feed = await anon.from("posts").select("id,visibility");
  const ids = (feed.data ?? []).map((p: { id: string }) => p.id);
  pruefe(
    "members: ausgeloggter Feed",
    "der Beitrag ist nicht dabei",
    feed.error
      ? `Abfrage abgelehnt: ${feed.error.message}`
      : `${ids.length} Beitraege sichtbar, davon members-Beitrag: ${ids.includes(beitraege.members)}`,
    !ids.includes(beitraege.members),
  );
  pruefe(
    "public: ausgeloggter Feed",
    "der Beitrag ist dabei",
    `public-Beitrag sichtbar: ${ids.includes(beitraege.public)}`,
    ids.includes(beitraege.public),
  );

  const sigM = await anon.storage.from(BUCKET).createSignedUrls([pfade.members], 60);
  const mErlaubt = !sigM.error && !!sigM.data?.[0]?.signedUrl;
  pruefe(
    "members: createSignedUrls als anon",
    "ABGELEHNT — keine Signatur",
    sigM.error
      ? `abgelehnt: ${sigM.error.message}`
      : `Eintrag: ${JSON.stringify(sigM.data?.[0]?.error ?? sigM.data?.[0]?.signedUrl?.slice(0, 40))}`,
    !mErlaubt,
  );

  const sigP = await anon.storage.from(BUCKET).createSignedUrls([pfade.public], 60);
  const url = sigP.data?.[0]?.signedUrl;
  if (!url) {
    pruefe(
      "public: ausgeloggt signieren und holen",
      "Signatur wird ausgestellt",
      `keine Signatur: ${sigP.error?.message ?? JSON.stringify(sigP.data?.[0]?.error)}`,
      false,
    );
  } else {
    const voll = url.startsWith("http") ? url : `${API_URL}/storage/v1${url}`;
    const bild = await fetch(voll);
    const bytes = Buffer.from(await bild.arrayBuffer());
    pruefe(
      "public: ausgeloggt signieren und holen",
      `Bild kommt an, ${WEBP.length} Bytes`,
      `HTTP ${bild.status}, ${bytes.length} Bytes, RIFF/WEBP: ${
        bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP"
      }`,
      bild.ok && bytes.length === WEBP.length,
    );
  }
} catch (e) {
  fehler += 1;
  console.log(`\nABBRUCH: ${(e as Error).message}`);
} finally {
  // ── Abbau, und danach nachzaehlen ─────────────────────────────────────────
  console.log("\nAbbau:");
  try {
    if (Object.keys(pfade).length) {
      await dienst.storage.from(BUCKET).remove(Object.values(pfade));
    }
    if (uid) {
      await db.query("delete from public.posts where author_id = $1", [uid]);
      await db.query("delete from public.profiles where id = $1", [uid]);
      await dienst.auth.admin.deleteUser(uid);
    }

    const rest = await db.query(
      `select
         (select count(*) from public.posts where author_id = $1) as beitraege,
         (select count(*) from public.post_media
            where storage_path like $2) as bildzeilen,
         (select count(*) from storage.objects
            where bucket_id = $3 and name like $2) as objekte,
         (select count(*) from public.profiles where id = $1) as profile,
         (select count(*) from auth.users where id = $1) as konten`,
      [uid || "00000000-0000-0000-0000-000000000000", `${uid}/%`, BUCKET],
    );
    const r = rest.rows[0];
    const sauber = Object.values(r).every((v) => Number(v) === 0);
    if (!sauber) abbauFehler += 1;
    console.log(
      `  ${sauber ? "OK   " : "REST "} nachgezaehlt: Beitraege ${r.beitraege}, Bildzeilen ${r.bildzeilen}, ` +
        `Storage-Objekte ${r.objekte}, Profil ${r.profile}, Konto ${r.konten}`,
    );
  } catch (e) {
    abbauFehler += 1;
    console.log(`  REST  Abbau fehlgeschlagen: ${(e as Error).message}`);
  }
  await db.end().catch(() => {});
}

console.log(
  `\n${fehler === 0 ? "Alle Pruefungen erfuellt." : `${fehler} Pruefung(en) offen.`}` +
    `${abbauFehler ? ` ABER: ${abbauFehler} Rest liegen geblieben.` : ""}\n`,
);
process.exit(fehler === 0 && abbauFehler === 0 ? 0 : 1);
