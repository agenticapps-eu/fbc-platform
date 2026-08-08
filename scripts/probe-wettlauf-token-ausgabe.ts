#!/usr/bin/env tsx
/**
 * Beweis-Sonde fuer den Wettlauf um die Token-Ausgabe (AGE-507, Befunde 8.8/8.9).
 *
 *   tsx scripts/probe-wettlauf-token-ausgabe.ts
 *
 * Laeuft ausschliesslich gegen den lokalen Stack; die Adresse steht fest und
 * ist nicht aus der Umgebung umstellbar. Warum, steht beim Waechter.
 *
 * ── Die Frage ───────────────────────────────────────────────────────────────
 * Halten die Grenzen der Token-Ausgabe, wenn ZWEI Anforderungen gleichzeitig
 * laufen? Beide RPCs pruefen erst und schreiben dann. Unter `read committed`
 * nimmt jede Anweisung einen FRISCHEN Snapshot — die Pruefung kann also auf
 * einem Stand entschieden haben, den das Schreiben nicht mehr vorfindet.
 *
 * ── Warum sie VOR dem Bau laeuft ────────────────────────────────────────────
 * Ohne roten Ausgangsbefund ist „gruen" am Ende nicht von „Sonde falsch
 * geschrieben" zu unterscheiden. Der erste Lauf gehoert gegen den UNGEAENDERTEN
 * Stand; seine Ausgabe gehoert woertlich in tasks.md, Gruppe 2.
 *
 * ── Warum sie BERICHTET, statt Rollen zu behaupten ──────────────────────────
 * Wer nach dem Fix gewinnt, haengt daran, WO die Sperre liegt — und genau da
 * lag der erste Entwurf falsch (siehe REVIEWS.md). Die Sonde misst deshalb, wer
 * wen blockiert und wer was geantwortet hat, und behauptet nur die Invarianten,
 * die die Zusage des Changes tragen:
 *
 *   1. Kein waehrend des Laufs entstandenes Token wird entwertet.
 *   2. Genau EINE der beiden Anforderungen gibt ein Token aus.
 *   3. Die andere faellt in eine ehrliche Grenze — nicht in einen DB-Fehler.
 *
 * ── Warum eine Laufzeit-Kopie der Function (nur S1) ─────────────────────────
 * S1 braucht einen Aufruf, der HINTER allen Pruefungen und VOR dem Schreiben
 * anhaelt. Eine Anweisung, die auf eine Zeilensperre wartet, taugt dafuer
 * nicht: sie hat ihren Snapshot bereits genommen. Die Naht muss deshalb IN der
 * Function liegen. Sie kommt aus `pg_get_functiondef` der echten Function —
 * damit misst die Kopie immer den geltenden Stand — und die Einfuegestelle
 * wird geprueft: nicht genau einmal getroffen heisst Abbruch statt Zahl.
 *
 * Verworfen: `dblink`/`pg_background` installieren. Eine Extension, die
 * beliebige Verbindungen oeffnen kann, laege danach fuer einen Test dauerhaft
 * in PROD.
 *
 * Schreibt ausschliesslich eigene Wegwerf-Konten (`zz-probe-…`) und raeumt sie
 * samt Kopie wieder ab — auch wenn eine Behauptung faellt (`finally`).
 * Laeuft NIE gegen etwas anderes als 127.0.0.1; der Waechter steht vor der
 * ersten Zeile, die etwas anlegt.
 */
import pg from "pg";

// ── 1.1 Ziel-Waechter — vor allem anderen ───────────────────────────────────
//
// KEIN Umschalter aus der Umgebung, mit Absicht. Ein Waechter, der eine
// Zeichenkette auf „127.0.0.1" prueft, prueft den Namen und nicht das Ziel: ein
// Tunnel auf 127.0.0.1:54322 zeigt auf ein fremdes Projekt und kaeme durch.
// Ein verlaessliches Merkmal IN der Datenbank gibt es nicht — gemessen: im
// lokalen Stack ist `postgres` KEIN Superuser, das unterscheidet ihn also nicht
// von einem gehosteten Projekt. Statt einen Waechter zu bauen, der bloss
// beruhigt, gibt es hier nichts umzustellen: die Adresse steht fest.
const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

function rot(nachricht: string): never {
  console.error(`::error::${nachricht}`);
  process.exit(1);
}

