#!/usr/bin/env tsx
/**
 * Der Wächter über den Push-Zustellweg (AGE-679) — der Läufer.
 *
 *   infisical run --env=dev  -- pnpm tsx scripts/push-waechter.ts dev
 *   infisical run --env=prod -- pnpm tsx scripts/push-waechter.ts prod
 *
 * Die Entscheidung liegt in `push-waechter.logic.ts` und ist dort ohne
 * Datenbank prüfbar. Hier steht nur, wie gemessen wird.
 *
 * **Die Seite ist eine Pflichtangabe.** `db-drift-scan.ts` fällt ohne Argument
 * auf `SUPABASE_DB_URL_PROD` zurück — ein Wächter mit einem Job je Seite, der
 * das Argument vergisst, prüfte damit PROD zweimal und DEV nie, und beide Läufe
 * wären grün. Gefunden hat das die Plan-Review; hier gibt es deshalb keinen
 * Rückfall.
 *
 * **Ein Messausfall ist ein roter Lauf, kein stiller grüner.** Scheitert die
 * Verbindung oder eine Abfrage, wird daraus ein Befund `messausfall` — nie ein
 * `stillstand`. Wer nicht misst, sieht auch keinen Takt, darf daraus aber nicht
 * schliessen, dass keiner läuft.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";

import { evaluateStage1 } from "./db-push-prod.logic";
import { ABFRAGEN, bewerteMessung, type Messung, type Schwellen } from "./push-waechter.logic";

const HIER = dirname(fileURLToPath(import.meta.url));

/**
 * Beide Zeitpläne stehen auf `* * * * *`, also ein Lauf je Minute. Der
 * Erwartungswert kommt bewusst aus dieser Zusage im Repo und NICHT aus dem
 * Zeitplan, den die Datenbank gerade trägt: weicht der ab, ist das Drift — und
 * die zu finden ist Aufgabe von `db-drift-scan.ts`, nicht dieses Wächters.
 */
const LAEUFE_JE_MINUTE = 1;

function abbruch(nachricht: string): never {
  console.error(`::error::${nachricht}`);
  process.exit(2);
}

const seite = process.argv[2];
if (seite !== "dev" && seite !== "prod") {
  abbruch("Aufruf: pnpm tsx scripts/push-waechter.ts <dev|prod> — die Seite ist Pflicht.");
}

function zahlAusUmgebung(name: string, vorgabe: number): number {
  const roh = process.env[name];
  if (roh === undefined || roh === "") return vorgabe;
  const wert = Number(roh);
  if (!Number.isFinite(wert) || wert < 0) abbruch(`${name}="${roh}" ist keine Zahl >= 0.`);
  return wert;
}

const schwellen: Schwellen = {
  fensterMinuten: zahlAusUmgebung("WAECHTER_FENSTER_MINUTEN", 120),
  // 0 ist erlaubt und ausdrücklich gewollt: damit wird der Stillstand-Befund
  // mit Sicherheit wahr, und der Meldeweg lässt sich einmal echt rot fahren.
  hoechstpauseMinuten: zahlAusUmgebung("WAECHTER_HOECHSTPAUSE_MINUTEN", 15),
};

if (schwellen.fensterMinuten <= 0) abbruch("Ein Fenster von 0 Minuten misst nichts.");

const url = seite === "prod" ? process.env.SUPABASE_DB_URL_PROD : process.env.SUPABASE_DB_URL_DEV;

// Zielkontrolle. `current_user` taugt dafür NICHT: hinter dem Pooler heisst er
// auf beiden Seiten `postgres`, und der Host ist regionsweit gleich. Was die
// Projekte unterscheidet, ist der Benutzername IN der URL — dieselbe geprüfte
// Funktion, die `assert-target.ts` und `db:push:prod` benutzen.
const ziel = evaluateStage1({
  dbUrl: url,
  expectedRef: readFileSync(join(HIER, `${seite}-project-ref.txt`), "utf8").trim(),
  args: [],
});
if (ziel.kind === "abort") {
  abbruch(`SUPABASE_DB_URL_${seite.toUpperCase()}: ${ziel.reason}`);
}
// Der Ref wird hier festgehalten und nicht unten aus `ziel` gelesen: die
// Verengung durch das `abbruch` oben gilt auf Modulebene, aber nicht mehr
// innerhalb von `main()`.
const zielRef = ziel.ref;

function ssl(u: string): pg.ClientConfig["ssl"] {
  if (u.includes("localhost") || u.includes("127.0.0.1")) return false;
  return {
    ca: readFileSync(join(HIER, "supabase-root-2021-ca.crt"), "utf8"),
    rejectUnauthorized: true,
  };
}

