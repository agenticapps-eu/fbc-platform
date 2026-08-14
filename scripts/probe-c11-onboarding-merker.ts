#!/usr/bin/env tsx
/**
 * Der Datenbank-Nachweis fuer AGE-538 (Willkommensstrecke), Aufgabengruppe 9.
 *
 *   npx tsx scripts/probe-c11-onboarding-merker.ts
 *
 * DIE FRAGE. Der Change trifft eine Entscheidung, die er nicht beweist, sondern
 * begruendet: der Onboarding-Merker liegt in `member_settings` und NICHT in
 * `profiles`, weil `profiles_select_self_or_discover` (`id = auth.uid() or
 * has_level(3)`) ab der Stufe `discover` fremde VOLLZEILEN freigibt. Waere das
 * falsch, traege jedes zahlende Mitglied den Merker aller anderen mit — eine
 * Preisgabe, die nirgends stuende.
 *
 * In jsdom ist der Rand zur Datenbank gemockt; dort ist jede dieser Aussagen per
 * Konstruktion wahr. pgTAP misst sie, aber nur in der impliziten Testtransaktion
 * einer Datei, die 420 andere Zusagen traegt. Diese Sonde misst sie einzeln und
 * benennt, WORAN die jeweilige Null lag.
 *
 * WARUM GEGEN DEN LOKALEN STACK. Es wird geschrieben — zwei Wegwerf-Konten samt
 * Profil und Einstellungszeile. DEV bedient die Live-Seite. Die Adresse ist
 * deshalb fest verdrahtet und wird nicht aus der Umgebung gelesen: ein Waechter,
 * der nur einen Variablennamen prueft, haelt nichts, wenn jemand die Variable
 * anders setzt.
 *
 * WARUM DIE FREMDSCHREIB-PRUEFUNG ZWEI FAELLE HAT. Ein fremdes UPDATE wirft
 * hier NICHT. `member_settings_own` filtert die fremde Zeile ueber `USING`
 * heraus, PostgreSQL fuehrt das Statement erfolgreich aus und aendert null
 * Zeilen. `42501` kaeme aus fehlenden RECHTEN — die hat `authenticated` auf
 * dieser Tabelle aber. Der Beleg ist deshalb der NACHGELESENE, unveraenderte
 * Fremdwert; ohne die Nachlese belegt „null Zeilen" gar nichts.
 */
import pg from "pg";

/** Fest verdrahtet, nicht aus der Umgebung: siehe Kopf. */
const LOKAL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

type Fall = { nr: string; frage: string; erwartet: string; gemessen: string; bestanden: boolean };

const faelle: Fall[] = [];

function pruefe(nr: string, frage: string, erwartet: string, gemessen: string) {
  faelle.push({ nr, frage, erwartet, gemessen, bestanden: erwartet === gemessen });
}

const EIGEN = "00000000-0538-4000-a000-000000000001";
const FREMD = "00000000-0538-4000-a000-000000000002";
const GESETZT = "2026-01-01T00:00:00.000Z";

