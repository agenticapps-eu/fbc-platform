/**
 * Objekt-Drift zwischen Datenbank und `supabase/migrations/` (AGE-496 Task 12).
 *
 * Zwei Fragen, und die zweite ist die wichtigere:
 *
 *  1. Steht in der Datenbank etwas, das in keiner Migration steht? → jemand war
 *     am Dashboard.
 *  2. Fehlt in der Datenbank etwas, das dort stehen muss, obwohl es
 *     absichtlich in keiner Migration steht? → die Webhooks, die von Hand in
 *     der Konsole angelegt werden. Verschwindet einer, stirbt sein Versand
 *     **still** — bei `notify-contact-request` die Mail, bei `send-push` der
 *     Push.
 *
 * Wie beim Migrations-Gate gilt: ein leeres Messergebnis ist ein Fehler, keine
 * Feststellung.
 *
 * ── WAS DIESER SCAN NICHT FINDET ────────────────────────────────────────────
 * Ein unabhängiges Review hat die Grenzen am 2026-08-05 benannt. Sie stehen
 * hier, damit ein grüner Lauf nicht als Aussage gelesen wird, die er nicht
 * trägt. Die Erkennung ist eine **Namens-Heuristik**: bekannt ist, wessen Name
 * wörtlich im Text irgendeiner Migration vorkommt.
 *
 *  1. **Angelegt und später verworfen.** `public.is_prime_plus()` entsteht in
 *     `20260612082726` und wird in `20260715150000` verworfen — der Name steht
 *     danach noch 26 mal im Migrationstext. Läge die Funktion trotzdem auf dem
 *     Ziel, hielte der Scan sie für bekannt. Das ist der teuerste blinde Fleck,
 *     weil `is_prime_plus` eine Zugriffsentscheidung war.
 *  2. **Name kommt nur als Fremdreferenz vor.** `auth.users` enthält `users`;
 *     eine von Hand angelegte `public.users` wäre damit „bekannt".
 *  3. **Typübergreifende Namensgleichheit.** Die Menge ist flach: ein Trigger,
 *     der wie eine vorhandene Funktion heißt, fällt nicht auf.
 *  4. **Gelöschtes.** Nur die Ausnahmeliste unten wird auf Fehlen geprüft. Eine
 *     entfernte oder gelockerte RLS-Policy findet dieser Scan **nicht** — dafür
 *     sind `grants_test.sql` und `rls_test.sql` da, die in CI gegen eine frisch
 *     aufgebaute Datenbank laufen.
 *  5. **Geänderte Funktionsrümpfe.** Verglichen wird der Name, nicht `prosrc`.
 * ────────────────────────────────────────────────────────────────────────────
 */

/**
 * Objekte, die bewusst in keiner Migration stehen und trotzdem da sein
 * MUESSEN. Jeder Eintrag wird von Hand per SQL angelegt, weil sein
 * Bearer-Token inline in der Datenbank liegt und dieses Repo oeffentlich ist.
 * (Frueher stand hier "in der Konsole". Das war schon fuer die Webhooks falsch
 * — Database Webhooks sind auf diesen Projekten nie aktiviert worden — und
 * fuer den cron-Eintrag darunter ist es das erst recht.)
 *
 * Die Liste steht in diesem Modul und nicht im Skript daneben, weil
 * `db-drift-scan.ts` schon beim Import eine Datenbankverbindung aufbaut — von
 * dort ist sie nicht pruefbar.
 *
 * Vorlage zum Wiederherstellen: `docs/secrets.md`.
 */