{
  const host = new URL(DB_URL.replace(/^postgresql:/, "http:")).hostname;
  if (host !== "127.0.0.1") {
    rot(
      `Ziel ist nicht der lokale Stack (Host: ${host}). Diese Sonde schreibt und legt ` +
        `eine Function an — sie laeuft ausschliesslich gegen 127.0.0.1. Abgebrochen.`,
    );
  }
}
console.log(`Ziel: ${DB_URL}  (lokaler Stack)`);

// ── Werkzeug ────────────────────────────────────────────────────────────────
const ADVISORY_KEY = 507_000_507n;
const KOPIE = "zz_probe_issue_activation_token";
const laeufe: { name: string; ok: boolean; text: string }[] = [];

async function neueVerbindung(): Promise<pg.Client> {
  const c = new pg.Client({ connectionString: DB_URL });
  await c.connect();
  // Ein haengender Lauf ist kein Messwert. Alle Wartezeiten der Sonde liegen
  // unter 5 s; was laenger haengt, ist ein Fehler im Aufbau und soll als
  // Fehler erscheinen, nicht als Stillstand.
  await c.query("set statement_timeout = '20s'");
  return c;
}

async function pidVon(c: pg.Client): Promise<number> {
  const { rows } = await c.query("select pg_backend_pid() as pid");
  return rows[0].pid;
}

/** Meldet sich als `uid` an — Muster aus rls_test.sql, gemessen in Task 0.2. */
async function alsMitglied(c: pg.Client, uid: string): Promise<void> {
  await c.query("select set_config('request.jwt.claims', $1, true)", [
    JSON.stringify({ sub: uid, role: "authenticated" }),
  ]);
  await c.query("set local role authenticated");
}

/**
 * 1.3 — wartet, bis `pid` an einer schweren Sperre haengt, und meldet, WER
 * blockiert. Ein `sleep` waere hier genau das Timing, gegen das die Sonde
 * antritt. Gibt [] zurueck, wenn innerhalb der Frist niemand blockiert —
 * das ist ein MESSWERT, kein Fehler.
 */
async function warteBisBlockiert(
  beobachter: pg.Client,
  pid: number,
  fristMs = 4000,
): Promise<number[]> {
  const ende = Date.now() + fristMs;
  for (;;) {
    const { rows } = await beobachter.query(
      `select pg_blocking_pids($1) as pids,
              (select wait_event_type from pg_stat_activity where pid = $1) as typ,
              (select wait_event      from pg_stat_activity where pid = $1) as ereignis`,
      [pid],
    );
    const pids: number[] = rows[0].pids ?? [];
    if (pids.length > 0) return pids;
    if (Date.now() > ende) return [];
    await new Promise((r) => setTimeout(r, 25));
  }
}

async function wartetAuf(beobachter: pg.Client, pid: number): Promise<string> {
  const { rows } = await beobachter.query(
    "select wait_event_type as typ, wait_event as ereignis, state from pg_stat_activity where pid = $1",
    [pid],
  );
  const r = rows[0];
  return r ? `${r.state} / ${r.typ ?? "—"}:${r.ereignis ?? "—"}` : "(weg)";
}

/** Legt ein Wegwerf-Profil an. Der Trigger auf auth.users erzeugt die Profilzeile. */
async function legeProfilAn(admin: pg.Client, kennung: string): Promise<{ id: string; email: string }> {
  const email = `zz-probe-${kennung}-${Date.now()}@probe.local`;
  const { rows } = await admin.query(
    `insert into auth.users (id, aud, role, email)
     values (gen_random_uuid(), 'authenticated', 'authenticated', $1)
     returning id`,
    [email],
  );
  const id: string = rows[0].id;
  await admin.query(
    "update public.profiles set name = 'Wegwerf-Sonde', activated_at = null where id = $1",
    [id],
  );
  return { id, email };
}

async function raeumeAb(admin: pg.Client): Promise<void> {
  await admin.query("delete from auth.users where email like 'zz-probe-%@probe.local'");
  await admin.query(`drop function if exists public.${KOPIE}(text, text, interval)`);
}

/**
 * 1.4 — die Kopie. Aus `pg_get_functiondef` der ECHTEN Function, umbenannt,
 * mit dem Riegel unmittelbar VOR dem `update public.activation_tokens`.
 * Die Einfuegestelle wird geprueft: nicht genau einmal heisst, die Naht hat
 * sich verschoben — dann misst die Kopie etwas anderes als das Original.
 */
