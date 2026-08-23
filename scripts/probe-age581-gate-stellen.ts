#!/usr/bin/env tsx
/** NUR LESEN. Wo steht das Aktivierungs-Gate heute wirklich? Policies, Funktionen, Views. */
import { readFile } from "node:fs/promises";
import pg from "pg";
const url = process.env.SUPABASE_DB_URL_DEV!;
const db = new pg.Client({ connectionString: url, ssl: { ca: await readFile("scripts/supabase-root-2021-ca.crt", "utf8") } });
await db.connect();
await db.query("set default_transaction_read_only = on");
await db.query("set statement_timeout = '60s'");

const muster = `(activated_at|is_activated)`;

console.log("## POLICIES mit activated_at/is_activated im Prädikat");
for (const r of (await db.query(`
  select schemaname, tablename, policyname, cmd,
         coalesce(qual,'') as qual, coalesce(with_check,'') as wc
    from pg_policies
   where schemaname in ('public','storage')
     and (coalesce(qual,'') ~* $1 or coalesce(with_check,'') ~* $1)
   order by schemaname, tablename, policyname`, [muster])).rows) {
  const direkt = /activated_at\s+is\s+not\s+null/i.test(r.qual + r.wc);
  console.log(`  ${r.schemaname}.${r.tablename}  ${r.policyname} [${r.cmd}]${direkt ? "   <-- DIREKTES activated_at" : ""}`);
}

console.log("\n## FUNKTIONEN mit activated_at im Rumpf");
for (const r of (await db.query(`
  select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args,
         (pg_get_functiondef(p.oid) ~* 'activated_at\\s+is\\s+not\\s+null') as direkt,
         (pg_get_functiondef(p.oid) ~* 'is_activated') as ueber_funktion
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.prokind='f'
     and pg_get_functiondef(p.oid) ~* $1
   order by p.proname`, [muster])).rows) {
  console.log(`  ${r.proname}(${r.args})${r.direkt ? "  <-- DIREKT" : ""}${r.ueber_funktion ? "  [ruft is_activated*]" : ""}`);
}

console.log("\n## VIEWS mit activated_at in der Definition");
for (const r of (await db.query(`
  select c.relname, (pg_get_viewdef(c.oid) ~* 'activated_at\\s+is\\s+not\\s+null') as direkt,
         (select reloptions::text from pg_class where oid=c.oid) as opts
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relkind in ('v','m') and pg_get_viewdef(c.oid) ~* $1
   order by c.relname`, [muster])).rows) {
  console.log(`  ${r.relname}${r.direkt ? "  <-- DIREKT" : ""}  ${r.opts ?? ""}`);
}
await db.end();
