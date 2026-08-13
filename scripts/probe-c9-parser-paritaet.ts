#!/usr/bin/env tsx
/**
 * Parität der zwei Video-Erkenner (AGE-533, C9, Aufgabe 1.6) — NUR LESEND.
 *
 *   pnpm exec tsx scripts/probe-c9-parser-paritaet.ts          (lokaler Stack)
 *   infisical run --env=dev -- pnpm exec tsx scripts/…         (gegen DEV)
 *
 * DIE FRAGE. Seit C9 gibt es zwei Erkenner für dieselbe Sache:
 *
 *   `public.erste_video_url(text)`  — entscheidet, OB ein Body ein Video
 *                                     enthält und WELCHE URL das ist.
 *   `parseVideoUrl` / `extractFirstVideo` (src/lib/video-url.ts)
 *                                   — entscheidet, WIE sie eingebettet wird.
 *
 * Der Plan-Review hat den Entwurf genau hier gekippt: die erste Fassung ließ den
 * Client rechnen und versprach, es gebe deshalb nur EINEN Erkenner. Das war
 * nicht durchsetzbar (`posts_write_own` erlaubt INSERT/UPDATE direkt auf
 * `posts`). Jetzt gibt es zwei — und der Preis dafür ist, dass ihre Parität
 * gemessen wird statt zugesagt.
 *
 * Diese Sonde hält beide gegen denselben Korpus. Sie ruft den ECHTEN
 * TypeScript-Parser auf, nicht eine Abschrift seiner Erwartungen: eine
 * Abschrift prüfte die Abschrift.
 *
 * Der Korpus ist die Vereinigung aus:
 *   - allen Fixtures in src/lib/feed.test.ts,
 *   - den Fällen aus rls_test.sql §21,
 *   - den zwei echten Bestandstreffern aus DEV (probe-c9-bestand.ts),
 *   - den Angriffen, die der Review benannt hat.
 *
 * SCHWELLE NULL. Weicht ein einziger Fall ab, endet die Sonde mit Exit 1: eine
 * benannte Abweichung ist keine Lösung (Befund gemini, MEDIUM).
 *
 * Sie liest, und sie kann nichts anderes: `default_transaction_read_only`, ein
 * `statement_timeout`, kein schreibender Befehl.
 */
import pg from "pg";
import { readFileSync } from "node:fs";

import { extractFirstVideo } from "../src/lib/video-url";

const LOKAL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const url = process.env.SUPABASE_DB_URL_DEV ?? process.env.SUPABASE_DB_URL_PROD ?? LOKAL;
const welche = process.env.SUPABASE_DB_URL_DEV
  ? "DEV"
  : process.env.SUPABASE_DB_URL_PROD
    ? "PROD"
    : "LOKAL";
const ref = url.match(/postgres\.([a-z0-9]+)/)?.[1] ?? "127.0.0.1:54322";
console.log(`Zielprojekt: ${ref} (${welche}) — NUR LESEND.`);

/**
 * Jede Zeile ist ein Beitragstext. Was daraus wird, sagt keiner von beiden
 * vorher — die Sonde vergleicht sie miteinander, nicht gegen eine Erwartung.
 */
const KORPUS: string[] = [
  // ── aus feed.test.ts ────────────────────────────────────────────────────
  "Schau https://example.com und https://youtu.be/abc an",
  "nur text https://example.com",
  "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "https://youtu.be/dQw4w9WgXcQ?t=42",
  "https://www.youtube.com/embed/dQw4w9WgXcQ",
  "https://vimeo.com/123456789",
  "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
  "https://player.vimeo.com/video/123456789",
  "https://www.youtube.com/watch",
  "https://youtu.be/",
  "https://www.youtube.com/feed/trending",
  "https://evil.example.com/embed/x",
  "javascript:alert(1)",
  "nur text",
  "",

  // ── aus rls_test.sql §21 ────────────────────────────────────────────────
  "Schau mal https://www.youtube.com/watch?v=Ks-_Mh1QhMc an",
  "https://m.youtube.com/watch?feature=x&v=AiOz1vDMjr0&list=RD",
  "http://youtu.be/abc_123-x?t=30",
  "https://player.vimeo.com/video/76979871 und https://vimeo.com/1",
  "https://WWW.YouTube.com/watch?v=Ks-_Mh1QhMc",
  "https://youtube.com.boese.example/watch?v=x",
  "https://vimeo.com/keinezahl",
  "Ein Satz ganz ohne Link.",
  "Sehenswert: https://youtu.be/abc123.",

  // ── die zwei echten Bestandstreffer aus DEV (0.4) ───────────────────────
  "https://www.youtube.com/watch?v=Ks-_Mh1QhMc",
  "https://www.youtube.com/watch?v=AiOz1vDMjr0&list=RDAiOz1vDMjr0&start_radio=1",

  // ── Angriffe und Randfälle aus dem Plan-Review ──────────────────────────
  "https://youtube.com.evil.example/watch?v=x",
  "https://notyoutube.com/watch?v=x",
  "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ", // vom Review vorgeschlagen, bewusst NICHT aufgenommen
  "https://youtu.be.evil.example/abc",
  "https://vimeo.com/123456789/extra",
  "https://vimeo.com/-1",
  "HTTPS://YOUTU.BE/ABC123",
  "http://www.youtube.com/watch?v=abc",
  "Zwei: https://vimeo.com/1 und https://youtu.be/zwei",
  "Klammer https://vimeo.com/123456789) dahinter",
  "Komma https://youtu.be/abc, weiter",
  "  https://youtu.be/mitLeerzeichen  ",
  "mehrzeilig\nhttps://vimeo.com/999\nende",
];

const db = new pg.Client({
  connectionString: url,
  ssl:
    welche === "LOKAL"
      ? undefined
      : { ca: readFileSync("scripts/supabase-root-2021-ca.crt", "utf8") },
});

async function main() {
  await db.connect();
  await db.query("set default_transaction_read_only = on");
  await db.query("set statement_timeout = '30s'");

  let abweichungen = 0;
  let treffer = 0;

  for (const body of KORPUS) {
    const ts = extractFirstVideo(body)?.url ?? null;
    const { rows } = await db.query<{ sql: string | null }>(
      "select public.erste_video_url($1) as sql",
      [body],
    );
    const sql = rows[0].sql;

    if (ts !== sql) {
      abweichungen++;
      console.log("\nABWEICHUNG");
      console.log(`  Body:        ${JSON.stringify(body)}`);
      console.log(`  TypeScript:  ${JSON.stringify(ts)}`);
      console.log(`  SQL:         ${JSON.stringify(sql)}`);
    } else if (ts !== null) {
      treffer++;
    }
  }

  const stumm = KORPUS.length - treffer - abweichungen;
  console.log(
    `\n${KORPUS.length} Fälle: ${treffer} mit Video (beide einig), ` +
      `${stumm} ohne Video (beide einig), ${abweichungen} Abweichungen.`,
  );

  await db.end();

  if (abweichungen > 0) {
    console.log(
      "\nERGEBNIS: Die Erkenner sind NICHT deckungsgleich. Die Schwelle ist null — " +
        "der SQL-Spiegel wird korrigiert, bevor die Migration ausgeliefert wird.",
    );
    process.exit(1);
  }
  console.log("\nERGEBNIS: deckungsgleich über den ganzen Korpus.");
}

main();
