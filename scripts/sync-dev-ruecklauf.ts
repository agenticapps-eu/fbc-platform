#!/usr/bin/env tsx
/**
 * Aufgabengruppe 4 des Spiegels DEV ← PROD (AGE-576) — der Rücklauf.
 *
 *   npx tsx scripts/sync-dev-ruecklauf.ts --ziel=lokal <ablage>
 *   infisical run --env=prod -- npx tsx scripts/sync-dev-ruecklauf.ts --ziel=dev <ablage>
 *
 * `--sicherung` lässt 4.13 **und** den DEV-Bestand aus 4.9/4.10 aus und stellt
 * damit genau den Bestand des Manifests her — anmeldefähig, ohne Dekoration
 * (5.6). Gegen `--ziel=dev` ist der Schalter abgelehnt, nicht bloss abgeraten;
 * die Begründung steht bei `pruefeSicherungslauf`.
 *
 * **Dieser Lauf löscht.** Er leert `auth`, `public` und alle Buckets des Ziels
 * und ersetzt sie durch den Auszug. `--ziel` hat keinen Vorgabewert: wer nichts
 * angibt, bekommt einen Abbruch, keine Vermutung.
 *
 * FÜNF ENTSCHEIDUNGEN, DIE IM KOPF STEHEN.
 *
 * 1. **Der Auszug wird VOLLSTÄNDIG geprüft, bevor irgendetwas gelöscht wird** —
 *    inklusive sha256 über jedes Objekt auf der Platte. Ein unvollständiger
 *    Auszug plus ein geleertes Ziel ist der einzige Zustand ohne Rückweg.
 *
 * 2. **`session_replication_role` wird gesetzt UND nachgelesen.** Über den
 *    Pooler verschluckt Supavisor jede Startup-Option lautlos (Decision 2b).
 *    Ein Schalter, den man setzt und nicht nachsieht, ist hier eine Vermutung —
 *    und die falsche Vermutung schreibt mit lebenden Triggern.
 *
 * 3. **Die Buckets werden über die Storage-API geleert, ausserhalb der
 *    replica-Sitzung.** Der Trigger `protect_delete` verbietet die direkte
 *    Löschung mit einer Begründung, die stimmt: sie liesse das Blob im S3
 *    zurück. Im replica-Modus schwiege er, und bei jedem Lauf kämen 125
 *    Waisen dazu.
 *
 * 4. **Der DEV-eigene Bestand folgt einer Regel, keiner Namensliste.** Fünf
 *    echte Mitgliedsadressen ins öffentliche Repository zu schreiben wäre der
 *    Fehler, den 2a gerade behoben hat. Die Auswahl ist deterministisch
 *    (kleinste `auth.users.id`) und deshalb über Läufe hinweg dieselbe.
 *    **Die Admin-Konten sind ausgenommen:** `has_level` kennt keine
 *    Admin-Ausnahme, ein Admin auf `basic` sähe ein leeres Verzeichnis.
 *
 * 5. **Jeder Schritt hinterlässt einen Beleg, keine Behauptung.** Das Protokoll
 *    ist die Abnahme; wo eine Zusage nicht messbar war, steht das da.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import pg from "pg";

import { sichererPfad } from "./sync-dev-auszug.logic";
import {
  authTabellenZumLeeren,
  entferneRestrict,
  planeLeeren,
  pruefeAuszug,
  pruefeSicherungslauf,
  vergleicheManifest,
  type Deklaration,
  type Manifest,
} from "./sync-dev-ruecklauf.logic";
import { pruefeLauf, wertMitNamen, type Zugang } from "./sync-dev.logic";

const HIER = dirname(fileURLToPath(import.meta.url));
const CA = join(HIER, "supabase-root-2021-ca.crt");
/** §3a: was DEV zusätzlich zum Spiegel trägt. */
const DEKLARATION: Deklaration = {
  zusatzZeilen: { "public.staff_roles": 1 },
  hashWeichtAb: ["public.profiles", "auth.users"],
};
const STUFEN = ["basic", "connect", "discover", "exchange", "focus"] as const;

