#!/usr/bin/env tsx
/**
 * Gruppe 1 aus openspec/changes/sync-dev-from-prod/tasks.md — NUR LESEN.
 * Die Sitzung wird auf default_transaction_read_only gestellt.
 */
import { readFile } from "node:fs/promises";
import pg from "pg";

const seite = process.argv[2]; // "prod" | "dev"
const url = seite === "prod" ? process.env.SUPABASE_DB_URL_PROD : process.env.SUPABASE_DB_URL_DEV;
if (!url) throw new Error(`URL fuer ${seite} fehlt`);
const ref = new URL(url).username.replace(/^postgres\./, "");
const erwartet = (await readFile(seite === "prod" ? "scripts/prod-project-ref.txt" : "scripts/dev-project-ref.txt", "utf8")).trim();
if (ref !== erwartet) throw new Error(`Kennung ${ref} != ${erwartet}`);

const db = new pg.Client({ connectionString: url, ssl: { ca: await readFile("scripts/supabase-root-2021-ca.crt", "utf8") } });
await db.connect();
await db.query("set default_transaction_read_only = on");
type Zeile = Record<string, unknown>;
const q = async (sql: string, p: unknown[] = []): Promise<Zeile[]> => (await db.query(sql, p)).rows;

console.log(`\n########## ${seite!.toUpperCase()} ${ref} ##########`);

// 1.3 Serverversion
console.log("\n== 1.3 Serverversion ==");
console.log(JSON.stringify((await q("select version(), current_setting('server_version') as v, current_user, session_user"))[0]));

// 1.4 Trigger-Inventar public + auth (nicht-intern)
console.log("\n== 1.4 Trigger-Inventar (nicht-intern) ==");
const trg = await q(`
  select n.nspname as schema, c.relname as tabelle, t.tgname as trigger,
         p.proname as funktion, t.tgenabled as status,
         case when t.tgtype & 1 = 1 then 'ROW' else 'STATEMENT' end as ebene,
         case when t.tgtype & 2 = 2 then 'BEFORE' when t.tgtype & 64 = 64 then 'INSTEAD' else 'AFTER' end as zeitpunkt,
         concat_ws(',', case when t.tgtype & 4 = 4 then 'INSERT' end,
                        case when t.tgtype & 8 = 8 then 'DELETE' end,
                        case when t.tgtype & 16 = 16 then 'UPDATE' end,
                        case when t.tgtype & 32 = 32 then 'TRUNCATE' end) as ereignis
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_proc p on p.oid = t.tgfoid
   where not t.tgisinternal and n.nspname in ('public','auth','storage')
   order by n.nspname, c.relname, t.tgname`);
for (const r of trg) console.log(`  ${r.schema}.${r.tabelle} :: ${r.trigger} [${r.status}] ${r.zeitpunkt} ${r.ereignis} ${r.ebene} -> ${r.funktion}()`);
console.log(`  SUMME nicht-intern: ${trg.length} (public: ${trg.filter((r)=>r.schema==='public').length}, auth: ${trg.filter((r)=>r.schema==='auth').length}, storage: ${trg.filter((r)=>r.schema==='storage').length})`);

// 1.5 Rechte, um Trigger stillzulegen: Eigentuemer der betroffenen Tabellen
console.log("\n== 1.5 Tabelleneigentuemer + session_replication_role ==");
const eig = await q(`
  select distinct n.nspname||'.'||c.relname as tabelle, pg_get_userbyid(c.relowner) as eigentuemer,
         pg_has_role(current_user, c.relowner, 'USAGE') as darf_altern
    from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
   where not t.tgisinternal and n.nspname in ('public','auth','storage') order by 1`);
for (const r of eig) console.log(`  ${r.darf_altern ? "ALTER-OK " : "KEIN ALTER"} ${r.tabelle} (owner ${r.eigentuemer})`);
console.log(`  session_replication_role setzbar? -> siehe Sonde unten`);
try { await db.query("begin; set local session_replication_role = replica; rollback"); console.log("  session_replication_role=replica: ERLAUBT"); }
catch (e) { console.log(`  session_replication_role=replica: VERWEIGERT (${(e as Error).message})`); }

