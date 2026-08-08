/**
 * Waehlt die Vergleichsbasis des Function-Deploys (AGE-506, Aufgabe 5).
 *
 * WARUM NICHT `HEAD^`. `HEAD^..HEAD` beantwortet „was aenderte dieser Merge".
 * Gebraucht wird „was ist noch nicht ausgeliefert". Die zwei sind nur solange
 * dasselbe, wie JEDER Lauf ausliefert — und das ist nicht zugesichert:
 * `drift-gate` steht regelmaessig rot, und dann wird `functions` uebersprungen.
 *
 * Der Schaden ist bereits eingetreten. Lauf 31211729060 (Merge 36b662a)
 * uebersprang den `functions`-Job; der Merge aenderte `send-activation/index.ts`.
 * Der Folgelauf verglich `HEAD^..HEAD` und sah davon nichts mehr. Auf das Ziel
 * kam die Aenderung nur, weil der naechste Merge zufaellig dieselbe Function
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
  /** `head_sha` des Laufs, ungeprueft so, wie die API ihn lieferte. */
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

/**
 * Der Wert geht danach in `git diff` und `git merge-base`. Was kein Commit-SHA
 * ist, ist auch keine Basis — und ein leeres `head_sha` haette sonst `sha: null`
 * mit dem Grund „zuletzt erfolgreich ausgeliefert in Lauf X" ergeben: eine
 * Basis, die es nicht gibt, mit einer Herkunft, die Erfolg behauptet.
 */
const SHA = /^[0-9a-f]{7,40}$/;

export function gewaehlteBasis(laeufe: Lauf[]): Basiswahl {
  // Absteigend nach ID sortieren, statt „neuester zuerst" vom Aufrufer zu
  // verlangen. Die Sortierung der Runs-API ist nirgends zugesichert, und ein
  // spaeter angehaengtes `&sort=` kehrte das Ergebnis still um — dann gaelte
  // die AELTESTE Basis als die juengste. IDs sind je Repository monoton.
  const ausgeliefert = [...laeufe]
    .sort((a, b) => b.id - a.id)
    .find((l) => l.functions === ERFOLG && SHA.test(l.sha ?? ""));

  if (ausgeliefert) {
    return {
      sha: ausgeliefert.sha,
      grund: `zuletzt erfolgreich ausgeliefert in Lauf ${ausgeliefert.id}`,
    };
  }

  if (laeufe.length === 0) {
    return { sha: null, grund: "keine Laufhistorie erhalten" };
  }

  // Kein Treffer hat zwei sehr verschiedene Ursachen, und sie duerfen nicht
  // dieselbe Meldung bekommen: ein zu kurzes Fenster ist ein Historienzustand
  // und geht vorbei. Ein Job, der in KEINEM Lauf vorkommt, ist ein kaputter
  // Selektor — der Job wurde umbenannt oder bekam eine `strategy.matrix` — und
  // der bliebe fuer immer. Beides gleich zu melden liesse den Dauerschaden wie
  // ein Rauschen aussehen.
  if (laeufe.every((l) => l.functions === null)) {
    return {
      sha: null,
      grund:
        `in keinem der ${laeufe.length} geprueften Laeufe kommt ueberhaupt ein ` +
        `functions-Job vor — vermutlich heisst der Job nicht mehr so`,
    };
  }

  return {
    sha: null,
    grund: `kein erfolgreich ausgeliefertes Ergebnis in den letzten ${laeufe.length} Laeufen`,
  };
}