const ende: (grund: string) => never = (grund) => {
  console.error(`::error::${grund}`);
  process.exit(1);
};
const schritt = (text: string) => console.log(`\n── ${text}`);
const beleg = (text: string) => console.log(`   ✔ ${text}`);

// ── Argumente ─────────────────────────────────────────────────────────────────
const zielArt = process.argv.find((a) => a.startsWith("--ziel="))?.slice("--ziel=".length);
if (zielArt !== "lokal" && zielArt !== "dev") {
  ende("--ziel=lokal oder --ziel=dev ist Pflicht. Ohne Angabe wird nichts vermutet.");
}
const sicherungsSchalter = pruefeSicherungslauf({
  zielArt,
  sicherung: process.argv.includes("--sicherung"),
});
if (sicherungsSchalter.kind === "abbruch") ende(sicherungsSchalter.grund);
const { neutralisieren, devBestand } = sicherungsSchalter;

const ablage = process.argv.find((a) => !a.startsWith("-") && a.endsWith("Z"));
if (!ablage) ende("Kein Ablageverzeichnis angegeben.");
const ablagePfad = resolve(ablage);

// ── Ziel bestimmen und prüfen ─────────────────────────────────────────────────
const hole = (...k: string[]) => wertMitNamen(process.env, k)?.wert;
let zielDbUrl: string;
let zielApiUrl: string;
let zielKey: string;

if (zielArt === "lokal") {
  // 127.0.0.1 ist als Unterscheidung tragfähig, wo ein Hostname es nicht wäre:
  // nichts Entferntes kann die Loopback-Adresse sein.
  zielDbUrl = process.env.LOKAL_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
  zielApiUrl = process.env.LOKAL_API_URL ?? "http://127.0.0.1:54321";
  zielKey = process.env.LOKAL_SERVICE_KEY ?? "";
  const h = new URL(zielDbUrl).hostname;
  if (h !== "127.0.0.1" && h !== "localhost") ende(`--ziel=lokal, aber die DB-URL zeigt auf ${h}.`);
  if (new URL(zielApiUrl).hostname !== "127.0.0.1")
    ende("--ziel=lokal, aber die API-URL ist nicht lokal.");
  if (!zielKey) ende("LOKAL_SERVICE_KEY fehlt (aus `supabase status`).");
  beleg(`Ziel ist der lokale Stack (${h})`);
} else {
  const ref = (u: "prod" | "dev") =>
    readFileSync(join(HIER, `${u}-project-ref.txt`), "utf8").trim();
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
  const w = pruefeLauf({ quelle, ziel, prodRef: ref("prod"), devRef: ref("dev") });
  if (w.kind === "abbruch") ende(w.grund);
  zielDbUrl = ziel.dbUrl!;
  zielApiUrl = ziel.apiUrl!;
  zielKey = ziel.serviceKey!;
  beleg(`Wächter frei: Ziel ${w.zielRef} (DEV)`);
}

// ── 1. Der Auszug, vollständig, VOR dem Löschen ───────────────────────────────
schritt("Auszug prüfen — vor jedem Löschen");
const dateien = await readdir(ablagePfad);
const manifest = await readFile(join(ablagePfad, "manifest.json"), "utf8")
  .then((t) => JSON.parse(t) as Manifest)
  .catch(() => null);
const erwarteteQuelle = readFileSync(join(HIER, "prod-project-ref.txt"), "utf8").trim();
const geprueft = pruefeAuszug({ vorhandeneDateien: dateien, manifest, erwarteteQuelle });
if (geprueft.kind === "abbruch") ende(geprueft.grund);
const soll = geprueft.manifest;
beleg(`Auszug aus ${soll.quelle}, Snapshot ${soll.snapshot}`);

