#!/usr/bin/env tsx
/**
 * Task 10.5 fuer C7 (AGE-528): PROD NACHMESSEN, nicht glauben.
 *
 *   infisical run --env=prod -- tsx scripts/mess-10-5-prod.ts --prod=viwntbodrtqxgmqyxluh
 *
 * WARUM ES DIESES SKRIPT GIBT. Ein gruener `migrate-prod`-Lauf sagt, dass die
 * CLI die Migrationen als angewendet verbucht hat. Er sagt nicht, dass der
 * Bucket wirklich privat ist, dass sein Groessenlimit steht, dass die vier
 * Storage-Policies existieren oder dass die neuen Tabellen ihre Rechte haben —
 * und genau diese Klasse ist hier teuer geworden: Grants werden nicht geerbt
 * (AGE-312), und `service_role` haelt auf keiner Tabelle in `public` ein Recht.
 * Das faellt erst zur Laufzeit auf.
 *
 * NUR LESEN. Das Skript fuehrt ausschliesslich SELECTs aus. Es gibt keinen
 * Schreibpfad, auch keinen abgeschalteten — die Sitzung wird zusaetzlich auf
 * `default_transaction_read_only` gestellt, damit ein versehentliches
 * Schreiben von der Datenbank abgelehnt wuerde und nicht von einem Kommentar.
 *
 * DAS ZIEL MUSS HINGESCHRIEBEN WERDEN, wie bei den Sonden zu 1.0c und 9.3: ein
 * Waechter, der eine Umgebungsvariable prueft, haelt nichts, wenn jemand sie
 * anders setzt. `--prod=` wird gegen `scripts/prod-project-ref.txt` geprueft.
 */
import { readFile } from "node:fs/promises";

import pg from "pg";

const zielRef = process.argv.find((a) => a.startsWith("--prod="))?.slice("--prod=".length);
const erwartet = (await readFile("scripts/prod-project-ref.txt", "utf8")).trim();
if (zielRef !== erwartet) {
  throw new Error(
    `--prod=${zielRef ?? "(fehlt)"} ist nicht das PROD-Projekt (erwartet ${erwartet}). Abbruch.`,
  );
}
const dbUrl = process.env.SUPABASE_DB_URL_PROD;
if (!dbUrl) throw new Error("SUPABASE_DB_URL_PROD fehlt — mit `infisical run --env=prod --` starten.");

const db = new pg.Client({
  connectionString: dbUrl,
  ssl: { ca: await readFile("scripts/supabase-root-2021-ca.crt", "utf8") },
});

let fehler = 0;
function pruefe(name: string, erwartetText: string, gemessen: string, ok: boolean) {
  if (!ok) fehler += 1;
  console.log(`  ${ok ? "OK   " : "FEHLT"} ${name}`);
  console.log(`        erwartet: ${erwartetText}`);
  console.log(`        gemessen: ${gemessen}`);
}

await db.connect();
await db.query("set default_transaction_read_only = on");

console.log(`\nZiel: PROD ${zielRef} — nur lesend\n`);

// ── Der Bucket ──────────────────────────────────────────────────────────────
const bucket = await db.query(
  `select public, file_size_limit, allowed_mime_types
     from storage.buckets where id = 'post-media'`,
);
if (bucket.rowCount === 0) {
  pruefe("Bucket post-media", "vorhanden", "nicht vorhanden", false);
} else {
  const b = bucket.rows[0];
  pruefe(
    "Bucket post-media ist privat",
    "public = false",
    `public = ${b.public}`,
    b.public === false,
  );
  pruefe(
    "Groessenlimit 1 MiB",
    "1048576",
    String(b.file_size_limit),
    Number(b.file_size_limit) === 1048576,
  );
  pruefe(
    "nur WebP erlaubt",
    '["image/webp"]',
    JSON.stringify(b.allowed_mime_types),
    Array.isArray(b.allowed_mime_types) &&
      b.allowed_mime_types.length === 1 &&
      b.allowed_mime_types[0] === "image/webp",
  );
}

