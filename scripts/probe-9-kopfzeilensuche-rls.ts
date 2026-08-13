#!/usr/bin/env tsx
/**
 * Der Datenbank-Nachweis fuer AGE-540 (Kopfzeilen-Suche), Aufgabengruppe 9.
 *
 *   infisical run --env=dev -- npx tsx scripts/probe-9-kopfzeilensuche-rls.ts
 *
 * DIE FRAGE. Die Kopfzeilen-Suche ruft `search_directory` — dieselbe Funktion,
 * die das Verzeichnis ruft, nur mit gekuerzter Trefferliste. Die Oberflaeche
 * behauptet an drei Stellen etwas ueber die GRENZE dahinter:
 *
 *   1. ein nicht aktiviertes Konto sieht keine fremde Zeile,
 *   2. ein aktiviertes Konto ab `discover` sieht mit demselben Wort Treffer,
 *   3. ausgeloggt weist die Datenbank mit `42501` ab.
 *
 * Alle drei sind Aussagen ueber Postgres, nicht ueber React. In jsdom ist der
 * Rand zur Datenbank gemockt — dort ist jede dieser Aussagen per Konstruktion
 * wahr. Deshalb misst diese Sonde sie an der echten Instanz.
 *
 * WARUM NICHT `anon-anreicherung.test.ts`. Der bestehende anon-Waechter traegt
 * den Nachweis nachweislich nicht: seine Positivliste erfasst weder neue
 * Dateien noch Funktionsaufrufe. Gemessen in dieser Aenderung — `rpc()` in
 * einer nicht importierten Datei liess ihn gruen.
 *
 * WARUM ZWEI WEGWERF-KONTEN STATT BESTEHENDER. DEV bedient die Live-Seite. Ein
 * bestehendes Konto kurz auf `activated_at = null` zu setzen waere ein Schreiben
 * an einer echten Zeile — auch zurueckgerollt ist das die riskantere Form. Die
 * Sonde legt stattdessen zwei eigene Konten an, misst, und rollt die GANZE
 * Transaktion zurueck; danach zaehlt sie nach, dass nichts stehen geblieben ist.
 *
 * WARUM DAS UNAKTIVIERTE KONTO AUF `impact` STEHT. Waere es `basic`, liesse der
 * Nullbefund zwei Lesarten zu — Stufe oder Aktivierung. Auf der hoechsten Stufe
 * bleibt genau eine: das Aktivierungs-Gate.
 */
import { readFile } from "node:fs/promises";

import pg from "pg";

/** Ein Wort, das auf mindestens zwei oeffentliche, aktivierte Profile passt. */
type Suchwort = { wort: string; profile: number };

type Fall = {
  nr: string;
  frage: string;
  erwartet: string;
  gemessen: string;
  bestanden: boolean;
};

const faelle: Fall[] = [];

function pruefe(nr: string, frage: string, erwartet: string, gemessen: string) {
  faelle.push({ nr, frage, erwartet, gemessen, bestanden: erwartet === gemessen });
}

