import { describe, expect, it } from "vitest";

import {
  ERWARTET_OHNE_MIGRATION,
  ERWARTETE_ZEITPLAENE,
  findeObjektDrift,
  findeZeitplanDrift,
  type Bestand,
  type Zeitplanbestand,
} from "./db-drift-scan.logic";

/**
 * Objekt-Drift: was steht in der Datenbank, das in keiner Migration steht —
 * und was fehlt, obwohl es dort stehen müsste (AGE-496 Task 12).
 *
 * Der Scan hat zwei Aufgaben, und die zweite ist die wichtigere:
 *
 *  1. **Unbekanntes melden.** Ein Objekt, das weder in einer Migration noch in
 *     der Ausnahmeliste steht, heißt: jemand war am Dashboard.
 *  2. **Fehlendes melden.** Die Webhooks in `ERWARTET_OHNE_MIGRATION` stehen
 *     bewusst in keiner Migration — ihr Bearer-Token liegt inline und das
 *     Repo ist öffentlich. Verschwindet einer, stirbt sein Versand **still**:
 *     kein Fehler, keine Meldung, nur nichts mehr. Genau dagegen ist dieser
 *     Scan gebaut.
 */

const leer: Bestand = { funktionen: [], trigger: [], tabellen: [], views: [], policies: [] };

describe("findeObjektDrift", () => {
  it("meldet nichts, wenn jedes Objekt in einer Migration steht", () => {
    const bestand: Bestand = { ...leer, funktionen: ["is_admin"], tabellen: ["profiles"] };

    expect(findeObjektDrift(bestand, ["is_admin", "profiles"], [])).toEqual([]);
  });

  it("meldet ein Objekt, das in keiner Migration steht", () => {
    const bestand: Bestand = { ...leer, funktionen: ["heimlich_im_dashboard"] };

    const drift = findeObjektDrift(bestand, ["is_admin"], []);

    expect(drift).toEqual([{ art: "unbekannt", typ: "funktion", name: "heimlich_im_dashboard" }]);
  });

  it("meldet ein Objekt aus der Ausnahmeliste NICHT als unbekannt", () => {
    const bestand: Bestand = {
      ...leer,
      funktionen: ["notify_contact_request_webhook"],
      trigger: ["contact_requests_email_webhook"],
    };

    const drift = findeObjektDrift(
      bestand,
      [],
      ["notify_contact_request_webhook", "contact_requests_email_webhook"],
    );

    expect(drift).toEqual([]);
  });

  it("meldet ein Objekt aus der Ausnahmeliste, das in der Datenbank FEHLT", () => {
    // Der Havariefall: der Trigger ist weg, der Mailversand still tot.
    const bestand: Bestand = { ...leer, funktionen: ["notify_contact_request_webhook"] };

    const drift = findeObjektDrift(
      bestand,
      [],
      ["notify_contact_request_webhook", "contact_requests_email_webhook"],
    );

    expect(drift).toEqual([
      { art: "fehlt", typ: "erwartet", name: "contact_requests_email_webhook" },
    ]);
  });

  it("unterscheidet Objekttypen in der Meldung", () => {
    const bestand: Bestand = { ...leer, funktionen: ["f"], trigger: ["t"], tabellen: ["x"] };

    const drift = findeObjektDrift(bestand, [], []);

    expect(drift.map((d) => d.typ)).toEqual(["funktion", "trigger", "tabelle"]);
  });

  it("meldet eine View, die in keiner Migration steht", () => {
    // Eine im Dashboard angelegte View auf `profiles` umgeht die
    // Zeilensichtbarkeit der Tabelle. Die erste Fassung des Scans fragte
    // ausschliesslich `relkind = 'r'` ab und sah Views gar nicht.
    const drift = findeObjektDrift(
      { ...leer, tabellen: ["profiles"], views: ["profile_leak"] },
      ["profiles"],
      [],
    );

    expect(drift).toEqual([{ art: "unbekannt", typ: "view", name: "profile_leak" }]);
  });

  it("meldet eine Policy, die in keiner Migration steht", () => {
    // RLS ist laut CLAUDE.md die Sicherheitsgrenze des Projekts. Eine im
    // Dashboard hinzugefuegte Policy war fuer den Scan bisher unsichtbar.
    const drift = findeObjektDrift(
      { ...leer, tabellen: ["profiles"], policies: ["profiles_read_all_oops"] },
      ["profiles"],
      [],
    );

    expect(drift).toEqual([{ art: "unbekannt", typ: "policy", name: "profiles_read_all_oops" }]);
  });

  it("wirft, wenn der Bestand leer ist — dann hat die Abfrage nichts gemessen", () => {
    // Eine Datenbank mit 40 angewendeten Migrationen hat Funktionen und
    // Tabellen. Null Objekte heißt: die Abfrage lief ins Leere, nicht dass
    // alles sauber ist. Dieselbe Lehre wie beim Migrations-Gate.
    expect(() => findeObjektDrift(leer, ["is_admin"], [])).toThrow();
  });
});