const objektWurzel = join(ablagePfad, "objekte");
for (const o of soll.objekte) {
  const p = sichererPfad(objektWurzel, o.bucket, o.name);
  if (p.kind === "abbruch") ende(`Objekt abgelehnt: ${p.grund}`);
  let bytes: Buffer;
  try {
    bytes = await readFile(p.pfad);
  } catch {
    ende(`Objekt fehlt auf der Platte: ${o.bucket}/${o.name}`);
  }
  if (
    bytes.byteLength !== o.groesse ||
    createHash("sha256").update(bytes).digest("hex") !== o.sha256
  ) {
    ende(`Objekt weicht vom Manifest ab: ${o.bucket}/${o.name}`);
  }
}
beleg(`${soll.objekte.length} Objekte byteweise gegen das Manifest bestätigt`);
const roh = {
  auth: await readFile(join(ablagePfad, "auth.sql"), "utf8"),
  public: await readFile(join(ablagePfad, "public.sql"), "utf8"),
};
if (/session_replication_role/i.test(roh.auth + roh.public)) {
  ende("Der Auszug dreht selbst an session_replication_role — das war beim Erzeugen nicht so.");
}
const gesaeubert = Object.fromEntries(
  Object.entries(roh).map(([name, text]) => {
    const e = entferneRestrict(text);
    if (e.kind === "abbruch") ende(`${name}.sql: ${e.grund}`);
    return [name, e.sql];
  }),
) as { auth: string; public: string };
const authSql = gesaeubert.auth;
const publicSql = gesaeubert.public;
beleg(
  `auth.sql (${roh.auth.length} B) und public.sql (${roh.public.length} B) fassen den Schalter nicht an; psql-Metabefehle entfernt`,
);

// ── 2. Buckets leeren — Storage-API, ausserhalb der replica-Sitzung ───────────
const speicher: SupabaseClient = createClient(zielApiUrl, zielKey, {
  auth: { persistSession: false },
});
const lokal = zielArt === "lokal";
const db = new pg.Client({
  connectionString: zielDbUrl,
  ...(lokal ? {} : { ssl: { ca: await readFile(CA, "utf8") } }),
});
await db.connect();

schritt("Buckets leeren — über die Storage-API, nicht per SQL");
const zielBuckets = (await db.query("select id from storage.buckets order by id")).rows.map(
  (r) => r.id as string,
);
for (const bucket of zielBuckets) {
  const namen = (
    await db.query("select name from storage.objects where bucket_id = $1 order by name", [bucket])
  ).rows.map((r) => r.name as string);
  for (let i = 0; i < namen.length; i += 100) {
    const teil = namen.slice(i, i + 100);
    const { error } = await speicher.storage.from(bucket).remove(teil);
    if (error) ende(`Bucket ${bucket} leeren: ${error.message}`);
  }
  const rest = (
    await db.query("select count(*)::int as n from storage.objects where bucket_id=$1", [bucket])
  ).rows[0].n;
  if (rest !== 0) ende(`Bucket ${bucket} trägt nach dem Leeren noch ${rest} Objekte.`);
  beleg(`${bucket}: ${namen.length} Objekte entfernt, 0 übrig`);
}

// ── 3. Die gehaltene Sitzung ──────────────────────────────────────────────────
schritt("Trigger stilllegen — gesetzt UND nachgelesen");
const triggerVorher = (
  await db.query(`select n.nspname||'.'||c.relname||'::'||t.tgname as k, t.tgenabled as e
                    from pg_trigger t join pg_class c on c.oid=t.tgrelid
                    join pg_namespace n on n.oid=c.relnamespace
                   where not t.tgisinternal and n.nspname in ('public','auth','storage') order by 1`)
).rows;
beleg(
  `${triggerVorher.length} nicht-interne Trigger, alle tgenabled='O': ${triggerVorher.every((t) => t.e === "O")}`,
);

await db.query("set session_replication_role = replica");
const schalter = (await db.query("select current_setting('session_replication_role') as v")).rows[0]
  .v;
