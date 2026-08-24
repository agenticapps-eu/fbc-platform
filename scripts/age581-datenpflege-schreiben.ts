#!/usr/bin/env tsx
/**
 * SCHREIBT auf PROD. Die Datenpflege aus AGE-581, Abschnitt 12.1 bis 12.6.
 *
 * Der Trockenlauf (`probe-age581-datenpflege-trockenlauf.ts`) sagt, was
 * geschähe; dieses Skript tut es. Beide teilen sich den Rechenkern, damit
 * „geplant" und „getan" nicht auseinanderlaufen können.
 *
 * ══ EIN SCHRITT JE AUFRUF ══════════════════════════════════════════════════
 * Nicht aus Bequemlichkeit: die sechs Schritte gehen über drei verschiedene
 * Wege (RPC, zwei Edge Functions, GoTrue-Admin-API) und sind einzeln prüfbar.
 * Ein Lauf, der alle sechs am Stück macht, ist nach dem ersten Fehler in einem
 * Zustand, den niemand aufgeschrieben hat.
 *
 * ══ JEDER SCHRITT IST IDEMPOTENT ═══════════════════════════════════════════
 * Er vergleicht vorher und überspringt, was schon stimmt. Ein zweiter Aufruf
 * ist deshalb harmlos — und ein abgebrochener erster ist fortsetzbar, ohne dass
 * jemand ausrechnen muss, wo er stehen blieb.
 *
 * ══ WARUM DIE WEGE SO GEWÄHLT SIND ═════════════════════════════════════════
 * - 12.1/12.2 über `admin_update_profile`: die Funktion pflegt `payment_type`
 *   an allen vier Stellen und schreibt die `admin_audit`-Zeile. Ein direktes
 *   UPDATE auf `profile_legacy` täte dasselbe, aber ohne Spur.
 * - 12.4 über `admin-change-email`: ein UPDATE auf `auth.users` liesse
 *   `auth.identities` zurück und das Konto in einem Zustand, den GoTrue nicht
 *   kennt.
 * - 12.5/12.6 über `admin-set-member-ban`: `disabled_at` ohne GoTrue-Bann ist
 *   der halbe Zustand aus 4.5 — unsichtbar, aber anmeldefähig.
 *
 * Aufruf:
 *   infisical run --env=prod -- npx tsx scripts/age581-datenpflege-schreiben.ts \
 *     <legacy|adressen|deaktivieren|heilen|anlegen|zaehlen> <tsv> [admin-email]
 *
 * Die TSV-Quelldatei ist NICHT eingecheckt und darf es nicht werden.
 */
import { readFile } from "node:fs/promises";

import { createClient } from "@supabase/supabase-js";
import pg from "pg";

import {
  adresseWeichtAb,
  findeDoppelbelegung,
  ordneZu,
  paidUntilAus,
  ZAHLUNGSARTEN,
  type Konto,
  type Uebersichtszeile,
} from "./age581-datenpflege.logic";

const STICHTAG = "2026-08-23";
const SCHRITTE = ["legacy", "adressen", "deaktivieren", "heilen", "anlegen", "zaehlen"] as const;
type Schritt = (typeof SCHRITTE)[number];

const schritt = process.argv[2] as Schritt;
const tsvPfad = process.argv[3];
const adminEmail = process.argv[4];
if (!SCHRITTE.includes(schritt) || !tsvPfad)
  throw new Error(`Aufruf: <${SCHRITTE.join("|")}> <tsv> [admin-email]`);

// ── Umgebung: alle vier Zugänge müssen auf DIESELBE Kennung zeigen ─────────
// Host und Region sind bei Supabase projektübergreifend gleich; nur die Kennung
// trennt PROD von DEV, und sie steht an vier verschiedenen Orten.
const erwartet = (await readFile("scripts/prod-project-ref.txt", "utf8")).trim();
const dbUrl = process.env.SUPABASE_DB_URL_PROD;
const apiUrl = process.env.SUPABASE_URL_PROD;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
if (!dbUrl || !apiUrl || !serviceKey || !anonKey) throw new Error("Zugangsdaten für PROD fehlen");

