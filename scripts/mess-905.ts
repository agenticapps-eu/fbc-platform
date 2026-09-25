#!/usr/bin/env tsx
/**
 * Die Messung zu AGE-905 — NUR LESEN (AGE-905).
 *
 *   tsx scripts/mess-905.ts --ziel=lokal --schreibe=/tmp/905-vorher.json
 *   tsx scripts/mess-905.ts --ziel=lokal --vergleich=/tmp/905-vorher.json --erwarte=23
 *   infisical run --env=prod -- tsx scripts/mess-905.ts \
 *     --prod=<ref> --vergleich=/tmp/905-prod-vorher.json --erwarte=23
 *
 * ── WARUM ES DIESES SKRIPT GIBT ─────────────────────────────────────────────
 * Die Abnahme von AGE-905 ist eine Differenz, keine Zahl: „0 neue Zeilen in
 * `notifications` und `push_zustellungen`". Ein gruener Migrationslauf sagt
 * darueber nichts — er sagt, dass die CLI die Datei verbucht hat.
 *
 * Und absolute Zielzahlen taugen dafuer nicht (Befund codex im Plan-Review,
 * MITTEL): „`notifications` steht bei 308" setzte voraus, dass zwischen
 * Messung und Deploy niemand einen Beitrag schreibt. Ein legitimer neuer
 * Beitrag liesse die Abnahme scheitern, zwei gegenlaeufige Schreibvorgaenge
 * verdeckten eine Regression. Deshalb: zweimal messen, die Differenz pruefen.
 *
 * ── NUR LESEN ───────────────────────────────────────────────────────────────
 * Ausschliesslich SELECTs, und die Sitzung wird zusaetzlich auf
 * `default_transaction_read_only` gestellt: ein versehentliches Schreiben
 * lehnt dann die Datenbank ab und nicht ein Kommentar.
 *
 * ── DAS ZIEL MUSS HINGESCHRIEBEN WERDEN ─────────────────────────────────────
 * Wie bei `mess-10-5-prod.ts`: ein Waechter, der eine Umgebungsvariable
 * prueft, haelt nichts, wenn jemand sie anders setzt. `--prod=` wird gegen
 * `scripts/prod-project-ref.txt` geprueft; `--ziel=lokal` verdrahtet die
 * lokale Adresse fest. Ein drittes Ziel gibt es nicht — DEV wird hier nicht
 * gemessen, weil dieser Change dort nichts zusagt.
 *
 * ── DIE RECHNUNG STEHT NEBENAN ──────────────────────────────────────────────
 * `mess-905.logic.ts`, mit Tests und Positivkontrollen. Hier steht nur, wie
 * die Zahlen aus der Datenbank kommen.
 */
import { readFile, writeFile } from "node:fs/promises";

import pg from "pg";

import { RELEASE_GESCHICHTEN } from "../src/content/release-geschichten";
import {
  bewerte,
  differenz,
  hatFehler,
  type GeschichtenStand,
  type Messung,
  type Zeilen,
} from "./mess-905.logic";

const LOKAL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

function arg(name: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
}

async function ziel(): Promise<{ name: string; url: string; ssl: pg.ClientConfig["ssl"] }> {
  const prod = arg("prod");
  const einfach = arg("ziel");

  if (prod !== undefined) {
    const erwartet = (await readFile("scripts/prod-project-ref.txt", "utf8")).trim();
    if (prod !== erwartet) {
      throw new Error(`--prod=${prod} ist nicht das PROD-Projekt (erwartet ${erwartet}). Abbruch.`);
    }
    const url = process.env.SUPABASE_DB_URL_PROD;
    if (!url) {
      throw new Error("SUPABASE_DB_URL_PROD fehlt — mit `infisical run --env=prod --` starten.");
    }
    return {
      name: `prod:${prod}`,
      url,
      ssl: { ca: await readFile("scripts/supabase-root-2021-ca.crt", "utf8") },
    };
  }

  if (einfach === "lokal") return { name: "lokal", url: LOKAL, ssl: undefined };

  throw new Error("Ziel fehlt: --ziel=lokal oder --prod=<ref>.");
}

/** `select <schluessel>, count(*)` in die Form der Rechnung bringen. */
async function zaehle(db: pg.Client, spalte: string, tabelle: string): Promise<Zeilen[]> {
  const r = await db.query(
    `select ${spalte}::text as schluessel, count(*)::int as n from ${tabelle} group by 1 order by 1`,
  );
  return r.rows as Zeilen[];
}

