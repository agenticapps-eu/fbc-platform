/**
 * Der Wächter über den Push-Zustellweg (AGE-679).
 *
 * Am 28.–31.08.2026 lagen drei Zeilen mit dem richtigen Fehlergrund drei Tage
 * lang in `push_zustellungen`, und niemand hat hingesehen. Dieser Wächter sieht
 * hin. Er läuft **außerhalb** der Datenbank, die er prüft: einer in der
 * Datenbank meldete über denselben Fire-and-Forget-Weg, dessen Blindheit das
 * Problem ist, und ein `supabase db reset` auf DEV nähme ihn mit.
 *
 * ── VIER FRAGEN, VIER QUELLEN ───────────────────────────────────────────────
 * Die Zuordnung ist nicht Beiwerk. Der erste Entwurf stellte drei Fragen an
 * dieselbe Tabelle, und für eine davon ist sie blind:
 *
 *  1. **Antwort** — `net._http_response`. Antwortet der HTTP-Weg noch mit 200?
 *  2. **Stillstand** — `cron.job_run_details` ⋈ `cron.job`. Läuft der
 *     Wiederholungslauf noch?
 *  3. **Aufgabe** — `push_zustellungen`. Wurde im Fenster eine Zustellung
 *     endgültig aufgegeben?
 *  4. **Messausfall** — der Wächter selbst. Konnte er überhaupt messen?
 *
 * **Warum Frage 2 nicht aus `net._http_response` kommt:** die Tabelle trägt
 * keine Ziel-URL und sammelt die Antworten *aller* `pg_net`-Aufrufer. Eine
 * einzige Kontaktanfrage im Fenster machte „keine Zeile" falsch — der Wächter
 * wäre grün und der Minutentakt tot. Genau der Fall, für den es ihn gibt.
 * `cron.job_run_details` trägt `jobid`, und `cron.job` bindet den an einen
 * Namen; die Aussage ist damit zurechenbar.
 *
 * **Warum Frage 1 trotzdem dort bleibt:** dieselbe URL-Losigkeit heißt, dass
 * eine gescheiterte Kontaktanfrage-Mail diesen Wächter rötet. Das ist kein
 * Fehlalarm — ein Fire-and-Forget-Aufruf ist tatsächlich gescheitert, und
 * dieser Weg war bis heute genauso blind. Der Befund darf deshalb nicht
 * „Push ist kaputt" sagen, sondern nur, was er weiß.
 *
 * ── WAS DIESER WÄCHTER NICHT LEISTET ────────────────────────────────────────
 *  1. **Er ist flankengesteuert.** Das Aufgabe-Signal sieht Zeilen, die im
 *     Fenster ENTSTANDEN sind. Bleibt der Anbieter kaputt und entsteht zwei
 *     Stunden lang kein neuer Hinweis, wird er grün, obwohl nichts repariert
 *     ist. Der nächste Zustellversuch rötet ihn wieder.
 *  2. **Sein Fenster ist eine Toleranz, keine Garantie.** Für geplante
 *     Actions-Läufe ist kein Takt zugesagt; fällt einer ganz aus, bleibt eine
 *     ungeprüfte Zeitspanne.
 *  3. **Er nennt den Aufrufer nicht**, siehe oben.
 *  4. **Wer ihn überwacht, ist offen.** Geplante Läufe werden nach 60 Tagen
 *     ohne Repo-Aktivität abgeschaltet.
 * ────────────────────────────────────────────────────────────────────────────
 */

/**
 * Spalten, die nie in einem Befund landen dürfen.
 *
 * Die Actions-Protokolle dieses Repositories sind **öffentlich**. `content`
 * trägt, was `send-push` in die Antwort schreibt; `headers` kann
 * Anbieter-Kennungen tragen; `letzter_fehler` ist kein Enum, sondern
 * `e.message` (`send-push/index.ts:205`) — und die APNs-Adresse trägt den
 * Gerätetoken im Pfad (`/3/device/<token>`). Ein Netzfehler beim Zustellen
 * könnte den Token damit bis ins Protokoll tragen.
 *
 * Die Liste steht hier und nicht im Läufer, weil sie dort nicht prüfbar wäre:
 * `push-waechter.ts` baut schon beim Import eine Verbindung auf.
 */
export const VERBOTENE_SPALTEN = [
  "content",
  "headers",
  "letzter_fehler",
  "token_id",
  "notification_id",
] as const;

/**
 * Die Abfragen. Sie stehen aus demselben Grund hier wie die Liste darüber: nur
 * so kann eine Zusage prüfen, dass keine von ihnen eine verbotene Spalte
 * liest. Eine Zusage, die bloß die erzeugten Texte prüft, wäre leer — die
 * Logik bekommt nie etwas Verbotenes zu sehen.
 *
 * `$1` ist überall das Fenster in Minuten.
 */