const refAusJwt = (k: string) =>
  JSON.parse(Buffer.from(k.split(".")[1], "base64url").toString()).ref;
const gefunden = {
  db: new URL(dbUrl).username.replace(/^postgres\./, ""),
  api: new URL(apiUrl).hostname.split(".")[0],
  service: refAusJwt(serviceKey),
  anon: refAusJwt(anonKey),
};
for (const [was, ref] of Object.entries(gefunden))
  if (ref !== erwartet) throw new Error(`${was} zeigt auf ${ref}, erwartet ${erwartet}`);

const db = new pg.Client({
  connectionString: dbUrl,
  ssl: { ca: await readFile("scripts/supabase-root-2021-ca.crt", "utf8") },
});
await db.connect();
await db.query("set statement_timeout = '30s'");

const leseKonten = async (): Promise<Konto[]> =>
  (
    await db.query(`
    select p.id, p.name, u.email::text as login_email, c.email::text as kontakt_email,
           l.paid_until::text as paid_until, l.payment_type,
           p.activated_at::text as activated_at, p.disabled_at::text as disabled_at,
           p.deleted_at::text as deleted_at
      from public.profiles p
      join auth.users u on u.id = p.id
      left join public.profile_contacts c on c.profile_id = p.id
      left join public.profile_legacy   l on l.profile_id = p.id
     order by p.name`)
  ).rows;

const zeilen: Uebersichtszeile[] = (await readFile(tsvPfad, "utf8"))
  .trim()
  .split("\n")
  .slice(1)
  .map((l) => {
    const [kategorie, vorname, nachname, jahrestag, email, kontoId] = l.split("\t");
    return {
      kategorie: kategorie.trim(),
      vorname,
      nachname,
      jahrestag,
      email,
      ...(kontoId?.trim() ? { kontoId: kontoId.trim() } : {}),
    };
  });

const unbekannt = [...new Set(zeilen.map((z) => z.kategorie))].filter(
  (k) => !(ZAHLUNGSARTEN as readonly string[]).includes(k),
);
if (unbekannt.length) throw new Error(`Kategorie ohne Entsprechung: ${unbekannt.join(", ")}`);

let konten = await leseKonten();
let zuordnungen = ordneZu(zeilen, konten);

// Dieselbe Sperre wie im Trockenlauf, und aus demselben Grund: zwei Zeilen auf
// ein Konto schreiben zwei verschiedene Werte in dieselbe Zeile und lassen das
// richtige Konto in 12.5 laufen.
const doppelt = findeDoppelbelegung(zuordnungen);
const mehrdeutig = zuordnungen.filter((z) => z.treffer.length > 1);
if (doppelt.length || mehrdeutig.length)
  throw new Error(
    `ABBRUCH: ${doppelt.length} Doppelbelegung(en), ${mehrdeutig.length} mehrdeutig. Erst auflösen.`,
  );

const sb = createClient(apiUrl, serviceKey, { auth: { persistSession: false } });
const kurz = (k: Konto) =>
  `${(k.name ?? "(ohne Namen)").slice(0, 24).padEnd(24)} <${k.login_email}>`;
const rolleVon = async (id: string): Promise<string | undefined> =>
  (await db.query("select role from public.staff_roles where profile_id = $1", [id])).rows[0]?.role;

console.log(`\n═══ AGE-581 · Schritt „${schritt}" · PROD (${erwartet}) ═══\n`);

/**
 * Ein Admin-Token, ohne ein Passwort zu setzen oder zu kennen.
 *
 * `generateLink` VERSCHICKT NICHTS — es gibt den Einmal-Token zurück, den wir
 * unmittelbar einlösen. Nötig ist das, weil die drei Schreibwege die handelnde
 * Person aus dem verifizierten Token lesen und nicht aus dem Rumpf; ein
 * `service_role`-Token trägt kein `sub` und liefe in 401.
 */
