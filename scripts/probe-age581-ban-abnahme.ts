#!/usr/bin/env tsx
/**
 * AGE-581, Aufgabe 4.8 — die Abnahme der Edge Function `admin-set-member-ban`
 * gegen den LOKALEN Stack. Prueft den ganzen Weg: Admin ruft die Function, die
 * Datenbank UND `auth.users` aendern sich, und — die eigentliche Zusage — das
 * deaktivierte Konto kommt danach nicht mehr herein.
 *
 * Warum diese Probe und nicht nur pgTAP: pgTAP sieht `auth.users.banned_until`
 * und die Datenbank, aber nie den Anmeldedienst. „Kein Login zulassen" laesst
 * sich nur belegen, indem man sich anzumelden versucht.
 *
 * Voraussetzung: `supabase start` UND `supabase functions serve`.
 * Aufruf:
 *   LOCAL_ANON_KEY=… LOCAL_SERVICE_ROLE_KEY=… tsx scripts/probe-age581-ban-abnahme.ts
 * Die Schluessel stehen in `supabase status` und sind fuer jeden lokalen Stack
 * dieselben — sie gehoeren trotzdem nicht ins Repo.
 */
import pg from "pg";

const URL = "http://127.0.0.1:54321";
if (!URL.startsWith("http://127.0.0.1")) throw new Error("nur lokal");
const ANON = process.env.LOCAL_ANON_KEY!;
const SR = process.env.LOCAL_SERVICE_ROLE_KEY!;
if (!ANON || !SR) throw new Error("LOCAL_ANON_KEY und LOCAL_SERVICE_ROLE_KEY setzen");
const SRH = { "Content-Type": "application/json", apikey: SR, Authorization: `Bearer ${SR}` };
const PW = "AbnahmePasswort!2026";

// Laeuft `functions serve` ueberhaupt? Ohne diese Zeile antwortet JEDER Aufruf
// mit einem Verbindungsfehler, die Probe meldet neunzehn Fehlschlaege und keiner
// davon nennt die Ursache. Gemessen: genau so ist es am 23.08. passiert.
const erreichbar = await fetch(`${URL}/functions/v1/admin-set-member-ban`, { method: "OPTIONS" })
  .then((r) => r.ok)
  .catch(() => false);
if (!erreichbar) {
  throw new Error("admin-set-member-ban ist nicht erreichbar — laeuft `supabase functions serve`?");
}

const db = new pg.Client("postgresql://postgres:postgres@127.0.0.1:54322/postgres");
await db.connect();

const befunde: boolean[] = [];
const pruefe = (name: string, ist: unknown, soll: unknown) => {
  const ok = JSON.stringify(ist) === JSON.stringify(soll);
  befunde.push(ok);
  console.log(
    `${ok ? "  OK  " : "  !!  "} ${name}${ok ? "" : `\n        ist:  ${JSON.stringify(ist)}\n        soll: ${JSON.stringify(soll)}`}`,
  );
};

async function konto(email: string) {
  const r = await fetch(`${URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: SRH,
    body: JSON.stringify({ email, password: PW, email_confirm: true }),
  });
  const u = await r.json();
  if (!u.id) throw new Error(`Konto ${email}: ${JSON.stringify(u)}`);
  await db.query(
    "update public.profiles set name=$2, activated_at=now(), is_public=true, tier='impact' where id=$1",
    [u.id, email.split("@")[0]],
  );
  return u.id;
}
/**
 * Aufraeumen. Die Protokollzeilen MUESSEN zuerst weg: `admin_audit.actor`
 * verweist auf `profiles(id)` ohne `on delete cascade`, und `profiles` haengt
 * seinerseits an `auth.users`. Der Admin liesse sich sonst nicht loeschen — die
 * Loeschung scheitert dabei still, und der naechste Lauf braeche mit
 * `email_exists` ab. (Gemessen am 23.08.; die fehlende Kaskade ist eine
 * Eigenschaft des Schemas, keine dieser Probe.)
 */
async function loeschen(id: string) {
  await db.query("delete from public.admin_audit where actor = $1 or target = $1", [id]);
  await fetch(`${URL}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: SRH });
}

