/** Ersetzt getippte Emoticons durch Emoji — beim SENDEN, nicht beim Anzeigen
 *  (AGE-645). Das Ergebnis landet endgültig in `messages.body`; es gilt damit
 *  nicht rückwirkend für alte Nachrichten und ist nicht rücknehmbar. Beides ist
 *  bewusst so entschieden.
 *
 *  Die Liste ist ABSICHTLICH klein. `emojibase-data` liefert eine kanonische
 *  mit 49 Zuordnungen, und sie ist zweimal unbrauchbar: sie kennt keine
 *  Nasenvariante (`:-)` fehlt, obwohl genau die bestellt war), und rund ein
 *  Dutzend ihrer Einträge ginge in gewöhnlichem Text los — `:/` in jeder URL,
 *  `:@` in jeder E-Mail-Andeutung, dazu `:B` `:E` `:j` `:3` `:#` `%(` `D:`.
 *  Erweitern ist möglich; jede Erweiterung zahlt aber wieder dieses Risiko.
 */
const EMOTICONS: ReadonlyArray<readonly [string, string]> = [
  [":-)", "🙂"],
  [":)", "🙂"],
  [":-(", "🙁"],
  [":(", "🙁"],
  [";-)", "😉"],
  [";)", "😉"],
  [":-D", "😄"],
  [":D", "😄"],
  [":-P", "😛"],
  [":P", "😛"],
  [":-O", "😮"],
  [":O", "😮"],
  ["<3", "❤️"],
];

function escapeRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Links: Textanfang, Leerraum, oder ein öffnendes Zeichen.
 *
 *  Sie ist die einzige, die `http://x.de/a:-).` rettet: dort erfüllt der Punkt
 *  die rechte Grenze, und nur das `a` davor verhindert den Treffer. Die
 *  Gegenprobe belegt es — streicht man diese Zeile, fällt genau dieser Test.
 *
 *  Die erste Fassung dieses Kommentars behauptete, sie rette URLs überhaupt.
 *  Das stimmt nicht: `…/a:-)b` hält die RECHTE Grenze, weil dort ein `b` folgt.
 *  Beide Grenzen arbeiten, jede an anderen Fällen.
 *
 *  Als Fanggruppe geschrieben, nicht als Lookbehind: Lookbehind gibt es in
 *  Safari erst ab 16.4, und ein Emoticon ist keinen Ausschluss alter Telefone
 *  wert. Die Gruppe wird beim Ersetzen unverändert wieder eingesetzt. */
const LINKS = `(^|[\\s([{"'])`;

/** Rechts: Textende, Leerraum, oder Satzzeichen.
 *
 *  Satzzeichen gehören dazu, weil `Toll :-).` der häufigste echte Fall ist und
 *  nicht der Ausnahmefall — eine Grenze aus reinem Leerraum liesse die Funktion
 *  genau dort aussetzen, wo sie am natürlichsten benutzt wird. Als Vorschau
 *  geschrieben, damit ein folgendes Satzzeichen nicht mitverbraucht wird und
 *  zwei aufeinanderfolgende Emoticons sich nicht gegenseitig auffressen.
 *
 *  Woran sie wirklich hängt, zeigt die Gegenprobe: ohne sie wird aus
 *  `<3000 Euro` ein `❤️000 Euro`, und aus `:-)x` ein `🙂x`. Die linke Grenze
 *  fängt diese Fälle NICHT — bei beiden steht links der Textanfang. */
const RECHTS = `(?=$|[\\s.,!?;)\\]}"'])`;

const MUSTER = new RegExp(
  LINKS +
    "(" +
    // Längste zuerst. In dieser Liste gibt es keine Form, die Präfix einer
    // anderen wäre (`:)` steckt nicht in `:-)`), die Sortierung ist also
    // Vorsorge für spätere Einträge, nicht Bedingung für die heutigen.
    [...EMOTICONS]
      .sort((a, b) => b[0].length - a[0].length)
      .map(([form]) => escapeRegExp(form))
      .join("|") +
    ")" +
    RECHTS,
  // `i`, weil `:p` häufiger getippt wird als `:P`. Ohne das würde die Hälfte
  // der Eingaben umgewandelt und die andere nicht, ohne sichtbare Regel.
  "gi",
);

const NACH_FORM = new Map(EMOTICONS.map(([form, emoji]) => [form.toUpperCase(), emoji]));

export function ersetzeEmoticons(text: string): string {
  return text.replace(MUSTER, (_treffer, davor: string, form: string) => {
    const emoji = NACH_FORM.get(form.toUpperCase());
    return emoji ? davor + emoji : _treffer;
  });
}
