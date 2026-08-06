#!/usr/bin/env tsx
/**
 * Beweis-Sonde fuer das Aktivierungs-Gate (AGE-495, Task 0.1 / 8.1).
 *
 *   infisical run --env=dev -- tsx scripts/probe-activation-gate.ts
 *   DEMO_SEED_DATABASE_URL=postgresql://... tsx scripts/probe-activation-gate.ts   # lokal
 *
 * Die Frage, die dieses Skript beantwortet, ist die Abnahmefrage aus AGE-495:
 * Was sieht ein Konto mit gueltiger Session und `activated_at = null`, wenn es
 * mit einem ROHEN Supabase-Client an der App vorbei fragt? Ein Screenshot der
 * Oberflaeche beantwortet sie nicht — die Oberflaeche ist Kulisse, die Grenze
 * ist die RLS.
 *
 * WARUM ES VOR DEM BAU LAEUFT. Ohne den roten Ausgangsbefund ist „null Zeilen"
 * am Ende nicht von „Abfrage falsch geschrieben" zu unterscheiden. Der erste
 * Lauf gehoert deshalb gegen den ungeaenderten Stand, und seine Ausgabe in
 * EVIDENCE.md, Abschnitt „Vorher".
 *
 * WARUM DAS SONDENKONTO `impact` IST. Importierte Mitglieder bekommen die
 * hoechste Stufe (Entscheidung Donald). Hinter dem Aktivierungs-Gate liegt bei
 * ihnen also KEIN Stufen-Gate mehr, das einen Fehler noch auffinge. Ein
 * `basic`-Sondenkonto wuerde vieles schon wegen der Stufe nicht sehen und
 * damit ein Gate vortaeuschen, das gar nicht greift.
 *
 * Schreibt ausschliesslich sein eigenes Wegwerf-Konto und raeumt es wieder ab.
 * Laeuft nie gegen PROD: der Ziel-Ref wird gegen scripts/dev-project-ref.txt
 * geprueft, bevor irgendetwas angelegt wird.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
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
console.log("Dieses Skript legt EIN Wegwerf-Konto an und loescht es wieder.\n");

// ── Flaechen, die das Gate schliessen muss ───────────────────────────────────
/** Fremddaten: was ein nicht aktiviertes Konto ueber ANDERE erfahren wuerde. */
const FREMD = [
  "profiles",
  "profiles_public",
  "posts",
  "events",
  "offers",
  "needs",
  "matches",
  "profile_interests",
  "profile_theme_scores",
  "profile_badges",
  "comments",
  "partners",
] as const;

/**
 * Eigene Daten — und genau das ist der Punkt, den Revision 1 verfehlt hat:
 * Der Angreifer meldet sich MIT DEM VERTEILTEN PASSWORT als das Mitglied an.
 * `auth.uid()` ist die ID des Bestohlenen; „eigene Daten" sind dessen Daten.
 * `profile_contacts` traegt E-Mail und Telefonnummer.
 */
const EIGEN = [
  "profile_contacts",
  "goals",
  "notifications",
  "compass_responses",
  "member_settings",
  "feedback",
  "message_threads",
  "messages",
  "contact_requests",
  "staff_roles",
] as const;

/**
 * Zaehlt als Sonde UND (per service-freier DB-Verbindung) den Gesamtbestand.
 * Der Gesamtbestand ist der Grund: eine Tabelle, die global leer ist, liefert
 * auch ohne Gate 0 — ihre 0 nach dem Change ist dann kein Beleg. Solche Zeilen
 * werden ausdruecklich als „global leer" markiert statt als Erfolg gezaehlt.
 */
async function zaehle(client: SupabaseClient, db: pg.Client, tabelle: string): Promise<string> {
  const { count, error } = await client.from(tabelle).select("*", { count: "exact", head: true });
  const { rows } = await db.query(`select count(*)::int as n from public.${tabelle}`);
  const gesamt = rows[0].n as number;
  if (error) return `Fehler ${error.code ?? ""} ${error.message}`.trim();
  const gesehen = count ?? 0;
  if (gesamt === 0) return `${gesehen} von ${gesamt}   ⚠ global leer — belegt nichts`;
  return `${gesehen} von ${gesamt}`;
}

const db = new pg.Client({ connectionString: dbUrl, ssl: lokal ? undefined : { ca: CA } });
await db.connect();

const { rows: spalte } = await db.query(
  `select 1 from information_schema.columns
    where table_schema='public' and table_name='profiles' and column_name='activated_at'`,
);
const gateGebaut = spalte.length > 0;
console.log(
  gateGebaut
    ? "profiles.activated_at ist vorhanden → NACHHER-Lauf (Gate erwartet)"
    : "profiles.activated_at fehlt → VORHER-Lauf (roter Ausgangsbefund erwartet)\n",
);

const email = `c3-probe-${Date.now()}@example.com`;
const passwort = "SondenPasswort2026xy";
const anon = createClient(apiUrl, anonKey, { auth: { persistSession: false } });
const { data: neu, error: regFehler } = await anon.auth.signUp({ email, password: passwort });
if (regFehler || !neu.user) {
  await db.end();
  rot(`Sondenkonto liess sich nicht anlegen: ${regFehler?.message}`);
}
const uid = neu.user.id;

