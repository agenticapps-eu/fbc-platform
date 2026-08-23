#!/usr/bin/env tsx
/** NUR LESEN. Gleicht die 60 Namen/Adressen aus Detlevs Screenshots gegen die DB ab. */
import { readFile } from "node:fs/promises";
import pg from "pg";

const seite = process.argv[2];
const tsv = process.argv[3];
if (seite !== "prod" && seite !== "dev") throw new Error("Argument: prod|dev <tsv>");
const url = seite === "prod" ? process.env.SUPABASE_DB_URL_PROD : process.env.SUPABASE_DB_URL_DEV;
if (!url) throw new Error(`URL fuer ${seite} fehlt`);
const ref = new URL(url).username.replace(/^postgres\./, "");
const erwartet = (await readFile(`scripts/${seite}-project-ref.txt`, "utf8")).trim();
if (ref !== erwartet) throw new Error(`Kennung ${ref} != ${erwartet}`);

const db = new pg.Client({ connectionString: url, ssl: { ca: await readFile("scripts/supabase-root-2021-ca.crt", "utf8") } });
await db.connect();
await db.query("set default_transaction_read_only = on");
await db.query("set statement_timeout = '30s'");

type Zeile = { kategorie: string; vorname: string; nachname: string; jahrestag: string; email: string };
const zeilen: Zeile[] = (await readFile(tsv, "utf8")).trim().split("\n").slice(1).map((l) => {
  const [kategorie, vorname, nachname, jahrestag, email] = l.split("\t");
  return { kategorie, vorname, nachname, jahrestag, email };
});

const konten = (await db.query(`
  select p.id, p.name, p.tier, p.activated_at, p.member_since, u.email::text as login_email,
         c.email::text as kontakt_email, l.paid_until
    from public.profiles p
    join auth.users u on u.id = p.id
    left join public.profile_contacts c on c.profile_id = p.id
    left join public.profile_legacy   l on l.profile_id = p.id
   order by p.name`)).rows;

const norm = (s: string | null) => (s ?? "").trim().toLowerCase();
const nameNorm = (s: string | null) => norm(s).replace(/\s+/g, " ");

const getroffen = new Set<string>();
const ergebnis = zeilen.map((z) => {
  const perEmail = konten.filter((k) => norm(k.login_email) === norm(z.email) || norm(k.kontakt_email) === norm(z.email));
  const voll = nameNorm(`${z.vorname} ${z.nachname}`);
  const perName = konten.filter((k) => nameNorm(k.name) === voll);
  const perNachname = konten.filter((k) => nameNorm(k.name).endsWith(" " + nameNorm(z.nachname)) && nameNorm(k.name).startsWith(nameNorm(z.vorname).split(" ")[0]));
  const treffer = perEmail.length ? perEmail : perName.length ? perName : perNachname;
  const wie = perEmail.length ? "email" : perName.length ? "name" : perNachname.length ? "name~" : "-";
  treffer.forEach((t) => getroffen.add(t.id));
  return { ...z, wie, treffer };
});

console.log(`### ${seite} (${ref}) — ${konten.length} Konten in der DB, ${zeilen.length} Zeilen aus den Screenshots\n`);
console.log("## Nicht gefunden");
for (const e of ergebnis.filter((e) => e.treffer.length === 0))
  console.log(`  ${e.kategorie.padEnd(12)} ${e.vorname} ${e.nachname}  <${e.email}>`);
console.log("\n## Mehrdeutig (>1 Treffer)");
for (const e of ergebnis.filter((e) => e.treffer.length > 1))
  console.log(`  ${e.vorname} ${e.nachname} <${e.email}> -> ${e.treffer.map((t) => `${t.name} <${t.login_email}>`).join(" | ")}`);
console.log("\n## Getroffen, aber nur über den Namen (Adresse weicht ab)");
for (const e of ergebnis.filter((e) => e.treffer.length === 1 && e.wie !== "email"))
  console.log(`  ${e.vorname} ${e.nachname}: Liste <${e.email}>  DB <${e.treffer[0].login_email}> / kontakt <${e.treffer[0].kontakt_email ?? "-"}>`);
console.log(`\n## Zusammenfassung`);
console.log(`  eindeutig getroffen: ${ergebnis.filter((e) => e.treffer.length === 1).length}`);
console.log(`  davon aktiviert:     ${ergebnis.filter((e) => e.treffer.length === 1 && e.treffer[0].activated_at).length}`);
console.log(`  nicht gefunden:      ${ergebnis.filter((e) => e.treffer.length === 0).length}`);
console.log(`  mehrdeutig:          ${ergebnis.filter((e) => e.treffer.length > 1).length}`);
console.log(`\n## In der DB, aber NICHT auf Detlevs Liste (${konten.length - getroffen.size})`);
for (const k of konten.filter((k) => !getroffen.has(k.id)))
  console.log(`  ${(k.name ?? "(ohne Namen)").padEnd(28)} <${k.login_email}>  tier=${k.tier} aktiviert=${k.activated_at ? "ja" : "nein"}`);
await db.end();
