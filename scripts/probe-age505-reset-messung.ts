#!/usr/bin/env tsx
/**
 * NUR LESEN. Messpunkt fuer password-reset-flow 6.3/6.4 (AGE-505).
 *
 * Liest den Zustand EINES Kontos, das per Adresse benannt wird — nie eine
 * Liste. Das Repo ist oeffentlich: eine Abfrage ohne Filter zoege fremde
 * Mitgliederdaten in den Mitschnitt, und der Beleg braucht sie nicht.
 *
 * Aufruf:  pnpm tsx scripts/probe-age505-reset-messung.ts dev <adresse>
 */
import { readFile } from "node:fs/promises";
import pg from "pg";

const seite = process.argv[2] === "prod" ? "prod" : "dev";
const adresse = process.argv[3];
if (!adresse) throw new Error("Adresse fehlt: … <dev|prod> <adresse>");

const url = seite === "prod" ? process.env.SUPABASE_DB_URL_PROD! : process.env.SUPABASE_DB_URL_DEV!;
const ref = new URL(url).username.replace(/^postgres\./, "");
const erwartet = (await readFile(`scripts/${seite}-project-ref.txt`, "utf8")).trim();
if (ref !== erwartet) throw new Error(`Kennung ${ref} != ${erwartet}`);

const db = new pg.Client({
  connectionString: url,
  ssl: { ca: await readFile("scripts/supabase-root-2021-ca.crt", "utf8") },
});
await db.connect();
// Der Wall gegen einen Tippfehler, der aus einer Messung eine Aenderung macht.
await db.query("set default_transaction_read_only = on");

const r = await db.query(
  `select p.activated_at,
          p.tier,
          u.encrypted_password is not null as hat_hash,
          u.last_sign_in_at,
          u.updated_at as auth_updated_at
     from auth.users u
     join public.profiles p on p.id = u.id
    where u.email = $1`,
  [adresse],
);
console.log(`### ${seite} (${ref}) — ${adresse}`);
if (r.rowCount === 0) console.log("KEIN KONTO unter dieser Adresse.");
else console.table(r.rows);

// Der Token-Stand gehoert zur Messung, nicht daneben: `issue_activation_token`
// antwortet bei einer offenen Anforderung mit `pending` und versendet NICHTS —
// die Function antwortet dem Aufrufer trotzdem 202. Ohne diesen Blick sieht ein
// verschluckter Lauf genau wie ein erfolgreicher aus.
const t = await db.query(
  `select t.created_at, t.used_at, t.invalidated_at, t.expires_at,
          t.created_at > now() - interval '60 seconds'  as sperrt_60s,
          (t.used_at is null and t.invalidated_at is null
           and t.expires_at > now()
           and t.created_at > now() - interval '24 hours') as sperrt_pending
     from public.activation_tokens t
     join auth.users u on u.id = t.profile_id
    where u.email = $1
    order by t.created_at desc
    limit 6`,
  [adresse],
);
console.log("Tokens (neueste zuerst):");
console.table(t.rows);
const tag = await db.query(
  `select count(*)::int as im_24h
     from public.activation_tokens t
     join auth.users u on u.id = t.profile_id
    where u.email = $1 and t.created_at > now() - interval '24 hours'`,
  [adresse],
);
console.log(`im 24h-Fenster: ${tag.rows[0].im_24h} (rate_limited_day ab 5)`);
await db.end();
