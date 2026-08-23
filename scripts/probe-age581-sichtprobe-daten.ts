#!/usr/bin/env tsx
/**
 * AGE-581, Aufgabe 7.6 — Datengrundlage für die Sichtprobe. NUR lokal.
 * Legt einen Admin und vier Mitglieder in den vier Lebenszyklus-Zuständen an.
 */
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { Client } from "pg";

const API = "http://127.0.0.1:54321";
if (!API.startsWith("http://127.0.0.1")) throw new Error("nur lokal");
const admin = createClient(API, process.env.SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

/**
 * Bei jedem Lauf neu gewürfelt und am Ende ausgegeben — KEIN Literal.
 *
 * Dieses Repo ist öffentlich, und ein Passwort aus einem öffentlichen Repo war
 * hier schon einmal ein echter Befund (Demo-Personas, behoben am 20.08.). Dass
 * die Konten nur auf `127.0.0.1` entstehen, ist die zweite Schranke, nicht die
 * erste.
 */
const PW = `Sichtprobe!${randomUUID().slice(0, 12)}`;
const KONTEN = [
  { mail: "age581-admin@local.host", name: "Adam Admin", zustand: "admin" },
  { mail: "age581-aktiv@local.host", name: "Carla Aktiv", zustand: "aktiv" },
  { mail: "age581-offen@local.host", name: "Bodo Unbestaetigt", zustand: "offen" },
  { mail: "age581-deakt@local.host", name: "Dora Deaktiviert", zustand: "deaktiviert" },
  { mail: "age581-gel@local.host", name: "Egon Geloescht", zustand: "geloescht" },
];

// `service_role` hält auf KEINER public-Tabelle ein Recht — die Profilzeilen
// gehen deshalb direkt an die lokale Datenbank, nicht über PostgREST.
// Aufräumen. Die Protokollzeilen MÜSSEN zuerst weg: `admin_audit.actor`
// verweist ohne `on delete cascade` auf `profiles`, und die GoTrue-Admin-API
// meldet den daran scheiternden Löschversuch NICHT als Fehler — das Konto
// bliebe stehen, und der nächste Lauf bräche mit `email_exists` ab. Beobachtet
// am 23.08., nachdem die Sichtprobe eine echte Handlung ausgelöst hatte.
const DB = process.env.DB_URL!;
if (!DB.includes("127.0.0.1") && !DB.includes("localhost")) throw new Error("nur lokal");
const db = new Client({ connectionString: DB });
await db.connect();

const { data: liste } = await admin.auth.admin.listUsers({ perPage: 1000 });
const alt = (liste?.users ?? []).filter((u) => u.email?.startsWith("age581-"));
if (alt.length > 0) {
  const ids = alt.map((u) => u.id);
  await db.query(`delete from public.admin_audit where actor = any($1) or target = any($1)`, [ids]);
  await db.query(`delete from public.staff_roles where profile_id = any($1)`, [ids]);
  for (const u of alt) {
    const { error } = await admin.auth.admin.deleteUser(u.id);
    if (error) throw error;
  }
}

for (const k of KONTEN) {
  const { data, error } = await admin.auth.admin.createUser({
    email: k.mail,
    password: PW,
    email_confirm: true,
  });
  if (error) throw error;
  const id = data.user.id;

  // Der Trigger hat die Profilzeile schon angelegt — also UPDATE, nicht INSERT.
  await db.query(
    `update public.profiles
        set name = $2, tier = 'impact', region = 'Berlin', company = 'Beispiel GmbH',
            activated_at = case when $3 = 'offen' then null else now() end,
            disabled_at  = case when $3 = 'deaktiviert' then now() else null end,
            deleted_at   = case when $3 = 'geloescht'   then now() else null end
      where id = $1`,
    [id, k.name, k.zustand],
  );
  if (k.zustand === "admin") {
    await db.query(
      `insert into public.staff_roles (profile_id, role) values ($1, 'admin')
       on conflict do nothing`,
      [id],
    );
  }
  console.log(`${k.zustand.padEnd(12)} ${k.mail}  ${id}`);
}
await db.end();
console.log(`\nAnmeldung: age581-admin@local.host / ${PW}`);
