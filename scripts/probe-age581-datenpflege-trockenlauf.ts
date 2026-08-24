#!/usr/bin/env tsx
/**
 * TROCKENLAUF zur Datenpflege aus AGE-581, Abschnitt 12.7.
 *
 * NUR LESEN. Die Sitzung setzt `default_transaction_read_only`, damit ein
 * versehentliches `update` in diesem Skript an der Datenbank scheitert und
 * nicht am Vorsatz.
 *
 * Wofür: 12.1 bis 12.6 schreiben in die PRODUKTIONSDATENBANK. Dieser Lauf sagt
 * VORHER, welche Umgebung gemeint ist, was sich ändern WÜRDE und welche
 * Endzahlen danach zu erwarten sind. Ein Durchgang, der seine Ergebniszahlen
 * erst hinterher bestimmt, kann nicht fehlschlagen.
 *
 * Aufruf:
 *   infisical run --env=prod -- npx tsx scripts/probe-age581-datenpflege-trockenlauf.ts prod <tsv>
 *
 * Die TSV-Quelldatei ist NICHT eingecheckt und darf es nicht werden — das Repo
 * ist öffentlich, die Datei trägt sechzig Klarnamen und Adressen.
 */
import { readFile } from "node:fs/promises";
import pg from "pg";

import {
  adresseWeichtAb,
  findeDoppelbelegung,
  ordneZu,
  paidUntilAus,
  ZAHLUNGSARTEN,
  type Konto,
  type Uebersichtszeile,
} from "./age581-datenpflege.logic";

/** Fest, nicht „heute". Siehe docs/age-581-mitgliederabgleich.md. */
const STICHTAG = "2026-08-23";

const seite = process.argv[2];
const tsvPfad = process.argv[3];
if ((seite !== "prod" && seite !== "dev") || !tsvPfad) throw new Error("Aufruf: <prod|dev> <tsv>");

const url = seite === "prod" ? process.env.SUPABASE_DB_URL_PROD : process.env.SUPABASE_DB_URL_DEV;
if (!url) throw new Error(`URL für ${seite} fehlt`);

// Host und Region sind bei Supabase seitenübergreifend gleich; die Kennung
// steht im BENUTZERNAMEN. Nur die trennt PROD von DEV.
const ref = new URL(url).username.replace(/^postgres\./, "");
const erwartet = (await readFile(`scripts/${seite}-project-ref.txt`, "utf8")).trim();
if (ref !== erwartet) throw new Error(`Kennung ${ref} != ${erwartet} — falsche Umgebung`);

const db = new pg.Client({
  connectionString: url,
  ssl: { ca: await readFile("scripts/supabase-root-2021-ca.crt", "utf8") },
});
await db.connect();
await db.query("set default_transaction_read_only = on");
await db.query("set statement_timeout = '30s'");

// Sechste Spalte optional: die heutige Anmeldeadresse des gemeinten Kontos,
// gesetzt nur dort, wo Adresse und Name die Zuordnung nicht tragen.
const zeilen: Uebersichtszeile[] = (await readFile(tsvPfad, "utf8"))
  .trim()
  .split("\n")
  .slice(1)
  .map((l) => {
    const [kategorie, vorname, nachname, jahrestag, email, kontoEmail] = l.split("\t");
    return {
      kategorie: kategorie.trim(),
      vorname,
      nachname,
      jahrestag,
      email,
      ...(kontoEmail?.trim() ? { kontoEmail: kontoEmail.trim() } : {}),
    };
  });

const unbekannt = [...new Set(zeilen.map((z) => z.kategorie))].filter(
  (k) => !(ZAHLUNGSARTEN as readonly string[]).includes(k),
);
if (unbekannt.length)
  throw new Error(`Kategorie ohne Entsprechung in der Datenbank: ${unbekannt.join(", ")}`);

const konten: Konto[] = (
  await db.query(`
  select p.id, p.name, u.email::text as login_email, c.email::text as kontakt_email,
         l.paid_until::text as paid_until, l.payment_type,
         p.activated_at::text as activated_at, p.disabled_at::text as disabled_at,
         p.deleted_at::text as deleted_at
    from public.profiles p
    join auth.users u on u.id = p.id
    left join public.profile_contacts c on c.profile_id = p.id
    left join public.profile_legacy   l on l.profile_id = p.id
   order by p.name`)
).rows;