export const ERWARTET_OHNE_MIGRATION = [
  // Kontaktanfrage → `notify-contact-request`: Funktion und Trigger.
  "notify_contact_request_webhook",
  "contact_requests_email_webhook",
  // Hinweis → `send-push` (AGE-641): Funktion und Trigger, wie oben.
  //
  // Ein Konsolen-Webhook waere nur EIN Trigger gewesen. Den gibt es hier
  // nicht: gemessen am 28.08. fehlt auf DEV UND PROD das Schema
  // `supabase_functions` ganz, Database Webhooks wurden auf diesen Projekten
  // also nie aktiviert. `pg_net` ist dagegen installiert — darum ist auch
  // dieser Webhook ein `net.http_post`-Trigger von Hand.
  "notify_push_webhook",
  "notifications_push_webhook",
  // Wiederholungslauf (AGE-641 A5b): dieselbe Sorte Objekt, anderer Ausloeser.
  // Kein Trigger stoesst es an, sondern `cron.schedule` jede Minute mit
  // `{"modus":"faellig"}`. Ohne diesen Lauf ist die Anspruchsfrist wirkungslos:
  // sie sagt, WANN ein Auftrag wieder faellig wird, aber nicht, dass ihn jemand
  // abholt — ein an einem Anbieter-5xx gescheiterter Push bliebe bis zum
  // naechsten zufaelligen Hinweis liegen.
  //
  // Die Zeitplanung dazu steht in `ERWARTETE_ZEITPLAENE` weiter unten. Bis zum
  // 01.09. stand hier, der Scan decke nur diese Haelfte ab und die
  // Zeitplanung falle ihm NICHT auf — das galt, solange er `cron` nicht
  // abfragte. Seit AGE-679 tut er es.
  "push_wiederholung",
];

/**
 * Zeitplanungen, die von Hand gesetzt werden (AGE-679).
 *
 * Warum sie nicht in `ERWARTET_OHNE_MIGRATION` stehen: jene Liste fuehrt Namen
 * aus dem Schema `public` und wirkt in BEIDE Richtungen — ein Name mit
 * Migration waere dort falsch. Beide Funktionen hier LIEGEN in Migrationen;
 * nur ihre Zeitplanung nicht, weil ein `cron.schedule` in einer Migration den
 * CI-Lauf gegen eine frische Datenbank braeche.
 *
 * `ruft` ist ein Teilstring des erwarteten Befehls, kein Volltext-Vergleich:
 * er faengt den ausgehoehlten Eintrag (richtiger Name, `select 1`) und
 * vertraegt Leerraum. Dass der Befehl ueberhaupt verglichen werden darf, ist
 * gemessen — beide tragen weder Bearer noch URL (33 und 35 Zeichen).
 *
 * Vorlage zum Wiederherstellen: `docs/secrets.md:478` und `:587`.
 */
export const ERWARTETE_ZEITPLAENE = [
  {
    jobname: "push-wiederholung",
    schedule: "* * * * *",
    command: "select public.push_wiederholung()",
  },
  {
    jobname: "beitrag-ankuendigen",
    schedule: "* * * * *",
    command: "select public.beitrag_ankuendigen()",
  },
] as const;

/**
 * Kleinschreibung, Leerraum weg, abschliessendes Semikolon weg.
 *
 * Verglichen wird der GANZE Befehl, nicht ein Teilstring darin. Die
 * Diff-Review hat gezeigt, warum: ein Teilstring-Vergleich laesst
 * `select 1` mit dem erwarteten Aufruf im Kommentar durch — also genau den
 * ausgehoehlten Eintrag, gegen den die Pruefung gebaut ist. Die Normalisierung
 * ist der Preis dafuer, dass der exakte Vergleich nicht an Formatierung
 * scheitert; sonst wird er beim ersten Wiederherstellen von Hand rot und man
 * gewoehnt sich das Wegklicken an.
 */
function normalisiereBefehl(befehl: string): string {
  return befehl
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/;$/, "");
}

export type ErwarteterZeitplan = (typeof ERWARTETE_ZEITPLAENE)[number];

export type Zeitplan = {
  jobname: string;
  schedule: string;
  active: boolean;
  command: string;
};

export type Zeitplanbestand = {
  zeitplaene: Zeitplan[];
  /** Trigger in `public` mit `tgenabled <> 'O'` — sie stehen da und sind tot. */
  abgeschalteteTrigger: string[];
};

/**
 * Findet, was dasteht und trotzdem nicht laeuft.
 *
 * `findeObjektDrift` prueft Namen. Das reicht nicht: ein cron-Eintrag mit
 * richtigem Namen und `select 1` als Befehl ist vorhanden und wirkungslos, ein
 * abgeschalteter Trigger ebenso. Beide Loecher hat die Plan-Review am 01.09.
 * benannt.
 */
