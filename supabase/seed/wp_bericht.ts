/**
 * Der Bericht des WordPress-Imports (AGE-534, Gruppe 4).
 *
 * Rein: baut Text, schreibt nicht. Abgelegt wird er von `schreibeBericht` in
 * `wp_import.lib.ts` — neben der Quelle, ausserhalb des Arbeitsbaums, mit `0600`.
 *
 * ── DER BERICHT IST DER EINZIGE ORT MIT PERSONENDATEN ───────────────────────
 * Namen, Adressen und Telefonnummern stehen hier und NUR hier. `stdout` bekommt
 * `stdoutZeile()`, die Datensatznummer, Kennung und Klasse führt und sonst
 * nichts — sonst landen die Daten von 70 Menschen in der Shell-History und in
 * jedem Log, das den Lauf mitschneidet.
 *
 * ── UND ER IST DAS EINZIGE GEDÄCHTNIS ZWEIER SACHEN ─────────────────────────
 * Der Auffüllgrad des Beitrittsdatums (aus „April 2021" wird `2021-04-01`, was
 * danach tagesgenau aussieht) und die Felder, die die Merge-Regel stehen liess.
 * Beides ist nirgends sonst festgehalten. Der Bericht ist deshalb aufzubewahren,
 * nicht nach dem Lauf zu verwerfen.
 */

import type { Vorabbefund } from "./wp_import.lib";

export type Klasse = "angelegt" | "aktualisiert" | "uebersprungen" | "fehlerhaft";

/** Die Reihenfolge, in der die Klassen im Bericht stehen. */
const KLASSEN: readonly Klasse[] = ["angelegt", "aktualisiert", "uebersprungen", "fehlerhaft"];

const KLASSENNAME: Record<Klasse, string> = {
  angelegt: "angelegt",
  aktualisiert: "aktualisiert",
  uebersprungen: "übersprungen",
  fehlerhaft: "fehlerhaft",
};

/**
 * Wie es einem der beiden Bilder ergangen ist (6.3/6.4).
 *
 * `fehlt` ist ausdrücklich KEIN Datensatzfehler: das Mitglied wird angelegt,
 * das Bild steht als Zeile im Bericht. Es ist der einzige Ort, an dem jemand
 * nachlesen kann, welches Bild nachzutragen ist.
 */
export type Bildbefund = {
  art: "profil" | "cover";
  stand: "hochgeladen" | "vorhanden" | "fehlt";
  grund?: string;
};

const BILDART: Record<Bildbefund["art"], string> = {
  profil: "Profilbild",
  cover: "Headerbild",
};

export type Datensatzergebnis = {
  /** Zählt DATENSÄTZE, nicht Dateizeilen — Freitextfelder tragen Umbrüche. */
  zeile: number;
  kennung: string | null;
  name: string | null;
  adresse: string | null;
  klasse: Klasse;
  grund?: string;
  /** Was die Quelle führt und die Merge-Regel nicht geschrieben hat. */
  uebersprungeneFelder?: string[];
  /** Übernommenes Beitrittsdatum samt Rohangabe und Auffüllgrad. */
  beitritt?: { datum: string; grad: "tag" | "monat" | "jahr"; roh: string };
  /** Wie es den beiden Bildern erging — nur im schreibenden Lauf belegt. */
  bilder?: Bildbefund[];
};

export type Berichtskopf = {
  modus: "trocken" | "schreibend";
  ziel: string;
  quelle: string;
  zeitpunkt: string;
  /** Was Detlev noch nicht geliefert hat. Blockiert nichts, steht aber drin. */
  fehlendeLieferungen: string[];
};

/**
 * Zwei Berichtstypen, und das ist Absicht: ein Vorab-Abbruch hat den
 * schreibenden Abschnitt nie erreicht, es gibt für ihn also keine
 * Datensatzklassen. Sie mit lauter Nullen zu führen, behauptete einen Lauf, den
 * es nicht gab.
 */
