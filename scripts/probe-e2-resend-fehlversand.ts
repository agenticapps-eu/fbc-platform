#!/usr/bin/env tsx
/**
 * Beweis-Sonde fuer E2 (AGE-495, Review 8.7): was ein FEHLVERSAND ueber
 * `resend-activation` liegen laesst.
 *
 *   infisical run --env=dev -- tsx scripts/probe-e2-resend-fehlversand.ts
 *
 * ── Die Frage ───────────────────────────────────────────────────────────────
 * `resend-activation` entwertet das ausstehende Token und gibt ein neues aus,
 * BEVOR es sendet (`request_own_activation_token`, 20260806090000:108-114).
 * Lehnt Resend danach ab, antwortet die Function ehrlich mit 502 — der laute
 * Teil. Der stille Teil ist das, was in der Datenbank zurueckbleibt:
 *
 *   (1) Das neue Token liegt OFFEN da (used_at null, invalidated_at null,
 *       72 h gueltig) — zu ihm existiert aber kein zugestellter Link, sein
 *       Klartext ist mit der Function-Instanz verschwunden.
 *   (2) Damit sieht das Schutzfenster von `issue_activation_token`
 *       (20260806090000:190-201) ein „ausstehendes" Token und antwortet dem
 *       SITZUNGSFREIEN Rueckfallweg 24 Stunden lang `pending` — kein Versand,
 *       kein neues Token. Ein Fehlversand auf dem angemeldeten Weg sperrt also
 *       den anonymen Weg zu.
 *
 * (2) ist der eigentliche Befund. (1) ist nur seine Ursache.
 *
 * ── Warum es vor dem Diff laeuft ────────────────────────────────────────────
 * Ohne den roten Ausgangsbefund ist ein spaeteres `issued` nicht von „Sonde
 * falsch geschrieben" zu unterscheiden. Erster Lauf gegen den UNGEAENDERTEN
 * Stand, Ausgabe in die Task-Notiz.
 *
 * ── Was hier NICHT gemockt wird ─────────────────────────────────────────────
 * Nichts. Der Fehlversand ist echt: das Wegwerf-Konto traegt eine
 * `@example.com`-Adresse, und Resend lehnt sie ab. Schlaegt das fehl — weil
 * Resend die Adresse doch annimmt —, bricht die Sonde LAUT ab, statt einen
 * gruenen Lauf vorzutaeuschen, der nichts gemessen hat.
 *
 * Schreibt ausschliesslich sein eigenes Wegwerf-Konto und raeumt es wieder ab.
 * Laeuft nie gegen PROD: der Ziel-Ref wird gegen scripts/dev-project-ref.txt
 * geprueft, bevor irgendetwas angelegt wird.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";
import pg from "pg";

const HIER = dirname(fileURLToPath(import.meta.url));
const CA = readFileSync(join(HIER, "supabase-root-2021-ca.crt"), "utf8");

function rot(nachricht: string): never {
  console.error(`::error::${nachricht}`);
  process.exit(1);
}

// ── Ziel bestimmen und belegen, bevor irgendetwas geschrieben wird ───────────
const apiUrl = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const dbUrl = process.env.DEMO_SEED_DATABASE_URL || process.env.SUPABASE_DB_URL_DEV;
if (!apiUrl || !anonKey) rot("VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY fehlen.");
if (!dbUrl) rot("Keine Verbindungs-URL (DEMO_SEED_DATABASE_URL oder SUPABASE_DB_URL_DEV).");

const lokal = apiUrl.includes("127.0.0.1") || apiUrl.includes("localhost");
if (!lokal) {
  const devRef = readFileSync(join(HIER, "dev-project-ref.txt"), "utf8").trim();
  if (!apiUrl.includes(devRef)) {
    rot(`Ziel ist nicht DEV. Erwartet ${devRef}, gefunden: ${apiUrl}. Abgebrochen.`);
  }
}
console.log(`Ziel-Projekt: ${apiUrl}${lokal ? "  (lokaler Stack)" : "  (DEV)"}`);
console.log("Diese Sonde legt EIN Wegwerf-Konto an und loescht es wieder.\n");

const db = new pg.Client({ connectionString: dbUrl, ssl: lokal ? undefined : { ca: CA } });
await db.connect();

/** Der Zustand der Token-Zeilen dieses Profils, so wie die RPCs ihn sehen. */
async function tokenZeilen(uid: string) {
  const { rows } = await db.query(
    `select left(token_hash, 8) as hash8,
            created_at,
            invalidated_at,
            used_at,
            expires_at > now() as gueltig
       from public.activation_tokens
      where profile_id = $1
      order by created_at`,
    [uid],
  );
  return rows as {
    hash8: string;
    created_at: Date;
    invalidated_at: Date | null;
    used_at: Date | null;
    gueltig: boolean;
  }[];
}

