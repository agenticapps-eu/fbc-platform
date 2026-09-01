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

  it("ist mit Höchstpause 0 mit Sicherheit rot — der Abnahmebeleg hängt daran", () => {
    // Der rote Lauf für 2.3/4.3 wird über `hoechstpauseMinuten: 0` erzeugt,
    // nicht über ein winziges Fenster: das schriebe der Minutentakt während
    // der Abfrage womöglich gerade voll. Damit der Beleg nicht flackert, muss
    // AUCH ein Lauf, der in derselben Sekunde lag, den Befund auslösen —
    // `extract(epoch ...)::int` schneidet auf 0 ab.
    const m: Messung = { ...gesund, juengsterLaufAlterSekunden: 0 };
    const jetztSofort: Schwellen = { fensterMinuten: 120, hoechstpauseMinuten: 0 };

    expect(bewerteMessung(m, jetztSofort).map((b) => b.art)).toEqual(["stillstand"]);
  });

  it("meldet einen leicht unvollständigen Takt NICHT", () => {
    // Ein halb laufender Takt verliert nichts, er verzögert nur — die
    // Anspruchsfrist holt die Auftraege nach. Die Schwelle soll „laeuft" von
    // „laeuft kaum" trennen, keine Guete messen.
    const m: Messung = { ...gesund, laeufeImFenster: 111 };

    expect(bewerteMessung(m, schwellen)).toEqual([]);
  });
});

describe("bewerteMessung — Stummheit (der Takt läuft, es kommt nichts zurück)", () => {
  it("meldet einen laufenden Takt ohne jede Antwort", () => {
    // Der Fall, den die Diff-Review gefunden hat — und den ICH selbst
    // aufgerissen habe: als das Stille-Signal von `net._http_response` auf
    // `cron.job_run_details` umzog, ist die Frage „kommt ueberhaupt etwas
    // zurueck?" ersatzlos entfallen.
    //
    // Stirbt der pg_net-Worker, reiht `net.http_post` weiter ein, das SQL
    // gelingt, der cron-Lauf ist `succeeded` — und es entsteht NIE eine
    // Antwortzeile. Ohne diese Zusage bliebe der Waechter dauerhaft gruen,
    // waehrend nichts zugestellt wird.
    const m: Messung = { ...gesund, antworten: [] };

    expect(arten(m)).toEqual(["stumm"]);
  });

  it("meldet einen Rueckstau, bei dem nur noch ein Bruchteil zurueckkommt", () => {
    // Gemessen ist das Verhaeltnis 1:1 — ein cron-Lauf, eine Antwortzeile
    // (DEV am 01.09.: 120 Laeufe, 120 Antworten im selben Fenster). Ein
    // Rueckstand von ein, zwei Zeilen ist Laufzeit; die Haelfte ist ein Defekt.
    const m: Messung = { ...gesund, antworten: [{ statusCode: 200, timedOut: false, fehler: false, anzahl: 40 }] };

    expect(arten(m)).toEqual(["stumm"]);
  });

  it("meldet einen leichten Rueckstand NICHT", () => {
    const m: Messung = { ...gesund, antworten: [{ statusCode: 200, timedOut: false, fehler: false, anzahl: 118 }] };

    expect(bewerteMessung(m, schwellen)).toEqual([]);
  });

  it("meldet keine Stummheit, wenn gar kein Takt laeuft — das ist Stillstand", () => {
    // Zwei verschiedene Ursachen, zwei verschiedene erste Handgriffe. Ohne
    // Takt gibt es nichts, was antworten koennte; „stumm" waere dort eine
    // Folgemeldung ohne eigenen Wert.
    const m: Messung = {
      ...gesund,
      antworten: [],
      juengsterLaufAlterSekunden: null,
      laeufeImFenster: 0,
    };

    expect(arten(m)).toEqual(["stillstand"]);
  });
});

describe("bewerteMessung — Aufgabe", () => {
  it("meldet eine im Fenster aufgegebene Zustellung", () => {
    const m: Messung = { ...gesund, aufgegeben: 1 };

    expect(arten(m)).toEqual(["aufgabe"]);
  });

  it("nennt die Anzahl", () => {
    // `letzter_fehler` kommt aus `e.message` (send-push/index.ts:205), und die
    // APNs-Adresse traegt den Geraetetoken im Pfad. Er darf nicht in ein
    // oeffentliches Protokoll.
    //
    // Hier stand dazu `expect(Object.keys(m)).not.toContain("letzterFehler")`.
    // Das war VAKUUM-GRUEN und hat die Diff-Review zu Recht geaergert: `m` ist
    // das selbst gebaute Testobjekt, es enthaelt den Schluessel nie, und die
    // Zusage haette auch bei einer Abfrage gehalten, die den Wert liest. Die
    // Aussage traegt die Abfragen-Zusage weiter unten, nicht diese.
    const m: Messung = { ...gesund, aufgegeben: 3 };

    expect(bewerteMessung(m, schwellen)[0].text).toContain("3");
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

  it.each(Object.entries(ABFRAGEN))("%s waehlt keinen Stern aus", (_name, sql) => {
    // Die Diff-Review hat die Luecke gefunden: eine Verbotsliste einzelner
    // Spaltennamen faengt `select *` NICHT — und `net._http_response.*` traegt
    // `content` und `headers`. Ein Stern liest ausserdem jede Spalte mit, die
    // eine spaetere Migration hinzufuegt.
    //
    // Verboten ist der Stern als AUSWAHLLISTE — nach `select` oder nach einem
    // Komma, auch tabellenqualifiziert (`r.*`). Erlaubt bleiben `count(*)` und
    // die Multiplikation `$1 * interval '1 minute'`; an letzterer ist die
    // erste, gröbere Fassung dieser Zusage haengengeblieben.
    const norm = sql.toLowerCase().replace(/\s+/g, " ");

    expect(norm).not.toMatch(/(select|,)\s+(\w+\.)?\*/);
  });

  it("fuehrt die Spalten, um die es geht — sonst prueft die Zusage darueber nichts", () => {
    // Gegenprobe zur Zusage darueber: waere die Liste leer, waere sie gruen,
    // ohne etwas auszuschliessen.
    expect(VERBOTENE_SPALTEN).toEqual(
      expect.arrayContaining(["content", "headers", "letzter_fehler", "token"]),
    );
  });
});
