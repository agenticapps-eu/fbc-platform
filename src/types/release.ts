/**
 * Die Gestalt eines Release-Eintrags (AGE-631).
 *
 * Steht hier und nicht im Erzeuger, weil beide Seiten sie brauchen: das
 * erzeugte Modul unter `src/content/` und die Admin-Fläche, die es liest. Der
 * Erzeuger liegt unter `scripts/` und ist nicht Teil des Bündels — ein Import
 * von dort zöge Node-Module in den Browser-Build.
 */
export interface ReleaseEintrag {
  /** Verzeichnisname im Archiv — der einzige verlässliche Schlüssel. */
  slug: string;
  /** `JJJJ-MM-TT` aus dem Verzeichnisnamen. */
  datum: string;
  /** Aus `# …` im Proposal, sonst der Verzeichnisname ohne Datum. */
  titel: string;
  /** `AGE-123`, wo das Proposal eine `Linear:`-Zeile trägt. */
  linear: string | null;
  /** Die Stichpunkte der obersten Ebene aus „What Changes". */
  aenderungen: string[];
}
