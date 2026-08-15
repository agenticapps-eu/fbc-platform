/**
 * Probe (AGE-534, Aufgabe 7.1): das Anmeldekonto und die Transaktion, gegen den
 * lokalen Stack — nicht gegen einen Nachbau.
 *
 * Die Unit-Tests prüfen den SQL-TEXT. Genau daran ist der erste Entwurf von 7.3
 * vorbeigelaufen: er war grün, während jedes importierte Konto `basic` geblieben
 * wäre, weil ein Trigger die Profilzeile vor dem Import anlegt. Was hier läuft,
 * läuft deshalb wirklich.
 *
 * Sie legt ein Konto an, schreibt einen Datensatz und räumt beides wieder weg.
 *
 *   LOKALER_SERVICE_KEY=… pnpm tsx scripts/probe-c10-transaktion.ts
 */

import pg from "pg";

import { fuehreDatensatzAus } from "../supabase/seed/wp_import";
import { legeKontoAn, schreibauftrag } from "../supabase/seed/wp_schreiben";

const API = "http://127.0.0.1:54321";
const DB = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const SCHLUESSEL = process.env.LOKALER_SERVICE_KEY;

if (!SCHLUESSEL) {
  console.error("LOKALER_SERVICE_KEY fehlt (aus `supabase status`).");
  process.exit(1);
}

let fehler = 0;
function pruefe(behauptung: string, erfuellt: boolean): void {
  console.log(`  ${erfuellt ? "ok  " : "FEHL"} ${behauptung}`);
  if (!erfuellt) fehler++;
}

const adresse = `probe-c10-tx-${Date.now()}@example.test`;

// ── 1. Das Konto, ohne Passwort ─────────────────────────────────────────────
const konto = await legeKontoAn({ adresse, basis: API, schluessel: SCHLUESSEL });
console.log(`Konto: ${konto.stand}`);
if (konto.stand !== "angelegt") {
  console.error(konto.grund);
  process.exit(1);
}

const client = new pg.Client({ connectionString: DB });
await client.connect();

