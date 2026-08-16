/**
 * Probe (AGE-534, Gruppe 7.1): Was steht in `public.profiles`, unmittelbar
 * nachdem die GoTrue-Admin-Schnittstelle ein Konto angelegt hat?
 *
 * Der Plan für 7.1 nimmt an, das Profil entstehe durch das `insert` des Imports
 * und `tier`/`activated_at` liessen sich als reine Einfügespalten setzen. Es
 * gibt aber einen Trigger `on_auth_user_created` (community_foundation.sql:82),
 * der bei JEDEM Insert in `auth.users` schon eine Profilzeile anlegt. Trifft er
 * auch beim Admin-Weg zu, findet das Upsert eine Zeile vor — und `do update set`
 * lässt `tier` bewusst aus.
 *
 * Diese Probe misst es, statt es zu behaupten. Nur gegen den lokalen Stack; sie
 * legt ein Konto an und räumt es wieder weg.
 *
 *   pnpm tsx scripts/probe-c10-gotrue-trigger.ts
 */

import pg from "pg";

import { stufeFuerNeuesKonto } from "../supabase/seed/wp_schreiben";

const API = "http://127.0.0.1:54321";
const DB = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const SCHLUESSEL = process.env.LOKALER_SERVICE_KEY;

if (!SCHLUESSEL) {
  console.error("LOKALER_SERVICE_KEY fehlt (aus `supabase status`).");
  process.exit(1);
}

const adresse = `probe-c10-${Date.now()}@example.test`;

const antwort = await fetch(`${API}/auth/v1/admin/users`, {
  method: "POST",
  headers: {
    apikey: SCHLUESSEL,
    Authorization: `Bearer ${SCHLUESSEL}`,
    "Content-Type": "application/json",
  },
  // Ohne Passwort — so, wie 7.1 es vorsieht.
  body: JSON.stringify({ email: adresse, email_confirm: true }),
});

const konto = (await antwort.json()) as { id?: string; msg?: string };
console.log(`Anlegen: HTTP ${antwort.status}, id=${konto.id ?? "—"}`);
if (!konto.id) {
  console.error("Kein Konto angelegt:", konto);
  process.exit(1);
}

const fehler: string[] = [];

const client = new pg.Client({ connectionString: DB });
await client.connect();

try {
  const { rows } = await client.query(
    "select id, name, tier, activated_at from public.profiles where id = $1",
    [konto.id],
  );

  console.log(`Profilzeilen direkt nach dem Anlegen: ${rows.length}`);
  if (rows[0]) {
    console.log(
      `  tier=${rows[0].tier}  activated_at=${rows[0].activated_at}  name=${rows[0].name}`,
    );
  }

  // Und nun GENAU die Anweisung, die der Import heute fährt. Bis zum 16.08.
  // stand hier der Upsert des ersten Entwurfs — den diese Probe selbst
  // widerlegt hat. Sie prüfte damit einen Weg, den es im Code nicht mehr gibt,
  // und meldete auch bei falscher Stufe Ausgang 0. (Befund LOW, codex.)
  const stufe = stufeFuerNeuesKonto({ stand: "angelegt", uid: konto.id });
  const gesetzt = await client.query(stufe.sql, stufe.werte);
  console.log(`Stufen-UPDATE: ${gesetzt.rowCount} Zeile(n)`);

  const { rows: danach } = await client.query(
    "select tier, activated_at from public.profiles where id = $1",
    [konto.id],
  );

  // Drei Zusicherungen, und jede einzeln benannt — „irgendetwas stimmt nicht"
  // schickt den nächsten Leser auf die Suche.
  if (gesetzt.rowCount !== 1) fehler.push(`Stufen-UPDATE traf ${gesetzt.rowCount} Zeilen, nicht 1`);
  if (danach[0]?.tier !== "impact") fehler.push(`tier ist ${danach[0]?.tier}, nicht impact`);
  if (danach[0]?.activated_at !== null) fehler.push("activated_at ist gesetzt, sollte null sein");

  console.log(
    `Nach dem Stufen-UPDATE: tier=${danach[0]?.tier} activated_at=${danach[0]?.activated_at}`,
  );
} finally {
  await client.end();
  const weg = await fetch(`${API}/auth/v1/admin/users/${konto.id}`, {
    method: "DELETE",
    headers: { apikey: SCHLUESSEL, Authorization: `Bearer ${SCHLUESSEL}` },
  });
  console.log(`Aufgeräumt: HTTP ${weg.status}`);
}

// Ein Ausgang ungleich 0, sonst ist die Probe kein Riegel, sondern ein Ausdruck.
if (fehler.length > 0) {
  console.error(`\nDie Stufe kommt NICHT wie zugesagt zustande:\n  ${fehler.join("\n  ")}`);
  process.exit(1);
}
console.log("\nStufe wie zugesagt: impact, unaktiviert, genau eine Zeile.");