/**
 * Die Ausnahmeliste selbst — nicht die Funktion, die sie verarbeitet.
 *
 * Diese Zusagen prüfen die **ausgelieferte** Liste, nicht eine hier
 * abgeschriebene Kopie. Eine Kopie belegt nichts: sie ginge weiter durch, wenn
 * ein Name aus `db-drift-scan.logic.ts` verschwände. Darum ist der Bestand aus
 * `ERWARTET_OHNE_MIGRATION` gebaut und nicht daneben getippt.
 *
 * Warum es sie gibt: die Webhooks werden von Hand angelegt und stehen darum in
 * keiner Migration. Fehlt ein Name in der Liste, meldet der Scan ihn als
 * „unbekannt"; fehlt umgekehrt das Objekt in PROD, meldet er es als „fehlend".
 * Beides bricht `migrate-prod` ab.
 *
 * **Korrigiert am 28.08. (Code-Review):** hier stand, danach bliebe auch
 * `deploy.yml` am Migrations-Gate hängen und der Frontend-Deploy falle stumm
 * aus. Das verwechselt zwei Gates. `db-drift-scan.ts` läuft an genau einer
 * Stelle — `migrate-prod.yml:152`, `workflow_dispatch`, also nur von Hand.
 * Das Gate in `deploy.yml` ist `migration-drift-gate.ts` und vergleicht die
 * Migrations*historie*; nur dieses blockiert Deploys. Ein roter Objekt-Scan
 * kostet den nächsten Handlauf von `migrate-prod`, keinen Deploy.
 */
