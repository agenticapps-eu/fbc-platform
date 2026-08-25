#!/usr/bin/env tsx
/**
 * Sondendaten für die Sichtprobe zu AGE-592 — NUR gegen den LOKALEN Stack.
 *
 * Legt eine offene eingehende Kontaktanfrage an das angegebene Konto an, wartet
 * auf Enter und räumt sie im `finally` wieder ab.
 *
 * WARUM EIN SKRIPT UND KEINE HANDARBEIT. Der Plan-Review (gemini, MEDIUM) hat
 * die ursprüngliche Aufgabe „Sondendaten anlegen, danach löschen" beanstandet:
 * Ein vergessener Aufräumschritt verseucht die lokale Umgebung, und niemand
 * merkt es, bis ein Test über fremde Zeilen stolpert — `member_lifecycle_test`
 * zählt Beiträge global und fällt bei genau so etwas.
 *
 * Der Host-Wächter unten ist NICHT Zierrat: Ein Skript, das Zeilen anlegt und
 * löscht, darf sich nicht in der Datenbank irren. Geprüft wird der Port des
 * lokalen Stacks, nicht bloß ein Name — „localhost" lässt sich auf alles
 * zeigen, ein Tunnel ebenso.
 *
 *   npx tsx scripts/probe-age592-anfragenweg.ts ich@sicht.local [anzahl]
 */
import pg from "pg";

const LOKAL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

const empfaengerLogin = process.argv[2];
const anzahl = Number(process.argv[3] ?? 1);
if (!empfaengerLogin) {
  console.error("Aufruf: probe-age592-anfragenweg.ts <empfaenger-login> [anzahl]");
  process.exit(1);
}

const ziel = new URL(LOKAL);
if (ziel.hostname !== "127.0.0.1" || ziel.port !== "54322") {
  throw new Error(`Nur gegen den lokalen Stack — angegeben war ${ziel.host}`);
}

const db = new pg.Client({ connectionString: LOKAL });
await db.connect();

/**
 * Strg-C führt den `finally`-Block NICHT aus.
 *
 * Der Kommentar dort behauptete das ursprünglich — er war falsch, und der
 * Diff-Review hat es gemeldet. Node beendet den Prozess bei `SIGINT` sofort;
 * ohne eigenen Handler bleiben die Sondenzeilen liegen, und zwar genau in dem
 * Fall, in dem man am ehesten abbricht.
 *
 * `process.exit()` im Handler wäre wieder derselbe Fehler, nur eine Ebene
 * höher: Es beendet, ohne auf das laufende Aufräumen zu warten. Deshalb wird
 * der Abbruch nur GEMERKT; die Warteschleife unten löst sich daraufhin auf und
 * läuft regulär in den `finally`-Block.
 */
let abgebrochen = false;
const merkeAbbruch = () => {
  abgebrochen = true;
};
process.once("SIGINT", merkeAbbruch);
process.once("SIGTERM", merkeAbbruch);

/** Die angelegten Zeilen, damit das Aufräumen nichts Fremdes trifft. */
const angelegt: string[] = [];
/** Alle beteiligten Profile — Empfänger und Absender. */
const beteiligte: string[] = [];
/** Der Zeitpunkt VOR der ersten Einfügung, aus der Datenbankuhr. */
const beginn: string = (await db.query<{ jetzt: string }>("select now()::text as jetzt")).rows[0]
  .jetzt;