if (schalter !== "replica") ende(`session_replication_role steht auf "${schalter}" statt replica.`);
beleg("session_replication_role = replica — nachgelesen, nicht angenommen");

schritt("Leeren");
const publicTabellen = (
  await db.query(`select table_name from information_schema.tables
                   where table_schema='public' and table_type='BASE TABLE' order by 1`)
).rows.map((r) => r.table_name as string);
const authTabellen = authTabellenZumLeeren(
  (
    await db.query(`select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
                     where n.nspname='auth' and c.relkind='r' order by 1`)
  ).rows.map((r) => r.relname as string),
);
for (const sql of planeLeeren(publicTabellen, authTabellen)) await db.query(sql);
const restProfile = (await db.query("select count(*)::int as n from public.profiles")).rows[0].n;
if (restProfile !== 0) ende(`Nach dem Leeren trägt public.profiles noch ${restProfile} Zeilen.`);

// Die Zusage, die am 2026-08-20 gefehlt hat: nicht „auth.users ist leer",
// sondern **jede** geleerte auth-Tabelle ist leer. Der Abbruch kam damals erst
// vier Schritte später aus der Fremdschlüsselprüfung, mit einem bereits
// halb eingespielten Ziel.
const nochBelegt: string[] = [];
for (const t of authTabellen) {
  const n = (await db.query(`select count(*)::int as n from ${t.replace(".", '."')}"`)).rows[0].n;
  if (n > 0) nochBelegt.push(`${t}=${n}`);
}
if (nochBelegt.length > 0) {
  ende(
    `Nach dem Leeren tragen auth-Tabellen noch Zeilen: ${nochBelegt.join(", ")}. ` +
      "Im replica-Modus verschwindet nur, was benannt wird.",
  );
}
beleg(
  `${publicTabellen.length} public-Tabellen und ${authTabellen.length} auth-Tabellen geleert (${authTabellen.join(", ")}), alle nachgezählt auf 0`,
);

schritt("auth zurückspielen — Konten UND Identitäten");
await db.query(authSql);
const nachAuth = (await db.query("select count(*)::int as n from auth.users")).rows[0].n;
const identitaeten = (await db.query("select count(*)::int as n from auth.identities")).rows[0].n;
beleg(`auth.users=${nachAuth}, auth.identities=${identitaeten}`);

// 4.5 — die Zusage, die den Kunstgriff ersetzt hat
const vomTrigger = (await db.query("select count(*)::int as n from public.profiles")).rows[0].n;
if (vomTrigger !== 0) {
  ende(
    `4.5 verletzt: nach dem auth-Rücklauf trägt public.profiles ${vomTrigger} Zeilen — der Trigger on_auth_user_created hat gefeuert.`,
  );
}
beleg("4.5: public.profiles ist leer — on_auth_user_created hat nicht gefeuert");

schritt("public zurückspielen");
await db.query(publicSql);
beleg(`public eingespielt`);

await db.query("reset session_replication_role");
const zurueck = (await db.query("select current_setting('session_replication_role') as v")).rows[0]
  .v;
if (zurueck !== "origin") ende(`session_replication_role steht nach dem Lauf auf "${zurueck}".`);
beleg("4.1a: session_replication_role wieder origin");
await db.end();

// ── 4. Nach der Sitzung: eine frische Verbindung, die nichts geerbt hat ───────
const db2 = new pg.Client({
  connectionString: zielDbUrl,
  ...(lokal ? {} : { ssl: { ca: await readFile(CA, "utf8") } }),
});
await db2.connect();

schritt("4.1a/4.1b: Trigger und Fremdschlüssel");
const triggerNachher = (
  await db2.query(`select n.nspname||'.'||c.relname||'::'||t.tgname as k, t.tgenabled as e
                     from pg_trigger t join pg_class c on c.oid=t.tgrelid
                     join pg_namespace n on n.oid=c.relnamespace
                    where not t.tgisinternal and n.nspname in ('public','auth','storage') order by 1`)
).rows;
const verloren = triggerVorher
  .filter((v) => !triggerNachher.some((n) => n.k === v.k))
  .map((v) => v.k);
