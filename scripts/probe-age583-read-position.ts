#!/usr/bin/env tsx
/**
 * RED/GREEN-Sonde für den Lese-Zeitstempel (AGE-583).
 *
 *   npx tsx scripts/probe-age583-read-position.ts
 *
 * WOZU. Der Change behauptet Dinge, die eine Sichtprobe im UI nicht belegen
 * kann, weil das UI nur zeigt, was ihm erlaubt wurde:
 *
 *   1. `message_threads` bleibt unangetastet — kein UPDATE-Recht, keine
 *      Lese-Spalte. Der verworfene Entwurf hätte hier zwei Spalten angelegt und
 *      damit dem Gegenüber eine Lesebestätigung geliefert.
 *   2. Der Lesestand liegt in `thread_read_positions` und ist EIGENTÜMERPRIVAT:
 *      A sieht B's Zeile nicht. Das ist die eigentliche Zusage des Changes,
 *      und sie ist im UI grundsätzlich unsichtbar — dort wird sie ja nicht
 *      angezeigt, ob sie nun lesbar wäre oder nicht.
 *
 * WARUM MIT GESETZTEN JWT-CLAIMS. Eine Sonde, die `set role authenticated` ohne
 * `request.jwt.claims` fährt, hat keine `auth.uid()`. Jede Policy mit
 * `= (select auth.uid())` trifft dann null Zeilen, und der Lauf meldet
 * „verweigert" — auch dort, wo in Wahrheit gar nichts geprüft wurde. Ein solcher
 * Negativbefund ist von einem Leerlauf nicht zu unterscheiden.
 *
 * DESHALB TRÄGT JEDE VERWEIGERUNG EINE POSITIVKONTROLLE. Zu jedem „A darf nicht"
 * steht ein „B darf" im selben Lauf. Bewegt sich B nicht, ist der ganze Lauf
 * ungültig und nicht etwa bestanden.
 *
 * WARUM GEGEN DEN LOKALEN STACK. Es wird geschrieben. Die Adresse ist fest
 * verdrahtet und wird NICHT aus der Umgebung gelesen — ein Wächter, der nur
 * einen Variablennamen prüft, hält nichts, wenn jemand die Variable anders
 * setzt. Gleiche Begründung wie in scripts/chat-testkonten.ts.
 *
 * Setzt die zwei Konten aus scripts/chat-testkonten.ts voraus.
 */
import pg from "pg";

/** Fest verdrahtet, nicht aus der Umgebung: siehe Kopf. */
const LOKAL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

const ANNA = "0aae5830-0000-4000-8000-00000000a11a";
const BERND = "0aae5830-0000-4000-8000-00000000b22b";

type Befund = { name: string; erwartet: string; gemessen: string; ok: boolean };
const befunde: Befund[] = [];

function halte(name: string, erwartet: string, gemessen: string): void {
  befunde.push({ name, erwartet, gemessen, ok: erwartet === gemessen });
}

/** Führt `fn` als das angegebene Mitglied aus — mit echten JWT-Claims. */
async function alsMitglied<T>(
  c: pg.Client,
  uid: string,
  fn: () => Promise<T>,
): Promise<{ wert: T } | { fehler: string }> {
  await c.query("begin");
  await c.query("select set_config('role', 'authenticated', true)");
  await c.query("select set_config('request.jwt.claims', $1, true)", [
    JSON.stringify({ sub: uid, role: "authenticated" }),
  ]);
  try {
    const wert = await fn();
    await c.query("rollback");
    return { wert };
  } catch (e) {
    await c.query("rollback");
    const err = e as { code?: string; message?: string };
    return { fehler: `${err.code ?? "?"}: ${err.message ?? String(e)}` };
  }
}