export type Berichtsdaten =
  | { art: "vorab-abbruch"; kopf: Berichtskopf; datensaetze: number; befunde: Vorabbefund[] }
  | { art: "lauf"; kopf: Berichtskopf; befunde: Vorabbefund[]; ergebnisse: Datensatzergebnis[] };

/**
 * Ein Wert in einer Markdown-Tabellenzelle. Der senkrechte Strich beendet dort
 * die Spalte — ein Name wie „Anna | Berg" verschöbe alle folgenden Spalten um
 * eine, und der Bericht läse sich falsch statt kaputt.
 */
function zelle(wert: string | null): string {
  return (wert ?? "—").replace(/\|/g, "\\|").replace(/\s*\n\s*/g, " ");
}

function tabelle(kopf: string[], zeilen: string[][]): string {
  return [
    `| ${kopf.join(" | ")} |`,
    `|${kopf.map(() => "---").join("|")}|`,
    ...zeilen.map((z) => `| ${z.join(" | ")} |`),
  ].join("\n");
}

function kopfzeilen(kopf: Berichtskopf): string[] {
  return [
    `- Betriebsart: **${kopf.modus === "trocken" ? "Trockenlauf" : "Schreibender Lauf"}**`,
    `- Ziel: \`${kopf.ziel}\``,
    `- Quelle: \`${kopf.quelle}\``,
    `- Zeitpunkt: ${kopf.zeitpunkt}`,
  ];
}

function befundzeilen(befunde: Vorabbefund[]): string[] {
  if (befunde.length === 0) return [];

  return [
    "## Befunde der Vorabprüfung",
    "",
    ...befunde.map((b) => {
      switch (b.art) {
        case "kopfzeile":
          return `- **Kopfzeile**: ${b.grund}`;
        case "dublette_kennung":
          return `- **Doppelte Kennung** \`${b.wert}\` in den Datensätzen ${b.zeilen.join(", ")}`;
        case "dublette_adresse":
          return `- **Doppelte Adresse** ${zelle(b.wert)} in den Datensätzen ${b.zeilen.join(", ")}`;
        case "adresse_ungueltig":
          return `- **Unbrauchbare Adresse** in Datensatz ${b.zeile} (Kennung ${b.kennung ?? "—"}): ${b.wert === "" ? "keine Angabe" : zelle(b.wert)}`;
        case "kollision_bestand":
          return `- **Kollision mit Bestandskonto** in Datensatz ${b.zeile} (Kennung ${b.kennung ?? "—"}): ${zelle(b.wert)} existiert bereits ohne Kennung`;
      }
    }),
    "",
  ];
}

function lieferzeilen(kopf: Berichtskopf): string[] {
  if (kopf.fehlendeLieferungen.length === 0) return [];

  return [
    "## Fehlende Lieferungen",
    "",
    "Der Lauf ist damit durchgelaufen — die Listen blockieren nichts (Entscheidung",
    "14.08.). Was fehlt, ist unten datensatzweise aufgeführt und nach der Lieferung",
    "gezielt nachzutragen:",
    "",
    ...kopf.fehlendeLieferungen.map((l) => `- ${l}`),
    "",
  ];
}