async function main() {
  const c = new pg.Client({ connectionString: LOKAL });
  await c.connect();

  // Die eigentliche Sicherung ist die Adresse oben: eine gehostete Instanz ist
  // unter 127.0.0.1:54322 nicht erreichbar. Die Pruefung hier ist die zweite,
  // billige Bestaetigung — und sie erwartet ausdruecklich KEIN Loopback: der
  // lokale Stack laeuft im Container und meldet dessen Adresse (172.18.x.x).
  // Ein Waechter auf "127.0.0.1" lehnte den lokalen Stack ab, und genau das ist
  // hier beim ersten Lauf passiert.
  const wo = await c.query<{ host: string | null }>("select inet_server_addr()::text as host");
  const host = wo.rows[0].host ?? "unix-socket";
  const privat = /^(127\.|::1|unix-socket|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);
  if (!privat) {
    throw new Error(`Nicht der lokale Stack (${host}) — Abbruch vor dem ersten Schreiben.`);
  }
  console.log(`Lokaler Stack, Serveradresse ${host}.`);

  try {
    await c.query("begin");

    for (const [uid, name, tier] of [
      [EIGEN, "AGE-538 Sonde eigen", "basic"],
      [FREMD, "AGE-538 Sonde fremd", "discover"],
    ]) {
      await c.query(
        `insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
           email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
         values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
           $2, '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb)`,
        [uid, `age538-sonde-${uid.slice(-1)}@example.invalid`],
      );
      // Ein Trigger auf auth.users kann das Profil schon angelegt haben.
      await c.query(
        `insert into public.profiles (id, name, tier, is_public, activated_at)
         values ($1, $2, $3, false, now())
         on conflict (id) do update
           set name = excluded.name, tier = excluded.tier,
               is_public = excluded.is_public, activated_at = excluded.activated_at`,
        [uid, name, tier],
      );
    }

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
    const merkerVon = async (uid: string) => {
      const { rows } = await c.query<{ onboarded_at: Date | null }>(
        "select onboarded_at from public.member_settings where profile_id = $1",
        [uid],
      );
      return rows.length === 0 ? "keine Zeile" : (rows[0].onboarded_at?.toISOString() ?? "null");
    };

    // ── 9.1a Die eigene Zeile entsteht per Upsert ───────────────────────────
    // Der Fall, den ein `update` still verfehlte: die Einstellungszeile entsteht
    // bei der Registrierung NICHT.
    pruefe("9.1a", "vor dem Schreiben: Einstellungszeile des Kontos", "keine Zeile", await merkerVon(EIGEN));

    await alsKonto(EIGEN);
    await c.query(
      `insert into public.member_settings (profile_id, onboarded_at) values ($1, $2)
       on conflict (profile_id) do update set onboarded_at = excluded.onboarded_at`,
      [EIGEN, GESETZT],
    );
    await zurueck();
    pruefe("9.1b", "nach dem Upsert als Eigentuemer", GESETZT, await merkerVon(EIGEN));

    // ── 9.1c/d Der fremde Schreibversuch ────────────────────────────────────
    await alsKonto(FREMD);
    const fremdSchreiben = await c.query(
      "update public.member_settings set onboarded_at = $2 where profile_id = $1",
      [EIGEN, "2030-01-01T00:00:00.000Z"],
    );
    await zurueck();
    pruefe(
      "9.1c",
      "fremdes UPDATE auf die Einstellungszeile (discover!)",
      "0 geaenderte Zeilen, kein Fehler",
      `${fremdSchreiben.rowCount} geaenderte Zeilen, kein Fehler`,
    );
    // Die Nachlese. Ohne sie belegt „0 Zeilen" nichts — auch ein Tippfehler im
    // WHERE saehe genauso aus.
    pruefe("9.1d", "der Fremdwert danach, nachgelesen", GESETZT, await merkerVon(EIGEN));

    // ── 9.2 Der Grund fuer member_settings statt profiles ───────────────────
    // Zuerst die Gegenprobe: dasselbe Konto SIEHT die fremde Profilzeile. Ohne
    // sie liesse die Null unten zwei Lesarten zu — Sichtbarkeit der Tabelle
    // oder Sichtbarkeit des ganzen Kontos.
    await alsKonto(FREMD);
    const profilSicht = await c.query("select id from public.profiles where id = $1", [EIGEN]);
    const merkerSicht = await c.query(
      "select onboarded_at from public.member_settings where profile_id = $1",
      [EIGEN],
    );
    await zurueck();
    pruefe(
      "9.2a",
      "discover liest die fremde PROFILzeile",
      "1 Zeilen",
      `${profilSicht.rowCount} Zeilen`,
    );
    pruefe(
      "9.2b",
      "dasselbe Konto liest die fremden EINSTELLUNGEN",
      "0 Zeilen",
      `${merkerSicht.rowCount} Zeilen`,
    );

    // ── 9.3 Woran lag die Null? ─────────────────────────────────────────────
    // Ein Nullbefund ist der schwaechste Messwert, den es gibt: ein vertippter
    // Rollenwechsel oder eine nicht ankommende `sub` saehen genauso aus wie eine
    // wirksame Policy. Deshalb dasselbe Konto, dieselbe Abfrage — nur auf die
    // EIGENE Zeile. Kommt dort etwas, lag die Null an der Policy.
    await alsKonto(FREMD);
    await c.query(
      `insert into public.member_settings (profile_id, onboarded_at) values ($1, $2)
       on conflict (profile_id) do update set onboarded_at = excluded.onboarded_at`,
      [FREMD, GESETZT],
    );
    const eigeneSicht = await c.query(
      "select onboarded_at from public.member_settings where profile_id = $1",
      [FREMD],
    );
    await zurueck();
    pruefe(
      "9.3",
      "dasselbe Konto, dieselbe Abfrage, nur die EIGENE Zeile",
      "1 Zeilen",
      `${eigeneSicht.rowCount} Zeilen`,
    );

    // ── 9.4 Ausgeloggt fehlt schon das Tabellenrecht ────────────────────────
    // Hier — und nur hier — ist `42501` richtig: `anon` haelt auf
    // member_settings gar kein Recht, das Statement scheitert vor jeder Policy.
    // Savepoint, weil ein Fehler die Transaktion sonst abbricht.
    await c.query("savepoint s_anon");
    let anonBefund = "kein Fehler";
    try {
      await c.query("set local role anon");
      await c.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ role: "anon" }),
      ]);
      const anon = await c.query(
        "update public.member_settings set onboarded_at = now() where profile_id = $1",
        [EIGEN],
      );
      anonBefund = `kein Fehler — ${anon.rowCount} Zeilen`;
    } catch (e) {
      anonBefund = (e as { code?: string }).code ?? String(e);
    } finally {
      await c.query("rollback to savepoint s_anon");
      await zurueck();
    }
    pruefe("9.4", "ausgeloggt (Rolle anon) schreibt den Merker", "42501", anonBefund);

    await c.query("rollback");

    // ── Der Abbau wird nachgewiesen, nicht behauptet ────────────────────────
    const rest = await c.query<{ users: string; profile: string; settings: string }>(
      `select (select count(*) from auth.users where id = any($1::uuid[])) as users,
              (select count(*) from public.profiles where id = any($1::uuid[])) as profile,
              (select count(*) from public.member_settings
                 where profile_id = any($1::uuid[])) as settings`,
      [[EIGEN, FREMD]],
    );
    const r = rest.rows[0];
    const liegengeblieben = Number(r.users) + Number(r.profile) + Number(r.settings);

    console.log("\n┌─ AGE-538, Gruppe 9 ────────────────────────────────────────");
    for (const f of faelle) {
      console.log(`│ ${f.bestanden ? "✅" : "❌"} ${f.nr}  ${f.frage}`);
      console.log(`│      erwartet: ${f.erwartet}`);
      console.log(`│      gemessen: ${f.gemessen}`);
    }
    console.log(`└─ Wegwerf-Zeilen nach dem Rollback: ${liegengeblieben} (erwartet 0)\n`);

    if (faelle.some((f) => !f.bestanden) || liegengeblieben > 0) process.exitCode = 1;
  } finally {
    await c.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
