#!/usr/bin/env tsx
/**
 * Beweis-Sonde fuer C7 (AGE-528), offene Frage aus der Uebergabe.
 *
 *   tsx scripts/probe-rpc-create-post.ts
 *
 * DIE FRAGE. `create_post_with_media()` ist gruen — aber nur in pgTAP, also
 * unter `set local role authenticated` in einer psql-Sitzung. Ueber PostgREST
 * ist sie **nie** gerufen worden. Genau dazwischen liegt die Fehlerklasse, die
 * dieses Repo teuer bezahlt hat: `service_role` haelt auf keiner Tabelle in
 * `public` ein Recht, und das haben drei Testsuiten und zwei Reviews
 * ueberstanden — gefunden hat es erst der echte Aufruf.
 *
 * Ueber PostgREST kann anders schiefgehen, was in psql laeuft:
 *  - Argumentnamen: PostgREST waehlt die Funktion ueber die NAMEN der Keys.
 *    Ein Tippfehler ergibt „function not found", kein falsches Ergebnis.
 *  - `p_media` reist als JSON-Array und muss serverseitig `jsonb` werden.
 *  - EXECUTE fuer `authenticated` muss ausgesprochen sein.
 *
 * Die Sonde misst deshalb den ganzen Weg: echter Login, echter Client, echter
 * Aufruf — und danach, ob Beitrag UND Bildzeilen wirklich dastehen.
 *
 * Dazu die beiden Ablehnungen, die die RPC tragen muss:
 *  - ein UNBESTAETIGTES Konto darf nicht veroeffentlichen (`is_activated()`),
 *  - sieben Bilder muessen den ganzen Beitrag zuruecknehmen (Trigger), nicht
 *    nur das siebte.
 *
 * NUR LOKAL. Adressen fest verdrahtet; die Sonde legt Konten und Zeilen an und
 * raeumt sie wieder ab.
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

const PASSWORT = "sonde-c7-nur-lokal";
const db = new pg.Client(DB_URL);
const dienst = createClient(API_URL, SERVICE_KEY, { auth: { persistSession: false } });

const angelegt: string[] = [];
let erfolg = true;

function pruefe(name: string, ok: boolean, gemessen: string) {
  if (!ok) erfolg = false;
  console.log(`${ok ? "  OK  " : " FEHL "} ${name}: ${gemessen}`);
}

/** Konto anlegen, Profil auf `tier` und Aktivierung setzen, einloggen. */
async function mitglied(name: string, aktiviert: boolean) {
  const email = `sonde-c7-${crypto.randomUUID()}@example.test`;
  const { data, error } = await dienst.auth.admin.createUser({
    email,
    password: PASSWORT,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`Konto: ${error?.message}`);
  const uid = data.user.id;
  angelegt.push(uid);

  await db.query(
    `insert into public.profiles (id, name, tier, activated_at)
     values ($1, $2, 'impact', case when $3 then now() else null end)
     on conflict (id) do update set tier = 'impact',
       activated_at = case when $3 then now() else null end`,
    [uid, name, aktiviert],
  );

  const client = createClient(API_URL, ANON_KEY, { auth: { persistSession: false } });
  const login = await client.auth.signInWithPassword({ email, password: PASSWORT });
  if (login.error) throw new Error(`Login: ${login.error.message}`);
  return { uid, client };
}

const bild = (uid: string, postId: string, i: number) => ({
  storage_path: `${uid}/${postId}/${i}-1.webp`,
  sort: i,
  width: 1600,
  height: 1200,
});

try {
  await db.connect();
  const wirt = (await db.query("select inet_server_addr()::text as adresse")).rows[0].adresse;
  if (wirt !== null && wirt !== "127.0.0.1" && !wirt.startsWith("172.") && wirt !== "::1") {
    throw new Error(`Nicht der lokale Stack (${wirt}) — Abbruch vor dem ersten Schreiben.`);
  }

  // ── A · Der gute Fall: bestaetigtes Mitglied, zwei Bilder, zwei Tag-Quellen
  const autor = await mitglied("C7-Sonde", true);
  const postId = crypto.randomUUID();
  const a = await autor.client.rpc("create_post_with_media", {
    p_post_id: postId,
    p_body: "Sonde: Erlebnistag mit #Netzwerken",
    p_visibility: "members",
    p_hashtags: ["netzwerken"],
    p_tags: ["netzwerken", "erlebnistag"],
    p_media: [bild(autor.uid, postId, 0), bild(autor.uid, postId, 1)],
    p_veroeffentlicht_ab: null,
  });
  pruefe(
    "A PostgREST findet die Funktion und nimmt sie an",
    a.error === null,
    a.error ? `${a.error.code} ${a.error.message}` : "kein Fehler",
  );

  const zeilen = await db.query(
    `select p.hashtags, (select count(*) from public.post_media m where m.post_id = p.id) as bilder
       from public.posts p where p.id = $1`,
    [postId],
  );
  pruefe(
    "A Beitrag und beide Bildzeilen stehen da",
    zeilen.rows.length === 1 && Number(zeilen.rows[0]?.bilder) === 2,
    `${zeilen.rows.length} Beitrag, ${zeilen.rows[0]?.bilder ?? 0} Bildzeilen`,
  );
  pruefe(
    "A getippt UND geklickt ergibt den Tag genau einmal",
    JSON.stringify(zeilen.rows[0]?.hashtags) === JSON.stringify(["netzwerken", "erlebnistag"]),
    JSON.stringify(zeilen.rows[0]?.hashtags),
  );

  // ── B · Sieben Bilder nehmen den GANZEN Beitrag zurueck, nicht nur das siebte
  const zuviel = crypto.randomUUID();
  const b = await autor.client.rpc("create_post_with_media", {
    p_post_id: zuviel,
    p_body: "Sonde: sieben Bilder",
    p_visibility: "members",
    p_hashtags: [],
    p_tags: [],
    p_media: Array.from({ length: 7 }, (_, i) => bild(autor.uid, zuviel, i)),
    p_veroeffentlicht_ab: null,
  });
  const uebrig = await db.query("select 1 from public.posts where id = $1", [zuviel]);
  pruefe(
    "B das siebte Bild nimmt den Beitrag mit zurueck",
    b.error !== null && uebrig.rows.length === 0,
    b.error ? `abgelehnt („${b.error.message}"), kein Beitrag uebrig` : "durchgelassen!",
  );

  // ── C · Unbestaetigtes Konto darf gar nicht veroeffentlichen
  const gesperrt = await mitglied("C7-Sonde ohne Bestaetigung", false);
  const c = await gesperrt.client.rpc("create_post_with_media", {
    p_post_id: crypto.randomUUID(),
    p_body: "Sonde: unbestaetigt",
    p_visibility: "members",
    p_hashtags: [],
    p_tags: [],
    p_media: [],
    p_veroeffentlicht_ab: null,
  });
  pruefe(
    "C unbestaetigtes Konto wird abgewiesen",
    c.error !== null,
    c.error ? `abgelehnt („${c.error.message}")` : "durchgelassen!",
  );

  // ── D · anon darf die RPC gar nicht erst rufen
  const anon = createClient(API_URL, ANON_KEY, { auth: { persistSession: false } });
  const d = await anon.rpc("create_post_with_media", {
    p_post_id: crypto.randomUUID(),
    p_body: "Sonde: anon",
    p_visibility: "public",
    p_hashtags: [],
    p_tags: [],
    p_media: [],
    p_veroeffentlicht_ab: null,
  });
  pruefe(
    "D ohne Session fehlt schon das Ausfuehrungsrecht",
    d.error !== null,
    d.error ? `abgelehnt („${d.error.message}")` : "durchgelassen!",
  );
} catch (fehler) {
  erfolg = false;
  console.error("\nABBRUCH:", fehler instanceof Error ? fehler.message : fehler);
} finally {
  for (const uid of angelegt) {
    await db.query("delete from public.posts where author_id = $1", [uid]).catch(() => {});
    await dienst.auth.admin.deleteUser(uid).catch(() => {});
    await db.query("delete from public.profiles where id = $1", [uid]).catch(() => {});
  }
  await db.end().catch(() => {});
}

console.log(erfolg ? "\nALLE PRUEFUNGEN ERFUELLT\n" : "\nMINDESTENS EINE PRUEFUNG GEFEHLT\n");
process.exit(erfolg ? 0 : 1);
