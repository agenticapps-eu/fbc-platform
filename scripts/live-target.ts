#!/usr/bin/env tsx
/**
 * Nennt das Projekt, das der auszuliefernde Build anspricht (AGE-536).
 *
 *   infisical run --env=prod -- pnpm tsx scripts/live-target.ts
 *
 * Auf STDOUT stehen zwei Zeilen, maschinenlesbar — Umgebung, dann Ref:
 *
 *   dev
 *   foelowldexkcqzewvrcf
 *
 * Dieselbe Form wie `deploy-base.ts`, aus demselben Grund: der Aufrufer leitet
 * STDOUT in eine Datei und liest sie mit `head`/`tail`, statt sich darauf zu
 * verlassen, dass kein Werkzeug in der Kette eine Zeile dazwischenschreibt.
 * Alles Erklärende geht deshalb nach STDERR.
 *
 * Die URL selbst wird nie ausgegeben — sie ist zwar kein Geheimnis, aber die
 * Hausregel für Zielangaben lautet Ref und Host, nicht die Verbindung.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { bestimmeLiveZiel } from "./live-target.logic";

const HIER = dirname(fileURLToPath(import.meta.url));

function lies(datei: string): string {
  try {
    return readFileSync(join(HIER, datei), "utf8").trim();
  } catch {
    // Ein fehlender Sollwert ist kein „passt nie", sondern Nichtwissen. Der
    // leere String faellt unten durch dieselbe Ref-Pruefung wie ein vertippter.
    return "";
  }
}

const ergebnis = bestimmeLiveZiel({
  apiUrl: process.env.VITE_SUPABASE_URL,
  devRef: lies("dev-project-ref.txt"),
  prodRef: lies("prod-project-ref.txt"),
});

if (ergebnis.kind === "abbruch") {
  console.error(`::error::Ziel des Builds nicht bestimmbar — ${ergebnis.grund}`);
  process.exit(1);
}

console.error(
  `Der ausgelieferte Build spricht das ${ergebnis.umgebung.toUpperCase()}-Projekt an (${ergebnis.ref}).`,
);
console.log(ergebnis.umgebung);
console.log(ergebnis.ref);
