import { describe, expect, it } from "vitest";

import {
  ABFRAGEN,
  bewerteMessung,
  type Messung,
  type Schwellen,
  VERBOTENE_SPALTEN,
} from "./push-waechter.logic";

/**
 * Der Wächter über den Push-Zustellweg (AGE-679).
 *
 * Er beantwortet vier Fragen, und jede hat ihre eigene Quelle — das ist der
 * teuerste Befund der Plan-Review und deshalb der Grund für die meisten
 * Zusagen hier:
 *
 *  1. **Antwort** — hat der HTTP-Weg mit etwas anderem als 200 geantwortet?
 *     Quelle `net._http_response`.
 *  2. **Stillstand** — läuft der Wiederholungslauf noch? Quelle
 *     `cron.job_run_details`, weil sie den Lauf BENENNT. `net._http_response`
 *     taugt dafür nicht: sie trägt keine Ziel-URL, und eine Antwort eines
 *     anderen Aufrufers würde den Befund verdecken.
 *  3. **Aufgabe** — wurde im Fenster eine Zustellung endgültig aufgegeben?
 *  4. **Messausfall** — konnte der Wächter überhaupt messen? Ein leeres
 *     Messergebnis ist ein Fehler, keine Feststellung (dieselbe Regel führt
 *     `db-drift-scan.logic.ts:104`), und es darf NIE als Stillstand
 *     durchgehen: die beiden haben verschiedene erste Handgriffe.
 *
 * Warum die Abfragen aus dem Logikmodul kommen und hier geprüft werden: die
 * Actions-Protokolle dieses Repositories sind öffentlich. Eine Zusage, die nur
 * die erzeugten Texte prüft, wäre leer — die Logik bekommt nie etwas
 * Verbotenes zu sehen. Was schiefgehen kann, ist die Abfrage, die eine Spalte
 * zu viel liest. Also wird die Abfrage geprüft.
 */

const gesund: Messung = {
  art: "gemessen",
  seite: "dev",
  antworten: [{ statusCode: 200, timedOut: false, fehler: false, anzahl: 120 }],
  juengsterLaufAlterSekunden: 46,
  laeufeImFenster: 120,
  laeufeErwartet: 120,
  aufgegeben: 0,
  ttlSekunden: 6 * 3600,
};

const schwellen: Schwellen = { fensterMinuten: 120, hoechstpauseMinuten: 15 };

const arten = (m: Messung) => bewerteMessung(m, schwellen).map((b) => b.art);

describe("bewerteMessung — der Grünfall", () => {
  it("meldet nichts, wenn der Weg antwortet, der Takt läuft und nichts aufgegeben wurde", () => {
    // Die Zahlen sind die Messung vom 01.09. gegen DEV, nicht erfunden.
    expect(bewerteMessung(gesund, schwellen)).toEqual([]);
  });
});

describe("bewerteMessung — Antwort", () => {
  it("meldet eine Antwort ungleich 200", () => {
    const m: Messung = {
      ...gesund,
      antworten: [
        { statusCode: 200, timedOut: false, fehler: false, anzahl: 118 },
        { statusCode: 401, timedOut: false, fehler: false, anzahl: 2 },
      ],
    };

    expect(arten(m)).toEqual(["antwort"]);
  });

  it("meldet eine Zeitüberschreitung, auch ohne Statuscode", () => {
    const m: Messung = {
      ...gesund,
      antworten: [
        { statusCode: 200, timedOut: false, fehler: false, anzahl: 119 },
        { statusCode: null, timedOut: true, fehler: false, anzahl: 1 },
      ],
    };

    expect(arten(m)).toEqual(["antwort"]);
  });

  it("meldet einen Übertragungsfehler", () => {
    const m: Messung = {
      ...gesund,
      antworten: [
        { statusCode: 200, timedOut: false, fehler: false, anzahl: 119 },
        { statusCode: null, timedOut: false, fehler: true, anzahl: 1 },
      ],
    };

    expect(arten(m)).toEqual(["antwort"]);
  });

  it("nennt den Aufruf und NICHT Push — dieselbe Tabelle trägt jeden Aufrufer", () => {
    // `net._http_response` hat keine Ziel-URL. Ein gescheiterter
    // Kontaktanfrage-Webhook landet hier genauso. Der Befund darf deshalb
    // nicht behaupten, Push sei kaputt.
    const m: Messung = {
      ...gesund,
      antworten: [{ statusCode: 502, timedOut: false, fehler: false, anzahl: 3 }],
    };

    const text = bewerteMessung(m, schwellen)[0].text;

    expect(text).toMatch(/http_post|Aufruf/i);
    expect(text).not.toMatch(/\bPush ist\b|\bPush kaputt\b/i);
  });
});