// `staff_roles.profile_id` ist Primärschlüssel — höchstens eine Rolle je Konto.
const rollen = new Map<string, string>();
for (const r of (await db.query(`select profile_id, role from public.staff_roles`)).rows)
  rollen.set(r.profile_id, r.role);

const zuordnungen = ordneZu(zeilen, konten);
const eindeutig = zuordnungen.filter((z) => z.treffer.length === 1);
const getroffen = new Set(eindeutig.map((z) => z.treffer[0].id));
const doppelt = findeDoppelbelegung(zuordnungen);
const fest = zuordnungen.filter((z) => z.wie === "fest").length;

const kurz = (k: Konto) =>
  `${(k.name ?? "(ohne Namen)").slice(0, 24).padEnd(24)} <${k.login_email}>`;

console.log(`
╔══════════════════════════════════════════════════════════════════════════╗
║  TROCKENLAUF — Datenpflege AGE-581, Abschnitt 12                         ║
╚══════════════════════════════════════════════════════════════════════════╝

  Umgebung   ${seite.toUpperCase()}  (${ref})   — Kennung geprüft gegen scripts/${seite}-project-ref.txt
  Modus      NUR LESEN (default_transaction_read_only = on)
  Stichtag   ${STICHTAG}  (fest — nicht der Ausführungstag)
  Quelle     ${tsvPfad} — ${zeilen.length} Zeilen
  Konten     ${konten.length}
  Zuordnung  ${eindeutig.length} eindeutig (davon ${fest} fest gesetzt) · ${zuordnungen.filter((z) => z.treffer.length === 0).length} ohne Konto · ${zuordnungen.filter((z) => z.treffer.length > 1).length} mehrdeutig
`);

// ── Sperre: zwei Zeilen auf ein Konto ──────────────────────────────────────
if (doppelt.length) {
  console.log("── ✖ DOPPELBELEGUNG — hier darf NICHTS geschrieben werden ".padEnd(76, "─"));
  for (const d of doppelt) {
    const k = konten.find((k) => k.id === d.kontoId)!;
    console.log(
      `  Zeilen ${d.nummern.map((n) => "#" + n).join(" und ")} treffen dasselbe Konto: ${kurz(k)}`,
    );
    for (const n of d.nummern) {
      const z = zuordnungen.find((z) => z.nummer === n)!;
      console.log(
        `     #${n}  ${z.zeile.kategorie.padEnd(11)} ${z.zeile.vorname} ${z.zeile.nachname} · Jahrestag ${z.zeile.jahrestag} · Liste <${z.zeile.email}> · Treffer über ${z.wie}`,
      );
    }
  }
  console.log("\n  Ungeprüft schriebe der Lauf beide Jahrestage nacheinander in dieselbe");
  console.log('  Zeile, und das richtige Konto bliebe „ohne Eintrag" — also in 12.5.');
  console.log("  Auflösung: die sechste TSV-Spalte setzt die Zuordnung fest.\n");
}

// ── 12.1 paid_until ────────────────────────────────────────────────────────
console.log("── 12.1  paid_until aus dem Jahrestag ".padEnd(76, "─"));
let setzen = 0,
  aendern = 0,
  gleich = 0,
  bleibtLeer = 0,
  unlesbar = 0;
const zeilen121: string[] = [];
for (const z of eindeutig) {
  const k = z.treffer[0];
  const p = paidUntilAus(z.zeile.jahrestag, STICHTAG);
  if (p.art === "unlesbar") {
    unlesbar++;
    zeilen121.push(`  #${String(z.nummer).padStart(2)}  UNLESBAR  „${p.roh}"  ${kurz(k)}`);
    continue;
  }
  if (p.art === "ohne") {
    bleibtLeer++;
    if (k.paid_until)
      zeilen121.push(
        `  #${String(z.nummer).padStart(2)}  ACHTUNG   Liste „Ohne", DB trägt ${k.paid_until}  ${kurz(k)}`,
      );
    continue;
  }
  if (k.paid_until === p.wert) {
    gleich++;
    continue;
  }
  if (k.paid_until === null) {
    setzen++;
    zeilen121.push(
      `  #${String(z.nummer).padStart(2)}  setzen    —          → ${p.wert}  ${kurz(k)}`,
    );
  } else {
    aendern++;
    zeilen121.push(
      `  #${String(z.nummer).padStart(2)}  ändern    ${k.paid_until} → ${p.wert}  ${kurz(k)}`,
    );
  }
}
console.log(zeilen121.join("\n") || "  (keine Änderung)");
console.log(
  `\n  setzen ${setzen} · ändern ${aendern} · unverändert ${gleich} · bleibt leer (12.3) ${bleibtLeer} · unlesbar ${unlesbar}`,
);
console.log(`  ⇒ nach dem Lauf mit gesetztem paid_until: ${setzen + aendern + gleich}\n`);