describe("ERWARTET_OHNE_MIGRATION", () => {
  /**
   * `send-push` steht mit **zwei** Namen in der Liste, Funktion und Trigger —
   * genau wie das Mail-Paar. Ein Konsolen-Webhook wäre nur ein Trigger, aber
   * die gibt es auf diesen Projekten nicht: gemessen am 28.08. fehlt auf DEV
   * **und** PROD das Schema `supabase_functions` ganz, `pg_net` ist dagegen
   * installiert. Der Webhook ist deshalb ein `net.http_post`-Trigger von Hand.
   */
  const PUSH_WEBHOOK = ["notify_push_webhook", "notifications_push_webhook"];

  /**
   * Der Wiederholungslauf (A5b) ist der dritte Name der **Push-Gruppe** (der
   * fünfte der Liste insgesamt) und kein Webhook: ihn stößt kein Trigger an,
   * sondern `cron.schedule`. In der Liste
   * steht er aus demselben Grund wie die zwei darüber — sein Bearer liegt
   * inline im Funktionsrumpf, und dieses Repo ist öffentlich.
   *
   * **Seit AGE-679 deckt der Scan beide Hälften ab.** Bis dahin stand hier,
   * `cron.job` liege im Schema `cron` und der Scan frage nur `public` ab —
   * eine abbestellte Zeitplanung falle ihm also nicht auf. Das galt. Die
   * Zeitplanung prüft jetzt `findeZeitplanDrift` weiter unten, gegen
   * `ERWARTETE_ZEITPLAENE`.
   */
  const PUSH_VON_HAND = [...PUSH_WEBHOOK, "push_wiederholung"];

  it("meldet keinen Drift, wenn jeder erwartete Webhook im Bestand liegt", () => {
    // Welcher Eimer, ist hier gleichgültig: geprüft wird gegen die **flache**
    // Vereinigung (Grenze 3 im Kopf des Logikmoduls). Sie nach Funktion und
    // Trigger aufzuteilen hiesse, die Liste abzuschreiben — genau das soll
    // diese Zusage nicht.
    const bestand: Bestand = { ...leer, trigger: [...ERWARTET_OHNE_MIGRATION] };

    expect(findeObjektDrift(bestand, [], ERWARTET_OHNE_MIGRATION)).toEqual([]);
  });

  it.each(PUSH_VON_HAND)(
    "meldet `%s` als fehlend, wenn er aus der Datenbank verschwindet",
    (name) => {
      const ohne = ERWARTET_OHNE_MIGRATION.filter((n) => n !== name);
      // Positivkontrolle: ohne sie wäre die Zusage auch dann grün, wenn der
      // Name gar nicht in der Liste stünde — dann filterte `filter` nichts weg
      // und der Bestand wäre vollständig.
      expect(ohne).toHaveLength(ERWARTET_OHNE_MIGRATION.length - 1);

      const drift = findeObjektDrift({ ...leer, trigger: ohne }, [], ERWARTET_OHNE_MIGRATION);

      expect(drift).toEqual([{ art: "fehlt", typ: "erwartet", name }]);
    },
  );
});

/**
 * Die Zeitplanung und der Aktivzustand (AGE-679).
 *
 * Zwei Löcher, die die Plan-Review am 01.09. benannt hat und die der Scan bis
 * dahin beide hatte:
 *
 *  1. **Das Schema `cron` wurde gar nicht abgefragt.** Eine abbestellte
 *     Zeitplanung fiel nicht auf — und ohne sie ist die Anspruchsfrist der
 *     Push-Zustellung wirkungslos: sie sagt, WANN ein Auftrag wieder fällig
 *     wird, aber niemand holt ihn ab.
 *  2. **Ein Objekt kann dastehen und trotzdem tot sein.** Ein per
 *     `alter table … disable trigger` abgeschalteter Trigger steht weiter in
 *     `pg_trigger`; für die Namensprüfung ist er vorhanden. Ein cron-Eintrag
 *     mit richtigem Namen und ausgehöhltem Befehl ebenso. Der Scan prüfte die
 *     Beschriftung, nicht die Sache.
 *
 * Warum der Befehl verglichen werden DARF, die Funktionsrümpfe der Webhooks
 * aber nicht: gemessen am 01.09. tragen beide cron-Befehle weder Bearer noch
 * URL (33 und 35 Zeichen, `select public.<funktion>()`). Die Webhook-Funktionen
 * tragen ihren Bearer inline — dort bleibt es beim Namen.
 */
