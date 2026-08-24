#!/usr/bin/env tsx
/**
 * ABNAHME der Datenpflege aus AGE-581, Abschnitt 12.7 (zweite Hälfte). NUR LESEN.
 *
 * ══ WARUM NICHT DER ZÄHLER IM SCHREIBSKRIPT ════════════════════════════════
 * Der zählt mit demselben Rechenkern, mit dem er geschrieben hat, und aus
 * derselben Quelldatei. Teilt sich beides einen Fehler, meldet es Erfolg —
 * genau das ist am 24.08. passiert: die Zuordnung war kaputt, und jede
 * Kennzahl, die aus ihr stammte, sah trotzdem plausibel aus.
 *
 * Dieser Lauf kennt die Quelldatei NICHT. Er stellt nur Fragen an die
 * Datenbank, deren Antwort man vorher aufschreiben kann.
 *
 * ══ DIE WICHTIGSTE FRAGE IST NICHT EINE ZAHL ═══════════════════════════════
 * Sondern die Doppelsperre: `disabled_at` und `banned_until` gehören zusammen.
 * Ein Konto, das verborgen ist und sich anmelden kann, ist der halbe Zustand,
 * gegen den dieser ganze Change gebaut wurde. Er lässt sich nicht zählen,
 * sondern nur paarweise prüfen — in BEIDE Richtungen.
 *
 * Aufruf:
 *   infisical run --env=prod -- npx tsx scripts/probe-age581-datenpflege-abnahme.ts
 */
import { readFile } from "node:fs/promises";

import pg from "pg";

const STICHTAG = "2026-08-23";

const url = process.env.SUPABASE_DB_URL_PROD;
if (!url) throw new Error("SUPABASE_DB_URL_PROD fehlt");
const ref = new URL(url).username.replace(/^postgres\./, "");
const erwartet = (await readFile("scripts/prod-project-ref.txt", "utf8")).trim();
if (ref !== erwartet) throw new Error(`Kennung ${ref} != ${erwartet}`);

const db = new pg.Client({
  connectionString: url,
  ssl: { ca: await readFile("scripts/supabase-root-2021-ca.crt", "utf8") },
});
await db.connect();
await db.query("set default_transaction_read_only = on");
await db.query("set statement_timeout = '30s'");

let fehler = 0;
const pruefe = (was: string, ist: unknown, soll: unknown) => {
  const ok = String(ist) === String(soll);
  if (!ok) fehler++;
  console.log(
    `  ${ok ? "✓" : "✖"} ${was.padEnd(46)} ist ${String(ist).padStart(4)}  soll ${String(soll).padStart(4)}`,
  );
};
const eine = async (sql: string, werte: unknown[] = []) => (await db.query(sql, werte)).rows[0];

console.log(`\n═══ AGE-581 · Abnahme 12.7 · PROD (${ref}) · nur lesend ═══\n`);

console.log("── Bestand ".padEnd(72, "─"));
pruefe("Profile", (await eine("select count(*) n from public.profiles")).n, 72);
pruefe(
  "davon tier = impact",
  (await eine("select count(*) n from public.profiles where tier = 'impact'")).n,
  72,
);
pruefe(
  "Profile ohne auth.users-Zeile",
  (
    await eine(
      "select count(*) n from public.profiles p where not exists (select 1 from auth.users u where u.id = p.id)",
    )
  ).n,
  0,
);

console.log("\n── 12.2 Zahlungsarten ".padEnd(72, "─"));
const SOLL: Record<string, number> = {
  rechnung: 28,
  stripe: 15,
  copecart: 6,
  partner: 5,
  ehren: 3,
  digistore24: 1,
  paypal: 1,
  offen: 1,
};
const je = new Map<string, string>();
for (const r of (
  await db.query(
    "select payment_type, count(*) n from public.profile_legacy where payment_type is not null group by 1",
  )
).rows)
  je.set(r.payment_type, r.n);
for (const [art, soll] of Object.entries(SOLL))
  pruefe(`payment_type = ${art}`, je.get(art) ?? 0, soll);
pruefe(
  "Summe",
  (await eine("select count(*) n from public.profile_legacy where payment_type is not null")).n,
  60,
);

console.log("\n── 12.1 / 12.3 bezahlt bis ".padEnd(72, "─"));
pruefe(
  "mit paid_until",
  (await eine("select count(*) n from public.profile_legacy where paid_until is not null")).n,
  57,
);
pruefe(
  "ohne paid_until, aber mit Zahlungsart (12.3)",
  (
    await eine(
      "select count(*) n from public.profile_legacy where paid_until is null and payment_type is not null",
    )
  ).n,
  3,
);
pruefe(
  "davon Zahlungsart stripe",
  (
    await eine(
      "select count(*) n from public.profile_legacy where paid_until is null and payment_type = 'stripe'",
    )
  ).n,
  3,
);
// Jedes Datum muss NACH dem Stichtag liegen. Ein Wert davor hiesse, die Regel
// „nächstes Vorkommen" hat nicht gegriffen — die Mitgliedschaft wäre abgelaufen
// ausgewiesen, obwohl sie läuft.
pruefe(
  `paid_until <= ${STICHTAG} (darf es nicht geben)`,
  (await eine("select count(*) n from public.profile_legacy where paid_until <= $1", [STICHTAG])).n,
  0,
);
pruefe(
  "paid_until weiter als ein Jahr voraus (darf es nicht geben)",
  (
    await eine(
      "select count(*) n from public.profile_legacy where paid_until > ($1::date + interval '1 year')",
      [STICHTAG],
    )
  ).n,
  0,
);

console.log("\n── 12.5 / 12.6 Lebenszyklus ".padEnd(72, "─"));
pruefe(
  "deaktiviert",
  (await eine("select count(*) n from public.profiles where disabled_at is not null")).n,
  12,
);
pruefe(
  "gelöscht",
  (await eine("select count(*) n from public.profiles where deleted_at is not null")).n,
  0,
);

console.log("\n── Die Doppelsperre, in BEIDE Richtungen ".padEnd(72, "─"));
// Verborgen, aber anmeldefähig: die Hälfte, die der Change verbietet.
pruefe(
  "deaktiviert OHNE GoTrue-Bann",
  (
    await eine(`select count(*) n from public.profiles p join auth.users u on u.id = p.id
                where p.disabled_at is not null
                  and (u.banned_until is null or u.banned_until <= now())`)
  ).n,
  0,
);
// Sichtbar, aber ausgesperrt: die andere Hälfte, und die wäre nach der Heilung
// vom 24.08. der Rückstand, wenn `enable` nur die Datenbank geöffnet hätte.
pruefe(
  "NICHT deaktiviert, aber gebannt",
  (
    await eine(`select count(*) n from public.profiles p join auth.users u on u.id = p.id
                where p.disabled_at is null
                  and u.banned_until is not null and u.banned_until > now()`)
  ).n,
  0,
);

console.log("\n── Die Spur ".padEnd(72, "─"));
// Die Zeitspalte heisst `at`, nicht `created_at` (20260811090300:87).
for (const r of (
  await db.query(
    "select action, count(*) n from public.admin_audit where at > now() - interval '2 hours' group by 1 order by 1",
  )
).rows)
  console.log(`  ${String(r.n).padStart(4)} × ${r.action}`);

await db.end();
console.log(
  fehler === 0 ? "\n  ✓ Alle Zusagen erfüllt.\n" : `\n  ✖ ${fehler} Zusage(n) NICHT erfüllt.\n`,
);
if (fehler > 0) process.exit(1);