async function adminToken(): Promise<string> {
  if (!adminEmail) throw new Error("Dieser Schritt braucht die Admin-Adresse als drittes Argument");
  const { data, error } = await sb.auth.admin.generateLink({
    type: "magiclink",
    email: adminEmail,
  });
  if (error || !data.properties?.hashed_token) throw new Error(`generateLink: ${error?.message}`);
  const anon = createClient(apiUrl!, anonKey!, { auth: { persistSession: false } });
  const { data: s, error: e2 } = await anon.auth.verifyOtp({
    token_hash: data.properties.hashed_token,
    type: "magiclink",
  });
  if (e2 || !s.session) throw new Error(`verifyOtp: ${e2?.message}`);
  const istAdmin = (await db.query("select public.is_admin_uid($1) as ok", [s.user!.id])).rows[0]
    .ok;
  if (!istAdmin) throw new Error(`${adminEmail} ist auf PROD kein (aktiver) Admin`);
  return s.session.access_token;
}

async function rufeFunction(name: string, token: string, rumpf: unknown) {
  const r = await fetch(`${apiUrl}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      apikey: anonKey!,
      "content-type": "application/json",
    },
    body: JSON.stringify(rumpf),
  });
  return { status: r.status, body: (await r.json().catch(() => null)) as unknown };
}

const alsAdmin = (token: string) =>
  createClient(apiUrl!, anonKey!, {
    auth: { persistSession: false },
    global: { headers: { authorization: `Bearer ${token}` } },
  });

// ── 12.1 / 12.2 / 12.3 ─────────────────────────────────────────────────────
if (schritt === "legacy") {
  const anon = alsAdmin(await adminToken());
  let geschrieben = 0;
  let uebersprungen = 0;
  for (const z of zuordnungen.filter((z) => z.treffer.length === 1)) {
    const k = z.treffer[0];
    const p = paidUntilAus(z.zeile.jahrestag, STICHTAG);
    if (p.art === "unlesbar") {
      console.log(`  #${z.nummer} ÜBERSPRUNGEN unlesbarer Jahrestag „${p.roh}"  ${kurz(k)}`);
      uebersprungen++;
      continue;
    }
    const patch: Record<string, string> = {};
    if (k.payment_type !== z.zeile.kategorie) patch.payment_type = z.zeile.kategorie;
    // 12.3: „Ohne" heisst leer lassen. Ein Jahr ab heute wäre erfunden.
    if (p.art === "datum" && k.paid_until !== p.wert) patch.paid_until = p.wert;
    if (Object.keys(patch).length === 0) {
      uebersprungen++;
      continue;
    }
    const { error } = await anon.rpc("admin_update_profile", { target: k.id, patch });
    if (error) throw new Error(`#${z.nummer} ${kurz(k)}: ${error.message}`);
    geschrieben++;
    console.log(
      `  #${String(z.nummer).padStart(2)} ${Object.keys(patch).join("+").padEnd(24)} ${kurz(k)}`,
    );
  }
  console.log(`\n  geschrieben ${geschrieben} · übersprungen (schon richtig) ${uebersprungen}`);
}

