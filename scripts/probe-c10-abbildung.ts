/**
 * Probe: die Abbildung gegen die echte Quelldatei (AGE-534, Aufgaben 3.1–3.6).
 *
 * Sie prüft KEINE festen Zahlen. Das Design hält fest, dass die Quelle vor dem
 * Go-Live neu gezogen wird — eine verdrahtete „47" wäre danach falsch, ohne dass
 * etwas kaputt wäre. Geprüft werden stattdessen INVARIANTEN zwischen Quelle und
 * Ergebnis: aus einem befüllten `biete` muss eine `offers`-Zeile werden, aus
 * einem leeren keine, und aus keinem Feld darf mehr entstehen, als drinstand.
 *
 * Ausgegeben werden ausschliesslich Zählwerte. Die Datei trägt Personendaten
 * von 70 Menschen; kein Wert daraus geht hier durch stdout.
 *
 * Aufruf:
 *   pnpm tsx scripts/probe-c10-abbildung.ts <pfad-zur-quelle>
 */

import { readFileSync } from "node:fs";

import { parse } from "csv-parse/sync";

import { bildeAb } from "../supabase/seed/wp_import.lib";
import { htmlEntfernen } from "../supabase/seed/wp_felder";

const quelle = process.argv[2];
if (!quelle) {
  console.error("Aufruf: pnpm tsx scripts/probe-c10-abbildung.ts <pfad-zur-quelle>");
  process.exit(2);
}

const zeilen: Record<string, string>[] = parse(readFileSync(quelle), {
  columns: true,
  bom: true,
  relax_quotes: true,
});

/** „Befüllt" nach derselben Leerwertregel, die auch die Abbildung anlegt. */
const befuellt = (feld: string): number =>
  zeilen.filter((z) => htmlEntfernen(z[feld] ?? "").trim() !== "").length;

const saetze = zeilen.map(bildeAb);
const zaehle = (f: (s: (typeof saetze)[number]) => unknown): number =>
  saetze.filter((s) => {
    const v = f(s);
    return Array.isArray(v) ? v.length > 0 : v !== null && v !== undefined;
  }).length;

const fehler: string[] = [];
const pruefe = (name: string, quellFeld: string, ist: number) => {
  const soll = befuellt(quellFeld);
  const zeichen = ist === soll ? "ok  " : "FEHL";
  console.log(`  ${zeichen}  ${name.padEnd(28)} Quelle ${String(soll).padStart(2)} → Ziel ${ist}`);
  if (ist !== soll) fehler.push(`${name}: Quelle ${soll}, Ziel ${ist}`);
};

console.log(`Datensätze: ${zeilen.length}\n`);
console.log("Ein befülltes Quellfeld muss genau ein befülltes Ziel ergeben:");
pruefe("beruf → headline", "beruf", zaehle((s) => s.profil.headline));
pruefe("ort_27_28 → region", "ort_27_28", zaehle((s) => s.profil.region));
pruefe("Homepage → website", "Homepage", zaehle((s) => s.profil.website));
pruefe("Strasse → street", "Strasse", zaehle((s) => s.kontakt.street));
pruefe("ort_27 → state", "ort_27", zaehle((s) => s.kontakt.state));
pruefe("E-Mail → kontakt.email", "E-Mail", zaehle((s) => s.kontakt.email));
pruefe("Telefonnummer → phone", "Telefonnummer", zaehle((s) => s.kontakt.phone));
pruefe("Mitgliedschaft → legacy_tier", "Mitgliedschaft", zaehle((s) => s.legacy.legacy_tier));
pruefe("source_user_id → legacy", "source_user_id", zaehle((s) => s.legacy.legacy_source_id));
pruefe("user_email → Anmeldung", "user_email", zaehle((s) => s.anmeldeadresse));
pruefe("biete → offers", "biete", zaehle((s) => s.offers));
pruefe("suche → needs", "suche", zaehle((s) => s.needs));
pruefe("infos_28 → interessen", "infos_28", zaehle((s) => s.interessen));

console.log("\nZusammengesetzte Ziele (mehrere Quellen, deshalb kein 1:1):");
const bioQuellen = zeilen.filter(
  (z, i) =>
    htmlEntfernen(z["infos"] ?? "").trim() !== "" ||
    htmlEntfernen(z["infos_15"] ?? "").trim() !== "" ||
    saetze[i].profil.videos.length < [z["praesi_kurz"], z["praesei_lang"]].filter((v) => (v ?? "").trim() !== "").length,
).length;
const bioZiel = zaehle((s) => s.profil.short_bio);
console.log(`  ${bioQuellen === bioZiel ? "ok  " : "FEHL"}  short_bio aus infos/infos_15/praesi   Quelle ${bioQuellen} → Ziel ${bioZiel}`);
if (bioQuellen !== bioZiel) fehler.push(`short_bio: Quelle ${bioQuellen}, Ziel ${bioZiel}`);

for (const netz of ["linkedin", "facebook", "instagram", "youtube", "twitter"]) {
  const ist = saetze.filter((s) => s.profil.socials[netz]).length;
  pruefe(`${netz} → socials.${netz}`, netz, ist);
}

const praesiGesamt =
  befuellt("praesi_kurz") + befuellt("praesei_lang");
const videos = saetze.reduce((n, s) => n + s.profil.videos.length, 0);
const praesiImText = praesiGesamt - videos;
console.log(
  `  ——    praesi_* aufgeteilt              ${praesiGesamt} = ${videos} Video + ${praesiImText} Text`,
);

const beitritt = zaehle((s) => s.profil.member_since);
const infos16 = befuellt("infos_16");
console.log(
  `  ${beitritt <= infos16 ? "ok  " : "FEHL"}  infos_16 → member_since        Quelle ${infos16} → Ziel ${beitritt}` +
    `${beitritt < infos16 ? ` (${infos16 - beitritt} nicht als Datum lesbar)` : ""}`,
);
if (beitritt > infos16) fehler.push("member_since: mehr Daten als Quellwerte");

console.log("\nHarte Zusicherungen:");
const ohneTitel = saetze.filter((s) =>
  [...s.offers, ...s.needs].some((e) => e.title.trim() === ""),
).length;
console.log(`  ${ohneTitel === 0 ? "ok  " : "FEHL"}  offers/needs ohne Titel: ${ohneTitel} (die Spalte ist not null)`);
if (ohneTitel > 0) fehler.push(`${ohneTitel} offers/needs-Zeilen ohne Titel`);

// Der Passwort-Hash darf im Ergebnis nirgends auftauchen — auch nicht als Teil
// eines Feldes, das ihn versehentlich mitschleppt.
const alsText = JSON.stringify(saetze);
const hashes = zeilen.map((z) => (z["user_pass"] ?? "").trim()).filter((h) => h.length > 8);
const durchgesickert = hashes.filter((h) => alsText.includes(h)).length;
console.log(
  `  ${durchgesickert === 0 ? "ok  " : "FEHL"}  user_pass im Ergebnis: ${durchgesickert} von ${hashes.length}`,
);
if (durchgesickert > 0) fehler.push(`${durchgesickert} Passwort-Hashes im Ergebnis`);

console.log("");
if (fehler.length > 0) {
  console.error(`FEHLGESCHLAGEN — ${fehler.length} Abweichung(en):`);
  for (const f of fehler) console.error(`  · ${f}`);
  process.exit(1);
}
console.log("Alle Invarianten halten.");