async function erzeugeKopie(admin: pg.Client): Promise<void> {
  const { rows } = await admin.query(
    "select pg_get_functiondef('public.issue_activation_token(text,text,interval)'::regprocedure) as def",
  );
  const original: string = rows[0].def;

  const kopfNadel = "FUNCTION public.issue_activation_token(";
  if (original.split(kopfNadel).length - 1 !== 1) {
    rot(`Kopfzeile "${kopfNadel}" nicht genau einmal gefunden. Abgebrochen.`);
  }
  const nahtNadel = "update public.activation_tokens";
  const treffer = original.split(nahtNadel).length - 1;
  if (treffer !== 1) {
    rot(
      `Die Naht "${nahtNadel}" kommt ${treffer}-mal vor, erwartet genau einmal. ` +
        `Die Kopie wuerde etwas anderes messen als das Original. Abgebrochen.`,
    );
  }

  const riegel = `perform pg_catalog.pg_advisory_xact_lock(${ADVISORY_KEY});\n\n  `;
  const kopie = original
    .replace(kopfNadel, `FUNCTION public.${KOPIE}(`)
    .replace(nahtNadel, riegel + nahtNadel);

  if (!kopie.includes(riegel.trim())) rot("Riegel nicht eingefuegt. Abgebrochen.");
  await admin.query(kopie);
}

// ── Die Szenarien ───────────────────────────────────────────────────────────
type Antwort = { status: string } | { fehler: string; code?: string };

function zeige(a: Antwort): string {
  return "status" in a ? a.status : `FEHLER ${a.code ?? "?"} ${a.fehler}`;
}
function istAusgabe(a: Antwort): boolean {
  return "status" in a && (a.status === "issued" || a.status === "issued_reset");
}

async function ruf(c: pg.Client, sql: string, args: unknown[]): Promise<Antwort> {
  try {
    const { rows } = await c.query(sql, args);
    return { status: rows[0]?.status ?? "(keine Zeile)" };
  } catch (e) {
    const err = e as { message: string; code?: string };
    return { fehler: err.message, code: err.code };
  }
}

function pruefe(name: string, ok: boolean, text: string): void {
  laeufe.push({ name, ok, text });
  console.log(`${ok ? "  ok  " : "  NICHT ok  "} ${name}: ${text}`);
}

/**
 * S1 — Befund 8.8, der sitzungsfreie Weg.
 * X haelt den Riegel · A ruft die KOPIE und parkt hinter allen Pruefungen ·
 * B ruft die ECHTE Function · X gibt frei · A laeuft weiter.
 */
