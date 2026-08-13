#!/usr/bin/env tsx
/**
 * Vorabmessung fuer C9 (AGE-533), Aufgabe 0.4 — NUR LESEND.
 *
 *   infisical run --env=dev  -- tsx scripts/probe-c9-bestand.ts
 *   infisical run --env=prod -- tsx scripts/probe-c9-bestand.ts   (SUPABASE_DB_URL_PROD)
 *
 * DIE FRAGE. C9 bringt zwei Migrationen mit Backfill, und beide Backfills
 * brauchen einen SOLLWERT, gegen den ihre Wirkung geprueft wird:
 *
 *   A) `posts.video_url` wird aus den Bodys der Bestandsbeitraege befuellt.
 *      Wie viele Beitraege tragen ueberhaupt einen einbettbaren Videolink?
 *   B) Jedes bestehende Event bekommt seinen Feed-Beitrag nachgereicht.
 *      Wie viele Events gibt es, und wie viele davon haben KEINEN host_id?
 *      (Ohne host_id entsteht kein Beitrag — `posts.author_id` ist not null.)
 *
 * „Die Migration hat schon funktioniert" ist ohne diese Zahlen unbelegbar.
 *
 * Sie liest, und sie kann nichts anderes: die Transaktion steht auf
 * `default_transaction_read_only`, es gibt keinen einzigen schreibenden Befehl,
 * und ein `statement_timeout` begrenzt jede Abfrage.
 *
 * ── Der SQL-Spiegel von `extractFirstVideo` ────────────────────────────────
 * Die Regex unten bildet `parseVideoUrl` (src/lib/feed.ts) Fall fuer Fall nach.
 * Sie ist NICHT als zweiter Parser gedacht und lebt nicht in der Laufzeit — sie
 * existiert nur fuer den einmaligen Backfill, und genau deshalb wird sie hier
 * gegen den echten Bestand gehalten, bevor sie in eine Migration wandert.
 *
 * Die Sonde gibt jeden gefundenen URL-Token einzeln aus, samt Urteil. Der
 * Abgleich mit dem TypeScript-Parser (Aufgabe 1.4) laeuft danach ueber
 * dieselbe Liste — Zeile fuer Zeile, nicht ueber eine Gesamtzahl, weil zwei
 * gleiche Summen aus verschiedenen Treffern bestehen koennen.
 */
import pg from "pg";
import { readFileSync } from "node:fs";

const url = process.env.SUPABASE_DB_URL_DEV ?? process.env.SUPABASE_DB_URL_PROD;
if (!url) {
  throw new Error(
    "Weder SUPABASE_DB_URL_DEV noch SUPABASE_DB_URL_PROD gesetzt — " +
      "mit `infisical run --env=dev --` bzw. `--env=prod --` aufrufen.",
  );
}
const welche = process.env.SUPABASE_DB_URL_DEV ? "DEV" : "PROD";
const ref = url.match(/postgres\.([a-z0-9]+)/)?.[1] ?? "unbekannt";
console.log(
  `Zielprojekt: ${ref} (${welche}) — NUR LESEND, keine Schreibbefehle in dieser Datei.`,
);

const db = new pg.Client({
  connectionString: url,
  ssl: { ca: readFileSync("scripts/supabase-root-2021-ca.crt", "utf8") },
});

/**
 * Spiegel von `parseVideoUrl`. Fuenf Alternativen, eine je akzeptiertem Host:
 * youtube/watch?v=, youtube/embed/, youtu.be/, vimeo.com/<zahl>,
 * player.vimeo.com/video/<zahl>. Query und Fragment sind ueberall zugelassen,
 * weil `new URL(...)` sie aus dem Pfad heraushaelt und der TS-Parser sie
 * deshalb ebenfalls durchlaesst (z. B. `youtu.be/ID?t=30`).
 */
const MUSTER = String.raw`^https?://(www\.)?((m\.)?youtube\.com/watch\?([^\s]*&)?v=[A-Za-z0-9_-]+([&#][^\s]*)?|(m\.)?youtube\.com/embed/[A-Za-z0-9_-]+([?#][^\s]*)?|youtu\.be/[A-Za-z0-9_-]+([?#][^\s]*)?|vimeo\.com/[0-9]+([?#][^\s]*)?|player\.vimeo\.com/video/[0-9]+([?#][^\s]*)?)$`;

function zeig(titel: string, rows: unknown[]) {
  console.log(`\n### ${titel}`);
  if (rows.length === 0) console.log("  (keine Zeilen)");
  for (const r of rows) console.log("  " + JSON.stringify(r));
}

