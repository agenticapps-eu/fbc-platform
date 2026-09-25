/**
 * Die Abstände EINES Eintrags in der Seitenleiste — Polsterung und
 * Symbolabstand (AGE-929).
 *
 * Steht in einer eigenen Datei und nicht zweimal im Baum: `SidebarNav` zeichnet
 * die Einträge mit Pfad, `FeedbackButton` zeichnet den einen Eintrag mit
 * Aktion. Bis AGE-929 trug der zweite eigene Werte — `gap-2` statt `gap-3`,
 * eingeklappt `py-2` statt `py-2.5`. Das sah man: 4 px Symbolabstand in der
 * zweiten Zeile eines dreizeiligen Abschnitts, ohne benennen zu können, woran
 * es liegt.
 *
 * „Wie ein Eintrag der Leiste sitzt" ist EINE Tatsache. Sie an zwei Stellen zu
 * schreiben und durch einen Test zu koppeln, hiesse den Test zum Eigentümer
 * einer Tatsache zu machen, die keinen hat.
 *
 * Eine eigene Datei und nicht ein Export aus `SidebarNav.tsx`, weil
 * `react-refresh/only-export-components` genau das anmahnt: eine Datei, die
 * neben Komponenten auch Funktionen ausführt, verliert Fast Refresh. Der
 * Linter benennt den Ausweg wörtlich.
 *
 * Eingeklappt KEIN `gap`: dort steht das Symbol allein, es gibt nichts, wovon
 * es Abstand halten könnte.
 */
export function navEintragAbstaende(collapsed: boolean): string {
  return collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2";
}