async function s1(admin: pg.Client, beobachter: pg.Client): Promise<void> {
  console.log("\n── S1 · 8.8 · anonymer Weg, Schutzfenster unter Nebenlaeufigkeit ──");
  const p = await legeProfilAn(admin, "s1");
  await admin.query(
    `insert into public.activation_tokens (token_hash, profile_id, expires_at, created_at)
     values ('zz-probe-s1-T0', $1, now() + interval '47 hours', now() - interval '25 hours')`,
    [p.id],
  );
  const start = (await admin.query("select now() as t")).rows[0].t as Date;

  const x = await neueVerbindung();
  const a = await neueVerbindung();
  const b = await neueVerbindung();
  try {
    await x.query("begin");
    await x.query("select pg_advisory_xact_lock($1)", [ADVISORY_KEY.toString()]);

    const pidA = await pidVon(a);
    const pidB = await pidVon(b);

    await a.query("begin");
    const pA = ruf(a, `select status from public.${KOPIE}($1, $2, interval '72 hours')`, [
      p.email,
      "zz-probe-s1-TA",
    ]);
    const blockA = await warteBisBlockiert(beobachter, pidA);
    pruefe(
      "S1 · A parkt am Riegel, hinter allen Pruefungen",
      blockA.length > 0,
      `pg_blocking_pids(A) = [${blockA}] · ${await wartetAuf(beobachter, pidA)}`,
    );

    await b.query("begin");
    const pB = ruf(b, "select status from public.issue_activation_token($1, $2, interval '72 hours')", [
      p.email,
      "zz-probe-s1-TB",
    ]);
    const blockB = await warteBisBlockiert(beobachter, pidB, 2000);
    const bWartetAufA = blockB.includes(pidA);
    console.log(
      `       gemessen: pg_blocking_pids(B) = [${blockB}]` +
        `${bWartetAufA ? "  (B wartet auf A)" : "  (B wartet NICHT auf A)"}` +
        ` · ${await wartetAuf(beobachter, pidB)}`,
    );

    // Die Reihenfolge richtet sich nach dem MESSWERT, nicht nach einer Erwartung.
    //
    // Blockiert B nicht (so ist es ohne die Sperre), dann laeuft B ganz durch
    // und COMMITTET — erst danach faellt der Riegel. Sonst kollidiert A an B's
    // unbestaetigtem Indexeintrag, und beide warten aufeinander: das misst die
    // Sperre am Index, nicht den Befund 8.8.
    //
    // Blockiert B dagegen an A (so soll es mit der Sperre sein), dann KANN B
    // nicht vorher committen — dann faellt der Riegel zuerst.
    let antwortA: Antwort;
    let antwortB: Antwort;
    if (bWartetAufA) {
      await x.query("commit"); // Riegel faellt, A laeuft weiter
      antwortA = await pA;
      await a.query("commit"); // gibt die Profilzeile frei, B laeuft weiter
      antwortB = await pB;
      await b.query("commit");
    } else {
      antwortB = await pB;
      await b.query("commit");
      await x.query("commit"); // Riegel faellt, A laeuft weiter — auf B's committeten Stand
      antwortA = await pA;
      await a.query("commit");
    }

    console.log(`       A (Kopie) = ${zeige(antwortA)} · B (Original) = ${zeige(antwortB)}`);

    const { rows: tokens } = await admin.query(
      `select token_hash, created_at > $2 as waehrend_des_laufs, invalidated_at is not null as entwertet,
              used_at is null and invalidated_at is null as offen
         from public.activation_tokens where profile_id = $1 order by created_at`,
      [p.id, start],
    );
    for (const t of tokens) {
      console.log(
        `       ${t.token_hash}: ${t.offen ? "offen" : t.entwertet ? "ENTWERTET" : "benutzt"}` +
          `${t.waehrend_des_laufs ? " (waehrend des Laufs entstanden)" : ""}`,
      );
    }

    const frischEntwertet = tokens.filter((t) => t.waehrend_des_laufs && t.entwertet);
    pruefe(
      "S1 · kein waehrend des Laufs entstandenes Token wurde entwertet",
      frischEntwertet.length === 0,
      frischEntwertet.length === 0
        ? "keines"
        : `${frischEntwertet.length}: ${frischEntwertet.map((t) => t.token_hash).join(", ")}`,
    );
    const ausgaben = [antwortA, antwortB].filter(istAusgabe);
    pruefe(
      "S1 · genau EINE der beiden Anforderungen gibt ein Token aus",
      ausgaben.length === 1,
      `${ausgaben.length} von 2 (A=${zeige(antwortA)}, B=${zeige(antwortB)})`,
    );
    const verlierer = [antwortA, antwortB].find((r) => !istAusgabe(r));
    pruefe(
      "S1 · der Verlierer faellt in eine ehrliche Grenze, nicht in einen DB-Fehler",
      verlierer !== undefined && "status" in verlierer && verlierer.status !== "(keine Zeile)",
      verlierer ? zeige(verlierer) : "es gab keinen Verlierer",
    );
    pruefe(
      "S1 · genau EIN offenes Token bleibt uebrig",
      tokens.filter((t) => t.offen).length === 1,
      `${tokens.filter((t) => t.offen).length} offen von ${tokens.length}`,
    );
  } finally {
    for (const c of [x, a, b]) await c.end().catch(() => {});
  }
}

/**
 * S2 — der Waechter-Fall (8.9). Eine zweite Verbindung fuegt AN DEN RPCs VORBEI
 * ein offenes Token ein und committet NICHT. Die Pruefungen sehen die Zeile
 * nicht; das `insert` kollidiert am partiellen Index und blockiert.
 * Behauptung: A antwortet `pending` — ueber den 23505-Zweig, nicht ueber eine Grenze.
 */