async function main() {
  await db.connect();
  await db.query("set default_transaction_read_only = on");
  await db.query("set statement_timeout = '30s'");

  // ── 0. Die Spalten dieses Changes duerfen es noch NICHT geben ────────────
  zeig(
    "posts: bestehende Spalten (video_url/kind/ref_id muessen fehlen)",
    (
      await db.query(
        `select column_name, data_type, is_nullable, column_default
           from information_schema.columns
          where table_schema = 'public' and table_name = 'posts'
          order by ordinal_position`,
      )
    ).rows,
  );

  // ── A. Der Sollwert fuer den video_url-Backfill ──────────────────────────
  zeig(
    "posts: gesamt / mit irgendeinem Link / mit einbettbarem Video",
    (
      await db.query(
        `select count(*)::int as gesamt,
                count(*) filter (where body ~ 'https?://')::int as mit_link,
                count(*) filter (where exists (
                  select 1
                    from regexp_matches(p.body, 'https?://[^\\s]+', 'g') as t(m)
                   where rtrim(t.m[1], '.,;:!?»"''') ~ $1
                ))::int as mit_video
           from public.posts p`,
        [MUSTER],
      )
    ).rows,
  );

  // Jeder Token einzeln — das ist die Liste, gegen die Aufgabe 1.4 den
  // TypeScript-Parser haelt. Eine Gesamtzahl allein wuerde eine Verschiebung
  // (einer zu viel, einer zu wenig) nicht zeigen.
  zeig(
    "posts: jeder gefundene URL-Token mit Urteil des SQL-Spiegels",
    (
      await db.query(
        `select p.id,
                p.created_at,
                t.ord,
                rtrim(t.m[1], '.,;:!?»"''') as token,
                (rtrim(t.m[1], '.,;:!?»"''') ~ $1) as ist_video
           from public.posts p
           cross join lateral regexp_matches(p.body, 'https?://[^\\s]+', 'g')
                with ordinality as t(m, ord)
          order by p.created_at, t.ord`,
        [MUSTER],
      )
    ).rows,
  );

  // Traegt ein Beitrag MEHRERE Videolinks, entscheidet die Reihenfolge —
  // `extractFirstVideo` nimmt den ersten. Wenn es diesen Fall im Bestand nicht
  // gibt, ist das eine Sorge weniger und soll dastehen.
  zeig(
    "posts: Beitraege mit MEHR als einem einbettbaren Video",
    (
      await db.query(
        `select p.id, count(*)::int as videos
           from public.posts p
           cross join lateral regexp_matches(p.body, 'https?://[^\\s]+', 'g') as t(m)
          where rtrim(t.m[1], '.,;:!?»"''') ~ $1
          group by p.id
         having count(*) > 1`,
        [MUSTER],
      )
    ).rows,
  );

  // ── B. Der Sollwert fuer den Event-Backfill ──────────────────────────────
  zeig(
    "events: gesamt / ohne host_id / mit cover_path",
    (
      await db.query(
        `select count(*)::int as gesamt,
                count(*) filter (where host_id is null)::int as ohne_host,
                count(*) filter (where cover_path is not null)::int as mit_cover,
                min(created_at) as aeltestes,
                max(created_at) as neuestes
           from public.events`,
      )
    ).rows,
  );

  zeig(
    "events: visibility-Verteilung",
    (await db.query(`select visibility, count(*)::int from public.events group by 1 order by 1`))
      .rows,
  );

  // ── C. Was die zweite Migration beruehrt ─────────────────────────────────
  zeig(
    "posts: bestehende Indizes",
    (await db.query(`select indexname from pg_indexes where tablename = 'posts' order by 1`)).rows,
  );

  zeig(
    "posts: bestehende Check-Constraints",
    (
      await db.query(
        `select conname, pg_get_constraintdef(oid) as definition
           from pg_constraint
          where conrelid = 'public.posts'::regclass and contype = 'c'
          order by conname`,
      )
    ).rows,
  );

  zeig(
    "posts/events: Tabellen-Grants (neue Spalten erben von hier)",
    (
      await db.query(
        `select table_name, grantee, string_agg(distinct privilege_type, ',' order by privilege_type) as rechte
           from information_schema.role_table_grants
          where table_schema = 'public' and table_name in ('posts','events')
            and grantee in ('anon','authenticated')
          group by 1, 2 order by 1, 2`,
      )
    ).rows,
  );

  // Spalten-Grants waeren die Falle: eine neue Spalte erbt NUR von den
  // Tabellen-Grants. Gibt es daneben ECHTE Spalten-Grants, muessten sie fuer
  // `video_url`, `kind` und `ref_id` einzeln nachgezogen werden.
  //
  // Gefragt wird ueber `pg_attribute.attacl`, NICHT ueber
  // `information_schema.column_privileges`: letztere rechnet die Tabellen-Grants
  // auf jede Spalte herunter und ist deshalb selbst dann prall gefuellt, wenn
  // kein einziger Spalten-Grant existiert. Sie kann die Frage nicht beantworten.
  // `attacl` ist genau dann nicht null, wenn auf DIESER Spalte ein Recht
  // ausgesprochen wurde.
  zeig(
    "posts/events: Spalten mit ECHTEM Spalten-ACL (leer = neue Spalten erben von der Tabelle)",
    (
      await db.query(
        `select c.relname as tabelle, a.attname as spalte, a.attacl::text as acl
           from pg_attribute a
           join pg_class c on c.oid = a.attrelid
           join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relname in ('posts','events')
            and a.attnum > 0 and a.attacl is not null
          order by 1, 2`,
      )
    ).rows,
  );

  zeig(
    "create_post_with_media: bestehende Signatur(en)",
    (
      await db.query(
        `select p.oid::regprocedure::text as signatur
           from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname = 'create_post_with_media'`,
      )
    ).rows,
  );

  await db.end();
  console.log("\nFertig. Diese Zahlen sind die Sollwerte fuer 1.4 und 5.5.");
}

main();