try {
  // Stufe `impact` — und, sobald es die Spalte gibt, ausdruecklich NICHT aktiviert.
  await db.query("update public.profiles set tier = 'impact' where id = $1", [uid]);
  if (gateGebaut) {
    await db.query("update public.profiles set activated_at = null where id = $1", [uid]);
  }

  /**
   * Dem Sondenkonto EIGENE Zeilen geben — sonst misst der Abschnitt „Eigene
   * Daten" nichts. Ein frisches Konto hat ohnehin keine Kontaktdaten, keine
   * Ziele und keine Benachrichtigungen; die 0 nach dem Change waere dann kein
   * Beleg fuers Gate, sondern nur ein Beleg fuer ein leeres Konto. Genau die
   * Sorte gruener Test, die nichts prueft.
   *
   * Das Sondenkonto steht damit fuer ein IMPORTIERTES Mitglied: hoechste Stufe,
   * gepflegtes Profil, Kontaktdaten hinterlegt — und noch nicht bestaetigt.
   */
  await db.query(
    `insert into public.profile_contacts (profile_id, email, phone)
     values ($1, 'sonde-kontakt@example.com', '+49 000 000000')
     on conflict (profile_id) do nothing`,
    [uid],
  );
  await db.query(
    `insert into public.goals (profile_id, category, title)
     values ($1, 'persoenlich', 'Sonden-Ziel')`,
    [uid],
  );
  await db.query(
    `insert into public.notifications (profile_id, type, payload)
     values ($1, 'system', '{"titel":"Sonden-Benachrichtigung"}'::jsonb)`,
    [uid],
  );
  await db.query(
    `insert into public.member_settings (profile_id) values ($1)
     on conflict (profile_id) do nothing`,
    [uid],
  );

  const sonde = createClient(apiUrl, anonKey, { auth: { persistSession: false } });
  const { data: sitzung, error: loginFehler } = await sonde.auth.signInWithPassword({
    email,
    password: passwort,
  });
  if (loginFehler || !sitzung.session)
    throw new Error(`Login fehlgeschlagen: ${loginFehler?.message}`);
  console.log(
    `Sondenkonto: tier=impact, activated_at=${gateGebaut ? "null" : "(Spalte fehlt)"}, Session steht.\n`,
  );

  console.log("── Fremddaten (muessen nach dem Change 0 sein) ──────────────────");
  for (const t of FREMD) console.log(`  ${t.padEnd(24)} ${await zaehle(sonde, db, t)}`);

  console.log(
    "\n── Eigene Daten des Kontos (ebenfalls 0 — es sind die Daten des Bestohlenen) ──\n" +
      "   Das Sondenkonto hat dafuer eigene Zeilen bekommen (Kontakt, Ziel,\n" +
      "   Benachrichtigung, Einstellungen); sonst waere die 0 nur ein leeres Konto.",
  );
  for (const t of EIGEN) console.log(`  ${t.padEnd(24)} ${await zaehle(sonde, db, t)}`);

  console.log("\n── SECURITY-DEFINER-RPCs (umgehen die RLS) ─────────────────────");
  const leer = "00000000-0000-0000-0000-000000000000";
  const rpcs: [string, Record<string, unknown>][] = [
    ["post_engagement_counts", { p_post_ids: [leer] }],
    ["event_registration_counts", { p_event_ids: [leer] }],
    ["recompute_my_matches", {}],
    ["admin_list_feedback", {}],
    ["list_routing_queue", {}],
    // Schreibend: mit einer nicht existierenden ID aufgerufen. Vor dem Change
    // antwortet die Funktion „event not found" (P0002) — sie ist also erreichbar,
    // ohne dass etwas geschrieben wird. Nach dem Change muss 42501 kommen.
    ["register_for_event", { p_event_id: leer }],
    ["set_event_check_in", { p_registration_id: leer, p_checked_in: true }],
  ];
  for (const [name, args] of rpcs) {
    const { data, error } = await sonde.rpc(name, args);
    const ergebnis = error
      ? `Fehler ${error.code ?? ""} ${error.message}`.trim()
      : `${Array.isArray(data) ? data.length : JSON.stringify(data)} `.trim();
    console.log(`  ${name.padEnd(26)} ${ergebnis}`);
  }
  console.log(
    "  (admin_list_feedback / list_routing_queue liefern mit diesem Konto in BEIDEN\n" +
      "   Zustaenden leer — es ist kein Staff. Belegt werden sie im pgTAP, Task 3.7.)",
  );

  console.log("\n── Gegenprobe: das Schaufenster bleibt offen (ausgeloggt) ───────");
  const gast = createClient(apiUrl, anonKey, { auth: { persistSession: false } });
  for (const t of ["posts", "events"]) {
    const { count, error } = await gast
      .from(t)
      .select("*", { count: "exact", head: true })
      .eq("visibility", "public");
    console.log(`  ${`anon ${t} (public)`.padEnd(24)} ${error ? error.message : (count ?? 0)}`);
  }

  if (gateGebaut) {
    console.log("\n── Zielprofil-Gate: sieht ein BESTAETIGTES Konto die Sonde? ─────");
    const { rows } = await db.query(
      `select count(*)::int as n from public.profiles_public where id = $1`,
      [uid],
    );
    console.log(`  profiles_public (als Eigner/service) enthaelt die Sonde: ${rows[0].n}`);
    console.log("  (Der Blick eines bestaetigten Mitglieds wird im pgTAP belegt, Task 3.3b.)");
  }
} finally {
  await db.query("delete from auth.users where id = $1", [uid]);
  await db.end();
  console.log(`\nWegwerf-Konto geloescht: ${uid}`);
}
