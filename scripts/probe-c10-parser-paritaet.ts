#!/usr/bin/env tsx
/**
 * Paritätsprüfung der übertragenen Feldparser (AGE-534, Aufgabe 2.7).
 *
 * WOZU. Die Parser sind aus `wp_feld_parser.py` nach TypeScript übertragen. Ein
 * Port ist erst belegt, wenn er auf denselben Daten dieselben Zahlen liefert wie
 * die Vorlage — Unit-Tests belegen nur die Fälle, die ich mir ausgedacht habe.
 * Die Sollwerte unten stammen aus einem Lauf der Python-Vorlage gegen den Export
 * vom 13.08.2026 (70 Datensätze).
 *
 * WAS AUSGEGEBEN WIRD. Nur Zählwerte, nie ein Feldinhalt. Die Quelle trägt
 * Klarnamen, Anschriften und Telefonnummern von 70 Menschen, und diese Ausgabe
 * landet in der Shell-History dessen, der sie aufruft.
 *
 * ZWEI SOLLWERTE SIND ABSICHTLICH VERSCHIEDEN VON DER VORLAGE. Beide sind im
 * Kopf von `wp_felder.ts` begründet: der Wohnort wird nicht aus der
 * Regionalgruppe aufgefüllt (die Vorlage kennt dafür eine eigene Güteklasse
 * `plz_+_standort`), und zweistellige Jahreszahlen werden nicht gelesen.
 *
 *   pnpm tsx scripts/probe-c10-parser-paritaet.ts <pfad/zur/quelle.csv>
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parse } from "csv-parse/sync";

import {
  datumParsen,
  ortParsen,
  phpArray,
  telefonParsen,
  type OrtGuete,
} from "../supabase/seed/wp_felder";
import { echterPfadAufPlatte } from "../supabase/seed/wp_import";
import { pruefeQuellPfad } from "../supabase/seed/wp_import.lib";

const REPO_WURZEL = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Gemessen mit der Python-Vorlage am 14.08.2026 gegen den Export vom 13.08. */
const SOLL = {
  datensaetze: 70,
  ort: { ok: 33, nur_ort: 15, nur_plz: 2, leer: 20 },
  whatsappBefuellt: 49,
  whatsappMitInhalt: 43,
  mitgliedschaftBefuellt: 4,
  mitgliedschaftMitInhalt: 3,
  datumBefuellt: 52,
  datumGelesen: 52,
  datumOhneTag: 16,
  datumOhneMonat: 6,
  telefonBefuellt: 52,
  telefonMitApostroph: 17,
} as const;

const pfadArgument = process.argv[2];
if (!pfadArgument) {
  console.error("Aufruf: pnpm tsx scripts/probe-c10-parser-paritaet.ts <pfad/zur/quelle.csv>");
  process.exit(1);
}

const gepruefterPfad = pruefeQuellPfad({
  pfad: pfadArgument,
  cwd: process.cwd(),
  repoWurzel: REPO_WURZEL,
  echterPfad: echterPfadAufPlatte,
});
if (gepruefterPfad.kind === "abbruch") {
  console.error(gepruefterPfad.grund);
  process.exit(1);
}

const zeilen = parse(readFileSync(gepruefterPfad.pfad, "utf8"), {
  columns: true,
  bom: true,
  skip_empty_lines: true,
}) as Array<Record<string, string>>;

const befuellt = (feld: string) => zeilen.filter((z) => (z[feld] ?? "").trim() !== "").length;

const orte = zeilen.map((z) => ortParsen(z.ort ?? ""));
const ortZaehlung = orte.reduce<Record<string, number>>((acc, o) => {
  acc[o.guete] = (acc[o.guete] ?? 0) + 1;
  return acc;
}, {});

const datumsRoh = zeilen.map((z) => z.infos_16 ?? "").filter((r) => r.trim() !== "");
const datumsWerte = datumsRoh.map(datumParsen);
const gelesen = datumsWerte.filter((d) => d !== null);

const telefone = zeilen.map((z) => z.Telefonnummer ?? "").filter((t) => t.trim() !== "");

const pruefungen: Array<[string, number, number]> = [
  ["Datensätze", zeilen.length, SOLL.datensaetze],
  ["Ort: ok", ortZaehlung.ok ?? 0, SOLL.ort.ok],
  ["Ort: nur_ort", ortZaehlung.nur_ort ?? 0, SOLL.ort.nur_ort],
  ["Ort: nur_plz", ortZaehlung.nur_plz ?? 0, SOLL.ort.nur_plz],
  ["Ort: leer", ortZaehlung.leer ?? 0, SOLL.ort.leer],
  ["WhatsApp befüllt", befuellt("WhatsApp"), SOLL.whatsappBefuellt],
  [
    "WhatsApp mit Inhalt",
    zeilen.filter((z) => phpArray(z.WhatsApp ?? "").length > 0).length,
    SOLL.whatsappMitInhalt,
  ],
  ["Mitgliedschaft befüllt", befuellt("Mitgliedschaft"), SOLL.mitgliedschaftBefuellt],
  [
    "Mitgliedschaft mit Inhalt",
    zeilen.filter((z) => phpArray(z.Mitgliedschaft ?? "").length > 0).length,
    SOLL.mitgliedschaftMitInhalt,
  ],
  ["Datum befüllt", datumsRoh.length, SOLL.datumBefuellt],
  ["Datum gelesen", gelesen.length, SOLL.datumGelesen],
  ["Datum ohne Tag", gelesen.filter((d) => d!.grad !== "tag").length, SOLL.datumOhneTag],
  ["Datum ohne Monat", gelesen.filter((d) => d!.grad === "jahr").length, SOLL.datumOhneMonat],
  ["Telefon befüllt", telefone.length, SOLL.telefonBefuellt],
  [
    "Telefon mit Apostroph",
    telefone.filter((t) => t.trim().startsWith("'")).length,
    SOLL.telefonMitApostroph,
  ],
];

let abweichungen = 0;
for (const [name, ist, soll] of pruefungen) {
  const gleich = ist === soll;
  if (!gleich) abweichungen++;
  console.log(`${gleich ? "  ok " : "ABW "} ${name.padEnd(28)} ist=${ist}  soll=${soll}`);
}

// Ein Apostroph darf nach dem Parsen nirgends mehr stehen — der Zählwert oben
// belegt nur, dass er vorher da war.
const restApostroph = telefone.filter((t) => telefonParsen(t).startsWith("'")).length;
console.log(
  `${restApostroph === 0 ? "  ok " : "ABW "} Apostroph nach dem Parsen  ist=${restApostroph}  soll=0`,
);
if (restApostroph !== 0) abweichungen++;

// Güteklassen, die es nicht geben darf: die Vorlage kennt `plz_+_standort`,
// dieser Port bewusst nicht.
const unbekannt = Object.keys(ortZaehlung).filter(
  (k) => !["ok", "nur_ort", "nur_plz", "leer"].includes(k as OrtGuete),
);
if (unbekannt.length > 0) {
  console.log(`ABW  Unbekannte Güteklasse: ${unbekannt.join(", ")}`);
  abweichungen++;
}

console.log(
  abweichungen === 0
    ? "\nParität: alle Zählwerte gleich."
    : `\nParität VERFEHLT: ${abweichungen} Abweichung(en) — Fehler im Port, nicht in den Sollwerten.`,
);
process.exit(abweichungen === 0 ? 0 : 1);