const abgeschaltet = triggerNachher.filter((t) => t.e !== "O").map((t) => t.k);
if (verloren.length || abgeschaltet.length) {
  ende(
    `Trigger verloren: ${verloren.join(", ") || "keine"} · nicht mehr 'O': ${abgeschaltet.join(", ") || "keine"}`,
  );
}
beleg(`${triggerNachher.length} Trigger stehen unverändert auf 'O'`);

// 4.1b — im replica-Modus schweigen auch die internen RI-Trigger. Was sich
// vorher von selbst ergab, ist jetzt eine Zusage, die jemand aussprechen muss.
const fks = (
  await db2.query(`select con.conname, cn.nspname as ks, cc.relname as kt, tn.nspname as es, tc.relname as et,
                          (select array_agg(a.attname order by u.ord) from unnest(con.conkey) with ordinality u(att, ord)
                             join pg_attribute a on a.attrelid=con.conrelid and a.attnum=u.att)::text[] as kspalten,
                          (select array_agg(a.attname order by u.ord) from unnest(con.confkey) with ordinality u(att, ord)
                             join pg_attribute a on a.attrelid=con.confrelid and a.attnum=u.att)::text[] as espalten
                     from pg_constraint con
                     join pg_class cc on cc.oid=con.conrelid join pg_namespace cn on cn.oid=cc.relnamespace
                     join pg_class tc on tc.oid=con.confrelid join pg_namespace tn on tn.oid=tc.relnamespace
                    where con.contype='f' and cn.nspname in ('public','auth') order by 1`)
).rows;
const waisen: string[] = [];
for (const f of fks) {
  const k = (f.kspalten as string[]).map((c) => `k."${c}"`);
  const e = (f.espalten as string[]).map((c) => `e."${c}"`);
  const on = k.map((s, i) => `${s} = ${e[i]}`).join(" and ");
  const nichtNull = k.map((s) => `${s} is not null`).join(" and ");
  const n = (
    await db2.query(`select count(*)::int as n from ${f.ks}."${f.kt}" k
                      left join ${f.es}."${f.et}" e on ${on}
                      where ${nichtNull} and ${e[0]} is null`)
  ).rows[0].n;
  if (n > 0) waisen.push(`${f.conname} (${f.ks}.${f.kt} → ${f.es}.${f.et}): ${n}`);
}
if (waisen.length) ende(`4.1b verletzt — verwaiste Zeilen: ${waisen.join("; ")}`);
beleg(`4.1b: ${fks.length} Fremdschlüssel eigens geprüft, keine verwaiste Zeile`);

// 4.8a — steht in keiner Migration; still verloren sähe aus wie ein sauberer Lauf
schritt("4.8a: was in keiner Migration steht");
for (const [art, name] of [
  ["function", "notify_contact_request_webhook"],
  ["trigger", "contact_requests_email_webhook"],
] as const) {
  const da =
    art === "function"
      ? (
          await db2.query(
            "select count(*)::int as n from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=$1",
            [name],
          )
        ).rows[0].n
      : (
          await db2.query(
            "select count(*)::int as n from pg_trigger where tgname=$1 and not tgisinternal",
            [name],
          )
        ).rows[0].n;
  if (da === 0) console.warn(`   ! ${art} ${name} FEHLT — auf diesem Ziel nicht vorhanden`);
  else beleg(`${art} ${name} steht noch`);
}

