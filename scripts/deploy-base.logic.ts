/**
 * Waehlt die Vergleichsbasis des Function-Deploys (AGE-506, Aufgabe 5).
 *
 * WARUM NICHT `HEAD^`. `HEAD^..HEAD` beantwortet „was aenderte dieser Merge".
 * Gebraucht wird „was ist noch nicht ausgeliefert". Die zwei sind nur solange
 * dasselbe, wie JEDER Lauf ausliefert — und das ist nicht zugesichert:
 * `drift-gate` steht regelmaessig rot, und dann wird `functions` uebersprungen.
 *
 * Der Schaden ist bereits eingetreten. Lauf 31211729060 (Merge 36b662a) sprang
 * `functions` uebersprungen; der Merge aenderte `send-activation/index.ts`. Der
 * Folgelauf verglich `HEAD^..HEAD` und sah davon nichts mehr. Auf das Ziel kam
 * die Aenderung nur, weil der naechste Merge zufaellig dieselbe Function
 * anfasste — Glueck, kein Mechanismus.
 *
 * WARUM ALS REINE FUNKTION. Gleiche Begruendung wie bei
 * `changed-functions.logic.ts`: eine Shell-Zeile im YAML testet niemand, und ein
 * Fehler hier heisst „eine Function wurde still nicht ausgeliefert" — der
 * Zustand, den AGE-506 ueberhaupt abstellt.
 */

/** Ein Lauf von `deploy.yml` auf `main`, so wie ihn `deploy-base.ts` reicht. */
export interface Lauf {
  /** Lauf-ID. Sie steht spaeter im Protokoll, damit die Basis nachschlagbar ist. */
  id: number;
  /** `head_sha` des Laufs. */
  sha: string;
  /**
   * `conclusion` des `functions`-JOBS in diesem Lauf — nicht die des Laufs.
   * Ein uebersprungener Job macht einen Lauf naemlich nicht rot; die Lauf-Ebene
   * waere heute nur ueber eine Schlusskette richtig, die ein kuenftiges `if:`
   * still kippt. `null` heisst: kein solcher Job in diesem Lauf.
   */
  functions: string | null;
}

export interface Basiswahl {
  /** SHA, gegen den verglichen wird — oder `null`, wenn keiner zu finden war. */
  sha: string | null;
  /**
   * Warum genau dieser. Kein Beiwerk: der Grund gehoert ins Protokoll. Eine
   * Basis ohne genannte Herkunft ist ein Wert, den hinterher niemand
   * nachschlagen kann.
   */
  grund: string;
}

/** Erst dieses Ergebnis belegt, dass der Stand des Laufs auf beiden Zielen liegt. */
const ERFOLG = "success";

/** @param laeufe Neuester zuerst. */
export function gewaehlteBasis(laeufe: Lauf[]): Basiswahl {
  const ausgeliefert = laeufe.find((l) => l.functions === ERFOLG);

  if (!ausgeliefert) {
    return {
      sha: null,
      grund: "kein Lauf mit erfolgreichem functions-Job in der Historie",
    };
  }

  return {
    sha: ausgeliefert.sha,
    grund: `zuletzt erfolgreich ausgeliefert in Lauf ${ausgeliefert.id}`,
  };
}