// ── 12.2 payment_type ──────────────────────────────────────────────────────
console.log("── 12.2  payment_type aus der Kategorie ".padEnd(76, "─"));
let ptSetzen = 0,
  ptAendern = 0,
  ptGleich = 0;
const zeilen122: string[] = [];
for (const z of eindeutig) {
  const k = z.treffer[0];
  const soll = z.zeile.kategorie;
  if (k.payment_type === soll) {
    ptGleich++;
    continue;
  }
  if (k.payment_type === null) {
    ptSetzen++;
    continue;
  }
  ptAendern++;
  zeilen122.push(
    `  #${String(z.nummer).padStart(2)}  ändern    ${k.payment_type} → ${soll}  ${kurz(k)}`,
  );
}
const jeKategorie = new Map<string, number>();
for (const z of eindeutig)
  jeKategorie.set(z.zeile.kategorie, (jeKategorie.get(z.zeile.kategorie) ?? 0) + 1);
console.log(
  "  " +
    [...jeKategorie]
      .sort()
      .map(([k, n]) => `${k}=${n}`)
      .join(" · "),
);
if (zeilen122.length) console.log(zeilen122.join("\n"));
console.log(`\n  setzen ${ptSetzen} · ändern ${ptAendern} · unverändert ${ptGleich}`);
console.log(`  ⇒ nach dem Lauf mit gesetzter payment_type: ${ptSetzen + ptAendern + ptGleich}\n`);

// ── 12.4 Anmeldeadressen ───────────────────────────────────────────────────
console.log("── 12.4  Anmeldeadressen angleichen ".padEnd(76, "─"));
const abweichend = eindeutig.filter((z) =>
  adresseWeichtAb(z.zeile.email, z.treffer[0].login_email),
);
const belegtVon = new Map<string, Konto[]>();
for (const k of konten) {
  for (const a of [k.login_email, k.kontakt_email]) {
    if (!a) continue;
    const s = a.trim().toLowerCase();
    belegtVon.set(s, [...(belegtVon.get(s) ?? []), k]);
  }
}
let angleichen = 0;
for (const z of abweichend) {
  const k = z.treffer[0];
  const ziel = z.zeile.email.trim().toLowerCase();
  const gruende: string[] = [];
  if (!ziel.includes("@")) gruende.push("kein @ in der Listenadresse");
  const fremd = (belegtVon.get(ziel) ?? []).filter((a) => a.id !== k.id);
  if (fremd.length) gruende.push(`Adresse bereits vergeben an ${fremd.map(kurz).join(" | ")}`);
  if (rollen.has(k.id))
    gruende.push(`hält Rolle ${rollen.get(k.id)} — Fehlgriff sperrt aus der Fläche aus`);
  if (gruende.length)
    console.log(
      `  #${String(z.nummer).padStart(2)}  AUSNAHME  ${kurz(k)}\n              ${gruende.join("\n              ")}`,
    );
  else {
    angleichen++;
    console.log(
      `  #${String(z.nummer).padStart(2)}  ändern    <${k.login_email}> → <${z.zeile.email}>`,
    );
  }
}
console.log(
  `\n  abweichend ${abweichend.length} · angleichen ${angleichen} · ausgenommen ${abweichend.length - angleichen}`,
);
console.log(`  Weg: Edge Function admin-change-email (nicht update auf auth.users)\n`);

