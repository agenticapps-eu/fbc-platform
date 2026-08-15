#!/usr/bin/env tsx
/**
 * Probe: die Bestandsabfrage des Imports gegen eine echte Datenbank (AGE-534,
 * Aufgabe 5.2).
 *
 * WOZU. `baueBestandsdaten` ist rein und durchgetestet — die SQL-Zeichenkette
 * darüber ist es nicht. Sie ist die einzige Stelle in Gruppe 5, die kein Test
 * erreicht: eine falsch geschriebene Spalte fiele erst beim Lauf auf, und dann
 * gegen DEV. Diese Probe führt sie gegen den lokalen Stack aus und hält
 * ausserdem fest, in welchen JavaScript-Typen die Werte ankommen — `count(*)`
 * kommt als Zeichenkette, und ungewandelt wäre `"0"` wahr.
 *
 * Ausgegeben werden ausschliesslich Spaltennamen, Typen und Zählwerte. Kein
 * Feldinhalt: die Tabelle trägt nach dem Import Klarnamen und Anschriften.
 *
 *   pnpm tsx scripts/probe-c10-bestandsabfrage.ts
 */
import pg from "pg";

import { BESTANDSABFRAGE, baueBestandsdaten, type Bestandszeile } from "../supabase/seed/wp_import";

const LOKAL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

const ERWARTET = [
  "kennung",
  "adresse",
  "tier",
  "activated_at",
  "name",
  "headline",
  "short_bio",
  "region",
  "website",
  "socials",
  "videos",
  "kontakt_email",
  "phone",
  "street",
  "postal_code",
  "city",
  "state",
  "country",
  "offers",
  "needs",
  "interessen",
];

async function main(): Promise<void> {
  const client = new pg.Client({ connectionString: LOKAL, ssl: false });
  await client.connect();

  const fehler: string[] = [];
  try {
    const { rows, fields } = await client.query<Bestandszeile>(BESTANDSABFRAGE);
    const spalten = fields.map((f) => f.name);

    console.log(`Zeilen: ${rows.length}`);
    console.log(`Spalten: ${spalten.length}`);

    for (const name of ERWARTET) {
      if (!spalten.includes(name)) fehler.push(`Spalte fehlt: ${name}`);
    }

    const zeile = rows[0];
    if (zeile) {
      // Der Typ, nicht der Wert — und `count(*)` ist der Grund für die Probe.
      console.log(`  offers-Typ:       ${typeof zeile.offers}`);
      console.log(
        `  activated_at-Typ: ${zeile.activated_at === null ? "null" : typeof zeile.activated_at}`,
      );
      if (typeof zeile.offers !== "string") {
        fehler.push(
          `offers kommt als ${typeof zeile.offers} — die Wandlung im Code rechnet mit einer Zeichenkette.`,
        );
      }
    } else {
      console.log("  (keine Zeile — Typprüfung übersprungen)");
    }

    const daten = baueBestandsdaten(rows);
    console.log(`Nach Kennung: ${daten.nachKennung.size}`);
    console.log(`Nach Adresse: ${daten.nachAdresse.size}`);
    console.log(`Adressen ohne Kennung (Kollisionsliste): ${daten.adressenOhneKennung.length}`);
  } finally {
    await client.end();
  }

  if (fehler.length > 0) {
    console.error(`\n${fehler.length} Befund(e):`);
    for (const f of fehler) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log("\nok — die Abfrage läuft und liefert jede erwartete Spalte.");
}

main().catch((e: Error) => {
  console.error(`FEHLER: ${e.message}`);
  process.exit(1);
});
