#!/usr/bin/env tsx
/**
 * Gruppe 1, Aufgabe 1.5 — die ENTSCHEIDENDE Messung, empirisch.
 *
 * Das Trigger-Inventar sagt: alle 18 nicht-internen Trigger tragen
 * tgenabled='O'. Daraus FOLGT, dass `session_replication_role = replica`
 * sie stilllegt — aber "folgt" ist keine Messung. Hier wird es gemessen.
 *
 * NUR GEGEN DEN LOKALEN STACK. Die Verbindung ist fest verdrahtet, es gibt
 * keinen Schalter auf ein entferntes Projekt. Beide Einfuegungen laufen in
 * einer Transaktion, die IMMER zurueckgerollt wird.
 */
import pg from "pg";

const LOKAL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const db = new pg.Client({ connectionString: LOKAL });
await db.connect();
const wo = (await db.query("select inet_server_addr() as a, inet_server_port() as p")).rows[0];
if (String(wo.p) !== "5432" && String(wo.p) !== "54322") throw new Error("unerwarteter Port");
console.log(`Ziel: lokal ${wo.a}:${wo.p}\n`);

const trg = await db.query(`select count(*)::int as n, count(*) filter (where tgenabled='O')::int as origin
  from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
 where not t.tgisinternal and n.nspname in ('public','auth','storage')`);
console.log(`Trigger lokal: ${trg.rows[0].n} nicht-intern, davon tgenabled='O': ${trg.rows[0].origin}`);

async function versuch(replica: boolean) {
  const id = "00000000-0000-4000-8000-0000000000" + (replica ? "01" : "02");
  await db.query("begin");
  try {
    if (replica) await db.query("set local session_replication_role = replica");
    const modus = (await db.query("show session_replication_role")).rows[0].session_replication_role;
    await db.query(
      `insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                               email_confirmed_at, created_at, updated_at,
                               raw_app_meta_data, raw_user_meta_data, is_super_admin)
       values ('00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated',
               $2, 'x', now(), now(), now(), '{}'::jsonb, '{"name":"Sonde"}'::jsonb, false)`,
      [id, `sonde-${replica ? "replica" : "origin"}@example.invalid`],
    );
    const p = await db.query("select count(*)::int as n, min(tier) as tier from public.profiles where id = $1", [id]);
    console.log(`  session_replication_role=${modus}: profiles-Zeilen nach dem Insert = ${p.rows[0].n}${p.rows[0].tier ? ` (tier=${p.rows[0].tier})` : ""}`);
    return p.rows[0].n as number;
  } finally {
    await db.query("rollback");
  }
}

console.log("\n== Gegenprobe: Trigger MUSS im Normalbetrieb feuern ==");
const origin = await versuch(false);
console.log("\n== Messung: replica-Modus ==");
const replica = await versuch(true);

console.log("\n== Ergebnis ==");
console.log(origin === 1 ? "  OK   origin feuert (1 Profilzeile) — die Gegenprobe traegt" : `  FEHLER origin erzeugte ${origin} Zeilen, erwartet 1`);
console.log(replica === 0 ? "  OK   replica legt still (0 Profilzeilen)" : `  FEHLER replica erzeugte ${replica} Zeilen, erwartet 0`);

const rest = await db.query("select count(*)::int as n from auth.users where email like 'sonde-%@example.invalid'");
console.log(`  Rueckstand nach Rollback: ${rest.rows[0].n} (muss 0 sein)`);
await db.end();
process.exit(origin === 1 && replica === 0 && rest.rows[0].n === 0 ? 0 : 1);
