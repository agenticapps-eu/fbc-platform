import { describe, expect, it } from "vitest";

import { findeObjektDrift, type Bestand } from "./db-drift-scan.logic";

/**
 * Objekt-Drift: was steht in der Datenbank, das in keiner Migration steht —
 * und was fehlt, obwohl es dort stehen müsste (AGE-496 Task 12).
 *
 * Der Scan hat zwei Aufgaben, und die zweite ist die wichtigere:
 *
 *  1. **Unbekanntes melden.** Ein Objekt, das weder in einer Migration noch in
 *     der Ausnahmeliste steht, heißt: jemand war am Dashboard.
 *  2. **Fehlendes melden.** Das Webhook-Paar
 *     (`notify_contact_request_webhook` + `contact_requests_email_webhook`)
 *     steht bewusst in keiner Migration — der Bearer-Token liegt inline und
 *     das Repo ist öffentlich. Verschwindet es, stirbt der Mailversand
 *     **still**: kein Fehler, keine Meldung, nur keine Mails mehr. Genau
 *     dagegen ist dieser Scan gebaut.
 */

const leer: Bestand = { funktionen: [], trigger: [], tabellen: [] };

describe("findeObjektDrift", () => {
  it("meldet nichts, wenn jedes Objekt in einer Migration steht", () => {
    const bestand: Bestand = { funktionen: ["is_admin"], trigger: [], tabellen: ["profiles"] };

    expect(findeObjektDrift(bestand, ["is_admin", "profiles"], [])).toEqual([]);
  });

  it("meldet ein Objekt, das in keiner Migration steht", () => {
    const bestand: Bestand = { ...leer, funktionen: ["heimlich_im_dashboard"] };

    const drift = findeObjektDrift(bestand, ["is_admin"], []);

    expect(drift).toEqual([{ art: "unbekannt", typ: "funktion", name: "heimlich_im_dashboard" }]);
  });

  it("meldet ein Objekt aus der Ausnahmeliste NICHT als unbekannt", () => {
    const bestand: Bestand = {
      funktionen: ["notify_contact_request_webhook"],
      trigger: ["contact_requests_email_webhook"],
      tabellen: [],
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
    const bestand: Bestand = {
      funktionen: ["notify_contact_request_webhook"],
      trigger: [],
      tabellen: [],
    };

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
    const bestand: Bestand = { funktionen: ["f"], trigger: ["t"], tabellen: ["x"] };

    const drift = findeObjektDrift(bestand, [], []);

    expect(drift.map((d) => d.typ)).toEqual(["funktion", "trigger", "tabelle"]);
  });

  it("wirft, wenn der Bestand leer ist — dann hat die Abfrage nichts gemessen", () => {
    // Eine Datenbank mit 40 angewendeten Migrationen hat Funktionen und
    // Tabellen. Null Objekte heißt: die Abfrage lief ins Leere, nicht dass
    // alles sauber ist. Dieselbe Lehre wie beim Migrations-Gate.
    expect(() => findeObjektDrift(leer, ["is_admin"], [])).toThrow();
  });
});
