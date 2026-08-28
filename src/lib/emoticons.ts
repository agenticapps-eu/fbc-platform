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
 *  fängt diese Fälle NICHT — bei beiden steht links der Textanfang.
 *
 *  `.` und `,` zählen nur, wenn KEINE Ziffer folgt. Das ist nachgetragen: die
 *  erste Fassung liess beide bedingungslos zu und machte damit aus
 *  `Budget <3.000 Euro` ein `Budget ❤️.000 Euro` — im Deutschen trennt der
 *  Punkt die Tausender und das Komma die Nachkommastellen, also kam
 *  ausgerechnet die Zahlenschreibweise durch dieselbe Tür, die `Toll :-).`
 *  offenhalten sollte. `<3000` war geprüft und geschützt, `<3.000` nicht. */
const RECHTS = `(?=$|[\\s!?;)\\]}"']|[.,](?![0-9]))`;

/** Rechts, aber enger — nur für `<3`.
 *
 *  `<3` ist der einzige Eintrag der Liste, der auch ein VERGLEICH sein kann.
 *  Von links ist das nicht zu entscheiden: vor `hab dich <3)` und vor
 *  `if (x <3)` steht beide Male Wort-plus-Leerzeichen. Die schliessenden
 *  Zeichen `)`, `]`, `}` und `;` fallen deshalb für `<3` weg.
 *
 *  Entschieden wurde das über die KOSTEN, nicht über die Häufigkeit: eine
 *  falsche Ersetzung steht dauerhaft in `messages.body` und ist nicht
 *  rücknehmbar — eine ausgebliebene kostet zwei Zeichen, die im Auswahlfeld
 *  danebenliegen. Der Preis ist ausgesprochen und getestet: `(hab dich <3)`
 *  bleibt stehen. */
const RECHTS_HERZ = `(?=$|[\\s!?"']|[.,](?![0-9]))`;

const HERZ = "<3";
const UEBRIGE = EMOTICONS.filter(([form]) => form !== HERZ);

const MUSTER = new RegExp(
  LINKS +
    "(?:(" +
    // Längste zuerst. In dieser Liste gibt es keine Form, die Präfix einer
    // anderen wäre (`:)` steckt nicht in `:-)`), die Sortierung ist also
    // Vorsorge für spätere Einträge, nicht Bedingung für die heutigen.
    [...UEBRIGE]
      .sort((a, b) => b[0].length - a[0].length)
      .map(([form]) => escapeRegExp(form))
      .join("|") +
    ")" +
    RECHTS +
    "|(" +
    escapeRegExp(HERZ) +
    ")" +
    RECHTS_HERZ +
    ")",
  // `i`, weil `:p` häufiger getippt wird als `:P`. Ohne das würde die Hälfte
  // der Eingaben umgewandelt und die andere nicht, ohne sichtbare Regel.
  "gi",
);

const NACH_FORM = new Map(EMOTICONS.map(([form, emoji]) => [form.toUpperCase(), emoji]));

export function ersetzeEmoticons(text: string): string {
  // Zwei Fanggruppen, weil zwei Zweige: genau einer trifft, der andere ist
  // `undefined`.
  return text.replace(MUSTER, (treffer, davor: string, uebrige?: string, herz?: string) => {
    const form = uebrige ?? herz;
    const emoji = form ? NACH_FORM.get(form.toUpperCase()) : undefined;
    return emoji ? davor + emoji : treffer;
  });
}