describe("findeZeitplanDrift", () => {
  const gesund: Zeitplanbestand = {
    zeitplaene: [
      {
        jobname: "push-wiederholung",
        schedule: "* * * * *",
        active: true,
        command: "select public.push_wiederholung()",
      },
      {
        jobname: "beitrag-ankuendigen",
        schedule: "* * * * *",
        active: true,
        command: "select public.beitrag_ankuendigen()",
      },
    ],
    abgeschalteteTrigger: [],
  };

  it("meldet nichts, wenn beide Zeitplanungen stehen und laufen", () => {
    // Der Ist-Stand vom 01.09., auf DEV und PROD gleich.
    expect(findeZeitplanDrift(gesund, ERWARTETE_ZEITPLAENE)).toEqual([]);
  });

  it("meldet eine fehlende Zeitplanung", () => {
    // Der `db reset`-Fall: die Funktion steht in einer Migration und kommt
    // wieder, die Zeitplanung nicht.
    const bestand: Zeitplanbestand = {
      ...gesund,
      zeitplaene: gesund.zeitplaene.filter((z) => z.jobname !== "push-wiederholung"),
    };

    expect(findeZeitplanDrift(bestand, ERWARTETE_ZEITPLAENE)).toEqual([
      { art: "fehlt", typ: "zeitplan", name: "push-wiederholung" },
    ]);
  });

  it("meldet eine abbestellte Zeitplanung, die noch dasteht", () => {
    const bestand: Zeitplanbestand = {
      ...gesund,
      zeitplaene: gesund.zeitplaene.map((z) =>
        z.jobname === "push-wiederholung" ? { ...z, active: false } : z,
      ),
    };

    const drift = findeZeitplanDrift(bestand, ERWARTETE_ZEITPLAENE);

    expect(drift).toHaveLength(1);
    expect(drift[0]).toMatchObject({
      art: "abgeschaltet",
      typ: "zeitplan",
      name: "push-wiederholung",
    });
  });

  it("meldet einen veränderten Zeitplan", () => {
    const bestand: Zeitplanbestand = {
      ...gesund,
      zeitplaene: gesund.zeitplaene.map((z) =>
        z.jobname === "push-wiederholung" ? { ...z, schedule: "*/30 * * * *" } : z,
      ),
    };

    const drift = findeZeitplanDrift(bestand, ERWARTETE_ZEITPLAENE);

    expect(drift).toHaveLength(1);
    expect(drift[0]).toMatchObject({ art: "abweichend", typ: "zeitplan" });
    expect(drift[0].grund).toContain("*/30 * * * *");
  });

  it("meldet einen ausgehöhlten Befehl bei richtigem Namen und Zeitplan", () => {
    // Genau der Fall, den eine reine Namensprüfung nicht sieht: der Eintrag
    // ist da, läuft jede Minute — und tut nichts.
    const bestand: Zeitplanbestand = {
      ...gesund,
      zeitplaene: gesund.zeitplaene.map((z) =>
        z.jobname === "push-wiederholung" ? { ...z, command: "select 1" } : z,
      ),
    };

    const drift = findeZeitplanDrift(bestand, ERWARTETE_ZEITPLAENE);

    expect(drift).toHaveLength(1);
    expect(drift[0]).toMatchObject({ art: "abweichend", typ: "zeitplan" });
  });

  it("meldet einen abgeschalteten Trigger", () => {
    // `tgenabled = 'D'`. Er steht weiter im Katalog, sein Versand ist tot.
    const bestand: Zeitplanbestand = {
      ...gesund,
      abgeschalteteTrigger: ["notifications_push_webhook"],
    };

    expect(findeZeitplanDrift(bestand, ERWARTETE_ZEITPLAENE)).toEqual([
      { art: "abgeschaltet", typ: "trigger", name: "notifications_push_webhook" },
    ]);
  });

  it("wirft, wenn nichts erwartet wird — dann prüft der Aufrufer nichts", () => {
    // Dieselbe Regel wie beim leeren Bestand: ein Vergleich ohne Sollwert ist
    // immer grün und belegt nichts.
    expect(() => findeZeitplanDrift(gesund, [])).toThrow();
  });
});

describe("ERWARTETE_ZEITPLAENE", () => {
  it("führt genau die zwei Zeitplanungen, die von Hand gesetzt werden", () => {
    // Sie stehen wörtlich in `docs/secrets.md:478` und `:587`. Beide Funktionen
    // liegen in Migrationen — nur ihre Zeitplanung nicht, weil ein
    // `cron.schedule` in einer Migration den CI-Lauf gegen eine frische
    // Datenbank bräche.
    expect(ERWARTETE_ZEITPLAENE.map((z) => z.jobname)).toEqual([
      "push-wiederholung",
      "beitrag-ankuendigen",
    ]);
    expect(ERWARTETE_ZEITPLAENE.every((z) => z.schedule === "* * * * *")).toBe(true);
  });
});