// ── 5. Objekte hochladen ──────────────────────────────────────────────────────
schritt("4.8: Objekte schreiben — upsert: false");
let hoch = 0;
for (const o of soll.objekte) {
  const p = sichererPfad(objektWurzel, o.bucket, o.name);
  if (p.kind === "abbruch") ende(p.grund);
  const bytes = await readFile(p.pfad);
  // `contentType` aus dem Manifest, nicht geraten: die Buckets führen eine
  // Positivliste erlaubter Typen, und ohne Angabe schickt der Klient
  // `text/plain` — den sie zurückweist.
  const { error } = await speicher.storage.from(o.bucket).upload(o.name, bytes, {
    upsert: false,
    ...(o.mimetype ? { contentType: o.mimetype } : {}),
  });
  if (error) ende(`Objekt ${o.bucket}/${o.name}: ${error.message}`);
  hoch += 1;
}
beleg(`${hoch} Objekte geschrieben`);

// ── 6. 4.13 Hashes neutralisieren ─────────────────────────────────────────────
if (neutralisieren) {
  schritt("4.13: Produktions-Passwort-Hashes neutralisieren");
  const neutral = (
    await db2.query(`update auth.users
                        set encrypted_password = crypt(gen_random_uuid()::text, gen_salt('bf'))
                      where encrypted_password is not null
                      returning 1`)
  ).rowCount;
  beleg(`${neutral} Hashes durch Zufallswerte ersetzt`);
} else {
  // 5.6: der Rückweg. Hier steht der Bestand anmeldefähig — das ist der Zweck
  // und zugleich das, was auf DEV nie passieren darf (siehe pruefeSicherungslauf).
  schritt("4.13 ausgelassen — SICHERUNGSLAUF, die Hashes bleiben echt");
  const echt = (
    await db2.query(
      "select count(*)::int as n from auth.users where encrypted_password is not null",
    )
  ).rows[0].n;
  beleg(`${echt} Konten behalten ihren Produktions-Hash und sind anmeldefähig`);
}

// ── 7. 4.9/4.10 Der deklarierte DEV-Bestand ───────────────────────────────────
if (!devBestand) {
  // 5.6: im Sicherungslauf entfällt er ganz. Stufen und die
  // matching_manager-Zeile sind DEV-Dekoration; im Manifest stehen sie nicht.
  schritt("4.9/4.10 ausgelassen — SICHERUNGSLAUF, kein DEV-Bestand");
  beleg("Stufen und matching_manager bleiben, wie der Auszug sie trägt");
} else {
  schritt("4.9/4.10: den deklarierten DEV-Bestand herstellen");
  const admins = (
    await db2.query(
      "select profile_id from public.staff_roles where role='admin' order by profile_id",
    )
  ).rows.map((r) => r.profile_id as string);
  beleg(`${admins.length} Admin-Zeilen aus dem Auszug übernommen`);

  const frei = (
    await db2.query(
      `select id from public.profiles
      where id <> all($1::uuid[])
      order by id`,
      [admins],
    )
  ).rows.map((r) => r.id as string);
  if (frei.length < STUFEN.length + 1)
    ende(`Nur ${frei.length} freie Konten — zu wenig für Stufen und matching_manager.`);

  // Die Zeitstempel des Zuschlags werden auf den Auszug festgenagelt, statt
  // `now()` zu nehmen. Sonst wanderte der Zielzustand von Lauf zu Lauf, und die
  // Idempotenz-Zusage aus 5.4 — zweimal derselbe Auszug, zweimal derselbe
  // Zeilenhash — liesse sich gar nicht mehr prüfen. Der Zuschlag ist eine
  // Vorrichtung, kein Vorgang; er darf kein „wann" tragen.
  const stempel = soll.erzeugt ?? new Date(0).toISOString();
  const managerId = frei[0];
  await db2.query(
    `insert into public.staff_roles (profile_id, role, created_at) values ($1,'matching_manager',$2)
     on conflict (profile_id) do update set role=excluded.role, created_at=excluded.created_at`,
    [managerId, stempel],
  );
  beleg(
    `matching_manager auf einem dritten Konto (…${managerId.slice(-6)}) — nicht auf einem Admin`,
  );

  const fuerStufen = frei.slice(1, 1 + STUFEN.length);
  // `profiles_set_updated_at` würde `updated_at` auf `now()` ziehen. Im
  // replica-Modus schweigt er, und der Wert bleibt der des Auszugs — dieselbe
  // Überlegung wie beim Zeitstempel oben.
  await db2.query("set session_replication_role = replica");
  for (let i = 0; i < STUFEN.length; i += 1) {
    await db2.query("update public.profiles set tier=$1 where id=$2", [STUFEN[i], fuerStufen[i]]);
  }
  await db2.query("reset session_replication_role");
  if (
    (await db2.query("select current_setting('session_replication_role') as v")).rows[0].v !==
    "origin"
  ) {
    ende("session_replication_role blieb nach dem Zuschlag auf replica.");
  }
  beleg(
    `Stufen besetzt: ${STUFEN.join(", ")} — Admins ausgenommen (has_level kennt keine Admin-Ausnahme)`,
  );
  const jeStufe = (
    await db2.query("select tier, count(*)::int as n from public.profiles group by 1 order by 1")
  ).rows;
  beleg(`Verteilung: ${jeStufe.map((r) => `${r.tier}=${r.n}`).join(", ")}`);

  // 4.11 — admin_roles.sql prüft sich nicht selbst; der Rollensatz wird verglichen
  const rollen = (
    await db2.query("select role, count(*)::int as n from public.staff_roles group by 1 order by 1")
  ).rows;
  beleg(`4.11: Rollensatz ist ${rollen.map((r) => `${r.role}=${r.n}`).join(", ")}`);
  const ohneKonto = (
    await db2.query(
      "select count(*)::int as n from public.staff_roles s left join auth.users u on u.id=s.profile_id where u.id is null",
    )
  ).rows[0].n;
  if (ohneKonto > 0) ende(`4.12: ${ohneKonto} Rollenzeile(n) zeigen auf kein Konto.`);
  beleg("4.12: jede Rollenzeile zeigt auf ein vorhandenes Konto");
}