const email = `e2-probe-${Date.now()}@example.com`;
const passwort = "SondenPasswort2026xy";
const anon = createClient(apiUrl, anonKey, { auth: { persistSession: false } });
const { data: neu, error: regFehler } = await anon.auth.signUp({ email, password: passwort });
if (regFehler || !neu.user) {
  await db.end();
  rot(`Sondenkonto liess sich nicht anlegen: ${regFehler?.message}`);
}
const uid = neu.user.id;

try {
  // Nicht aktiviert — sonst antwortet request_own_activation_token
  // `already_activated` und es wird gar kein Token ausgegeben.
  await db.query("update public.profiles set activated_at = null where id = $1", [uid]);

  const sonde = createClient(apiUrl, anonKey, { auth: { persistSession: false } });
  const { data: sitzung, error: loginFehler } = await sonde.auth.signInWithPassword({
    email,
    password: passwort,
  });
  if (loginFehler || !sitzung.session)
    throw new Error(`Login fehlgeschlagen: ${loginFehler?.message}`);
  console.log(`Sondenkonto ${email}\n  activated_at=null, Session steht.\n`);

  // ── Schritt 1: der Fehlversand ────────────────────────────────────────────
  console.log("── Schritt 1: resend-activation aufrufen (Resend MUSS ablehnen) ─");
  const { data: antwort, error: fnFehler } = await sonde.functions.invoke("resend-activation", {
    body: {},
  });

  let status: string | undefined;
  let httpStatus: number | undefined;
  if (fnFehler) {
    const ctx = (fnFehler as { context?: Response }).context;
    httpStatus = ctx?.status;
    status = await ctx
      ?.json()
      .then((j) => (j as { status?: string })?.status)
      .catch(() => undefined);
  } else {
    httpStatus = 200;
    status = (antwort as { status?: string } | null)?.status;
  }
  console.log(`  HTTP ${httpStatus}, status=${status}`);

  if (status !== "send_failed") {
    throw new Error(
      `Erwartet war ein abgelehnter Versand (502 / send_failed), gemessen: ` +
        `HTTP ${httpStatus} / ${status}. Resend hat die Adresse offenbar angenommen — ` +
        `diese Sonde misst damit NICHTS. Abgebrochen, statt gruen zu melden.`,
    );
  }
  console.log("  ✓ Echter Fehlversand, nichts gemockt.\n");

  // ── Schritt 2: was liegt in der Tabelle? ──────────────────────────────────
  console.log("── Schritt 2: Zustand der Token-Zeilen ─────────────────────────");
  const zeilen = await tokenZeilen(uid);
  for (const z of zeilen) {
    console.log(
      `  ${z.hash8}…  gueltig=${z.gueltig}  used_at=${z.used_at ? "gesetzt" : "null"}` +
        `  invalidated_at=${z.invalidated_at ? "gesetzt" : "NULL"}`,
    );
  }
  const offen = zeilen.filter((z) => !z.used_at && !z.invalidated_at && z.gueltig);
  console.log(
    `\n  Offene, noch gueltige Token: ${offen.length}` +
      `   ${offen.length === 0 ? "→ nichts bleibt liegen (Soll)" : "→ liegt ohne zugestellten Link (E2)"}\n`,
  );

  // ── Schritt 3: der eigentliche Schaden ────────────────────────────────────
  // Die 60-s-Sperre von issue_activation_token zaehlt ueber created_at und
  // greift VOR dem Schutzfenster. Ohne dieses Warten misst Schritt 3 nur die
  // Sperre und nie das Fenster — also warten, statt created_at zurueckzudrehen.
  console.log("── Schritt 3: was sieht der sitzungsfreie Rueckfallweg? ────────");
  console.log("  Warte 65 s (die 60-s-Sperre liegt VOR dem Schutzfenster) …");
  await new Promise((r) => setTimeout(r, 65_000));

  const { rows: anonym } = await db.query(
    `select status from public.issue_activation_token($1, $2)`,
    [email, "e2-sonde-hash-ohne-bedeutung"],
  );
  const anonStatus = anonym[0]?.status as string;
  console.log(`  issue_activation_token(…) → ${anonStatus}`);
  console.log(
    anonStatus === "pending"
      ? "\n  ROT: Der anonyme Weg schweigt — kein Versand, kein neues Token.\n" +
          "       Bis zu 24 Stunden lang, und /aktivierung meldet dabei Gruen."
      : anonStatus === "issued"
        ? "\n  GRUEN: Der anonyme Weg gibt einen Link aus. Der Fehlversand hat ihn\n" +
          "         nicht zugesperrt."
        : `\n  UNERWARTET: ${anonStatus} — weder pending noch issued. Nicht deuten, nachsehen.`,
  );
} finally {
  await db.query("delete from auth.users where id = $1", [uid]);
  await db.end();
  console.log(`\nWegwerf-Konto geloescht: ${uid}`);
}
