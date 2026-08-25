#!/usr/bin/env tsx
/**
 * NUR LESEN. Bestandserhebung fuer AGE-597 — „Ich biete / Ich suche".
 *
 * DIESES SKRIPT GIBT KEINE MITGLIEDERTEXTE AUS. Das Repo ist oeffentlich, und
 * woertliche Kompass-Zeilen tragen Firmen, Orte und URLs auch ohne Klarnamen
 * (Befund codex im Plan-Review). Ausgegeben werden ausschliesslich Zahlen und
 * Laengen — keine Titel, keine Beschreibungen, keine Kennungen.
 *
 * Zweck: die Praefix-Regel aus dem Spec-Delta an den echten 112 Zeilen pruefen,
 * statt sie zu raten. Gemessen werden mehrere Kandidaten-Regeln nebeneinander.
 */
import { readFile } from "node:fs/promises";
import pg from "pg";

const seite = process.argv[2] === "prod" ? "prod" : "dev";
const url = seite === "prod" ? process.env.SUPABASE_DB_URL_PROD! : process.env.SUPABASE_DB_URL_DEV!;
const ref = new URL(url).username.replace(/^postgres\./, "");
const erwartet = (await readFile(`scripts/${seite}-project-ref.txt`, "utf8")).trim();
if (ref !== erwartet) throw new Error(`Kennung ${ref} != ${erwartet}`);

const db = new pg.Client({
  connectionString: url,
  ssl: { ca: await readFile("scripts/supabase-root-2021-ca.crt", "utf8") },
});
await db.connect();
await db.query("set default_transaction_read_only = on");

const AUFZAEHLUNG = /^[ \t]*'-[ \t]*/gm;
const putzen = (t: string) => t.replace(AUFZAEHLUNG, "").trim();
// EIGENE, NICHTGLOBALE Fassung fuers Erkennen: `.test()` auf einem /g-Regex
// merkt sich `lastIndex` zwischen den Aufrufen und beginnt beim naechsten Mal
// mitten in der Zeichenkette — das zaehlt zu wenig. `replace` oben ist davon
// nicht betroffen, es setzt `lastIndex` selbst zurueck.
const AUFZAEHLUNG_ERKENNEN = /(^|\n)[ \t]*'-/;

type Zeile = { id: string; seite: "offer" | "need"; source: string; category: string | null; title: string; description: string | null; profile_id: string };

const r = await db.query<Zeile>(`
  select id, 'offer' as seite, source, category, title, description, profile_id from public.offers
  union all
  select id, 'need'  as seite, source, category, title, description, profile_id from public.needs`);
const zeilen = r.rows;

const z = (b: boolean) => (b ? 1 : 0);
const summe = (f: (x: Zeile) => boolean) => zeilen.filter(f).length;

console.log(`### ${seite} (${ref}) — ${zeilen.length} Zeilen (offers + needs)`);
console.table([
  { Merkmal: "source = chip", Zahl: summe((x) => x.source === "chip") },
  { Merkmal: "source = editor", Zahl: summe((x) => x.source === "editor") },
  { Merkmal: "source = sonstiges", Zahl: summe((x) => x.source !== "chip" && x.source !== "editor") },
  { Merkmal: "chip MIT Beschreibung", Zahl: summe((x) => x.source === "chip" && !!x.description?.trim()) },
  { Merkmal: "chip OHNE category", Zahl: summe((x) => x.source === "chip" && !x.category) },
  { Merkmal: "editor MIT category", Zahl: summe((x) => x.source === "editor" && !!x.category) },
  { Merkmal: "editor OHNE Beschreibung", Zahl: summe((x) => x.source === "editor" && !x.description?.trim()) },
]);

