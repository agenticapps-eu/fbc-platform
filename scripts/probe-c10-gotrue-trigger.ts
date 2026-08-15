/**
 * Probe (AGE-534, Gruppe 7.1): Was steht in `public.profiles`, unmittelbar
 * nachdem die GoTrue-Admin-Schnittstelle ein Konto angelegt hat?
 *
 * Der Plan für 7.1 nimmt an, das Profil entstehe durch das `insert` des Imports
 * und `tier`/`activated_at` liessen sich als reine Einfügespalten setzen. Es
 * gibt aber einen Trigger `on_auth_user_created` (community_foundation.sql:82),
 * der bei JEDEM Insert in `auth.users` schon eine Profilzeile anlegt. Trifft er
 * auch beim Admin-Weg zu, findet das Upsert eine Zeile vor — und `do update set`
 * lässt `tier` bewusst aus.
 *
 * Diese Probe misst es, statt es zu behaupten. Nur gegen den lokalen Stack; sie
 * legt ein Konto an und räumt es wieder weg.
 *
 *   pnpm tsx scripts/probe-c10-gotrue-trigger.ts
 */

import pg from "pg";

const API = "http://127.0.0.1:54321";
const DB = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const SCHLUESSEL = process.env.LOKALER_SERVICE_KEY;

if (!SCHLUESSEL) {
  console.error("LOKALER_SERVICE_KEY fehlt (aus `supabase status`).");
  process.exit(1);
}

const adresse = `probe-c10-${Date.now()}@example.test`;

const antwort = await fetch(`${API}/auth/v1/admin/users`, {
  method: "POST",
  headers: {
    apikey: SCHLUESSEL,
    Authorization: `Bearer ${SCHLUESSEL}`,
    "Content-Type": "application/json",
  },
  // Ohne Passwort — so, wie 7.1 es vorsieht.
  body: JSON.stringify({ email: adresse, email_confirm: true }),
});

const konto = (await antwort.json()) as { id?: string; msg?: string };
console.log(`Anlegen: HTTP ${antwort.status}, id=${konto.id ?? "—"}`);
if (!konto.id) {
  console.error("Kein Konto angelegt:", konto);
  process.exit(1);
}

const client = new pg.Client({ connectionString: DB });
await client.connect();

try {
  const { rows } = await client.query(
    "select id, name, tier, activated_at from public.profiles where id = $1",
    [konto.id],
  );

  console.log(`Profilzeilen direkt nach dem Anlegen: ${rows.length}`);
  if (rows[0]) {
    console.log(
      `  tier=${rows[0].tier}  activated_at=${rows[0].activated_at}  name=${rows[0].name}`,
    );
  }

  // Und nun die Anweisung, die 7.1 baut: `tier` steht in den Einfüge-, nicht in
  // den Update-Spalten. Was kommt dabei heraus?
  await client.query(
    `insert into public.profiles ("id", "name", "tier", "activated_at")
     values ($1, $2, $3, $4)
     on conflict ("id") do update set "name" = excluded."name"`,
    [konto.id, "Probe Name", "impact", null],
  );

  const { rows: danach } = await client.query(
    "select tier, activated_at, name from public.profiles where id = $1",
    [konto.id],
  );
  console.log(`Nach dem Upsert des Imports: tier=${danach[0].tier}  name=${danach[0].name}`);
  console.log(
    danach[0].tier === "impact"
      ? "→ tier ist impact. Die Annahme des Plans hält."
      : "→ tier ist NICHT impact. Der Trigger war schneller; 7.3 greift so nicht.",
  );
} finally {
  await client.end();
  const weg = await fetch(`${API}/auth/v1/admin/users/${konto.id}`, {
    method: "DELETE",
    headers: { apikey: SCHLUESSEL, Authorization: `Bearer ${SCHLUESSEL}` },
  });
  console.log(`Aufgeräumt: HTTP ${weg.status}`);
}