async function main(): Promise<void> {
  const c = new pg.Client({ connectionString: LOKAL });
  await c.connect();

  // Wächter: niemals gegen etwas anderes als den lokalen Stack schreiben. Der
  // Stack läuft in Docker und meldet seine Container-Adresse aus dem Bridge-Netz,
  // nicht 127.0.0.1 — geprüft wird deshalb auf private Bereiche. DEV und PROD
  // liegen hinter öffentlichen Adressen und fallen damit durch.
  const wo = await c.query<{ host: string | null }>("select inet_server_addr()::text as host");
  const host = wo.rows[0].host ?? "unix-socket";
  if (!/^(127\.|::1|unix-socket|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) {
    throw new Error(`Nicht der lokale Stack (${host}) — Abbruch vor dem ersten Schreiben.`);
  }

  // ── Vorbedingung: der Thread der beiden Testkonten ─────────────────────────
  const t = await c.query<{ id: string; a: string; b: string }>(
    `select id, a_profile_id as a, b_profile_id as b
       from public.message_threads
      where (a_profile_id = $1 and b_profile_id = $2)
         or (a_profile_id = $2 and b_profile_id = $1)`,
    [ANNA, BERND],
  );
  if (t.rowCount !== 1) {
    throw new Error(
      `Kein Thread zwischen den Testkonten (${t.rowCount} gefunden). ` +
        `Erst 'npx tsx scripts/chat-testkonten.ts' laufen lassen.`,
    );
  }
  const thread = t.rows[0];

  // ── Gibt es die Tabelle überhaupt schon? ───────────────────────────────────
  const tabelle = await c.query(
    `select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'thread_read_positions'`,
  );
  const tabelleDa = tabelle.rowCount === 1;
  console.log(
    tabelleDa
      ? "» thread_read_positions vorhanden — GREEN-Lauf (nach der Migration)"
      : "» thread_read_positions FEHLT — RED-Lauf (vor der Migration)",
  );
  console.log();

  // ── 1. Die Tabelle trägt kein UPDATE-Recht ─────────────────────────────────
  // Das gilt vor UND nach der Migration und ist die eigentliche Zusage.
  const tabellenRecht = await c.query<{ p: string }>(
    `select privilege_type as p from information_schema.role_table_grants
      where table_schema = 'public' and table_name = 'message_threads'
        and grantee = 'authenticated' order by 1`,
  );
  halte(
    "Tabellen-Grants auf message_threads",
    "INSERT,SELECT",
    tabellenRecht.rows.map((r) => r.p).join(","),
  );

  const spaltenRecht = await c.query<{ c: string }>(
    `select column_name as c from information_schema.role_column_grants
      where table_schema = 'public' and table_name = 'message_threads'
        and grantee = 'authenticated' and privilege_type = 'UPDATE' order by 1`,
  );
  halte(
    "Spalten-UPDATE-Grants auf message_threads",
    "(keine)",
    spaltenRecht.rowCount === 0 ? "(keine)" : spaltenRecht.rows.map((r) => r.c).join(","),
  );

  // ── 2. `message_threads` trägt KEINE Lese-Spalte ───────────────────────────
  // Der verworfene Entwurf hätte hier zwei angelegt — und weil threads_select
  // Teilnehmern die ganze Zeile gibt, wäre der Lesestand des Gegenübers damit
  // abfragbar gewesen. Diese Zusage gilt vor UND nach der Migration.
  const leseSpalten = await c.query<{ column_name: string }>(
    `select column_name from information_schema.columns
      where table_schema = 'public' and table_name = 'message_threads'
        and column_name like '%read%' order by 1`,
  );
  halte(
    "message_threads trägt keine Lese-Spalte",
    "(keine)",
    leseSpalten.rowCount === 0 ? "(keine)" : leseSpalten.rows.map((r) => r.column_name).join(","),
  );

  // ── 3. Positivkontrolle: dieselbe Sitzung DARF lesen ───────────────────────
  // Ohne sie ist „abgewiesen" von „die Claims kamen nie an" nicht zu trennen.
  const lesen = await alsMitglied(c, ANNA, async () => {
    const r = await c.query(`select id from public.message_threads where id = $1`, [thread.id]);
    return `${r.rowCount} Zeile(n) gelesen`;
  });
  halte(
    "Positivkontrolle: derselbe Aufrufer liest seinen Thread",
    "1 Zeile(n) gelesen",
    "fehler" in lesen ? `FEHLER ${lesen.fehler}` : lesen.wert,
  );

  // ── 4. Nach der Migration: der Lesestand ist eigentümerprivat ──────────────
  if (tabelleDa) {
    // GRUNDLINIE, die sich BEWEGT. Der erste Lauf dieser Sonde meldete brav
    // „0 ungelesen" — und zwar, weil der Thread gar keine Nachricht trug. Eine
    // Messung aus lauter Nullen ist von einem Erfolg nicht zu unterscheiden.
    // Also: zwei Nachrichten von B und eine von A, damit „nicht von mir" und
    // „neuer als mein Lesestand" überhaupt etwas zu trennen haben.
    await c.query(`delete from public.messages where thread_id = $1`, [thread.id]);
    await c.query(
      `insert into public.messages (thread_id, sender_id, body) values
         ($1, $2, 'von B, eins'), ($1, $2, 'von B, zwei'), ($1, $3, 'von A')`,
      [thread.id, BERND, ANNA],
    );

    // B's Zeile — der Wert, den A NICHT sehen darf. Ausserhalb der
    // alsMitglied-Transaktionen, damit er den Lauf überdauert; die werden
    // zurückgerollt.
    await c.query(
      `insert into public.thread_read_positions (thread_id, profile_id, last_read_at)
       values ($1, $2, clock_timestamp())
       on conflict (thread_id, profile_id) do update set last_read_at = excluded.last_read_at`,
      [thread.id, BERND],
    );

    // Schreiben UND Lesen im SELBEN Zugriff. Getrennt gemessen sah es zuerst so
    // aus, als sei die eigene Zeile unsichtbar — in Wahrheit hatte der Rollback
    // sie weggeräumt, bevor der Lesetest lief.
    const eigen = await alsMitglied(c, ANNA, async () => {
      await c.query(
        `insert into public.thread_read_positions (thread_id, profile_id, last_read_at)
         values ($1, $2, clock_timestamp())
         on conflict (thread_id, profile_id) do update set last_read_at = excluded.last_read_at`,
        [thread.id, ANNA],
      );
      const r = await c.query<{ profile_id: string }>(
        `select profile_id from public.thread_read_positions where thread_id = $1`,
        [thread.id],
      );
      const wer = r.rows.map((x) => (x.profile_id === ANNA ? "A" : "B")).sort();
      return wer.length === 0 ? "(nichts)" : wer.join(",");
    });
    halte(
      "A schreibt und liest: sieht NUR sich selbst, nicht B",
      "A",
      "fehler" in eigen ? `FEHLER ${eigen.fehler}` : eigen.wert,
    );

    const fremdSchreiben = await alsMitglied(c, ANNA, async () => {
      const r = await c.query(
        `update public.thread_read_positions set last_read_at = clock_timestamp()
          where thread_id = $1 and profile_id = $2`,
        [thread.id, BERND],
      );
      return `${r.rowCount} Zeile(n) geändert`;
    });
    halte(
      "A schreibt B's Zeile",
      "0 Zeile(n) geändert",
      "fehler" in fremdSchreiben
        ? `abgewiesen (${fremdSchreiben.fehler.split(":")[0]})`
        : fremdSchreiben.wert,
    );

    // Unbeteiligter: ein Profil, das weder A noch B ist.
    const dritter = await c.query<{ id: string }>(
      `select id from public.profiles where id not in ($1, $2) and activated_at is not null limit 1`,
      [ANNA, BERND],
    );
    if (dritter.rowCount === 1) {
      const fremdThread = await alsMitglied(c, dritter.rows[0].id, async () => {
        await c.query(
          `insert into public.thread_read_positions (thread_id, profile_id)
           values ($1, $2)`,
          [thread.id, dritter.rows[0].id],
        );
        return "DURCHGEKOMMEN";
      });
      halte(
        "Unbeteiligter schreibt eine Zeile auf fremden Thread",
        "abgewiesen",
        "fehler" in fremdThread ? "abgewiesen" : fremdThread.wert,
      );
    } else {
      console.log("  (kein drittes aktiviertes Profil lokal — Fremdthread nicht geprüft)\n");
    }

    const inaktiv = await c.query<{ id: string }>(
      `select id from public.profiles where activated_at is null limit 1`,
    );
    if (inaktiv.rowCount === 1) {
      const zaehler = await alsMitglied(c, inaktiv.rows[0].id, async () => {
        const r = await c.query(`select * from public.unread_message_counts()`);
        return `${r.rowCount} Zeile(n)`;
      });
      halte(
        "unread_message_counts() für ein nicht aktiviertes Konto",
        "0 Zeile(n)",
        "fehler" in zaehler ? `FEHLER ${zaehler.fehler}` : zaehler.wert,
      );
    }

    // POSITIVKONTROLLE mit einem Wert, der sich bewegt. A hat keinen Lesestand
    // und drei Nachrichten im Thread, davon ZWEI von B — also genau 2 ungelesen.
    // Eine „2" trennt drei Fehler auf einmal ab, die eine „0" alle durchliesse:
    // die eigene Nachricht mitgezählt (waeren 3), gar nichts gezaehlt (0), oder
    // den Lesestand des Gegenuebers benutzt (0, weil B gerade gelesen hat).
    const zaehlerAktiv = await alsMitglied(c, ANNA, async () => {
      const r = await c.query<{ unread_count: string }>(
        `select unread_count from public.unread_message_counts()`,
      );
      return r.rows.map((x) => x.unread_count).join(",") || "(keine Zeile)";
    });
    halte(
      "unread_message_counts() für A: zwei fremde, eine eigene Nachricht",
      "2",
      "fehler" in zaehlerAktiv ? `FEHLER ${zaehlerAktiv.fehler}` : zaehlerAktiv.wert,
    );

    // Und nach dem Lesen: keine Zeile mehr — nicht etwa eine Zeile mit 0.
    const nachLesen = await alsMitglied(c, ANNA, async () => {
      await c.query(
        `insert into public.thread_read_positions (thread_id, profile_id, last_read_at)
         values ($1, $2, clock_timestamp())
         on conflict (thread_id, profile_id) do update set last_read_at = excluded.last_read_at`,
        [thread.id, ANNA],
      );
      const r = await c.query(`select * from public.unread_message_counts()`);
      return r.rowCount === 0 ? "(keine Zeile)" : `${r.rowCount} Zeile(n)`;
    });
    halte(
      "Nach dem Lesen liefert die Funktion GAR KEINE Zeile",
      "(keine Zeile)",
      "fehler" in nachLesen ? `FEHLER ${nachLesen.fehler}` : nachLesen.wert,
    );

    await c.query(`delete from public.thread_read_positions where thread_id = $1`, [thread.id]);
    await c.query(`delete from public.messages where thread_id = $1`, [thread.id]);
  }

  // ── Ausgabe ────────────────────────────────────────────────────────────────
  console.log();
  for (const b of befunde) {
    console.log(`${b.ok ? "✓" : "✗"} ${b.name}`);
    if (!b.ok) console.log(`    erwartet: ${b.erwartet}\n    gemessen: ${b.gemessen}`);
  }
  const schlecht = befunde.filter((b) => !b.ok).length;
  console.log(`\n${befunde.length - schlecht}/${befunde.length} erfüllt`);

  await c.end();
  if (schlecht > 0) process.exitCode = 1;
}

void main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