async function messen(db: pg.Client, zielName: string): Promise<Messung> {
  const slugs = RELEASE_GESCHICHTEN.filter((g) => g.freigegeben).map((g) => g.slug);

  // Je Slug: gibt es eine Note, ist sie zugestellt, haengt eine Karte daran?
  //
  // `entry_slugs @> array[s]` und NICHT `= array[s]`: eine Note darf mehrere
  // Eintraege abdecken (so benutzt die Admin-Flaeche sie), und eine Messung,
  // die das uebersaehe, meldete eine fehlende Karte, die es gibt.
  //
  // Der Join auf `posts` traegt `kind = 'release'` AUSDRUECKLICH, obwohl der
  // partielle Index nichts anderes zulaesst: die Messung soll die Zusage
  // pruefen und sie nicht voraussetzen.
  const r = await db.query(
    `select s.slug,
            (rn.id is not null)          as note,
            (rn.status = 'sent')         as zugestellt,
            (p.id is not null)           as beitrag,
            p.veroeffentlicht_ab         as veroeffentlicht_ab
       from unnest($1::text[]) as s(slug)
       left join public.release_notes rn on rn.entry_slugs @> array[s.slug]
       left join public.posts p
              on p.release_note_id = rn.id and p.kind = 'release'
      order by s.slug`,
    [slugs],
  );

  const geschichten: GeschichtenStand[] = r.rows.map((x) => ({
    slug: x.slug,
    note: x.note === true,
    zugestellt: x.zugestellt === true,
    beitrag: x.beitrag === true,
    veroeffentlichtAb: x.veroeffentlicht_ab ? new Date(x.veroeffentlicht_ab).toISOString() : null,
  }));

  const push = await db.query(`select count(*)::int as n from public.push_zustellungen`);

  return {
    ziel: zielName,
    gemessenAm: new Date().toISOString(),
    releaseNotes: await zaehle(db, "status", "public.release_notes"),
    posts: await zaehle(db, "kind", "public.posts"),
    notifications: await zaehle(db, "type", "public.notifications"),
    pushZustellungen: push.rows[0].n as number,
    geschichten,
  };
}

async function main() {
  const z = await ziel();
  const db = new pg.Client({ connectionString: z.url, ssl: z.ssl });
  await db.connect();
  await db.query("set default_transaction_read_only = on");

  const jetzt = await messen(db, z.name);
  await db.end();

  console.log(`\nZiel: ${z.name} — nur lesend, ${jetzt.gemessenAm}\n`);
  console.log(`  release_notes      ${JSON.stringify(jetzt.releaseNotes)}`);
  console.log(`  posts              ${JSON.stringify(jetzt.posts)}`);
  console.log(`  push_zustellungen  ${jetzt.pushZustellungen}`);
  console.log(
    `  notifications      ${jetzt.notifications.reduce((a, b) => a + b.n, 0)} gesamt, ` +
      `${jetzt.notifications.length} Typen`,
  );
  const mitKarte = jetzt.geschichten.filter((g) => g.beitrag).length;
  console.log(`  Geschichten        ${mitKarte}/${jetzt.geschichten.length} mit Karte`);

  const schreibe = arg("schreibe");
  if (schreibe) {
    await writeFile(schreibe, JSON.stringify(jetzt, null, 2));
    console.log(`\n  geschrieben nach ${schreibe}`);
  }

  const vergleich = arg("vergleich");
  if (!vergleich) {
    console.log("\n(kein --vergleich — nur aufgenommen, nichts bewertet)\n");
    return;
  }

  const vorher = JSON.parse(await readFile(vergleich, "utf8")) as Messung;
  if (vorher.ziel !== jetzt.ziel) {
    // Zwei Flaechen zu vergleichen ergaebe eine Differenz, die aussieht wie
    // eine Veraenderung und keine ist.
    throw new Error(`Vergleich misst eine ANDERE Flaeche: ${vorher.ziel} gegen ${jetzt.ziel}.`);
  }

  const erwarte = Number(arg("erwarte") ?? "NaN");
  if (!Number.isInteger(erwarte)) {
    throw new Error(
      "--erwarte=<zahl> fehlt: wie viele neue Karten sind zu erwarten? (0 beim Wiederholungslauf)",
    );
  }

  const d = differenz(vorher, jetzt);
  const befunde = bewerte(d, erwarte);

  console.log(`\nDifferenz gegen ${vergleich} (${vorher.gemessenAm}):\n`);
  for (const b of befunde) console.log(`  ${b.schwere === "OK" ? "OK   " : "FEHLER"} ${b.text}`);
  if (d.neueKarten.length) console.log(`\n  neue Karten: ${d.neueKarten.join(", ")}`);

  if (hatFehler(befunde)) {
    console.log("\nABNAHME NICHT ERFUELLT.\n");
    process.exitCode = 1;
  } else {
    console.log("\nAbnahme erfuellt.\n");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