// 1.6 auth-Umfang
console.log("\n== 1.6 auth-Tabellen mit Zeilen ==");
const authTabs = await q(`select table_name from information_schema.tables where table_schema='auth' and table_type='BASE TABLE' order by 1`);
for (const t of authTabs) {
  try { const c = await q(`select count(*)::int as n from auth."${t.table_name}"`); console.log(`  ${String(c[0].n).padStart(6)}  auth.${t.table_name}`); }
  catch (e) { console.log(`  ERR     auth.${t.table_name}: ${(e as Error).message.split("\n")[0]}`); }
}

// 1.7 Rechte auf auth.users
console.log("\n== 1.7 Rechte auf auth ==");
for (const tab of ["auth.users", "auth.identities", "public.profiles"]) {
  const r = (await q(`select has_table_privilege($1,'select') as sel, has_table_privilege($1,'insert') as ins,
                             has_table_privilege($1,'update') as upd, has_table_privilege($1,'delete') as del,
                             has_table_privilege($1,'truncate') as trunc`, [tab]))[0];
  console.log(`  ${tab}: select=${r.sel} insert=${r.ins} update=${r.upd} delete=${r.del} truncate=${r.trunc}`);
}

// 1.8 Fremdschluesselrichtung profiles -> auth.users
console.log("\n== 1.8 Fremdschluessel auf/aus public.profiles ==");
const fks = await q(`
  select con.conname, con.confdeltype,
         cs.relname as quelle_tab, ns.nspname as quelle_schema,
         ct.relname as ziel_tab, nt.nspname as ziel_schema
    from pg_constraint con
    join pg_class cs on cs.oid=con.conrelid join pg_namespace ns on ns.oid=cs.relnamespace
    join pg_class ct on ct.oid=con.confrelid join pg_namespace nt on nt.oid=ct.relnamespace
   where con.contype='f' and ((ns.nspname='public' and cs.relname='profiles') or (nt.nspname='public' and ct.relname='profiles'))
   order by 1`);
for (const r of fks) console.log(`  ${r.quelle_schema}.${r.quelle_tab} --${r.conname} (ondel=${r.confdeltype})--> ${r.ziel_schema}.${r.ziel_tab}`);
const eingehend = await q(`
  select count(*)::int as n from pg_constraint con
    join pg_class ct on ct.oid=con.confrelid join pg_namespace nt on nt.oid=ct.relnamespace
   where con.contype='f' and nt.nspname='auth' and ct.relname='users'`);
console.log(`  FKs, die auf auth.users zeigen: ${eingehend[0].n}`);

// 1.9 Migrationsversionen
console.log("\n== 1.9 Migrationsversionen ==");
const mig = await q(`select version from supabase_migrations.schema_migrations order by version`);
console.log(`  Anzahl: ${mig.length}  erste=${mig[0]?.version}  letzte=${mig[mig.length-1]?.version}`);
console.log(`  ALLE: ${mig.map((m)=>m.version).join(",")}`);

// 1.12 Manifest-Vorstufe: Zeilenzahlen public
console.log("\n== 1.12 Zeilenzahlen public (mit Zeilen) ==");
const pubTabs = await q(`select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by 1`);
let summe = 0;
for (const t of pubTabs) {
  const c = await q(`select count(*)::int as n from public."${t.table_name}"`);
  summe += Number(c[0].n);
  console.log(`  ${String(c[0].n).padStart(6)}  public.${t.table_name}`);
}
console.log(`  Tabellen: ${pubTabs.length}, Zeilen gesamt: ${summe}`);

console.log("\n== Buckets/Objekte ==");
for (const r of await q(`select b.id, b.public, count(o.id)::int as objekte, coalesce(sum((o.metadata->>'size')::bigint),0)::bigint as bytes
                           from storage.buckets b left join storage.objects o on o.bucket_id=b.id group by 1,2 order by 1`))
  console.log(`  ${r.id}: public=${r.public} objekte=${r.objekte} bytes=${r.bytes}`);

await db.end();
