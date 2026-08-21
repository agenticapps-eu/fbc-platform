/**
 * Fährt die Migration `20260821120000_bild_pfade_statt_urls.sql` gegen den
 * LOKALEN Stack — mit echten Fixtures, und rollt danach zurück (AGE-580).
 *
 * WARUM ES DIESE SONDE GIBT UND KEINEN pgTAP-TEST: die Migration ist bereits
 * angewendet, wenn ein Test läuft. Ein Test müsste ihre Logik also abschreiben
 * und prüfte dann die Abschrift, nicht die Migration. Diese Sonde liest die
 * DATEI und führt sie aus — was hier grün wird, ist die Fassung, die auch auf
 * DEV und PROD läuft.
 *
 * WARUM ROLLBACK: sie legt Konten und Ablage-Objekte an. Ein Lauf, der Spuren
 * hinterlässt, wäre beim zweiten Mal nicht mehr derselbe Lauf.
 *
 *   npx tsx scripts/probe-age580-migration.ts
 */
import { readFileSync } from "node:fs";
import pg from "pg";

const MIGRATION = "supabase/migrations/20260821120000_bild_pfade_statt_urls.sql";
const LOKAL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

// Die Kennung des lokalen Stacks. Der Punkt der Migration ist, dass sie NICHT
// von ihr abhängt — hier steht sie nur, um die Fixtures zu bauen.
const EIGEN = "http://127.0.0.1:54321/storage/v1/object/public";
const FREMD = "https://fremde-instanz.supabase.co/storage/v1/object/public";

interface Fall {
  name: string;
  bucket: "avatars" | "covers";
  /** Was vor der Migration in der Spalte steht. */
  vorher: string | null;
  /** Objekt in `storage.objects` anlegen? Der Riegel der Migration hängt daran. */
  objekt: string | null;
  /** Was danach dort stehen MUSS. */
  erwartet: string | null;
}

const FAELLE: Fall[] = [
  {
    name: "eigene URL, Objekt liegt hier → zurückgeschnitten",
    bucket: "avatars",
    vorher: `${EIGEN}/avatars/UID/a.webp`,
    objekt: "UID/a.webp",
    erwartet: "UID/a.webp",
  },
  {
    name: "eigene URL, Objekt liegt NICHT hier → unangetastet",
    bucket: "avatars",
    vorher: `${EIGEN}/avatars/UID/fehlt.webp`,
    objekt: null,
    erwartet: `${EIGEN}/avatars/UID/fehlt.webp`,
  },
  {
    name: "FREMDE Supabase-Instanz, gleicher Bucket-Name → unangetastet",
    bucket: "avatars",
    vorher: `${FREMD}/avatars/UID/a.webp`,
    objekt: "UID/a.webp",
    erwartet: `${FREMD}/avatars/UID/a.webp`,
  },
  {
    name: "falscher Bucket in der Spalte → unangetastet",
    bucket: "avatars",
    vorher: `${EIGEN}/covers/UID/a.webp`,
    objekt: null,
    erwartet: `${EIGEN}/covers/UID/a.webp`,
  },
  {
    name: "fremd gehostet (Demo-Seed) → unangetastet",
    bucket: "avatars",
    vorher: "https://i.pravatar.cc/300?u=x",
    objekt: null,
    erwartet: "https://i.pravatar.cc/300?u=x",
  },
  {
    name: "schon ein Pfad → unangetastet (Wiederholbarkeit)",
    bucket: "avatars",
    vorher: "UID/schon-pfad.webp",
    objekt: "UID/schon-pfad.webp",
    erwartet: "UID/schon-pfad.webp",
  },
  {
    name: "null → bleibt null",
    bucket: "avatars",
    vorher: null,
    objekt: null,
    erwartet: null,
  },
  {
    name: "covers: eigene URL, Objekt liegt hier → zurückgeschnitten",
    bucket: "covers",
    vorher: `${EIGEN}/covers/UID/c.webp`,
    objekt: "UID/c.webp",
    erwartet: "UID/c.webp",
  },
];

const db = new pg.Client({ connectionString: LOKAL });

async function main() {
  await db.connect();
  await db.query("begin");
  let fehler = 0;
  try {
    const ids: string[] = [];
    for (let i = 0; i < FAELLE.length; i++) {
      const f = FAELLE[i];
      // Konto anlegen — der Trigger `handle_new_user` legt die Profilzeile an.
      const uid = `00000000-0000-4000-8000-${String(i + 100).padStart(12, "0")}`;
      await db.query(
        `insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
           email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
         values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
           $2, '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb)`,
        [uid, `age580-${i}@probe.invalid`],
      );
      const spalte = f.bucket === "avatars" ? "avatar_url" : "cover_url";
      const wert = f.vorher?.replace("UID", uid) ?? null;
      await db.query(`update public.profiles set ${spalte} = $1 where id = $2`, [wert, uid]);
      if (f.objekt) {
        await db.query(
          `insert into storage.objects (bucket_id, name, owner) values ($1, $2, $3)
           on conflict do nothing`,
          [f.bucket, f.objekt.replace("UID", uid), uid],
        );
      }
      ids.push(uid);
    }

    // DIE ECHTE DATEI, nicht eine Abschrift ihrer Logik.
    await db.query(readFileSync(MIGRATION, "utf8"));

    for (let i = 0; i < FAELLE.length; i++) {
      const f = FAELLE[i];
      const spalte = f.bucket === "avatars" ? "avatar_url" : "cover_url";
      const { rows } = await db.query(`select ${spalte} as w from public.profiles where id = $1`, [
        ids[i],
      ]);
      const ist = rows[0].w as string | null;
      const soll = f.erwartet?.replace("UID", ids[i]) ?? null;
      const ok = ist === soll;
      if (!ok) fehler++;
      console.log(`${ok ? "  ok  " : "FEHLER"}  ${f.name}`);
      if (!ok) console.log(`          soll: ${soll}\n          ist : ${ist}`);
    }

    // Wiederholbarkeit: derselbe Lauf ein zweites Mal darf NICHTS mehr ändern.
    const vorher2 = await db.query(
      `select id, avatar_url, cover_url from public.profiles where id = any($1) order by id`,
      [ids],
    );
    await db.query(readFileSync(MIGRATION, "utf8"));
    const nachher2 = await db.query(
      `select id, avatar_url, cover_url from public.profiles where id = any($1) order by id`,
      [ids],
    );
    const stabil = JSON.stringify(vorher2.rows) === JSON.stringify(nachher2.rows);
    if (!stabil) fehler++;
    console.log(`${stabil ? "  ok  " : "FEHLER"}  wiederholbar: ein zweiter Lauf ändert nichts`);
  } finally {
    await db.query("rollback");
    await db.end();
  }
  console.log(fehler === 0 ? "\nAlle Fälle grün." : `\n${fehler} Fall/Fälle rot.`);
  process.exit(fehler === 0 ? 0 : 1);
}

void main();
