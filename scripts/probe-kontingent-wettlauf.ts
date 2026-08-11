/**
 * AGE-526 — Laufzeitbeleg fuer den Riegel am Stundenkontingent.
 *
 * WARUM ES DIESE DATEI GIBT. Die Zusage lautet: Bei vollem Stundenkontingent
 * gibt der sitzungsgebundene Weg keinem frischen Profil mehr ein Token aus.
 * Diese Zusage ist eine Aussage ueber GLEICHZEITIGKEIT, und pgTAP laeuft in
 * genau einer Transaktion — dort ist sie nicht messbar. Die Assertion in
 * rls_test.sql prueft deshalb nur, DASS der Riegel im Rumpf vor der Zaehlung
 * steht. Ob er wirkt, misst diese Sonde: zwei echte Sitzungen, die sich
 * ueberholen wollen.
 *
 * Aufbau: 99 Ausgaben liegen in der laufenden Stunde. Zwei frische Profile
 * fordern gleichzeitig an. Genau EINES darf durchkommen.
 *
 * Ohne Riegel lesen beide 99, beide schreiben, und in der Stunde stehen 101.
 *
 * NUR LOKAL. Die Adresse ist fest verdrahtet, nicht aus der Umgebung gelesen —
 * diese Sonde schreibt, und ein Wirt-Waechter, der nur einen Namen prueft,
 * haette hier schon einmal zu wenig geprueft.
 *
 * Lauf:  npx tsx scripts/probe-kontingent-wettlauf.ts
 * Setzt einen laufenden lokalen Stack voraus (`supabase start`).
 */
import { Client } from "pg";

const LOKAL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

const FUELLER = "a5260000-0000-0000-0000-0000000000f9";
const EINS = "a5260000-0000-0000-0000-0000000000f1";
const ZWEI = "a5260000-0000-0000-0000-0000000000f2";

function neu(): Client {
  return new Client({ connectionString: LOKAL });
}

/** Eine Anforderung unter der Identitaet `uid`, in der offenen Transaktion. */
async function anfordern(c: Client, uid: string, hash: string): Promise<string> {
  await c.query("select set_config('request.jwt.claims', $1, true)", [
    JSON.stringify({ sub: uid, role: "authenticated" }),
  ]);
  await c.query("set local role authenticated");
  const r = await c.query("select status from public.request_own_activation_token($1)", [hash]);
  await c.query("reset role");
  return r.rows[0].status as string;
}

async function main() {
  const setup = neu();
  await setup.connect();

  // Ausgangslage. `on conflict do nothing`, damit ein zweiter Lauf nicht an
  // den Konten scheitert — die Token raeumt der Block darunter selbst weg.
  for (const [id, mail] of [
    [FUELLER, "wettlauf-fueller@test.fbc"],
    [EINS, "wettlauf-eins@test.fbc"],
    [ZWEI, "wettlauf-zwei@test.fbc"],
  ]) {
    await setup.query(
      `insert into auth.users (id, aud, role, email)
       values ($1, 'authenticated', 'authenticated', $2)
       on conflict (id) do nothing`,
      [id, mail],
    );
  }
  await setup.query(
    `update public.profiles set activated_at = null, created_at = now()
      where id = any($1::uuid[])`,
    [[EINS, ZWEI]],
  );
  await setup.query("delete from public.activation_tokens");
  await setup.query(
    `insert into public.activation_tokens (token_hash, profile_id, expires_at, created_at, invalidated_at)
     select 'wettlauf-' || g, $1, now() + interval '72 hours', now() - interval '5 minutes', now()
       from generate_series(1, 99) g`,
    [FUELLER],
  );

  const vorher = await setup.query(
    "select count(*)::int as n from public.activation_tokens where created_at > now() - interval '1 hour'",
  );
  console.log(`Ausgangslage: ${vorher.rows[0].n} Ausgaben in der letzten Stunde (Grenze 100)`);

  // Zwei Sitzungen, die sich ueberholen wollen. A oeffnet, fordert an und
  // COMMITTET NICHT — B laeuft in genau das Fenster, in dem ein count(*) ohne
  // Riegel den veralteten Stand 99 liest.
  const a = neu();
  const b = neu();
  await a.connect();
  await b.connect();

  await a.query("begin");
  const statusA = await anfordern(a, EINS, "wettlauf-a");
  console.log(`A (offen, nicht committet): ${statusA}`);

  await b.query("begin");
  console.log("B fordert an, waehrend A offen ist …");
  const bLaeuft = anfordern(b, ZWEI, "wettlauf-b");

  // Haelt der Riegel, blockiert B hier. Ohne ihn ist B sofort fertig.
  const blockiert = await Promise.race([
    bLaeuft.then(() => false),
    new Promise<boolean>((r) => setTimeout(() => r(true), 1500)),
  ]);
  console.log(
    blockiert
      ? "B blockiert — der Riegel greift"
      : "B lief SOFORT durch — kein Riegel, beide zaehlen auf demselben Stand",
  );

  await a.query("commit");
  const statusB = await bLaeuft;
  await b.query("commit");
  console.log(`B nach A's Commit: ${statusB}`);

  const nachher = await setup.query(
    "select count(*)::int as n from public.activation_tokens where created_at > now() - interval '1 hour'",
  );
  const n = nachher.rows[0].n as number;

  const bestanden = blockiert && statusA === "issued" && statusB === "rate_limited_global" && n <= 100;
  console.log(`\nAusgaben in der Stunde danach: ${n}`);
  console.log(
    bestanden
      ? "BESTANDEN — genau eine Ausgabe kam durch, das Kontingent haelt"
      : `DURCHGEFALLEN — A=${statusA}, B=${statusB}, blockiert=${blockiert}, Stand=${n}`,
  );

  await setup.query("delete from public.activation_tokens");
  await a.end();
  await b.end();
  await setup.end();
  process.exit(bestanden ? 0 : 1);
}

main();
