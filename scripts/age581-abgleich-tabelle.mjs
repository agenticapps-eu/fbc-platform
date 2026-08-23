/** Erzeugt docs/age-581-mitgliederabgleich.md aus der TSV + dem PROD-Abgleich. NUR LESEN. */
import { readFileSync } from "node:fs";
const HEUTE = new Date(Date.UTC(2026, 7, 23));
const zeilen = readFileSync(process.argv[2], "utf8").trim().split("\n").slice(1)
  .map((l) => { const [kategorie, vorname, nachname, jahrestag, email] = l.split("\t");
                return { kategorie, vorname, nachname, jahrestag, email }; });
function paidUntil(j) {
  if (j === "Ohne") return null;
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(j); if (!m) return null;
  const tag = +m[1], monat = +m[2];
  let k = new Date(Date.UTC(HEUTE.getUTCFullYear(), monat - 1, tag));
  if (k <= HEUTE) k = new Date(Date.UTC(HEUTE.getUTCFullYear() + 1, monat - 1, tag));
  return new Date(k.getTime() - 86400000).toISOString().slice(0, 10);
}
const out = [];
out.push("| # | Kategorie | Name | Jahrestag | bezahlt bis | Adresse (Liste) |");
out.push("|---|---|---|---|---|---|");
zeilen.forEach((z, i) => {
  const p = paidUntil(z.jahrestag);
  out.push(`| ${i + 1} | ${z.kategorie} | ${z.vorname} ${z.nachname} | ${z.jahrestag} | ${p ?? "—"} | \`${z.email}\` |`);
});
console.log(out.join("\n"));