async function s2(admin: pg.Client, beobachter: pg.Client): Promise<void> {
  console.log("\n── S2 · 8.9 · der 23505-Waechter unter einem echten Zwei-Sitzungs-Wettlauf ──");
  const p = await legeProfilAn(admin, "s2");

  const c = await neueVerbindung();
  const a = await neueVerbindung();
  try {
    await c.query("begin");
    await c.query(
      `insert into public.activation_tokens (token_hash, profile_id, expires_at)
       values ('zz-probe-s2-fremd', $1, now() + interval '72 hours')`,
      [p.id],
    );

    const pidA = await pidVon(a);
    await a.query("begin");
    const pA = ruf(a, "select status from public.issue_activation_token($1, $2, interval '72 hours')", [
      p.email,
      "zz-probe-s2-TA",
    ]);
    const blockA = await warteBisBlockiert(beobachter, pidA);
    console.log(
      `       gemessen: pg_blocking_pids(A) = [${blockA}] · ${await wartetAuf(beobachter, pidA)}`,
    );

    await c.query("commit");
    const antwortA = await pA;
    await a.query("commit");

    // KEINE Behauptung auf einen festen Statuswert. 8.9 fragt: haelt der
    // Waechter unter einem echten Zwei-Sitzungs-Wettlauf, ohne dass ein
    // DB-Fehler durchschlaegt? Beide gemessenen Antworten sind ehrlich —
    //   ohne die Sperre: `pending`, ueber den 23505-Zweig aus 8.1;
    //   mit der Sperre:  `rate_limited`, weil A schon VOR seinen Pruefungen
    //     wartet: das `insert` der fremden Sitzung nimmt fuer den
    //     FREMDSCHLUESSEL ein `for key share` auf die Profilzeile, und das
    //     kollidiert mit `for update`. A prueft danach auf dem committeten
    //     Stand und sieht das fremde Token.
    // Eine Behauptung auf „pending" wuerde nach dem Fix fallen, obwohl nichts
    // kaputt ist — sie pruefte den Weg, nicht das Ergebnis.
    const { rows } = await admin.query(
      "select count(*) filter (where used_at is null and invalidated_at is null) as offen from public.activation_tokens where profile_id = $1",
      [p.id],
    );
    pruefe(
      "S2 · A antwortet mit einem Status statt einen DB-Fehler durchzureichen",
      "status" in antwortA,
      `${zeige(antwortA)} (ohne Sperre: pending ueber den 23505-Zweig · mit Sperre: rate_limited vor den Pruefungen)`,
    );
    pruefe("S2 · genau EIN offenes Token", Number(rows[0].offen) === 1, `${rows[0].offen} offen`);
  } finally {
    for (const x of [c, a]) await x.end().catch(() => {});
  }
}

/**
 * S3 — der angemeldete Weg. B ruft `request_own_activation_token` und committet
 * NICHT; A ruft auf und laeuft in B hinein; B committet.
 * `request_own_activation_token` hat KEINEN 23505-Handler.
 */
async function s3(admin: pg.Client, beobachter: pg.Client): Promise<void> {
  console.log("\n── S3 · der angemeldete Weg, zwei gleichzeitige eigene Anforderungen ──");
  const p = await legeProfilAn(admin, "s3");

  const b = await neueVerbindung();
  const a = await neueVerbindung();
  try {
    await b.query("begin");
    await alsMitglied(b, p.id);
    const antwortB = await ruf(
      b,
      "select status from public.request_own_activation_token($1, interval '72 hours')",
      ["zz-probe-s3-TB"],
    );

    const pidA = await pidVon(a);
    await a.query("begin");
    await alsMitglied(a, p.id);
    const pA = ruf(a, "select status from public.request_own_activation_token($1, interval '72 hours')", [
      "zz-probe-s3-TA",
    ]);
    const blockA = await warteBisBlockiert(beobachter, pidA);
    console.log(
      `       gemessen: pg_blocking_pids(A) = [${blockA}] · ${await wartetAuf(beobachter, pidA)}`,
    );

    await b.query("commit");
    const antwortA = await pA;
    await a.query("commit").catch(() => a.query("rollback"));

    console.log(`       B = ${zeige(antwortB)} · A = ${zeige(antwortA)}`);
    pruefe(
      "S3 · A antwortet mit einem Status statt einen DB-Fehler durchzureichen",
      "status" in antwortA,
      zeige(antwortA),
    );
    const { rows } = await admin.query(
      "select count(*) filter (where used_at is null and invalidated_at is null) as offen from public.activation_tokens where profile_id = $1",
      [p.id],
    );
    pruefe("S3 · genau EIN offenes Token", Number(rows[0].offen) === 1, `${rows[0].offen} offen`);
  } finally {
    for (const x of [b, a]) await x.end().catch(() => {});
  }
}

/**
 * S4 — die gemischten Wege, in BEIDEN Gewinner-Reihenfolgen. Ueber
 * `pg_blocking_pids` belegt, dass A tatsaechlich VON B blockiert wird — sonst
 * belegt „A war spaeter fertig" nur, dass A langsamer war.
 */