// Kategorien-Deckung gegen die Konfiguration im Code.
const { OFFER_CATEGORIES, NEED_CATEGORIES } = await import("../src/config/matching");
const bekannt = {
  offer: new Set(OFFER_CATEGORIES.map((c) => c.key)),
  need: new Set(NEED_CATEGORIES.map((c) => c.key)),
};
const mitKat = zeilen.filter((x) => x.category);
console.log(`\n### Kategorien: ${mitKat.length} Zeilen tragen eine`);
console.table([
  { Merkmal: "Schluessel im Code bekannt", Zahl: mitKat.filter((x) => bekannt[x.seite].has(x.category!)).length },
  { Merkmal: "Schluessel UNBEKANNT (Marke entfiele)", Zahl: mitKat.filter((x) => !bekannt[x.seite].has(x.category!)).length },
  { Merkmal: "verschiedene Titel-Werte je Kategorie > 1", Zahl: new Set(mitKat.map((x) => `${x.seite}:${x.category}:${putzen(x.title)}`)).size - new Set(mitKat.map((x) => `${x.seite}:${x.category}`)).size },
  { Merkmal: "Titel != Klartext der Kategorie", Zahl: mitKat.filter((x) => {
      const alle = x.seite === "offer" ? OFFER_CATEGORIES : NEED_CATEGORIES;
      const label = alle.find((c) => c.key === x.category)?.label;
      return label !== undefined && putzen(x.title) !== label;
    }).length },
]);

