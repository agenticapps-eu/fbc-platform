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
 * Eine wöchentliche Ausgabe des Blogs (AGE-705).
 *
 * **Die Gliederung des Blogs ist die Zeit, nicht das Thema.** Eine thematische
 * Liste beantwortet die Frage „was ist neu" nicht — sie beantwortet „wo steht
 * etwas über X". Eine Ausgabe beantwortet die erste, für einen Zeitraum und für
 * mehrere Funktionen zusammen.
 *
 * `einleitung` ist die einzige Stelle im ganzen Blog, an der „neu" gesagt werden
 * darf: eine Ausgabe ist eine Meldung über einen Zeitraum. Der Text der
 * Geschichte selbst bleibt zeitlos, weil er auch im Tutorial steht — dort hat
 * niemand ein Vorher.
 */
export interface ReleaseAusgabe {
  /** `JJJJ-MM-TT` — der Tag der Ausgabe. Sortiert die Blog-Übersicht. */
  datum: string;
  /** Eine Zeile, die den Zeitraum benennt. */
  titel: string;
  /** Klartext, wie bei einer Geschichte: eine Leerzeile trennt Absätze. */
  einleitung: string;
  /** Die Slugs der Geschichten, die diese Ausgabe vorstellt — in Leseordnung. */
  geschichten: string[];
}

/**
 * Eine Etappe des Tutorials (AGE-705).
 *
 * Das Tutorial ist ein Weg durch die Anwendung, vom Ankommen bis zum Einrichten.
 * Seine Reihenfolge steht **hier** und wird nicht aus Datum oder Thema
 * abgeleitet: beide sagen, wann etwas entstand, und nicht, in welcher Ordnung
 * man es lernt.
 */
export interface TutorialEtappe {
  /** Die Überschrift der Etappe, in der Sprache des Lesers. */
  titel: string;
  /** Ein Satz, der sagt, worum es auf dieser Wegstrecke geht. */
  einleitung: string;
  /** Dateiname eines Motivs aus `public/images/` — der Kopfbereich der Etappe. */
  motiv: string;
  /** Die Slugs der Kapitel, in der Reihenfolge, in der sie gelesen werden. */
  kapitel: string[];
}

/**
 * Eine für Mitglieder lesbare Geschichte zu einem archivierten Change
 * (AGE-705).
 *
 * Sie ist nicht die Übersetzung eines Archiveintrags, sondern eine Einführung:
 * wozu brauche ich das, wie geht es heute, ab welcher Stufe. Der Archiveintrag
 * ist der Anlass, nicht die Vorlage — die Leser haben erst jetzt Zugang und
 * kennen kein Vorher.
 */
export interface ReleaseGeschichte {
  /** Zeichengleich mit dem Slug des Archiveintrags — das ist die Verbindung. */
  slug: string;
  /** `JJJJ-MM-TT`, aus dem Archiveintrag. */
  datum: string;
  /** Eine Zeile, in Mitgliedersprache. */
  titel: string;
  /**
   * Klartext. Eine Leerzeile trennt Absätze. KEIN Markup: derselbe Text kann in
   * eine Zustellung wandern, und `ReleaseNoteModal` rendert ihn unverändert —
   * Auszeichnungszeichen wären dort sichtbar.
   */
  text: string;
  /**
   * Ein Screenshot der beschriebenen Fläche — Pflicht, nicht Zierde.
   *
   * Die Übersicht zeigt ihn neben dem Anriss, die Einzelseite über dem Text.
   * Ein optionales Feld hiesse, dass die Übersicht zwei Gestalten hätte, und
   * beide müssten aussehen, als wären sie so gemeint.
   *
   * `src` zeigt in den Ausgabeordner des Blogs (`/bilder/…`), nicht in das
   * Bündel der Anwendung — der Blog wird getrennt ausgeliefert.
   */
  bild: ReleaseBild;
  /**
   * Nur Freigegebenes erscheint öffentlich. Trennt „liegt im Repository" von
   * „ist veröffentlicht"; ohne diese Trennung wäre der Commit die
   * Veröffentlichung.
   */
  freigegeben: boolean;
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