export function findeZeitplanDrift(
  bestand: Zeitplanbestand,
  erwartet: readonly ErwarteterZeitplan[],
): ObjektDrift[] {
  // Ein Vergleich ohne Sollwert ist immer gruen und belegt nichts — dieselbe
  // Regel wie beim leeren Bestand in `findeObjektDrift`.
  if (erwartet.length === 0) {
    throw new Error(
      "Keine erwarteten Zeitplanungen uebergeben. Ohne Sollwert prueft der Vergleich nichts.",
    );
  }

  const drift: ObjektDrift[] = [];

  for (const soll of erwartet) {
    const ist = bestand.zeitplaene.find((z) => z.jobname === soll.jobname);
    if (!ist) {
      drift.push({ art: "fehlt", typ: "zeitplan", name: soll.jobname });
      continue;
    }
    if (!ist.active) {
      drift.push({
        art: "abgeschaltet",
        typ: "zeitplan",
        name: soll.jobname,
        grund: "active = false",
      });
      continue;
    }
    if (ist.schedule !== soll.schedule) {
      drift.push({
        art: "abweichend",
        typ: "zeitplan",
        name: soll.jobname,
        grund: `Zeitplan "${ist.schedule}", erwartet "${soll.schedule}"`,
      });
      continue;
    }
    if (normalisiereBefehl(ist.command) !== normalisiereBefehl(soll.command)) {
      drift.push({
        art: "abweichend",
        typ: "zeitplan",
        name: soll.jobname,
        grund: `Befehl weicht ab, erwartet "${soll.command}"`,
      });
    }
  }

  // Die andere Richtung, und die hat in der ersten Fassung gefehlt: geprueft
  // wurde nur ueber die ERWARTETEN Namen. Ein im Dashboard angelegter Job, der
  // jede Minute irgendetwas tut, erzeugte keinen Befund — dabei ist „war
  // jemand am Dashboard?" die erste der zwei Fragen dieses Scans.
  const erwarteteNamen = new Set<string>(erwartet.map((z) => z.jobname));
  for (const ist of bestand.zeitplaene) {
    if (!erwarteteNamen.has(ist.jobname)) {
      drift.push({ art: "unbekannt", typ: "zeitplan", name: ist.jobname });
    }
  }

  for (const name of bestand.abgeschalteteTrigger) {
    drift.push({ art: "abgeschaltet", typ: "trigger", name });
  }

  return drift;
}

export type Bestand = {
  funktionen: string[];
  trigger: string[];
  tabellen: string[];
  views: string[];
  policies: string[];
};
export type ObjektDrift = {
  /**
   * `abgeschaltet` und `abweichend` kommen aus `findeZeitplanDrift`: ein Objekt
   * kann dastehen und trotzdem nicht laufen. Die Namenspruefung sieht das nie.
   */
  art: "unbekannt" | "fehlt" | "abgeschaltet" | "abweichend";
  typ: "funktion" | "trigger" | "tabelle" | "view" | "policy" | "erwartet" | "zeitplan";
  name: string;
  /** Was genau abweicht. Nur bei `abweichend` und `abgeschaltet` gesetzt. */
  grund?: string;
};

export function findeObjektDrift(
  bestand: Bestand,
  inMigrationen: string[],
  ausnahmen: string[],
): ObjektDrift[] {
  const gesamt =
    bestand.funktionen.length +
    bestand.trigger.length +
    bestand.tabellen.length +
    bestand.views.length +
    bestand.policies.length;
  if (gesamt === 0) {
    throw new Error(
      "Der Bestand ist leer. Eine Datenbank mit angewendeten Migrationen hat " +
        "Funktionen und Tabellen — die Abfrage hat nichts gemessen.",
    );
  }

  const bekannt = new Set([...inMigrationen, ...ausnahmen]);
  const drift: ObjektDrift[] = [];

  const gruppen = [
    ["funktion", bestand.funktionen],
    ["trigger", bestand.trigger],
    ["tabelle", bestand.tabellen],
    ["view", bestand.views],
    ["policy", bestand.policies],
  ] as const;

  for (const [typ, namen] of gruppen) {
    for (const name of namen) {
      if (!bekannt.has(name)) drift.push({ art: "unbekannt", typ, name });
    }
  }

  const vorhanden = new Set([
    ...bestand.funktionen,
    ...bestand.trigger,
    ...bestand.tabellen,
    ...bestand.views,
    ...bestand.policies,
  ]);
  for (const name of ausnahmen) {
    if (!vorhanden.has(name)) drift.push({ art: "fehlt", typ: "erwartet", name });
  }

  return drift;
}
