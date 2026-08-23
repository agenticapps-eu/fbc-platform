#!/usr/bin/env tsx
/** NUR LESEN. Sind alle Admins aktiviert? Sonst sperrt die is_admin()-Verschärfung sie aus. */
import { readFile } from "node:fs/promises";
import pg from "pg";
const seite = process.argv[2] === "prod" ? "prod" : "dev";
const url = seite === "prod" ? process.env.SUPABASE_DB_URL_PROD! : process.env.SUPABASE_DB_URL_DEV!;
const ref = new URL(url).username.replace(/^postgres\./, "");
const erwartet = (await readFile(`scripts/${seite}-project-ref.txt`, "utf8")).trim();
if (ref !== erwartet) throw new Error(`Kennung ${ref} != ${erwartet}`);
const db = new pg.Client({ connectionString: url, ssl: { ca: await readFile("scripts/supabase-root-2021-ca.crt", "utf8") } });
await db.connect();
await db.query("set default_transaction_read_only = on");
const r = await db.query(`
  select s.role, p.name, u.email::text as login, p.activated_at is not null as aktiviert
    from public.staff_roles s
    join public.profiles p on p.id = s.profile_id
    join auth.users u on u.id = p.id
   order by s.role, p.name`);
console.log(`### ${seite} (${ref})`);
console.table(r.rows);
const blind = r.rows.filter((x) => x.role === "admin" && !x.aktiviert);
console.log(blind.length === 0
  ? "OK — jeder Admin ist aktiviert; die Verschaerfung von is_admin() sperrt niemanden aus."
  : `ACHTUNG — ${blind.length} Admin(s) NICHT aktiviert: ${blind.map((x) => x.login).join(", ")}`);
await db.end();