async function s4(admin: pg.Client, beobachter: pg.Client, anonymGewinnt: boolean): Promise<void> {
  const titel = anonymGewinnt ? "anonym gewinnt gegen angemeldet" : "angemeldet gewinnt gegen anonym";
  console.log(`\n── S4 · gemischte Wege · ${titel} ──`);
  const p = await legeProfilAn(admin, anonymGewinnt ? "s4a" : "s4b");

  const b = await neueVerbindung();
  const a = await neueVerbindung();
  try {
    // Vor dem `begin` — eine abgebrochene Transaktion beantwortet keine Fragen mehr.
    const pidB = await pidVon(b);
    const pidA = await pidVon(a);

    await b.query("begin");
    let antwortB: Antwort;
    if (anonymGewinnt) {
      antwortB = await ruf(
        b,
        "select status from public.issue_activation_token($1, $2, interval '72 hours')",
        [p.email, `zz-probe-s4-${anonymGewinnt ? 'a' : 'b'}-TB`],
      );
    } else {
      await alsMitglied(b, p.id);
      antwortB = await ruf(
        b,
        "select status from public.request_own_activation_token($1, interval '72 hours')",
        [`zz-probe-s4-${anonymGewinnt ? 'a' : 'b'}-TB`],
      );
    }

    if (!("status" in antwortB)) {
      pruefe(
        `S4/${anonymGewinnt ? "a" : "b"} · B kommt ueberhaupt durch`,
        false,
        `B ist gescheitert, bevor A ueberhaupt lief: ${zeige(antwortB)}`,
      );
      return;
    }

    await a.query("begin");
    let pA: Promise<Antwort>;
    if (anonymGewinnt) {
      await alsMitglied(a, p.id);
      pA = ruf(a, "select status from public.request_own_activation_token($1, interval '72 hours')", [
        `zz-probe-s4-${anonymGewinnt ? 'a' : 'b'}-TA`,
      ]);
    } else {
      pA = ruf(a, "select status from public.issue_activation_token($1, $2, interval '72 hours')", [
        p.email,
        `zz-probe-s4-${anonymGewinnt ? 'a' : 'b'}-TA`,
      ]);
    }
    const blockA = await warteBisBlockiert(beobachter, pidA);
    pruefe(
      `S4/${anonymGewinnt ? "a" : "b"} · A wird VON B blockiert`,
      blockA.includes(pidB),
      `pg_blocking_pids(A) = [${blockA}], B = ${pidB} · ${await wartetAuf(beobachter, pidA)}`,
    );

    await b.query("commit");
    const antwortA = await pA;
    await a.query("commit").catch(() => a.query("rollback"));

    console.log(`       B = ${zeige(antwortB)} · A = ${zeige(antwortA)}`);
    pruefe(
      `S4/${anonymGewinnt ? "a" : "b"} · A antwortet mit einem Status statt einen DB-Fehler durchzureichen`,
      "status" in antwortA,
      zeige(antwortA),
    );
    const ausgaben = [antwortA, antwortB].filter(istAusgabe);
    pruefe(
      `S4/${anonymGewinnt ? "a" : "b"} · genau EINE der beiden gibt ein Token aus`,
      ausgaben.length === 1,
      `${ausgaben.length} von 2`,
    );
  } finally {
    for (const x of [b, a]) await x.end().catch(() => {});
  }
}

// ── Lauf ────────────────────────────────────────────────────────────────────
const admin = await neueVerbindung();
const beobachter = await neueVerbindung();
try {
  await raeumeAb(admin); // Reste eines abgebrochenen Laufs
  await erzeugeKopie(admin);
  console.log(`Kopie ${KOPIE} angelegt, Riegel vor dem ersten Schreibzugriff geprueft.`);

  await s1(admin, beobachter);
  await s2(admin, beobachter);
  await s3(admin, beobachter);
  await s4(admin, beobachter, true);
  await s4(admin, beobachter, false);
} finally {
  await raeumeAb(admin).catch((e) => console.error(`Abraeumen fehlgeschlagen: ${e}`));
  await admin.end().catch(() => {});
  await beobachter.end().catch(() => {});
}

const gefallen = laeufe.filter((l) => !l.ok);
console.log(`\n${laeufe.length - gefallen.length} von ${laeufe.length} Behauptungen halten.`);
if (gefallen.length > 0) {
  rot(`${gefallen.length} Behauptung(en) gefallen: ${gefallen.map((l) => l.name).join(" · ")}`);
}
console.log("Alle Behauptungen halten.");