export const ABFRAGEN = {
  antworten: `select status_code, timed_out, (error_msg is not null) as fehler, count(*)::int as anzahl
                from net._http_response
               where created > now() - ($1 * interval '1 minute')
               group by 1, 2, 3`,

  laeufe: `select extract(epoch from now() - max(d.start_time))::int as juengster_alter_sekunden,
                  count(*) filter (where d.start_time > now() - ($1 * interval '1 minute'))::int as im_fenster
             from cron.job j
             join cron.job_run_details d on d.jobid = j.jobid
            where j.jobname = 'push-wiederholung' and d.status = 'succeeded'`,

  zeitplan: `select schedule, active from cron.job where jobname = 'push-wiederholung'`,

  aufgegeben: `select count(*)::int as anzahl
                 from public.push_zustellungen
                where zustand = 'aufgegeben'
                  and created_at > now() - ($1 * interval '1 minute')`,

  ttl: `select extract(epoch from current_setting('pg_net.ttl')::interval)::int as ttl_sekunden`,
} as const;

export type Antwortgruppe = {
  statusCode: number | null;
  timedOut: boolean;
  fehler: boolean;
  anzahl: number;
};

export type Messung =
  | {
      art: "gemessen";
      seite: "dev" | "prod";
      antworten: Antwortgruppe[];
      /** Alter des jüngsten erfolgreichen Laufs. `null` = es gibt keinen. */
      juengsterLaufAlterSekunden: number | null;
      laeufeImFenster: number;
      /** Aus dem Zeitplan gerechnet. Bei `* * * * *` ist das die Fensterlänge in Minuten. */
      laeufeErwartet: number;
      aufgegeben: number;
      ttlSekunden: number;
    }
  | { art: "messausfall"; seite: "dev" | "prod"; grund: string };

export type Schwellen = {
  fensterMinuten: number;
  /** Wie alt der jüngste Lauf höchstens sein darf. */
  hoechstpauseMinuten: number;
};

export type Befund = {
  art: "antwort" | "stillstand" | "aufgabe" | "messausfall" | "voraussetzung";
  text: string;
};

export function bewerteMessung(messung: Messung, schwellen: Schwellen): Befund[] {
  // Ein leeres Messergebnis ist ein Fehler, keine Feststellung — dieselbe
  // Regel wie in `db-drift-scan.logic.ts`. Und er wird NIE als Stillstand
  // gemeldet: wer nicht misst, sieht auch keinen Takt, darf daraus aber nicht
  // schliessen, dass keiner läuft. Verschiedene Ursachen, verschiedene erste
  // Handgriffe.
  if (messung.art === "messausfall") {
    return [{ art: "messausfall", text: `Der Waechter konnte nicht messen: ${messung.grund}` }];
  }

  if (messung.laeufeErwartet <= 0) {
    return [
      {
        art: "messausfall",
        text:
          "Erwartungswert 0 Laeufe — der Zeitplan wurde nicht gelesen. " +
          "Ohne ihn hat der Vergleich keine Grundlage.",
      },
    ];
  }

  const befunde: Befund[] = [];

  const schlecht = messung.antworten.filter(
    (a) => a.statusCode !== 200 || a.timedOut || a.fehler,
  );
  if (schlecht.length > 0) {
    const anzahl = schlecht.reduce((s, a) => s + a.anzahl, 0);
    const gestalt = schlecht
      .map((a) => (a.timedOut ? "Zeitueberschreitung" : a.fehler ? "Uebertragungsfehler" : `${a.statusCode}`))
      .join(", ");
    befunde.push({
      art: "antwort",
      text:
        `${anzahl} net.http_post-Aufruf(e) im Fenster ohne 200: ${gestalt}. ` +
        "Welcher Aufrufer, sagt die Tabelle nicht — sie traegt keine Ziel-URL.",
    });
  }

  // Zwei Bedingungen, ein Befund. Das Alter faengt den harten Ausfall, die
  // Mindestmenge den Takt, der nur noch stottert.
  const zuAlt =
    messung.juengsterLaufAlterSekunden === null ||
    messung.juengsterLaufAlterSekunden > schwellen.hoechstpauseMinuten * 60;
  const zuWenig = messung.laeufeImFenster < messung.laeufeErwartet / 2;
  if (zuAlt || zuWenig) {
    const alter =
      messung.juengsterLaufAlterSekunden === null
        ? "gar keiner"
        : `${Math.round(messung.juengsterLaufAlterSekunden / 60)} min alt`;
    befunde.push({
      art: "stillstand",
      text:
        `Der Wiederholungslauf steht: juengster erfolgreicher Lauf ${alter}, ` +
        `${messung.laeufeImFenster} von ${messung.laeufeErwartet} erwarteten im Fenster.`,
    });
  }

  if (messung.aufgegeben > 0) {
    befunde.push({
      art: "aufgabe",
      text:
        `${messung.aufgegeben} Zustellung(en) im Fenster endgueltig aufgegeben. ` +
        "Der Grund steht in push_zustellungen und gehoert nicht in ein oeffentliches Protokoll.",
    });
  }

  // Das ganze Fenster haengt an dieser Frist. Sie wird gemessen, nicht
  // angenommen: eine ferne `ALTER SYSTEM`-Aenderung verschoebe sie still, und
  // der Waechter maesse danach ein Fenster, das pg_net laengst geleert hat.
  if (messung.ttlSekunden <= schwellen.fensterMinuten * 60) {
    befunde.push({
      art: "voraussetzung",
      text:
        `pg_net.ttl ist ${Math.round(messung.ttlSekunden / 60)} min und damit nicht laenger ` +
        `als das Fenster von ${schwellen.fensterMinuten} min. Der Waechter maesse ` +
        "eine Zeitspanne, aus der bereits geloescht wurde.",
    });
  }

  return befunde;
}
