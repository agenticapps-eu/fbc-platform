/** Suche im Emoji-Datensatz (AGE-645).
 *
 *  Bewusst OHNE Import aus `src/content/emoji.generated.ts`: dieses Modul soll
 *  ohne den 156-kB-Datensatz prüfbar sein, und ein statischer Import von dort
 *  zöge ihn ins Startbündel. Die Form ist strukturell dieselbe.
 */
export type EmojiEintrag = readonly [
  emoji: string,
  name: string,
  suchbegriffe: string,
  gruppe: number,
];

/** Faltet Schreibweise und Umlaute auf eine gemeinsame Form.
 *
 *  Zwei Schritte, und der zweite ist der, den man leicht vergisst: erst
 *  `ä→a`/`ö→o`/`ü→u`/`ß→ss`, DANN `ae→a`/`oe→o`/`ue→u`/`ss→s`. Nur so fallen
 *  „grün", „GRUN" und „gruen" auf dieselbe Form — mit der Umlautfaltung allein
 *  bliebe „gruen" aussen vor, und genau das verspricht die Spec nicht.
 *
 *  Der Preis ist offen benannt: „Feuer" wird zu „fer". Das ist kein Fehler,
 *  solange BEIDE Seiten des Vergleichs dieselbe Behandlung erfahren — was sie
 *  hier tun. Es macht die Suche grosszügiger, nicht falsch. */
export function normalisiere(text: string): string {
  return text
    .toLowerCase()
    .replaceAll("ä", "a")
    .replaceAll("ö", "o")
    .replaceAll("ü", "u")
    .replaceAll("ß", "ss")
    .replaceAll("ae", "a")
    .replaceAll("oe", "o")
    .replaceAll("ue", "u")
    .replaceAll("ss", "s");
}

/** Teilzeichenfolgen-Vergleich über Namen und Suchbegriffe.
 *
 *  Ein linearer Durchlauf über knapp 1900 Einträge je Tastendruck; das ist
 *  unmessbar teuer und braucht keinen Index. Sollte sich das im Browser anders
 *  zeigen, ist es ein Befund und kein Plan. */
export function filtereEmoji(eintraege: readonly EmojiEintrag[], suche: string): EmojiEintrag[] {
  const begriff = normalisiere(suche.trim());
  if (!begriff) return [...eintraege];
  return eintraege.filter(
    ([, name, suchbegriffe]) =>
      normalisiere(name).includes(begriff) || normalisiere(suchbegriffe).includes(begriff),
  );
}