/** Reste eines abgebrochenen Vorlaufs. Ohne das ist die Probe nur einmal lauffaehig. */
async function aufraeumenVorher(mails: string[]) {
  const { rows } = await db.query<{ id: string }>(
    "select id from auth.users where email = any($1)",
    [mails],
  );
  for (const r of rows) await loeschen(r.id);
}

async function anmelden(email: string) {
  const r = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON },
    body: JSON.stringify({ email, password: PW }),
  });
  return { status: r.status, body: await r.json() };
}

async function ruf(jwt: string, body: Record<string, unknown>) {
  const r = await fetch(`${URL}/functions/v1/admin-set-member-ban`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${jwt}` },
    body: JSON.stringify(body),
  });
  return { status: r.status, body: await r.json() };
}

const adminMail = "abnahme-admin@local.test";
const zielMail = "abnahme-ziel@local.test";
let adminId: string | undefined, zielId: string | undefined, fremdId: string | undefined;
try {
  await aufraeumenVorher([adminMail, zielMail, "abnahme-fremd@local.test"]);
  adminId = await konto(adminMail);
  zielId = await konto(zielMail);
  fremdId = await konto("abnahme-fremd@local.test");
  await db.query("insert into public.staff_roles (profile_id, role) values ($1,'admin')", [
    adminId,
  ]);

  const adminAnmeldung = await anmelden(adminMail);
  const jwt = adminAnmeldung.body.access_token;
  if (!jwt) throw new Error("Admin-Anmeldung fehlgeschlagen: " + JSON.stringify(adminAnmeldung));

  // 0. Gegenprobe: das Ziel kann sich VORHER anmelden.
  pruefe("vorher: das Ziel meldet sich an", (await anmelden(zielMail)).status, 200);

  // 1. Ein Nicht-Admin prallt ab.
  const fremdJwt = (await anmelden("abnahme-fremd@local.test")).body.access_token;
  pruefe(
    "ein Nicht-Admin bekommt 403",
    (await ruf(fremdJwt, { action: "disable", target: zielId })).status,
    403,
  );
  pruefe(
    "… und das Ziel traegt kein disabled_at",
    (await db.query("select disabled_at from public.profiles where id=$1", [zielId])).rows[0]
      .disabled_at,
    null,
  );

  // 2. Ohne Token gar nichts.
  const ohne = await fetch(`${URL}/functions/v1/admin-set-member-ban`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON },
    body: JSON.stringify({ action: "disable", target: zielId }),
  });
  pruefe("ohne Authorization-Kopfzeile: 401", ohne.status, 401);

  // 3. Eine unbekannte Handlung ist ein Fehler, keine stille Deaktivierung.
  pruefe(
    "unbekannte Handlung: 400",
    (await ruf(jwt, { action: "ban", target: zielId })).status,
    400,
  );

  // 4. Der Erfolgsfall.
  const aus = await ruf(jwt, { action: "disable", target: zielId, grund: "Abnahme" });
  pruefe("deaktivieren antwortet 200", aus.status, 200);
  pruefe("… mit hidden und banned", aus.body, { hidden: true, banned: true });

  const nach = (
    await db.query(
      "select p.disabled_at is not null as gesperrt, u.banned_until > now() as gebannt from public.profiles p join auth.users u on u.id=p.id where p.id=$1",
      [zielId],
    )
  ).rows[0];
  pruefe("… disabled_at steht in der Datenbank", nach.gesperrt, true);
  pruefe("… banned_until steht in auth.users", nach.gebannt, true);

  const spur = (
    await db.query(
      "select action, payload->>'grund' as grund from public.admin_audit where target=$1 order by id",
      [zielId],
    )
  ).rows;
  pruefe("… genau eine Protokollzeile, mit Grund", spur, [
    { action: "disable_member", grund: "Abnahme" },
  ]);

  // 5. DIE ZUSAGE, um die es geht: keine Anmeldung mehr.
  const abgewiesen = await anmelden(zielMail);
  pruefe("das deaktivierte Konto kommt NICHT mehr herein (400)", abgewiesen.status, 400);
  pruefe(
    "… und der Anmeldedienst nennt den Grund",
    abgewiesen.body.error_code ?? abgewiesen.body.error,
    "user_banned",
  );

  // 6. Zweimal dieselbe Handlung: 409, keine zweite Zeile.
  pruefe(
    "ein zweiter Aufruf bricht mit 409 ab",
    (await ruf(jwt, { action: "disable", target: zielId })).status,
    409,
  );
  pruefe(
    "… und es bleibt bei EINER Protokollzeile",
    (
      await db.query(
        "select count(*)::int as n from public.admin_audit where target=$1 and action='disable_member'",
        [zielId],
      )
    ).rows[0].n,
    1,
  );

  // 7. Sich selbst deaktivieren geht nicht.
  pruefe(
    "ein Admin kann sich nicht selbst deaktivieren (409)",
    (await ruf(jwt, { action: "disable", target: adminId })).status,
    409,
  );

  // 7b. DER HALBE ZUSTAND IST HEILBAR (Aufgabe 4.6).
  //
  // Hergestellt wird er von Hand: `disabled_at` steht, der Bann fehlt — genau
  // das, was ein gescheiterter zweiter Schritt hinterlaesst. Ohne diese Zusage
  // waere so ein Zustand durch die Oberflaeche UNHEILBAR: „deaktivieren" braeche
  // mit 409 ab, und der Admin muesste erst reaktivieren, um erneut deaktivieren
  // zu koennen — und liesse das Konto dabei kurz wieder sichtbar werden.
  await fetch(`${URL}/auth/v1/admin/users/${zielId}`, {
    method: "PUT",
    headers: SRH,
    body: JSON.stringify({ ban_duration: "none" }),
  });
  pruefe(
    "halber Zustand hergestellt: gesperrt, aber nicht gebannt",
    (
      await db.query(
        "select p.disabled_at is not null as gesperrt, coalesce(u.banned_until > now(), false) as gebannt from public.profiles p join auth.users u on u.id=p.id where p.id=$1",
        [zielId],
      )
    ).rows[0],
    { gesperrt: true, gebannt: false },
  );
  pruefe(
    "das Konto kommt im halben Zustand wieder herein — deshalb muss es heilbar sein",
    (await anmelden(zielMail)).status,
    200,
  );

  const geheilt = await ruf(jwt, { action: "disable", target: zielId });
  pruefe("… erneut deaktivieren bricht NICHT mit 409 ab, sondern setzt nach", geheilt.status, 200);
  pruefe(
    "… und der Bann steht wieder",
    (
      await db.query("select u.banned_until > now() as gebannt from auth.users u where u.id=$1", [
        zielId,
      ])
    ).rows[0].gebannt,
    true,
  );
  pruefe(
    "… ohne eine zweite Protokollzeile: die Datenbank hat sich nicht geaendert",
    (
      await db.query(
        "select count(*)::int as n from public.admin_audit where target=$1 and action='disable_member'",
        [zielId],
      )
    ).rows[0].n,
    1,
  );

  // 8. Und wieder auf.
  const auf = await ruf(jwt, { action: "enable", target: zielId });
  pruefe("reaktivieren antwortet 200", auf.status, 200);
  pruefe("… mit hidden=false, banned=false", auf.body, { hidden: false, banned: false });
  const zurueck = (
    await db.query(
      "select p.disabled_at is null as frei, coalesce(u.banned_until > now(), false) as gebannt from public.profiles p join auth.users u on u.id=p.id where p.id=$1",
      [zielId],
    )
  ).rows[0];
  pruefe("… disabled_at ist zurueckgenommen", zurueck.frei, true);
  pruefe("… und der Bann ebenso", zurueck.gebannt, false);
  pruefe("das Konto meldet sich wieder an", (await anmelden(zielMail)).status, 200);
} finally {
  for (const id of [adminId, zielId, fremdId]) if (id) await loeschen(id);
  await db.end();
}

const rot = befunde.filter((b) => !b).length;
console.log(`\n${befunde.length - rot}/${befunde.length} Zusagen erfuellt.`);
process.exit(rot ? 1 : 0);
