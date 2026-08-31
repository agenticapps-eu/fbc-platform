/**
 * Veröffentlicht `dist/` als OTA-Bündel (AGE-642, Phase D1).
 *
 *   pnpm tsx scripts/ota-buendel.ts
 *
 * Läuft im `deploy`-Job, NUR auf `main`, nach dem Upload zu Cloudflare Pages.
 * Das Rechnen und das Zippen stehen in `ota-buendel.logic.ts` und sind dort
 * geprüft — bis hin zu einem Rundlauf, der das Gerät nachspielt und das Archiv
 * wirklich aufmacht. Diese Datei tut nur noch, was ein Test nicht tun kann:
 * hochladen und ins Manifest schreiben.
 *
 * ══ DIE REIHENFOLGE IST NICHT BELIEBIG ══════════════════════════════════════
 * Erst der Upload, dann die Manifest-Zeile. Andersherum gäbe es ein Zeitfenster,
 * in dem der Aktualisierungs-Endpunkt eine Fassung anbietet, deren Datei noch
 * nicht liegt — und jedes Gerät, das in dieses Fenster fällt, bekommt einen
 * Download-Fehler statt einer Aktualisierung.
 *
 * Dass ein Abbruch DAZWISCHEN nichts kaputtmacht, kommt nicht aus der
 * Reihenfolge, sondern aus dem inhaltsadressierten Objektnamen — die Begründung
 * steht bei `objektname()`.
 *
 * ══ DER SCHREIBWEG IST EINE FUNKTION, KEIN `.from(...)` ═════════════════════
 * `service_role` hält in `public` auf keiner Tabelle ein Recht (AGE-312). Ein
 * `.from("ota_buendel").insert(...)` liefe durch Typecheck und Tests und
 * scheiterte erst hier, zur Laufzeit, mit `permission denied`. Geschrieben wird
 * über `ota_buendel_veroeffentlichen` (20260831140000). Für den BUCKET gilt das
 * nicht: dort hält `service_role` alle Rechte und umgeht die RLS.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { createClient } from "@supabase/supabase-js";

import capacitorConfig from "../capacitor.config";
import {
  bildeBuendel,
  buendelUrl,
  fassung,
  objektname,
  zippeVerzeichnis,
} from "./ota-buendel.logic";

const BUCKET = "ota-buendel";
const DIST = "dist";

/** Liest eine Umgebungsvariable oder bricht mit einem Satz ab, der sagt woher sie kommt. */
function ausUmgebung(name: string, herkunft: string): string {
  const wert = process.env[name];
  if (wert === undefined || wert.trim() === "") {
    throw new Error(`${name} fehlt. Herkunft: ${herkunft}.`);
  }
  return wert;
}

/**
 * Die Vertragsnummer der nativen Schale.
 *
 * Genau eine Quelle, und das ist die Entscheidung vom 31.08.:
 * `plugins.CapacitorUpdater.version` in `capacitor.config.ts`. Diese Datei liegt
 * NEBEN `public/` im gebauten Paket, ist also nur über den Store änderbar — der
 * Luftweg kann sie nicht anfassen. Genau das macht sie zur Vertragsnummer.
 */
function benoetigteSchale(): string {
  const wert = capacitorConfig.plugins?.CapacitorUpdater?.version;
  if (typeof wert !== "string" || wert === "") {
    throw new Error(
      "plugins.CapacitorUpdater.version fehlt in capacitor.config.ts. " +
        "Das ist die Vertragsnummer der Schale (design.md §8) und hat genau " +
        "diese eine Stempelstelle.",
    );
  }
  return wert;
}

async function main(): Promise<void> {
  const apiUrl = ausUmgebung("VITE_SUPABASE_URL", "Infisical, Umgebung prod");
  const serviceKey = ausUmgebung("SUPABASE_SERVICE_ROLE_KEY", "Infisical, Umgebung prod");
  const privatschluessel = ausUmgebung("CAPGO_PRIVATE_KEY", "Infisical, Umgebung prod");

  // Der SHA kommt von GitHub; lokal aus git, damit ein Probelauf möglich ist.
  const sha =
    process.env.GITHUB_SHA ??
    execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const semver = JSON.parse(readFileSync("package.json", "utf8")).version as string;

  const version = fassung(semver, sha);
  const schale = benoetigteSchale();

  const zip = zippeVerzeichnis(DIST);
  console.log(`Buendel  ${version}  (Schale ${schale})`);
  console.log(`  Zip          ${(zip.length / 1_048_576).toFixed(2)} MB, ohne Sourcemaps`);

  // Wirft, wenn der private Schlüssel nicht 2048 Bit hat — vor jedem
  // Seiteneffekt, also ohne halb veröffentlichten Zustand.
  const buendel = bildeBuendel(zip, privatschluessel);
  console.log(`  Chiffrat     ${(buendel.chiffrat.length / 1_048_576).toFixed(2)} MB`);

  const dienst = createClient(apiUrl, serviceKey, { auth: { persistSession: false } });

  // Der Objektname trägt den Inhalt (`ota-buendel.logic.ts`), ein Re-Run
  // schreibt also eine NEUE Datei statt eine bestehende zu überschreiben. Damit
  // gibt es kein Zeitfenster, in dem die Manifest-Zeile auf veränderte Bytes
  // mit alten Kryptowerten zeigt — und das ist wichtiger, als es klingt:
  // `deploy.yml` trägt `cancel-in-progress: true`, ein Lauf kann also genau
  // zwischen diesen beiden Aufrufen enden.
  //
  // `upsert: true` bleibt trotzdem: derselbe Inhalt ergibt denselben Namen, und
  // ein Wiederholungslauf mit unverändertem Ergebnis soll nicht an einer
  // bereits liegenden, byte-gleichen Datei scheitern. Die Falle aus AGE-537 —
  // upsert scheitert an einer fehlenden SELECT-Policy — greift hier nicht:
  // service_role umgeht die RLS auf storage.objects, gemessen in
  // ota_buendel_test.sql.
  const objekt = objektname(version, buendel.chiffrat);
  const hoch = await dienst.storage.from(BUCKET).upload(objekt, buendel.chiffrat, {
    contentType: "application/octet-stream",
    upsert: true,
  });
  if (hoch.error) {
    throw new Error(`Upload nach ${BUCKET} fehlgeschlagen: ${hoch.error.message}`);
  }
  console.log(`  Hochgeladen  ${BUCKET}/${objekt}`);

  const url = buendelUrl(apiUrl, objekt);
  const eintrag = await dienst.rpc("ota_buendel_veroeffentlichen", {
    p_version: version,
    p_url: url,
    p_checksum: buendel.checksum,
    p_session_key: buendel.sessionKey,
    p_benoetigte_schale: schale,
  });
  if (eintrag.error) {
    // Die Bedingungen an den Spalten schlagen hier zu, nicht erst auf dem
    // Gerät. Eine Verletzung heisst: die Zahlen oben stimmen nicht.
    throw new Error(`Manifest-Zeile fuer ${version} fehlgeschlagen: ${eintrag.error.message}`);
  }
  console.log(`  Manifest     ${url}`);
}

main().catch((fehler: unknown) => {
  console.error(fehler instanceof Error ? fehler.message : String(fehler));
  process.exit(1);
});
