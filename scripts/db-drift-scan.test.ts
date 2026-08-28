import { describe, expect, it } from "vitest";

import { ERWARTET_OHNE_MIGRATION, findeObjektDrift, type Bestand } from "./db-drift-scan.logic";

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
 * Beides bricht `migrate-prod` ab, und weil `deploy.yml` dann am
 * Migrations-Gate hängen bleibt, fällt der Frontend-Deploy **stumm** aus.
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

  it("meldet keinen Drift, wenn jeder erwartete Webhook im Bestand liegt", () => {
    // Welcher Eimer, ist hier gleichgültig: geprüft wird gegen die **flache**
    // Vereinigung (Grenze 3 im Kopf des Logikmoduls). Sie nach Funktion und
    // Trigger aufzuteilen hiesse, die Liste abzuschreiben — genau das soll
    // diese Zusage nicht.
    const bestand: Bestand = { ...leer, trigger: [...ERWARTET_OHNE_MIGRATION] };

    expect(findeObjektDrift(bestand, [], ERWARTET_OHNE_MIGRATION)).toEqual([]);
  });

  it.each(PUSH_WEBHOOK)(
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