try {
  const empf = await db.query<{ id: string }>("select id from auth.users where email = $1", [
    empfaengerLogin,
  ]);
  if (empf.rowCount === 0) throw new Error(`Kein Konto ${empfaengerLogin} im lokalen Stack.`);
  const to = empf.rows[0].id;
  beteiligte.push(to);

  // Absender: irgendwelche anderen Profile. Wer genau, ist für die Sichtprobe
  // gleichgültig — es geht um den WEG zur Anfrage, nicht um ihren Inhalt.
  const sender = await db.query<{ id: string; name: string }>(
    "select id, name from public.profiles where id <> $1 order by created_at limit $2",
    [to, anzahl],
  );
  if (sender.rowCount === 0) throw new Error("Keine anderen Profile im lokalen Stack.");

  beteiligte.push(...sender.rows.map((s) => s.id));

  for (const s of sender.rows) {
    const eingefuegt = await db.query<{ id: string }>(
      `insert into public.contact_requests (from_id, to_id, match_id, message, status)
       values ($1, $2, null, $3, 'pending') returning id`,
      [s.id, to, `Sonde AGE-592 — von ${s.name}`],
    );
    angelegt.push(eingefuegt.rows[0].id);
  }
  console.log(`${angelegt.length} offene Anfrage(n) an ${empfaengerLogin} angelegt.`);
  console.log("Sichtprobe machen. Danach Enter drücken — dann wird aufgeräumt.");
  await new Promise<void>((auf) => {
    const fertig = () => {
      process.stdin.off("data", fertig);
      clearInterval(takt);
      auf();
    };
    process.stdin.once("data", fertig);
    // Der Abbruch kommt nicht über stdin, sondern über das Signal oben.
    const takt = setInterval(() => {
      if (abgebrochen) fertig();
    }, 200);
  });
} finally {
  // IM finally, nicht danach: Ein Fehler mittendrin darf die Zeilen nicht
  // stehen lassen. Für Strg-C reicht das ALLEIN NICHT — dafür sorgt der
  // Signal-Handler weiter oben, der den Abbruch merkt und die Warteschleife
  // regulär auflöst.
  if (angelegt.length > 0) {
    const weg = await db.query("delete from public.contact_requests where id = any($1::uuid[])", [
      angelegt,
    ]);

    // Der Lebenszyklus-Trigger (Migration 20260614100000) legt NEBEN der Anfrage
    // an: eine Benachrichtigung sofort, und bei einer ANNAHME zusätzlich einen
    // Nachrichten-Thread plus eine zweite Benachrichtigung. Nichts davon hängt
    // per Fremdschlüssel an `contact_requests` — das Löschen der Anfrage lässt
    // beides stehen.
    //
    // GEMESSEN, nicht angenommen: Nach der Sichtprobe zu AGE-592 blieben genau
    // 2 Threads und 4 Benachrichtigungen zurück, während die Anfragen weg
    // waren. Ein Skript, das „aufgeräumt" meldet und Reste hinterlässt, ist
    // schlimmer als Handarbeit — es beendet das Nachsehen.
    //
    // ENG gefasst — der erste Entwurf löschte jede Benachrichtigung der
    // Beteiligten seit `beginn` und jeden Thread zwischen ihnen. Das trifft
    // auch, was parallel echt entsteht, und der Kommentar behauptete das
    // Gegenteil (Befund des Diff-Reviews). Drei Einschränkungen statt zwei:
    // Zeitraum, die beiden Typen, die dieser Trigger überhaupt erzeugt, und —
    // beim Thread — dass der EMPFÄNGER eine der beiden Seiten ist. Sonst fiele
    // auch ein Thread zwischen zwei Absendern, mit dem die Sonde nichts zu tun
    // hat.
    const empfaenger = beteiligte[0];
    const nachrichten = await db.query(
      `delete from public.notifications
        where created_at >= $1
          and profile_id = any($2::uuid[])
          and type in ('contact_request', 'contact_request_accepted')`,
      [beginn, beteiligte],
    );
    const threads = await db.query(
      `delete from public.message_threads
        where created_at >= $1
          and a_profile_id = any($2::uuid[])
          and b_profile_id = any($2::uuid[])
          and $3::uuid in (a_profile_id, b_profile_id)`,
      [beginn, beteiligte, empfaenger],
    );
    console.log(
      `Aufgeräumt: ${weg.rowCount} Anfrage(n), ${threads.rowCount} Thread(s), ` +
        `${nachrichten.rowCount} Benachrichtigung(en).`,
    );
  }
  await db.end();
}
