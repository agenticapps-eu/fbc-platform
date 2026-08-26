/**
 * Inhaltsmodell fuer die Rechtsseiten (AGE-497).
 *
 * **Warum kein Markdown-Renderer.** Das Projekt hat heute keine
 * Markdown-Abhaengigkeit. Einen einzufuehren hiesse: neue Lieferkette, und bei
 * `dangerouslySetInnerHTML` eine Injektionsflaeche fuer Text, den ein Mensch aus
 * einem Word-Dokument einpflegt. Rechtstexte sind der letzte Ort, an dem man
 * eine HTML-Interpretation haben will.
 *
 * **Warum genau drei Blockarten.** Beide Plan-Reviewer hielten das fuer zu wenig
 * fuer 62k Zeichen AGB und erwarteten verschachtelte Listen, Tabellen und
 * nummerierte Klauseln. Am pandoc-Export der vier Dokumente gezaehlt: 0
 * verschachtelte Listen, 0 Tabellen, 0 nummerierte Listen, 0 eingerueckte
 * Zeilen. Die Gliederungstiefe steckt in Ueberschriften (die AGB haben 178
 * Abschnitte), und Absatznummern wie „(1)" sind Text. Ein vierter Blocktyp
 * haette keinen Verwender.
 */

/** Ein Stueck Fliesstext — oder ein Verweis. Verweise sind DATEN, kein Markup. */
export type Inline = string | { text: string; href: string };

export type Block =
  /** Ein Absatz Fliesstext. */
  | { art: "absatz"; inhalt: Inline[] }
  /** Eine Aufzaehlung. */
  | { art: "liste"; punkte: Inline[][] }
  /** Zeilen, die zusammengehoeren und nicht umbrochen werden duerfen —
   *  im Bestand ausschliesslich Anschriften. */
  | { art: "zeilen"; zeilen: Inline[][] };

export interface Abschnitt {
  titel: string;
  bloecke: Block[];
}

export interface Rechtsdokument {
  /** Letztes Pfadstueck der Route, z. B. `impressum` → `/impressum`. */
  slug: string;
  /** Titel der Seite. Je Dokument verschieden — ein Test haengt daran, weil
   *  „alle vier Routen rendern" sonst auch bestuende, wenn alle vier
   *  dasselbe Dokument zeigen. */
  titel: string;
  /** Stand laut Quelldokument, z. B. „15. Juli 2026". */
  stand: string;
  /** Herkunft: Dateiname des freigegebenen Quelldokuments. Ohne diese Angabe
   *  laesst sich spaeter nicht mehr pruefen, wogegen der Text abgeglichen
   *  wurde. */
  quelle: string;

  /**
   * Ist der Text fuer diese Plattform final?
   *
   * Ein eigenes Feld und nicht „hat `offenePunkte`", weil das Delta einen Fall
   * verlangt, in dem KEIN Hinweis erscheint — sonst kann das Szenario nie rot
   * werden. Genau das haben beide Plan-Reviewer beanstandet.
   */
  provisorisch: boolean;

  /**
   * Was an genau diesem Dokument noch offen ist.
   *
   * Bewusst je Dokument verschieden, nicht ein Einheitssatz: ein Kasten, der
   * ueberall dasselbe sagt, wird nach dem zweiten Mal nicht mehr gelesen.
   */
  offenePunkte: string[];

  abschnitte: Abschnitt[];
}