type Zeitplanzeile = { schedule: string; active: boolean };

async function miss(): Promise<{ messung: Messung; zeitplan: Zeitplanzeile | null }> {
  const client = new pg.Client({ connectionString: url!, ssl: ssl(url!) });
  await client.connect();
  try {
    const fenster = [schwellen.fensterMinuten];

    const antworten = await client.query<{
      status_code: number | null;
      timed_out: boolean;
      fehler: boolean;
      anzahl: number;
    }>(ABFRAGEN.antworten, fenster);

    const laeufe = await client.query<{
      juengster_alter_sekunden: number | null;
      im_fenster: number;
    }>(ABFRAGEN.laeufe, fenster);

    const zeitplan = await client.query<Zeitplanzeile>(ABFRAGEN.zeitplan);
    const aufgegeben = await client.query<{ anzahl: number }>(ABFRAGEN.aufgegeben, fenster);
    const ttl = await client.query<{ ttl_sekunden: number }>(ABFRAGEN.ttl);

    if (ttl.rows.length === 0) {
      throw new Error("pg_net.ttl liess sich nicht lesen — ist pg_net installiert?");
    }

    return {
      zeitplan: zeitplan.rows[0] ?? null,
      messung: {
        art: "gemessen",
        seite: seite as "dev" | "prod",
        antworten: antworten.rows.map((r) => ({
          statusCode: r.status_code,
          timedOut: r.timed_out,
          fehler: r.fehler,
          anzahl: r.anzahl,
        })),
        juengsterLaufAlterSekunden: laeufe.rows[0]?.juengster_alter_sekunden ?? null,
        laeufeImFenster: laeufe.rows[0]?.im_fenster ?? 0,
        laeufeErwartet: schwellen.fensterMinuten * LAEUFE_JE_MINUTE,
        aufgegeben: aufgegeben.rows[0]?.anzahl ?? 0,
        ttlSekunden: ttl.rows[0].ttl_sekunden,
      },
    };
  } finally {
    await client.end();
  }
}

async function main() {
  console.log(
    `Ziel: ${seite} = ${zielRef} · Fenster ${schwellen.fensterMinuten} min · ` +
      `Hoechstpause ${schwellen.hoechstpauseMinuten} min`,
  );

  let messung: Messung;
  let zeitplan: Zeitplanzeile | null = null;
  try {
    ({ messung, zeitplan } = await miss());
  } catch (e) {
    // Kein `process.exit` hier: der Ausfall geht durch dieselbe Bewertung wie
    // alles andere und wird dort zu einem Befund. Sonst gaebe es zwei Wege
    // nach draussen und nur einer waere geprueft.
    messung = {
      art: "messausfall",
      seite: seite as "dev" | "prod",
      grund: e instanceof Error ? e.message : "unbekannt",
    };
  }

  // Nur Aggregate. Nie `content`, nie `headers`, nie `letzter_fehler`, nie eine
  // Kennung — die Actions-Protokolle dieses Repositories sind oeffentlich.
  if (messung.art === "gemessen") {
    const antworten = messung.antworten
      .map((a) => `${a.timedOut ? "timeout" : a.fehler ? "fehler" : a.statusCode}×${a.anzahl}`)
      .join(", ");
    console.log(
      `Antworten im Fenster: ${antworten || "(keine)"}\n` +
        `Wiederholungslauf: juengster erfolgreicher Lauf ` +
        `${messung.juengsterLaufAlterSekunden === null ? "(keiner)" : `${messung.juengsterLaufAlterSekunden} s`} alt, ` +
        `${messung.laeufeImFenster} von ${messung.laeufeErwartet} erwarteten\n` +
        `Zeitplan: ${zeitplan ? `${zeitplan.schedule}, aktiv=${zeitplan.active}` : "(kein Eintrag)"}\n` +
        `Aufgegebene Zustellungen im Fenster: ${messung.aufgegeben}\n` +
        `pg_net.ttl: ${messung.ttlSekunden} s`,
    );
  }

  const befunde = bewerteMessung(messung, schwellen);
  if (befunde.length === 0) {
    console.log(`\nOK — keine Beanstandung auf ${seite}.`);
    return;
  }

  for (const b of befunde) console.error(`::error::[${b.art}] ${b.text}`);
  console.error(`\n${befunde.length} Befund(e) auf ${seite}.`);
  process.exitCode = 1;
}

main().catch((e) => {
  // Hierher kommt nur, was die Bewertung selbst zerlegt — die Messung ist oben
  // schon abgefangen.
  console.error(`::error::Der Waechter ist selbst gescheitert: ${(e as Error).message}`);
  process.exit(1);
});