// ── Die vier Storage-Policies ───────────────────────────────────────────────
const sp = await db.query(
  `select policyname, cmd from pg_policies
     where schemaname = 'storage' and tablename = 'objects'
       and policyname like 'post_media%' order by policyname`,
);
pruefe(
  "vier Storage-Policies auf storage.objects",
  "post_media_select, _insert_own, _update_own, _delete_own",
  sp.rows.map((r) => `${r.policyname}(${r.cmd})`).join(", ") || "keine",
  sp.rowCount === 4,
);

// ── Die neuen Tabellen, ihre RLS und ihre Rechte ────────────────────────────
for (const tabelle of ["post_media", "tags"] as const) {
  const da = await db.query(
    `select relrowsecurity from pg_class
       where oid = ('public.' || $1)::regclass`,
    [tabelle],
  );
  if (da.rowCount === 0) {
    pruefe(`Tabelle public.${tabelle}`, "vorhanden", "nicht vorhanden", false);
    continue;
  }
  pruefe(
    `public.${tabelle} mit RLS`,
    "relrowsecurity = true",
    `relrowsecurity = ${da.rows[0].relrowsecurity}`,
    da.rows[0].relrowsecurity === true,
  );

  // Grants werden hier NICHT geerbt (AGE-312) — deshalb ausdruecklich geprueft.
  const g = await db.query(
    `select grantee, string_agg(distinct privilege_type, ',' order by privilege_type) as rechte
       from information_schema.role_table_grants
      where table_schema = 'public' and table_name = $1
        and grantee in ('authenticated','anon','service_role')
      group by grantee order by grantee`,
    [tabelle],
  );
  const karte = Object.fromEntries(g.rows.map((r) => [r.grantee, r.rechte]));
  pruefe(
    `public.${tabelle}: Rechte ausgesprochen`,
    "authenticated hat mindestens SELECT",
    g.rows.map((r) => `${r.grantee}=${r.rechte}`).join(" | ") || "keine",
    typeof karte.authenticated === "string" && karte.authenticated.includes("SELECT"),
  );
}

// ── Die beiden Funktionen und der Trigger ───────────────────────────────────
const funk = await db.query(
  `select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and proname in ('post_media_lesbar','create_post_with_media','post_media_hoechstens_sechs')
     order by proname`,
);
pruefe(
  "Funktionen vorhanden",
  "create_post_with_media, post_media_hoechstens_sechs, post_media_lesbar",
  funk.rows.map((r) => r.proname).join(", ") || "keine",
  funk.rowCount === 3,
);

const trig = await db.query(
  `select tgname from pg_trigger
     where tgrelid = 'public.post_media'::regclass and not tgisinternal`,
);
pruefe(
  "Sechser-Grenze als Trigger",
  "post_media_hoechstens_sechs",
  trig.rows.map((r) => r.tgname).join(", ") || "keiner",
  trig.rows.some((r) => r.tgname === "post_media_hoechstens_sechs"),
);

// ── Die Indizes aus 090300 ──────────────────────────────────────────────────
const idx = await db.query(
  `select indexname from pg_indexes
     where schemaname = 'public' and tablename = 'posts'
       and indexname in ('posts_created_at_id_idx','posts_hashtags_gin')
     order by indexname`,
);
pruefe(
  "die zwei Indizes auf posts",
  "posts_created_at_id_idx, posts_hashtags_gin",
  idx.rows.map((r) => r.indexname).join(", ") || "keiner",
  idx.rowCount === 2,
);

// ── Die kuratierten Tags ────────────────────────────────────────────────────
const tags = await db.query("select count(*)::int as n from public.tags where active");
pruefe("kuratierte Tags eingespielt", "15 aktive", `${tags.rows[0].n} aktive`, tags.rows[0].n === 15);

await db.end();
console.log(`\n${fehler === 0 ? "PROD steht wie gemeint." : `${fehler} Abweichung(en) auf PROD.`}\n`);
process.exit(fehler === 0 ? 0 : 1);