// ── 8. Abnahme ────────────────────────────────────────────────────────────────
schritt("5.3: Abnahme gegen das Manifest des Auszugs");
const ist: Record<string, { zeilen: number; hash: string }> = {};
for (const voll of Object.keys(soll.tabellen)) {
  const [schema, name] = voll.split(".");
  const r = (
    await db2.query(`select count(*)::int as zeilen,
                            coalesce(md5(string_agg(h,'' order by h)),'-') as hash
                       from (select md5(x::text) as h from ${schema}."${name}" x) s`)
  ).rows[0];
  ist[voll] = { zeilen: r.zeilen, hash: r.hash };
}
// Im Sicherungslauf ist nichts deklariert, weil nichts abweichen darf: der
// Bestand des Manifests soll entstehen, nicht ein DEV-Bestand mit echten
// Hashes. Null Abweichungen ist hier die Zusage, nicht zwei.
const abnahme = vergleicheManifest({
  soll,
  ist,
  deklaration: devBestand ? DEKLARATION : { zusatzZeilen: {}, hashWeichtAb: [] },
});
for (const d of abnahme.deklariert) console.log(`   · gewollt abweichend: ${d.was} (${d.grund})`);
if (abnahme.unerwartet.length > 0) {
  for (const u of abnahme.unerwartet)
    console.error(`   ✗ ${u.was}: ${u.grund} soll=${u.soll} ist=${u.ist}`);
  ende(`${abnahme.unerwartet.length} unerwartete Abweichung(en).`);
}
const objekteIst = (await db2.query("select count(*)::int as n from storage.objects")).rows[0].n;
if (objekteIst !== soll.objekte.length)
  ende(`Objekte: ${objekteIst} statt ${soll.objekte.length}.`);
beleg(
  `${Object.keys(ist).length} Tabellen und ${objekteIst} Objekte stimmen; ${abnahme.deklariert.length} gewollte Abweichungen benannt`,
);

await db2.end();
console.log(`\nFertig. Ziel: ${zielArt}. Auszug: ${ablagePfad}`);
