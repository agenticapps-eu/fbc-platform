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

/**
 * Ein Bild zu einem archivierten Change (AGE-632).
 *
 * `width`/`height` sind Pflicht, nicht Zierde: ohne sie kennt der Browser das
 * Seitenverhältnis erst, wenn das Bild da ist, und schiebt den Text darunter
 * genau in dem Moment nach unten, in dem jemand ihn liest.
 */
export interface ReleaseBild {
  /** Pfad im ausgelieferten Bündel, z. B. `/release/chat-leiste.png`. */
  src: string;
  /** Was zu sehen ist — für Vorlesesoftware und für den Fall, dass es fehlt. */
  alt: string;
  width: number;
  height: number;
}