// Aufzaehlungszeichen.
const hatArtefakt = (t: string) => AUFZAEHLUNG_ERKENNEN.test(t.replace(/\r/g, ""));
console.log("\n### Aufzaehlungszeichen '-");
console.table([
  { Merkmal: "Titel beginnt mit '-", Zahl: summe((x) => /^[ \t]*'-/.test(x.title)) },
  { Merkmal: "Titel enthaelt '- am Zeilenanfang", Zahl: summe((x) => hatArtefakt(x.title)) },
  { Merkmal: "Beschreibung enthaelt '- am Zeilenanfang", Zahl: summe((x) => !!x.description && hatArtefakt(x.description)) },
]);

// Die Praefix-Regel: mehrere Kandidaten nebeneinander gemessen.
const freitext = zeilen.filter((x) => x.source === "editor" && !!x.description?.trim());
const norm = (t: string) => t.replace(/\s+/g, " ").trim();
const kand = { woertlichErsteZeile: 0, woertlichGanz: 0, normGanz: 0, wortgrenzeErsteZeile: 0, titelHatUmbruch: 0, titel80: 0, titel80WoertlichErsteZeile: 0, titel80NormGanz: 0, keineRegel: 0 };
for (const x of freitext) {
  const titel = putzen(x.title);
  const besch = putzen(x.description!);
  const erste = besch.split("\n").find((l) => l.trim() !== "")?.trim() ?? "";
  const wG = titel.slice(0, Math.max(0, titel.lastIndexOf(" ")));
  const a = erste.startsWith(titel) && titel !== "";
  const b = besch.startsWith(titel) && titel !== "";
  const c = norm(besch).startsWith(norm(titel)) && titel !== "";
  const d = wG !== "" && erste.startsWith(wG);
  kand.woertlichErsteZeile += z(a);
  kand.woertlichGanz += z(b);
  kand.normGanz += z(c);
  kand.wortgrenzeErsteZeile += z(d);
  kand.titelHatUmbruch += z(/\n/.test(x.title));
  const lang80 = x.title.length === 80;
  kand.titel80 += z(lang80);
  if (lang80) { kand.titel80WoertlichErsteZeile += z(a); kand.titel80NormGanz += z(c); }
  kand.keineRegel += z(!a && !b && !c && !d);
}
console.log(`\n### Praefix-Regel, gemessen an ${freitext.length} Freitext-Zeilen mit Beschreibung`);
console.table(Object.entries(kand).map(([Regel, Treffer]) => ({ Regel, Treffer })));

// Die Regel LAEUFT AUS DEM ECHTEN CODE (`src/lib/kompass-anzeige.ts`), nicht
// aus einer Kopie: eine nachgebaute Fassung haette gemessen, was dieses Skript
// tut, nicht was die Seite zeigt.
const { putzen: putzenEcht, wiederholtDenAnfang, kompassAnzeige } = await import("../src/lib/kompass-anzeige");
const gekuerzt = freitext.filter((x) => putzenEcht(x.title).endsWith("\u2026"));
console.log("\n### Die umgesetzte Regel");
console.table([
  { Merkmal: "Titel entfaellt", Zahl: freitext.filter((x) => wiederholtDenAnfang(x.title, x.description!)).length },
  { Merkmal: "Titel bleibt stehen", Zahl: freitext.filter((x) => !wiederholtDenAnfang(x.title, x.description!)).length },
  { Merkmal: "Titel endet auf Auslassungspunkte", Zahl: gekuerzt.length },
  { Merkmal: "davon von der Regel gefasst", Zahl: gekuerzt.filter((x) => wiederholtDenAnfang(x.title, x.description!)).length },
  { Merkmal: "Titel mit exakt 80 Zeichen", Zahl: freitext.filter((x) => x.title.length === 80).length },
]);

// ABNAHME UEBER DEN GANZEN BESTAND (Task 4.1), rein rechnerisch und ohne PII:
// was zeigt die Seite je Profil, nachdem beide Regeln gelaufen sind? Gesucht
// sind LEERE Abschnitte (eine Zeile, von der nichts uebrig bleibt) und
// Ausreisser in Menge und Laenge.
const jeProfilSeite = new Map<string, Zeile[]>();
for (const x of zeilen) {
  const k = `${x.profile_id}|${x.seite}`;
  jeProfilSeite.set(k, [...(jeProfilSeite.get(k) ?? []), x]);
}
let leereAbschnitte = 0;
let maxMarken = 0;
let maxTextZeichen = 0;
let maxTextBloecke = 0;
for (const [schluessel, gruppe] of jeProfilSeite) {
  const seite = schluessel.endsWith("|offer") ? "offer" : "need";
  const a = kompassAnzeige(gruppe, seite);
  // Ein Abschnitt, der zwar Zeilen hat, aber nichts Anzeigbares uebrig laesst.
  if (a.marken.length === 0 && a.eintraege.length === 0) leereAbschnitte++;
  maxMarken = Math.max(maxMarken, a.marken.length);
  maxTextBloecke = Math.max(maxTextBloecke, a.eintraege.length);
  for (const e of a.eintraege) maxTextZeichen = Math.max(maxTextZeichen, e.text.length);
}
console.log(`\n### Was die Seite zeigt — ueber alle ${jeProfilSeite.size} Abschnitte mit Inhalt`);
console.table([
  { Merkmal: "Abschnitte, die LEER wuerden", Zahl: leereAbschnitte },
  { Merkmal: "meiste Marken in EINER Reihe", Zahl: maxMarken },
  { Merkmal: "meiste Textbloecke in EINEM Abschnitt", Zahl: maxTextBloecke },
  { Merkmal: "laengster angezeigter Text (Zeichen)", Zahl: maxTextZeichen },
]);

// Ausreisser — nur Laengen und Anzahlen.
const laengen = zeilen.map((x) => putzen(x.description ?? "").length).sort((a, b) => b - a);
const proProfil = new Map<string, number>();
for (const x of zeilen.filter((y) => y.source === "chip")) proProfil.set(x.profile_id, (proProfil.get(x.profile_id) ?? 0) + 1);
console.log("\n### Ausreisser");
console.table([
  { Merkmal: "laengste Beschreibung (Zeichen)", Zahl: laengen[0] ?? 0 },
  { Merkmal: "Beschreibungen > 500 Zeichen", Zahl: laengen.filter((l) => l > 500).length },
  { Merkmal: "laengster Titel (Zeichen)", Zahl: Math.max(...zeilen.map((x) => x.title.length)) },
  { Merkmal: "meiste chip-Zeilen auf EINEM Profil", Zahl: Math.max(0, ...proProfil.values()) },
  { Merkmal: "Profile mit Kompass-Zeilen", Zahl: new Set(zeilen.map((x) => x.profile_id)).size },
]);

await db.end();
