/**
 * Prüft eine erzeugte Blog-Seite gegen eine ERLAUBNISLISTE (AGE-705, 2.4).
 *
 * Der erste Entwurf war eine Suche nach `<script>` und `supabase`. Die
 * Plan-Review hat das zu Recht verworfen: eine Verbotsliste benennt, woran
 * jemand gedacht hat, und übersieht `onclick=`, `javascript:` und den Verweis
 * auf eine fremde Schrift. Hier steht deshalb, was erlaubt ist; alles andere
 * rötet. Die Menge ist klein, weil die Seite klein ist.
 *
 * Gemessen wird am ARTEFAKT: der Aufrufer liest die geschriebene Datei. Ein
 * Wächter über den Eingaben belegt nicht, was ausgeliefert wurde.
 *
 * Geparst wird mit demselben Regelwerk wie im Browser — eine Zeichenkettensuche
 * sähe `<p onclick=…>` nicht als das, was daraus entsteht.
 *
 * `DOMParser` und nicht `jsdom` unmittelbar: derselbe Parser, aber aus
 * `lib.dom` getypt. `jsdom` bringt keine Typdeklarationen mit, und der Wächter
 * ist keine Zusage wert, für die eine weitere Abhängigkeit in den Baum kommt.
 * Er läuft damit dort, wo ein DOM existiert — im Test, wo er hingehört.
 */

const ELEMENTE = new Set([
  "html",
  "head",
  "meta",
  "title",
  "style",
  "body",
  "aside",
  "header",
  "main",
  "footer",
  "h1",
  "h2",
  "h3",
  "p",
  "a",
  "time",
  "nav",
  "article",
  "img",
]);

const ATTRIBUTE = new Set([
  "lang",
  "charset",
  "name",
  "content",
  "href",
  "datetime",
  "class",
  "src",
  "alt",
  "width",
  "height",
  "loading",
]);

/**
 * Attribute, deren Wert eine Adresse ist — und die deshalb DIESELBE
 * Ursprungsregel bekommen.
 *
 * Als Menge und nicht als zwei Zweige: `src` kam später dazu als `href`, und
 * ein zweiter Zweig daneben wäre die Stelle gewesen, an der beim dritten
 * Adressattribut einer vergessen wird.
 */
const ADRESSEN = new Set(["href", "src"]);

/**
 * Die einzigen absoluten Adressen, die der Blog führen darf.
 *
 * Die Regel darunter lautet „jede Adresse beginnt mit `/`" und schliesst damit
 * `javascript:` und jede fremde Herkunft mit EINEM Satz aus. Sie aufzuweichen
 * — etwa auf „`https:` ist erlaubt" — gäbe genau die Aufzählung von Schemata
 * und Hostnamen zurück, die sie vermeidet.
 *
 * Deshalb eine Liste **vollständiger** Adressen und kein Muster: ein Präfix wie
 * `https://app.effbeezee.com` würde auch auf
 * `https://app.effbeezee.com.beispiel.tld/` passen.
 *
 * Der Anlass ist der Verweis von den Blog-Seiten in die Anwendung (10.09.).
 */
const ERLAUBTE_FREMDZIELE = new Set(["https://app.effbeezee.com/"]);

/**
 * Die erste unerlaubte Stelle im Markup, oder `null`.
 *
 * Die Rückgabe benennt die Stelle, statt nur `false` zu sein: wer den Test rot
 * sieht, soll ohne Suchen wissen, welches Element oder Attribut gemeint ist.
 */
export function pruefeArtefakt(html: string): string | null {
  const dokument = new DOMParser().parseFromString(html, "text/html");
  for (const element of dokument.querySelectorAll("*")) {
    const name = element.tagName.toLowerCase();
    if (!ELEMENTE.has(name)) return `unerlaubtes Element <${name}>`;
    for (const attribut of element.attributes) {
      if (!ATTRIBUTE.has(attribut.name)) {
        return `unerlaubtes Attribut ${attribut.name} an <${name}>`;
      }
      // Eine Adresse nur mit `/`-Anfang: kein Schema, also weder `javascript:`
      // noch eine fremde Herkunft. Das schliesst beides mit EINER Regel aus,
      // statt Schemata und Hostnamen einzeln aufzuzählen — und es gilt für das
      // Bild genauso wie für den Verweis.
      if (
        ADRESSEN.has(attribut.name) &&
        !attribut.value.startsWith("/") &&
        !ERLAUBTE_FREMDZIELE.has(attribut.value)
      ) {
        return `${attribut.name} ohne eigenen Ursprung an <${name}>: ${attribut.value}`;
      }
    }
  }
  return null;
}