try {
  // GEMESSEN, und anders als erwartet: GoTrue legt auch OHNE `password` einen
  // bcrypt-Hash in `auth.users` ab. Die leere Spalte zu prüfen, hiesse also die
  // falsche Eigenschaft zu prüfen — und sie wäre rot, obwohl nichts fehlt.
  //
  // Was zählt, ist, ob damit jemand hineinkommt. Das steht hier, weil ein
  // Passwort, das der Import vergibt, ein Zugang wäre, den niemand angefordert
  // hat und den niemand kennt.
  const anmeldung = await fetch(`${API}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SCHLUESSEL, "Content-Type": "application/json" },
    body: JSON.stringify({ email: adresse, password: "" }),
  });
  pruefe("mit leerem Passwort kommt niemand hinein", anmeldung.status === 400);

  // ── 2. Die Transaktion ────────────────────────────────────────────────────
  const anweisungen = schreibauftrag({
    uid: konto.uid,
    neuAngelegt: true,
    zusammenfuehrung: {
      profil: {
        name: "Anna Berg",
        headline: "Bäckerin",
        socials: { linkedin: "https://example.org/anna" },
        member_since: "2021-04-01",
      },
      kontakt: { email: "anna@example.org", city: "Bad Homburg" },
      legacy: { legacy_source_id: `probe-${Date.now()}`, legacy_tier: "Premium" },
      offers: [{ title: "Beratung", description: "seit 1998" }],
      needs: [{ title: "Partner", description: "" }],
      interessen: [{ label: "Nachhaltigkeit", theme: null }],
      uebersprungen: [],
    },
  });

  console.log(`\n${anweisungen.length} Anweisungen in einer Transaktion:`);
  await fuehreDatensatzAus(client, anweisungen);

  const eins = async (sql: string): Promise<Record<string, unknown>> =>
    (await client.query(sql, [konto.uid])).rows[0] ?? {};

  const profil = await eins(
    "select tier, activated_at, name, socials, member_since from public.profiles where id = $1",
  );
  pruefe("tier ist impact", profil.tier === "impact");
  pruefe("activated_at bleibt leer", profil.activated_at === null);
  pruefe("der Name steht im Profil", profil.name === "Anna Berg");
  pruefe("member_since ist gesetzt", profil.member_since !== null);

  const kontakt = await eins("select city from public.profile_contacts where profile_id = $1");
  pruefe("die Kontaktzeile steht", kontakt.city === "Bad Homburg");

  const legacy = await eins("select legacy_tier from public.profile_legacy where profile_id = $1");
  pruefe("die Legacy-Zeile steht", legacy.legacy_tier === "Premium");

  const listen = await eins(`
    select
      (select count(*) from public.offers            where profile_id = $1 and source = 'editor') as angebote,
      (select count(*) from public.needs             where profile_id = $1 and source = 'editor') as gesuche,
      (select count(*) from public.profile_interests where profile_id = $1)                       as interessen
  `);
  pruefe("ein Angebot, als Zeile des Editors", listen.angebote === "1");
  pruefe("ein Gesuch, als Zeile des Editors", listen.gesuche === "1");
  pruefe("ein Interesse", listen.interessen === "1");

  // ── 3. Der zweite Durchgang bricht nicht ──────────────────────────────────
  // Nur die drei Upserts. Dass die LISTEN sich nicht verdoppeln, hält nicht
  // diese Anweisung, sondern die Merge-Regel aus 3.7 — sie gibt eine Liste nur
  // heraus, solange im Ziel keine Zeile steht. Das gehört zu 7.7.
  console.log("\nZweiter Durchgang (die drei Upserts):");
  await fuehreDatensatzAus(client, anweisungen.slice(0, 3));
  const nochmal = await eins("select tier, name from public.profiles where id = $1");
  pruefe("er läuft durch und tier bleibt impact", nochmal.tier === "impact");

  // ── 4. Ein bestehendes Konto bekommt die Stufe NICHT ──────────────────────
  await client.query("update public.profiles set tier = 'basic' where id = $1", [konto.uid]);
  await fuehreDatensatzAus(
    client,
    schreibauftrag({
      uid: konto.uid,
      neuAngelegt: false,
      zusammenfuehrung: {
        profil: { name: "Anna Berg" },
        kontakt: {},
        legacy: { legacy_source_id: `probe-${Date.now()}` },
        offers: [],
        needs: [],
        interessen: [],
        uebersprungen: [],
      },
    }),
  );
  const bestehend = await eins("select tier from public.profiles where id = $1");
  pruefe("ein bestehendes Konto bleibt auf seiner Stufe", bestehend.tier === "basic");

  // ── 5. Bricht eine Anweisung ab, bleibt keine halbe Person zurück ─────────
  // Ohne diese Probe wäre „eine Transaktion je Datensatz" eine Behauptung: die
  // Anweisungen liefen auch ohne Klammer der Reihe nach durch, und der
  // Unterschied zeigt sich erst an dem Datensatz, der scheitert.
  console.log("\nFehlerfall:");
  await client.query("update public.profiles set headline = 'vor dem Fehler' where id = $1", [
    konto.uid,
  ]);

  const kaputt = [
    ...schreibauftrag({
      uid: konto.uid,
      neuAngelegt: false,
      zusammenfuehrung: {
        profil: { headline: "mitten im Fehler" },
        kontakt: {},
        legacy: { legacy_source_id: null },
        offers: [],
        needs: [],
        interessen: [],
        uebersprungen: [],
      },
    }),
    // Eine Zeile, die keinem Profil gehört — der Fremdschlüssel weist sie ab.
    {
      sql: 'insert into public.offers ("profile_id", "title") values ($1, $2)',
      werte: ["00000000-0000-0000-0000-000000000000", "gehört niemandem"],
    },
  ];

  let geworfen = false;
  try {
    await fuehreDatensatzAus(client, kaputt);
  } catch {
    geworfen = true;
  }
  pruefe("der Fehler kommt beim Aufrufer an", geworfen);

  const danach = await eins("select headline from public.profiles where id = $1");
  pruefe("die Schreibvorgänge davor sind zurückgenommen", danach.headline === "vor dem Fehler");

  const { rows: weiter } = await client.query("select 1 as lebt");
  pruefe("die Verbindung ist danach weiter brauchbar", weiter[0]?.lebt === 1);
} finally {
  await client.end();
  const weg = await fetch(`${API}/auth/v1/admin/users/${konto.uid}`, {
    method: "DELETE",
    headers: { apikey: SCHLUESSEL, Authorization: `Bearer ${SCHLUESSEL}` },
  });
  console.log(`\nAufgeräumt: HTTP ${weg.status}`);
}

console.log(fehler === 0 ? "\nAlles erfüllt." : `\n${fehler} Befunde.`);
process.exit(fehler === 0 ? 0 : 1);