async function main() {
  const dbUrl = process.env.SUPABASE_DB_URL_DEV;
  if (!dbUrl) {
    throw new Error(
      "SUPABASE_DB_URL_DEV fehlt — mit `infisical run --env=dev -- npx tsx …` starten.",
    );
  }

  // Das Ziel wird geprueft, nicht geglaubt: die Sonde legt Zeilen an (und nimmt
  // sie zurueck). Ein Waechter, der nur eine Variable liest, haelt nichts, wenn
  // jemand sie anders setzt — der Projekt-Ref steht in der Adresse selbst.
  const devRef = (await readFile("scripts/dev-project-ref.txt", "utf8")).trim();
  if (!dbUrl.includes(devRef)) {
    throw new Error(
      `SUPABASE_DB_URL_DEV zeigt nicht auf das DEV-Projekt (${devRef}). Abbruch vor dem ersten Schreiben.`,
    );
  }

  const c = new pg.Client({
    connectionString: dbUrl,
    ssl: { ca: await readFile("scripts/supabase-root-2021-ca.crt", "utf8") },
  });
  await c.connect();

  const uidUnaktiviert = "00000000-0540-4000-a000-000000000001";
  const uidAktiviert = "00000000-0540-4000-a000-000000000002";

  try {
    await c.query("begin");

    // ── Ein Wort, das wirklich mehrere fremde Profile trifft ────────────────
    // Nicht geraten: `ts_stat` liest die Lexeme aus den echten `search_doc`
    // der oeffentlichen, aktivierten Profile. Ein selbst ausgedachtes Wort
    // koennte auf null Zeilen passen — dann waere 9.1 gruen, ohne etwas zu
    // zeigen, und 9.2 rot ohne Fehler im Code.
    const { rows: woerter } = await c.query<Suchwort>(`
      select word as wort, ndoc as profile
      from ts_stat(
        'select search_doc from public.profiles where is_public and activated_at is not null'
      )
      where ndoc >= 2 and length(word) >= 4
      order by ndoc desc, word
      limit 5
    `);
    if (woerter.length === 0) {
      throw new Error(
        "Kein Wort trifft zwei oeffentliche, aktivierte Profile — Sonde nicht aussagekraeftig.",
      );
    }
    const suchwort = woerter[0].wort;
    console.log(
      `\nSuchwort: „${suchwort}" — laut ts_stat in ${woerter[0].profile} oeffentlichen, aktivierten Profilen.`,
    );
    console.log(
      `Weitere Kandidaten: ${
        woerter
          .slice(1)
          .map((w) => `${w.wort} (${w.profile})`)
          .join(", ") || "—"
      }`,
    );

    // ── Zwei Wegwerf-Konten ─────────────────────────────────────────────────
    for (const [uid, name] of [
      [uidUnaktiviert, "AGE-540 Sonde unaktiviert"],
      [uidAktiviert, "AGE-540 Sonde aktiviert"],
    ]) {
      await c.query(
        `insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
           email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
         values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
           $2, '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb)`,
        [uid, `age540-sonde-${uid.slice(-1)}@example.invalid`],
      );
      // Ein Trigger auf auth.users kann das Profil schon angelegt haben.
      await c.query(
        `insert into public.profiles (id, name, tier, is_public, activated_at)
         values ($1, $2, $3, false, $4)
         on conflict (id) do update
           set name = excluded.name, tier = excluded.tier,
               is_public = excluded.is_public, activated_at = excluded.activated_at`,
        [
          uid,
          name,
          uid === uidUnaktiviert ? "impact" : "discover",
          uid === uidUnaktiviert ? null : new Date().toISOString(),
        ],
      );
    }
    // `is_public = false` bei beiden: die Sonden-Konten sollen die Trefferzahl
    // der Gegenprobe nicht selbst auffuellen. Gezaehlt werden nur FREMDE Zeilen.

    const alsKonto = async (uid: string) => {
      await c.query("set local role authenticated");
      await c.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: uid, role: "authenticated" }),
      ]);
    };
    const zurueck = async () => {
      await c.query("reset role");
      await c.query("select set_config('request.jwt.claims', null, true)");
    };

    // ── 9.2 zuerst: die Gegenprobe ──────────────────────────────────────────
    // Ohne sie belegt 9.1 nur, dass die Abfrage nichts liefert.
    // (Kein Savepoint: hier wird kein Fehler erwartet. Einen zu setzen, den
    // niemand freigibt oder zurückrollt, sähe nach einer Absicht aus, die es
    // nicht gibt — 9.3 braucht einen, weil `42501` die Transaktion abbricht.)
    await alsKonto(uidAktiviert);
    const aktiviert = await c.query<{ id: string; name: string }>(
      "select id, name from public.search_directory(p_query => $1)",
      [suchwort],
    );
    await zurueck();
    const fremdeAktiviert = aktiviert.rows.filter((r) => r.id !== uidAktiviert);
    pruefe(
      "9.2",
      `aktiviertes Konto (discover) sucht „${suchwort}"`,
      "mindestens 2 fremde Zeilen",
      fremdeAktiviert.length >= 2
        ? "mindestens 2 fremde Zeilen"
        : `${fremdeAktiviert.length} fremde Zeilen`,
    );
    console.log(
      `\n9.2 sieht ${fremdeAktiviert.length} fremde Zeilen, u. a.: ` +
        fremdeAktiviert
          .slice(0, 3)
          .map((r) => r.name)
          .join(" · "),
    );

    // ── 9.1 Das nicht aktivierte Konto ──────────────────────────────────────
    await alsKonto(uidUnaktiviert);
    const unaktiviert = await c.query<{ id: string; name: string }>(
      "select id, name from public.search_directory(p_query => $1)",
      [suchwort],
    );
    await zurueck();
    const fremdeUnaktiviert = unaktiviert.rows.filter((r) => r.id !== uidUnaktiviert);
    pruefe(
      "9.1",
      `nicht aktiviertes Konto (impact!) sucht „${suchwort}"`,
      "0 fremde Zeilen",
      `${fremdeUnaktiviert.length} fremde Zeilen`,
    );
    // Die schaerfere Form derselben Messung: das Gate haelt auch die eigene Zeile.
    pruefe(
      "9.1b",
      "dasselbe Konto, Zeilen insgesamt",
      "0 Zeilen",
      `${unaktiviert.rows.length} Zeilen`,
    );

    // ── 9.1c Woran lag die Null? ────────────────────────────────────────────
    // Ein Nullbefund ist der schwaechste Messwert, den es gibt: ein vertippter
    // Rollenwechsel, eine nicht ankommende `sub`, ein Suchwort ohne Treffer —
    // alles drei saehe genauso aus wie ein wirksames Gate. Deshalb bekommt
    // GENAU DIESES Konto jetzt `activated_at` gesetzt, sonst nichts, und wird
    // mit demselben Wort erneut gefragt. Kommen dann Zeilen, war die Null
    // vorher die Aktivierung und nichts anderes.
    await c.query("update public.profiles set activated_at = now() where id = $1", [
      uidUnaktiviert,
    ]);
    await alsKonto(uidUnaktiviert);
    const nachAktivierung = await c.query<{ id: string }>(
      "select id from public.search_directory(p_query => $1)",
      [suchwort],
    );
    await zurueck();
    const fremdeNachAktivierung = nachAktivierung.rows.filter((r) => r.id !== uidUnaktiviert);
    pruefe(
      "9.1c",
      "dasselbe Konto, nur activated_at gesetzt",
      "mindestens 2 fremde Zeilen",
      fremdeNachAktivierung.length >= 2
        ? "mindestens 2 fremde Zeilen"
        : `${fremdeNachAktivierung.length} fremde Zeilen`,
    );

    // ── 9.3 Ausgeloggt ──────────────────────────────────────────────────────
    // Eigener Savepoint: `42501` bricht die Transaktion ab.
    await c.query("savepoint s_anon");
    let anonBefund = "kein Fehler — die Abfrage lief durch";
    try {
      await c.query("set local role anon");
      await c.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ role: "anon" }),
      ]);
      const anon = await c.query("select id from public.search_directory(p_query => $1)", [
        suchwort,
      ]);
      anonBefund = `kein Fehler — ${anon.rows.length} Zeilen`;
    } catch (e) {
      anonBefund = (e as { code?: string }).code ?? String(e);
    } finally {
      await c.query("rollback to savepoint s_anon");
      await zurueck();
    }
    pruefe("9.3", "ausgeloggt (Rolle anon) ruft search_directory", "42501", anonBefund);

    await c.query("rollback");

    // ── Der Abbau wird nachgewiesen, nicht behauptet ────────────────────────
    const rest = await c.query<{ users: string; profile: string }>(
      `select (select count(*) from auth.users where id = any($1::uuid[])) as users,
              (select count(*) from public.profiles where id = any($1::uuid[])) as profile`,
      [[uidUnaktiviert, uidAktiviert]],
    );
    const liegengeblieben = Number(rest.rows[0].users) + Number(rest.rows[0].profile);

    console.log("\n┌─ AGE-540, Gruppe 9 ────────────────────────────────────────");
    for (const f of faelle) {
      console.log(`│ ${f.bestanden ? "✅" : "❌"} ${f.nr}  ${f.frage}`);
      console.log(`│      erwartet: ${f.erwartet}`);
      console.log(`│      gemessen: ${f.gemessen}`);
    }
    console.log(`└─ Wegwerf-Zeilen nach dem Rollback: ${liegengeblieben} (erwartet 0)\n`);

    const gescheitert = faelle.filter((f) => !f.bestanden);
    if (gescheitert.length > 0 || liegengeblieben > 0) {
      process.exitCode = 1;
    }
  } finally {
    await c.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