// ── 12.5 Konten ohne Übersichtseintrag ─────────────────────────────────────
console.log("── 12.5  Konten ohne Übersichtseintrag ".padEnd(76, "─"));
const ohneEintrag = konten.filter((k) => !getroffen.has(k.id));
let zuDeaktivieren = 0;
for (const k of ohneEintrag) {
  const r = rollen.get(k.id);
  const zustand = k.deleted_at ? "GELÖSCHT" : k.disabled_at ? "bereits deaktiviert" : "aktiv";
  if (r) console.log(`  BLEIBT    ${kurz(k)}  Rolle ${r} · ${zustand}`);
  else {
    zuDeaktivieren++;
    console.log(`  deakt.    ${kurz(k)}  ${zustand} · aktiviert=${k.activated_at ? "ja" : "nein"}`);
  }
}
console.log(
  `\n  ohne Eintrag ${ohneEintrag.length} · davon mit Rolle (bleiben) ${ohneEintrag.length - zuDeaktivieren} · zu deaktivieren ${zuDeaktivieren}`,
);
console.log(
  `  Weg: Edge Function admin-set-member-ban (nicht update auf disabled_at — sonst der halbe Zustand aus 4.5)\n`,
);

// ── 12.6 Übersichtseinträge ohne Konto ─────────────────────────────────────
console.log("── 12.6  Übersichtseinträge ohne Konto ".padEnd(76, "─"));
const ohneKonto = zuordnungen.filter((z) => z.treffer.length === 0);
for (const z of ohneKonto)
  console.log(
    `  anlegen   #${z.nummer} ${z.zeile.vorname} ${z.zeile.nachname} <${z.zeile.email}> · Kategorie ${z.zeile.kategorie} · danach sofort deaktivieren`,
  );
const mehrdeutig = zuordnungen.filter((z) => z.treffer.length > 1);
for (const z of mehrdeutig)
  console.log(
    `  MEHRDEUTIG #${z.nummer} → ${z.treffer.map(kurz).join(" | ")} — hier wird NICHTS geschrieben`,
  );
console.log(`\n  anzulegen ${ohneKonto.length} · mehrdeutig (ausgelassen) ${mehrdeutig.length}\n`);

// ── Erwartete Endzahlen ────────────────────────────────────────────────────
const istGesetztPt = konten.filter((k) => k.payment_type !== null).length;
const istGesetztPu = konten.filter((k) => k.paid_until !== null).length;
const istDeaktiviert = konten.filter((k) => k.disabled_at !== null).length;
const istGeloescht = konten.filter((k) => k.deleted_at !== null).length;
const zeile = (was: string, ist: number | string, soll: number | string) =>
  `  ${was.padEnd(34)} ${String(ist).padStart(6)} ${String(soll).padStart(9)}`;
console.log("── Erwartete Endzahlen ".padEnd(76, "─"));
console.log(`  ${"Kennzahl".padEnd(34)} ${"jetzt".padStart(6)} ${"nachher".padStart(9)}`);
console.log(zeile("Profile", konten.length, konten.length + ohneKonto.length));
console.log(
  zeile("mit payment_type", istGesetztPt, ptSetzen + ptAendern + ptGleich + ohneKonto.length),
);
// Das in 12.6 anzulegende Konto bekommt seine Werte beim Anlegen — es zählt in
// ALLEN drei Zeilen mit, sonst vergleicht die Abnahme später Äpfel mit Birnen.
const neueMitDatum = ohneKonto.filter(
  (z) => paidUntilAus(z.zeile.jahrestag, STICHTAG).art === "datum",
).length;
console.log(zeile("mit paid_until", istGesetztPu, setzen + aendern + gleich + neueMitDatum));
console.log(
  zeile("deaktiviert", istDeaktiviert, istDeaktiviert + zuDeaktivieren + ohneKonto.length),
);
console.log(zeile("gelöscht", istGeloescht, istGeloescht));
console.log(zeile("Anmeldeadressen angeglichen", 0, angleichen));
console.log("\n  Nichts davon wurde geschrieben. Dies war ein Trockenlauf.");

await db.end();

// Ein Trockenlauf, der einen Zustand meldet, in dem nicht geschrieben werden
// darf, muss auch so enden — sonst hängt die Sperre am Lesen der Ausgabe.
if (doppelt.length || mehrdeutig.length) {
  console.log(
    `\n  ✖ ABBRUCH: ${doppelt.length} Doppelbelegung(en), ${mehrdeutig.length} mehrdeutige Zeile(n). Erst auflösen, dann schreiben.\n`,
  );
  process.exit(1);
}
console.log("  ✓ Keine Doppelbelegung, keine Mehrdeutigkeit — 12.1 bis 12.6 sind schreibbar.\n");
