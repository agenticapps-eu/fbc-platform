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
import { legeKontoAn, schreibauftrag, stufeFuerNeuesKonto } from "../supabase/seed/wp_schreiben";

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

// Festgehalten, statt `konto` in die Funktion zu ziehen: eine hochgezogene
// Funktionsdeklaration sieht die Verengung von oben nicht.
const uid = konto.uid;
const schluessel = SCHLUESSEL;

/** Das angelegte Konto wieder wegräumen — in JEDEM Ausgang. */
async function raeumeAuf(): Promise<void> {
  const weg = await fetch(`${API}/auth/v1/admin/users/${uid}`, {
    method: "DELETE",
    headers: { apikey: schluessel, Authorization: `Bearer ${schluessel}` },
  });
  console.log(`\nAufgeräumt: HTTP ${weg.status}`);
}

// Ab hier ist ein Konto in der Welt. Alles Weitere steht deshalb IM try —
// vorher lag `new pg.Client()` + `connect()` davor, und ein geschlossener Port
// 54322 liess das Konto stehen (aus dem Sicherheits-Review).
const client = new pg.Client({ connectionString: DB });

try {
  await client.connect();
  // GEMESSEN, und anders als erwartet: GoTrue legt auch OHNE `password` einen
  // bcrypt-Hash in `auth.users` ab. Die leere Spalte zu prüfen, hiesse also die
  // falsche Eigenschaft zu prüfen — und sie wäre rot, obwohl nichts fehlt.
  //
  // ACHTUNG, diese Prüfung misst WENIGER, als sie aussieht (aus dem Review):
  // GoTrue weist ein leeres Passwort immer ab, auch wenn eines gesetzt WÄRE.
  // Dass der Import keines vergibt, belegt der Unit-Test „legt das Konto OHNE
  // Passwort an" (kein `password` im Rumpf). Hier steht nur, dass der Hash aus
  // dem Anlegen kein benutzbarer Zugang ist.
  const anmeldung = await fetch(`${API}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SCHLUESSEL, "Content-Type": "application/json" },
    body: JSON.stringify({ email: adresse, password: "" }),
  });
  pruefe("mit leerem Passwort kommt niemand hinein", anmeldung.status === 400);

  // ── 2. Die Stufe, in einer eigenen Anweisung VOR der Transaktion ──────────
  // Genau hier liegt der Unterschied zur verworfenen Fassung: bricht die
  // Transaktion gleich ab, trägt das Konto trotzdem schon die Handschrift des
  // Imports (`impact` ohne Freischaltung) und wird beim nächsten Lauf als
  // eigener Rest ERGÄNZT statt als Kollision gewertet.
  await client.query(stufeFuerNeuesKonto(konto).sql, stufeFuerNeuesKonto(konto).werte);

  const anweisungen = schreibauftrag({
    uid: konto.uid,
    zusammenfuehrung: {
      profil: {
        name: "Anna Berg",
        headline: "Bäckerin",
        socials: { linkedin: "https://example.org/anna" },
        videos: ["https://www.youtube.com/watch?v=dQw4w9WgXcQ"],
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
    "select tier, activated_at, name, socials, videos, member_since from public.profiles where id = $1",
  );
  pruefe("tier ist impact", profil.tier === "impact");
  pruefe("activated_at bleibt leer", profil.activated_at === null);
  pruefe("der Name steht im Profil", profil.name === "Anna Berg");
  pruefe("member_since ist gesetzt", profil.member_since !== null);
  // `jsonb` und `text[]` muss `pg` aus JS-Werten übersetzen. Ein Unit-Test auf
  // den SQL-Text belegt darüber nichts — das ist die ganze Begründung dieser
  // Probe, und die zwei Spalten waren als einzige noch nicht gemessen.
  pruefe(
    "socials steht als Objekt",
    (profil.socials as Record<string, string>)?.linkedin === "https://example.org/anna",
  );
  pruefe(
    "videos steht als Array",
    Array.isArray(profil.videos) && (profil.videos as string[]).length === 1,
  );

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
  await fuehreDatensatzAus(
    client,
    // Nach Tabelle ausgewählt, nicht nach Position: ein `slice(0, 3)` prüfte
    // still etwas anderes, sobald `schreibauftrag` eine Anweisung einschiebt
    // oder eine weglässt.
    anweisungen.filter((a) => !/public\.(offers|needs|profile_interests)/.test(a.sql)),
  );
  const nochmal = await eins("select tier, name from public.profiles where id = $1");
  pruefe("er läuft durch und tier bleibt impact", nochmal.tier === "impact");

  // ── 4. Ein bestehendes Konto bekommt die Stufe NICHT ──────────────────────
  // Zwei getrennte Zusicherungen, seit die Stufe aus dem Auftrag heraus ist:
  //   (a) der Datensatz-Weg fasst sie überhaupt nicht mehr an,
  //   (b) und selbst die Stufen-Anweisung geht an einem FREIGESCHALTETEN Konto
  //       vorbei — das benutzt jemand, dann ist es keiner unserer Reste.
  await client.query(
    "update public.profiles set tier = 'basic', activated_at = now() where id = $1",
    [konto.uid],
  );
  await fuehreDatensatzAus(
    client,
    schreibauftrag({
      uid: konto.uid,
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
  const stufe = stufeFuerNeuesKonto(konto);
  await client.query(stufe.sql, stufe.werte);
  const bestehend = await eins("select tier from public.profiles where id = $1");
  pruefe(
    "weder der Datensatz-Weg noch die Stufen-Anweisung heben ein freigeschaltetes Konto",
    bestehend.tier === "basic",
  );

  // Zurücksetzen, damit der Fehlerfall unten auf einem sauberen Stand misst.
  await client.query("update public.profiles set activated_at = null where id = $1", [konto.uid]);

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
      zusammenfuehrung: {
        profil: { headline: "mitten im Fehler" },
        kontakt: {},
        legacy: {},
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
  // `end()` darf das Aufräumen nicht verhindern — wirft es, bliebe sonst ein
  // Konto zurück.
  await client.end().catch(() => {});
  await raeumeAuf();
}

console.log(fehler === 0 ? "\nAlles erfüllt." : `\n${fehler} Befunde.`);
process.exit(fehler === 0 ? 0 : 1);