describe("bewerteMessung — Stillstand", () => {
  it("meldet einen zu alten jüngsten Lauf", () => {
    // 16 Minuten bei einer Höchstpause von 15. Der Minutentakt hat also
    // fünfzehn Schläge ausgelassen.
    const m: Messung = { ...gesund, juengsterLaufAlterSekunden: 16 * 60 };

    expect(arten(m)).toEqual(["stillstand"]);
  });

  it("meldet, wenn gar kein Lauf mehr kommt", () => {
    const m: Messung = {
      ...gesund,
      juengsterLaufAlterSekunden: null,
      laeufeImFenster: 0,
    };

    expect(arten(m)).toEqual(["stillstand"]);
  });

  it("meldet einen stotternden Takt, auch wenn der jüngste Lauf frisch ist", () => {
    // Der Fall, den ein reiner Alterstest übersieht: es läuft gerade eben
    // etwas, aber nur noch ein Drittel der Schläge.
    const m: Messung = { ...gesund, laeufeImFenster: 40, juengsterLaufAlterSekunden: 30 };

    expect(arten(m)).toEqual(["stillstand"]);
  });

  it("meldet einen leicht unvollständigen Takt NICHT", () => {
    // Ein halb laufender Takt verliert nichts, er verzögert nur — die
    // Anspruchsfrist holt die Auftraege nach. Die Schwelle soll „laeuft" von
    // „laeuft kaum" trennen, keine Guete messen.
    const m: Messung = { ...gesund, laeufeImFenster: 111 };

    expect(bewerteMessung(m, schwellen)).toEqual([]);
  });
});

describe("bewerteMessung — Aufgabe", () => {
  it("meldet eine im Fenster aufgegebene Zustellung", () => {
    const m: Messung = { ...gesund, aufgegeben: 1 };

    expect(arten(m)).toEqual(["aufgabe"]);
  });

  it("nennt die Anzahl und nie den Fehlergrund", () => {
    // `letzter_fehler` kommt aus `e.message` (send-push/index.ts:205), und die
    // APNs-Adresse traegt den Geraetetoken im Pfad. Er darf nicht in ein
    // oeffentliches Protokoll — deshalb kennt die Messung ihn gar nicht.
    const m: Messung = { ...gesund, aufgegeben: 3 };

    expect(bewerteMessung(m, schwellen)[0].text).toContain("3");
    expect(Object.keys(m)).not.toContain("letzterFehler");
  });
});

describe("bewerteMessung — Messausfall", () => {
  it("meldet einen Messausfall als eigenen Befund", () => {
    const m: Messung = { art: "messausfall", seite: "prod", grund: "Verbindung abgelehnt" };

    expect(arten(m)).toEqual(["messausfall"]);
  });

  it("meldet einen Messausfall NIE als Stillstand", () => {
    // Der stille Gruenfall, den die Plan-Review gefunden hat: wer nicht misst,
    // sieht auch keinen Takt — und duerfte daraus nie „der Takt steht"
    // schliessen. Verschiedene Ursachen, verschiedene erste Handgriffe.
    const m: Messung = { art: "messausfall", seite: "prod", grund: "Zertifikat abgelaufen" };

    expect(arten(m)).not.toContain("stillstand");
  });

  it("meldet einen Erwartungswert von null als Messausfall, nicht als Stillstand", () => {
    // Ein leeres Messergebnis ist ein Fehler, keine Feststellung: sind null
    // Laeufe erwartet, hat der Laeufer die Zeitplanung nicht gelesen.
    const m: Messung = { ...gesund, laeufeErwartet: 0, laeufeImFenster: 0 };

    expect(arten(m)).toEqual(["messausfall"]);
  });
});

describe("bewerteMessung — die Aufbewahrungsfrist ist eine Voraussetzung", () => {
  it("meldet eine TTL, die das Fenster nicht mehr übersteigt", () => {
    // Das ganze Fenster haengt an `pg_net.ttl`. Eine ferne Aenderung
    // (`ALTER SYSTEM`) verschoebe sie still — also wird sie bei jedem Lauf
    // mitgemessen statt angenommen.
    const m: Messung = { ...gesund, ttlSekunden: 90 * 60 };

    expect(arten(m)).toContain("voraussetzung");
  });

  it("meldet eine TTL, die weit über dem Fenster liegt, NICHT", () => {
    expect(bewerteMessung({ ...gesund, ttlSekunden: 6 * 3600 }, schwellen)).toEqual([]);
  });
});

describe("bewerteMessung — mehrere Befunde gleichzeitig", () => {
  it("meldet jeden Befund einzeln, statt beim ersten aufzuhören", () => {
    const m: Messung = {
      ...gesund,
      antworten: [{ statusCode: 401, timedOut: false, fehler: false, anzahl: 5 }],
      juengsterLaufAlterSekunden: 40 * 60,
      aufgegeben: 2,
    };

    expect(arten(m).sort()).toEqual(["antwort", "aufgabe", "stillstand"]);
  });
});

describe("Die Abfragen lesen keine Mitgliederdaten", () => {
  // Die Actions-Protokolle dieses Repositories sind oeffentlich. Der Rumpf
  // einer Antwort kann tragen, was `send-push` hineinschreibt; die Kopfzeilen
  // koennen Anbieter-Kennungen tragen; `letzter_fehler` kann ueber `e.message`
  // eine APNs-URL mitsamt Geraetetoken tragen.
  it.each(Object.entries(ABFRAGEN))("%s liest keine verbotene Spalte", (_name, sql) => {
    for (const spalte of VERBOTENE_SPALTEN) {
      expect(sql.toLowerCase()).not.toContain(spalte);
    }
  });

  it("fuehrt die Spalten, um die es geht — sonst prueft die Zusage darueber nichts", () => {
    // Gegenprobe zur Zusage darueber: waere die Liste leer, waere sie gruen,
    // ohne etwas auszuschliessen.
    expect(VERBOTENE_SPALTEN).toEqual(
      expect.arrayContaining(["content", "headers", "letzter_fehler", "token_id"]),
    );
  });
});
