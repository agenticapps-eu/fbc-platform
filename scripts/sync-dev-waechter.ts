#!/usr/bin/env tsx
/**
 * CLI über `sync-dev.logic.ts` — dieselbe Rolle, die `assert-target.ts` für
 * `db-push-prod.logic.ts` spielt: die geprüfte Funktion, nicht eine zweite
 * Regex an anderer Stelle.
 *
 *   tsx scripts/sync-dev-waechter.ts --seite=quelle
 *   tsx scripts/sync-dev-waechter.ts --seite=ziel
 *   tsx scripts/sync-dev-waechter.ts              # beide Seiten, echter Lauf
 *
 * Je Seite drei Werte, aus der Umgebung:
 *
 *   Quelle (PROD)  SUPABASE_DB_URL_PROD · SUPABASE_URL_PROD · SUPABASE_SERVICE_ROLE_KEY_PROD
 *   Ziel   (DEV)   SUPABASE_DB_URL_DEV  · SUPABASE_URL_DEV  · SUPABASE_SERVICE_ROLE_KEY_DEV
 *
 * WARUM DIE API-URL EIN EIGENER GESPEICHERTER WERT IST und nicht aus der
 * Kennung abgeleitet wird: abgeleitet stimmte sie immer, und die Prüfung
 * prüfte nichts. Gespeichert kann sie falsch sein — und sie IST es heute:
 * in Infisical `prod` zeigt `VITE_SUPABASE_URL` auf DEV. Genau diese Klasse
 * soll der Wächter fangen.
 *
 * Gibt Kennungen aus, nie die Werte: sie tragen Passwörter und Schlüssel.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { pruefeLauf, pruefeZugang, type Zugang } from "./sync-dev.logic";

const HIER = dirname(fileURLToPath(import.meta.url));
const ref = (umgebung: "prod" | "dev") =>
  readFileSync(join(HIER, `${umgebung}-project-ref.txt`), "utf8").trim();

/** Erlaubt, den Namen zu überschreiben — für die Sichtprobe an vorhandenen Werten. */
function ausUmgebung(name: string, ersatz?: string): string | undefined {
  return process.env[ersatz ?? name] ?? process.env[name];
}

const quelle: Zugang = {
  dbUrl: ausUmgebung("SUPABASE_DB_URL_PROD"),
  apiUrl: ausUmgebung("SUPABASE_URL_PROD", process.env.SYNC_QUELLE_URL_NAME),
  serviceKey: ausUmgebung("SUPABASE_SERVICE_ROLE_KEY_PROD", process.env.SYNC_QUELLE_KEY_NAME),
};
const ziel: Zugang = {
  dbUrl: ausUmgebung("SUPABASE_DB_URL_DEV"),
  apiUrl: ausUmgebung("SUPABASE_URL_DEV", process.env.SYNC_ZIEL_URL_NAME),
  serviceKey: ausUmgebung("SUPABASE_SERVICE_ROLE_KEY_DEV", process.env.SYNC_ZIEL_KEY_NAME),
};

const seite = process.argv.find((a) => a.startsWith("--seite="))?.slice("--seite=".length);

if (seite === "quelle" || seite === "ziel") {
  const soll = seite === "quelle" ? ref("prod") : ref("dev");
  const e = pruefeZugang(seite === "quelle" ? quelle : ziel);
  if (e.kind === "abbruch") {
    console.error(`::error::${seite === "quelle" ? "Quelle" : "Ziel"}: ${e.grund}`);
    process.exit(1);
  }
  if (e.ref !== soll) {
    console.error(`::error::${seite} trägt ${e.ref}, erwartet ${soll}.`);
    process.exit(1);
  }
  console.log(`${seite}: alle drei Werte zeigen auf ${e.ref} — wie erwartet.`);
} else if (seite !== undefined) {
  console.error(`::error::--seite=${seite} unbekannt. Erwartet: quelle | ziel`);
  process.exit(1);
} else {
  const e = pruefeLauf({ quelle, ziel, prodRef: ref("prod"), devRef: ref("dev") });
  if (e.kind === "abbruch") {
    console.error(`::error::${e.grund}`);
    process.exit(1);
  }
  console.log(`Quelle ${e.quelleRef} (PROD)  →  Ziel ${e.zielRef} (DEV)`);
}