// ── 12.4 ───────────────────────────────────────────────────────────────────
if (schritt === "adressen") {
  const token = await adminToken();
  const belegtVon = new Map<string, Konto[]>();
  for (const k of konten)
    for (const a of [k.login_email, k.kontakt_email]) {
      if (!a) continue;
      const s = a.trim().toLowerCase();
      belegtVon.set(s, [...(belegtVon.get(s) ?? []), k]);
    }

  let geaendert = 0;
  let ausgenommen = 0;
  let schon = 0;
  for (const z of zuordnungen.filter((z) => z.treffer.length === 1)) {
    const k = z.treffer[0];
    if (!adresseWeichtAb(z.zeile.email, k.login_email)) {
      schon++;
      continue;
    }
    const ziel = z.zeile.email.trim().toLowerCase();
    const gruende: string[] = [];
    if (!ziel.includes("@")) gruende.push("kein @ in der Listenadresse");
    const fremd = (belegtVon.get(ziel) ?? []).filter((a) => a.id !== k.id);
    if (fremd.length) gruende.push(`Adresse gehört bereits ${fremd.map(kurz).join(" | ")}`);
    const rolle = await rolleVon(k.id);
    if (rolle) gruende.push(`hält Rolle ${rolle} — ein Fehlgriff sperrt aus der Fläche aus`);
    if (gruende.length) {
      ausgenommen++;
      console.log(
        `  #${String(z.nummer).padStart(2)} AUSNAHME ${kurz(k)}\n           ${gruende.join("\n           ")}`,
      );
      continue;
    }
    const { status, body } = await rufeFunction("admin-change-email", token, {
      target: k.id,
      email: z.zeile.email.trim(),
    });
    if (status !== 200) throw new Error(`#${z.nummer}: ${status} ${JSON.stringify(body)}`);
    geaendert++;
    console.log(
      `  #${String(z.nummer).padStart(2)} geändert <${k.login_email}> → <${z.zeile.email.trim()}>  ${JSON.stringify(body)}`,
    );
  }
  console.log(`\n  geändert ${geaendert} · ausgenommen ${ausgenommen} · schon richtig ${schon}`);
}

// ── 12.5 ───────────────────────────────────────────────────────────────────
if (schritt === "deaktivieren") {
  const token = await adminToken();
  const getroffen = new Set(
    zuordnungen.filter((z) => z.treffer.length === 1).map((z) => z.treffer[0].id),
  );
  let deaktiviert = 0;
  let bleibt = 0;
  let schon = 0;
  for (const k of konten.filter((k) => !getroffen.has(k.id))) {
    const rolle = await rolleVon(k.id);
    if (rolle) {
      console.log(`  BLEIBT   ${kurz(k)}  Rolle ${rolle}`);
      bleibt++;
      continue;
    }
    if (k.disabled_at) {
      schon++;
      continue;
    }
    const { status, body } = await rufeFunction("admin-set-member-ban", token, {
      action: "disable",
      target: k.id,
      grund: "Kein Eintrag in der Mitgliederuebersicht vom 23.08.2026 (AGE-581, 12.5)",
    });
    if (status !== 200) throw new Error(`${kurz(k)}: ${status} ${JSON.stringify(body)}`);
    deaktiviert++;
    console.log(`  deakt.   ${kurz(k)}  ${JSON.stringify(body)}`);
  }
  console.log(
    `\n  deaktiviert ${deaktiviert} · bleibt (Rolle) ${bleibt} · schon deaktiviert ${schon}`,
  );
}

// ── Heilung: ein Mitglied auf der Liste darf NICHT deaktiviert sein ────────
// Die Umkehrung von 12.5, und sie hat einen Anlass. Am 24.08. hing die feste
// Zuordnung an der Anmeldeadresse, die 12.4 unmittelbar davor geändert hatte;
// die Zeile galt danach als „ohne Eintrag" und das Mitglied wurde deaktiviert.
// Der Schritt stellt die Invariante her, statt den Einzelfall zu reparieren:
// wer auf der Liste steht, ist offen. Er ist idempotent und meldet null, wenn
// nichts zu tun ist — genau dann ist die Invariante erfüllt.
if (schritt === "heilen") {
  const token = await adminToken();
  let geheilt = 0;
  let offen = 0;
  for (const z of zuordnungen.filter((z) => z.treffer.length === 1)) {
    const k = z.treffer[0];
    if (k.deleted_at) {
      // Wiederherstellen ist ein anderer Übergang mit anderen Folgen; das
      // entscheidet ein Mensch, nicht dieser Lauf.
      console.log(
        `  ✖ GELÖSCHT #${z.nummer} ${kurz(k)} — braucht eine Entscheidung, nicht diesen Schritt`,
      );
      continue;
    }
    if (!k.disabled_at) {
      offen++;
      continue;
    }
    const { status, body } = await rufeFunction("admin-set-member-ban", token, {
      action: "enable",
      target: k.id,
      grund: "Steht in der Mitgliederuebersicht vom 23.08.2026 (AGE-581, Heilung)",
    });
    if (status !== 200)
      throw new Error(`#${z.nummer} ${kurz(k)}: ${status} ${JSON.stringify(body)}`);
    geheilt++;
    console.log(`  geheilt  #${String(z.nummer).padStart(2)} ${kurz(k)}  ${JSON.stringify(body)}`);
  }
  console.log(`\n  geheilt ${geheilt} · war schon offen ${offen}`);
}