export function baueBericht(daten: Berichtsdaten): string {
  if (daten.art === "vorab-abbruch") {
    return [
      "# WordPress-Import — Vorab-Abbruch",
      "",
      ...kopfzeilen(daten.kopf),
      `- Datensätze in der Quelle: ${daten.datensaetze}`,
      "",
      "Der Lauf hat den verarbeitenden Abschnitt **nicht erreicht**. Es wurde nichts",
      "geschrieben; Datensatzklassen gibt es für diesen Lauf deshalb nicht.",
      "",
      ...befundzeilen(daten.befunde),
    ]
      .join("\n")
      .trimEnd()
      .concat("\n");
  }

  const { ergebnisse } = daten;

  // Die Summe wird nicht geführt, sondern gezählt: sie kann so gar nicht von der
  // Zahl der Datensätze abweichen. Eine mitgeführte Zahl könnte es.
  const anzahl = (k: Klasse): number => ergebnisse.filter((e) => e.klasse === k).length;

  const nachzutragen: string[] = [];

  const aufgefuellt = ergebnisse.filter((e) => e.beitritt && e.beitritt.grad !== "tag");
  if (aufgefuellt.length > 0) {
    nachzutragen.push(
      "### Aufgefüllte Beitrittsdaten",
      "",
      "Die Rohangabe steht nur hier — im Profil sieht das Datum tagesgenau aus.",
      "",
      tabelle(
        ["Datensatz", "Kennung", "Name", "Übernommen", "Rohangabe", "genau bis"],
        aufgefuellt.map((e) => [
          String(e.zeile),
          zelle(e.kennung),
          zelle(e.name),
          e.beitritt?.datum ?? "—",
          zelle(e.beitritt?.roh ?? null),
          e.beitritt?.grad ?? "—",
        ]),
      ),
      "",
    );
  }

  const stehengelassen = ergebnisse.flatMap((e) =>
    (e.uebersprungeneFelder ?? []).map((feld) => [
      String(e.zeile),
      zelle(e.kennung),
      zelle(e.name),
      feld,
    ]),
  );
  if (stehengelassen.length > 0) {
    nachzutragen.push(
      "### Nicht geschriebene Felder",
      "",
      "Die Quelle führt hier einen Wert; die Merge-Regel hat das Ziel stehen lassen,",
      "weil dort schon etwas stand oder das Mitglied es geleert hat. Von Hand",
      "nachtragbar — der Import tut es nicht mehr.",
      "",
      tabelle(["Datensatz", "Kennung", "Name", "Feld"], stehengelassen),
      "",
    );
  }

  // Die Bilder (6.3/6.4). Ein fehlendes Bild ist KEIN Datensatzfehler — das
  // Mitglied steht, nur sein Bild fehlt. Genau deshalb braucht es eine eigene
  // Zeile: in der Klassentabelle wäre es unsichtbar, und im Profil sieht ein
  // fehlender Avatar aus wie einer, den niemand hochgeladen hat.
  const alleBilder = ergebnisse.flatMap((e) => (e.bilder ?? []).map((b) => ({ e, b })));
  if (alleBilder.length > 0) {
    const zaehle = (stand: Bildbefund["stand"]) =>
      alleBilder.filter(({ b }) => b.stand === stand).length;

    nachzutragen.push(
      "### Bilder",
      "",
      `- hochgeladen: ${zaehle("hochgeladen")}`,
      `- schon vorhanden (übersprungen, nicht ersetzt): ${zaehle("vorhanden")}`,
      `- fehlt: ${zaehle("fehlt")}`,
      "",
    );

    const fehlend = alleBilder.filter(({ b }) => b.stand === "fehlt");
    if (fehlend.length > 0) {
      nachzutragen.push(
        "Diese Bilder sind nicht im Bucket gelandet. Das Mitglied wurde trotzdem",
        "angelegt; nachzutragen ist es von Hand über den Profil-Editor.",
        "",
        tabelle(
          ["Datensatz", "Kennung", "Name", "Bild", "Grund"],
          fehlend.map(({ e, b }) => [
            String(e.zeile),
            zelle(e.kennung),
            zelle(e.name),
            BILDART[b.art],
            zelle(b.grund ?? null),
          ]),
        ),
        "",
      );
    }
  }

  // Übersprungene gehören hierher, nicht nur in die Klassentabelle: hinter
  // jedem steht ein Mensch, über den jemand entscheiden muss. Die Sichtprobe am
  // 14.08. zeigte ihn sonst als blosse Zahl, mit dem Grund allenfalls indirekt
  // über einen Vorabbefund.
  const offen = ergebnisse.filter((e) => e.klasse === "fehlerhaft" || e.klasse === "uebersprungen");
  if (offen.length > 0) {
    nachzutragen.push(
      "### Fehlerhafte und übersprungene Datensätze",
      "",
      tabelle(
        ["Datensatz", "Kennung", "Name", "Adresse", "Klasse", "Grund"],
        offen.map((e) => [
          String(e.zeile),
          zelle(e.kennung),
          zelle(e.name),
          zelle(e.adresse),
          KLASSENNAME[e.klasse],
          zelle(e.grund ?? null),
        ]),
      ),
      "",
    );
  }

  // Für einen fehlerhaften Datensatz ist nichts nachzutragen: er wurde nicht
  // angelegt, es gibt also keine Zeile, an der ein Zahlungsstand hinge.
  const offeneZahlung = daten.kopf.fehlendeLieferungen.includes("Zahlungsstände")
    ? ergebnisse.filter((e) => e.klasse === "angelegt" || e.klasse === "aktualisiert")
    : [];
  if (offeneZahlung.length > 0) {
    nachzutragen.push(
      "### Offene Zahlungsstände (`paid_until`)",
      "",
      "Diese Konten tragen den Bestandsschutz noch ohne Ablaufdatum. `null` heisst",
      "dort **unbekannt**, nicht unbefristet.",
      "",
      tabelle(
        ["Datensatz", "Kennung", "Name"],
        offeneZahlung.map((e) => [String(e.zeile), zelle(e.kennung), zelle(e.name)]),
      ),
      "",
    );
  }

  // ── Wer, nicht wie viele ──────────────────────────────────────────────────
  // Die Klassentabelle sagt „2 angelegt" — vor dem echten Lauf ist aber die
  // Frage, WER das ist. Die Anforderung „Der Trockenlauf benennt, was er
  // schreiben würde" verlangt den Datensatz einzeln, mit der Adresse als
  // Schlüssel; sie ist es auch, unter der ein Mensch sich später anmeldet.
  //
  // Fehlerhafte und übersprungene stehen NICHT hier: sie haben ihre eigene
  // Tabelle mit dem Grund, und unter dieser Überschrift läsen sie sich, als
  // würden sie geschrieben.
  const trocken = daten.kopf.modus === "trocken";
  const geschrieben = ergebnisse.filter(
    (e) => e.klasse === "angelegt" || e.klasse === "aktualisiert",
  );
  const einzeln =
    geschrieben.length === 0
      ? []
      : [
          trocken ? "## Was der Lauf anlegen und ergänzen würde" : "## Angelegt und ergänzt",
          "",
          tabelle(
            ["Datensatz", "Kennung", "Name", "Adresse", trocken ? "Vorhaben" : "Klasse"],
            geschrieben.map((e) => [
              String(e.zeile),
              zelle(e.kennung),
              zelle(e.name),
              zelle(e.adresse),
              trocken ? `würde ${KLASSENNAME[e.klasse]}` : KLASSENNAME[e.klasse],
            ]),
          ),
          "",
        ];

  return [
    "# WordPress-Import — Bericht",
    "",
    ...kopfzeilen(daten.kopf),
    "",
    ...lieferzeilen(daten.kopf),
    "## Datensätze",
    "",
    tabelle(
      ["Klasse", "Anzahl"],
      [
        ...KLASSEN.map((k) => [KLASSENNAME[k], String(anzahl(k))]),
        ["**Summe**", `**${ergebnisse.length}**`],
      ],
    ),
    "",
    ...einzeln,
    ...(nachzutragen.length > 0 ? ["## Nachzutragen", "", ...nachzutragen] : []),
    ...befundzeilen(daten.befunde),
  ]
    .join("\n")
    .trimEnd()
    .concat("\n");
}

/**
 * Was auf der Konsole erscheinen darf: Datensatznummer, Kennung, Klasse. Kein
 * Name, keine Adresse, kein Grund — Gründe tragen oft den Namen mit („Anna Berg
 * hat keine PLZ"), und die Konsole ist der eine Ort, an dem Personendaten
 * unkontrolliert weiterwandern.
 */
export function stdoutZeile(e: Datensatzergebnis): string {
  return `Datensatz ${e.zeile} · ${e.kennung ?? "ohne Kennung"} · ${KLASSENNAME[e.klasse]}`;
}