// ── 12.6 ───────────────────────────────────────────────────────────────────
if (schritt === "anlegen") {
  const token = await adminToken();
  const anon = alsAdmin(token);

  for (const z of zuordnungen.filter((z) => z.treffer.length === 0)) {
    const email = z.zeile.email.trim();
    const name = `${z.zeile.vorname} ${z.zeile.nachname}`.trim();

    // `email_confirm: true`: ohne das scheitert die Anmeldung NACH der
    // Aktivierung, und der Fehler zeigt dann auf das Aktivierungs-Gate.
    const { data, error } = await sb.auth.admin.createUser({ email, email_confirm: true });
    if (error) throw new Error(`createUser ${email}: ${error.message}`);
    const id = data.user!.id;
    console.log(`  angelegt  #${z.nummer} ${name} <${email}>  id=${id.slice(0, 8)}…`);

    // Der Trigger hat die Profilzeile schon angelegt — mit der Vorgabe `basic`.
    // Alle 71 bestehenden Konten stehen auf `impact` (Import = impact); `tier`
    // steht bewusst NICHT in der Weisliste von admin_update_profile, deshalb
    // hier ein eigener Satz statt eines Patches.
    await db.query("update public.profiles set tier = 'impact' where id = $1", [id]);

    const p = paidUntilAus(z.zeile.jahrestag, STICHTAG);
    const patch: Record<string, string> = { name, payment_type: z.zeile.kategorie };
    if (p.art === "datum") patch.paid_until = p.wert;
    const { error: e2 } = await anon.rpc("admin_update_profile", { target: id, patch });
    if (e2) throw new Error(`admin_update_profile ${email}: ${e2.message}`);
    console.log(`  gesetzt   tier=impact · ${Object.keys(patch).join(", ")}`);

    const { status, body } = await rufeFunction("admin-set-member-ban", token, {
      action: "disable",
      target: id,
      grund: "Zahlung offen (AGE-581, 12.6)",
    });
    if (status !== 200) throw new Error(`disable ${email}: ${status} ${JSON.stringify(body)}`);
    console.log(`  deakt.    ${JSON.stringify(body)}`);
  }
}

// ── 12.7, zweite Hälfte ────────────────────────────────────────────────────
if (schritt === "zaehlen") {
  konten = await leseKonten();
  zuordnungen = ordneZu(zeilen, konten);
  const zeile = (was: string, ist: number, soll: number) =>
    `  ${was.padEnd(30)} ${String(ist).padStart(6)} ${String(soll).padStart(9)}   ${ist === soll ? "✓" : "✖"}`;
  const eindeutig = zuordnungen.filter((z) => z.treffer.length === 1);
  const mitDatum = zeilen.filter((z) => paidUntilAus(z.jahrestag, STICHTAG).art === "datum").length;

  console.log(`  ${"Kennzahl".padEnd(30)} ${"ist".padStart(6)} ${"erwartet".padStart(9)}`);
  console.log(zeile("Profile", konten.length, 72));
  console.log(zeile("zugeordnet", eindeutig.length, 60));
  console.log(zeile("mit payment_type", konten.filter((k) => k.payment_type).length, 60));
  console.log(zeile("mit paid_until", konten.filter((k) => k.paid_until).length, mitDatum));
  console.log(zeile("deaktiviert", konten.filter((k) => k.disabled_at).length, 12));
  console.log(zeile("gelöscht", konten.filter((k) => k.deleted_at).length, 0));
  const offen = eindeutig.filter((z) => adresseWeichtAb(z.zeile.email, z.treffer[0].login_email));
  console.log(zeile("Adressen noch abweichend", offen.length, 3));
}

await db.end();
console.log("");
