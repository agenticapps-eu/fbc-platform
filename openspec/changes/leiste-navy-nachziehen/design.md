# Design — beide Leisten tragen dasselbe Dunkelblau

## Was gemessen wurde, bevor die erste Zeile geschrieben war

AGE-1002 hat die Nacharbeit als „Einzeiler in `--sidebar-surface`" angekündigt.
Diese Ankündigung war eine Vermutung, und sie ist zur Hälfte falsch. Vier
Messungen am gebauten Zustand, jede mit einem Ergebnis, das die Vermutung
korrigiert:

**1. Die Topbar ist nicht betroffen.** Vermutet war, sie hänge wie die Leiste am
Chrome und müsse mitwandern, sonst stünden zwei verschieden dunkle Flächen
nebeneinander, deren Trennlinien auf einer Höhe liegen. Gemessen:
`AppShell.tsx:1050` trägt `border-b border-line bg-canvas/85 backdrop-blur` —
eine **Inhalts**farbe. Die Topbar ist in beiden Modi hell und war es die ganze
Zeit.

**2. Die linke Navigation hängt nicht an `--color-chrome`.** Das behauptet die
Spec von AGE-1002 ausdrücklich („die linke Navigation hängt an `--color-chrome`,
und sie soll hier gerade nicht mitwandern"). Gemessen: in `AppShell.tsx` und
`SidebarNav.tsx` kommt `bg-chrome` **nicht vor**. Die Fläche kommt aus
`--sidebar-surface`. Die Behauptung hatte die Absicht der Entwurfsvorlage
(`docs/design-system.html`: „`--color-chrome` — Sidebar- und Topbar-Fläche")
übernommen, nicht den Code. Sie wird in der Spec berichtigt.

**3. Die Hover-Fläche ist keine Verschlechterung.** Vermutet war, `#0E1F38`
werde als Hover dunkler als die neue Leistenfläche und damit zum Problem.
Gerechnet: 1,11:1 auf `#081527`, 1,15:1 auf `#002B51`. Die Fläche hat sich schon
vorher praktisch nicht abgehoben; der sichtbare Hinweis ist die Schrift, die auf
Weiss wechselt. Marginal besser statt schlechter — es gibt hier nichts zu
beheben, nur etwas festzuhalten.

**4. Der Fokusring fällt durch, und das war nicht vermutet.** `ring-accent`
(`#2F6BD1`): 3,61:1 auf `#081527`, **2,83:1** auf `#002B51`. Die Norm verlangt
3:1 für Bedienelemente. Vier Elemente auf der Leistenfläche lesen diesen Ring.

Das ist derselbe Befund, den der Code-Review bei AGE-1002 auf der rechten Leiste
erhoben hat. Dass er hier zweimal auftritt, ist kein Zufall: wer eine Fläche von
sehr dunkel auf mittel-dunkel hebt, nimmt jedem Element darauf Kontrast weg, und
der Akzent hatte die geringste Reserve. Das ist die Regel, nicht die Ausnahme —
und genau deshalb steht sie jetzt zweimal in der Spec, mit Zahlen.

## Entscheidung 1 — nur `--sidebar-surface`, nicht `--color-chrome`

`--sidebar-surface` im navy-Block auf `#002B51`. Nichts weiter an den Flächen.

**Verworfen: `--color-chrome` mitziehen.** Es wäre der Griff, den die
Entwurfsvorlage nahelegt, und er färbt drei unbeteiligte Flächen mit: die
Vollflächen von `/onboarding` und `/willkommen` (beide `min-h-screen bg-chrome
text-on-chrome`), `Button variant="secondary"` überall in der App, und — als
`text-chrome` — die Ziffer auf jedem `bg-accent`-Zähler. Drei Regressionen für
null Gewinn, weil keine von ihnen die Leiste ist.

**Verworfen: `--color-chrome` innerhalb von `.fbc-sidebar-surface` umlegen**, so
wie AGE-1002 es in der Chatleiste getan hat. Dort war es nötig, weil der
sekundäre Knopf im Leerzustand **in** der Leiste steht und `bg-chrome` liest. Auf
der linken Leiste liest **kein** Element `bg-chrome` — gemessen. Eine Umlegung
wäre tote Konfiguration, und tote Konfiguration wird beim nächsten Lesen für
einen Beleg gehalten.

## Entscheidung 2 — ein eigener Fokus-Token für die linke Leiste

`--leiste-focus`: auf `:root` **genau** `#2F6BD1` — Zeichen für Zeichen der
heutige Wert von `--color-accent` —, im navy-Block `#B9CCE6`. Vier Stellen lesen
ihn statt `ring-accent`: die Wortmarke in `AppShell.tsx`, die Abschnittsmarken in
`SidebarNav.tsx`, der Feedback-Knopf in `FeedbackButton.tsx` und der
„leiste"-Zweig von `LeistenPill.tsx`.

Der gleiche Wert auf `:root` ist die ganze Zusage für den hellen Modus: er
bleibt nicht „ungefähr" gleich, sondern identisch, und das ist als Test prüfbar.

**Verworfen: `--color-accent` innerhalb von
`html[data-variant="navy"] .fbc-sidebar-surface` umlegen.** Das wäre ein
Einzeiler ohne Komponentenänderung und damit verlockend. Zwei Gründe dagegen,
beide gemessen: erstens liest `SidebarNav` innerhalb derselben Leiste
`bg-accent` für die Zähler — die Umlegung färbte sie mit, und zwar von `#2F6BD1`
auf eine Farbe, auf der die dunkle Ziffer `text-chrome` neu gerechnet werden
müsste. Zweitens ist `--color-accent` ein **Inhalts**token, und die Zusage von
AGE-492 lautet, dass `navy` nur den Rahmen färbt und kein Inhalts-Token
anfasst. Eine Ausnahme davon kostet mehr als vier Klassen.

**Verworfen: `--thread-focus` mitbenutzen.** Technisch wäre es weniger Code —
`LeistenPill` liest ihn heute für **beide** Seiten, der linke Zweig fiele also
ohne Änderung mit. Aber der Name sagt „Thread-Liste", und ein Token, dessen Name
etwas anderes behauptet als seine Verwendungsstellen, ist eine Falle für den
nächsten Leser. Die beiden Leisten tragen jetzt dieselbe Farbe; sie bleiben
trotzdem zwei Leisten.

**Verworfen: einen gemeinsamen Token für beide Leisten einführen** und
`--thread-focus` darauf umbiegen. Das ist die sauberste Form und zugleich die
teuerste: sie fasst die gerade gemergte Chatleiste an, bewegt ihre Spec-Tabelle
und ihren Test, und liefert dafür keine Verhaltensänderung. Als Aufräumarbeit
vormerken, nicht in diesem Change.

## Entscheidung 3 — die Aktivfläche bleibt, und die Begründung wird Spec

`--color-chrome-active` (`#1F53B0`) trägt gegen die neue Leiste **2,00:1**,
vorher 2,55:1. Beide liegen unter den 3:1 für Bedienelemente.

Die Fläche bleibt. Der Zustand ist durch drei Merkmale **über** der Schwelle
erkennbar, und keines davon hängt an der Füllung: weisse halbfette Schrift
(7,19:1 auf der Füllung selbst), der weisse Linksbalken im aufgeklappten
Zustand, das weisse Symbol im eingeklappten. Die Füllung ist Dekoration.

**Verworfen: die Aktivfläche aufhellen**, damit die Zahl über 3:1 kommt. Das
wäre eine dritte Farbänderung für ein Element, das sein Signal gar nicht über
die Fläche trägt — und sie veränderte das Erscheinungsbild der Navigation an
einer Stelle, die niemand beanstandet hat.

Was hier zählt, ist die **Begründung in der Spec**. Ohne sie steht beim nächsten
Griff an die Farben eine Zahl unter der Schwelle ohne Erklärung da, und dann
wird entweder blind „behoben" oder blind verteidigt.

## Entscheidung 4 — die Entwurfsvorlage bleibt unangetastet

`docs/design-system.html` und `docs/design-system.md` führen
`--sidebar-surface` navy als `#081527`. Nach diesem Change stimmt das nicht mehr.

Sie bleiben trotzdem, wie sie sind. Die Vorlage ist das **Eingangs**artefakt der
Entwurfsphase, nicht die laufende Wahrheit; die steht in
`openspec/specs/design-system/spec.md`. AGE-1002 ist von ihr schon abgewichen
(die Chatleiste kommt dort gar nicht vor) und hat die Abweichung in der Spec
festgehalten statt die Vorlage umzuschreiben. Dieser Change hält es genauso —
eine Vorlage, die man der Umsetzung nachzieht, ist keine Vorlage mehr.

`docs/technisches-handbuch.md` ist ein anderer Fall: das ist **unser** Handbuch,
und sein Satz „ausdrücklich nicht das `#081527` der linken Navigation" wird mit
diesem Change falsch. Er wird berichtigt.

## Kein ADR

Die vier Entscheidungen sind lokal und umkehrbar: eine Token-Zeile, vier
Klassen, zwei Dokumentationsstellen. Keine davon ist schwer zurückzudrehen, und
keine bindet eine künftige Entscheidung. Nach der Regel im Workflow — ADR nur
für **festgenagelte** Entscheidungen bei Medium und Large — gehören sie hierher
und nicht nach `docs/decisions/`.

## Keine Fremdreviewer für den Plan

Donalds Regel vom 26.08.: Fremdreviewer bei Schema, Rechten und Sicherheit;
reines UI direkt bauen. Dieser Change fasst keine Migration, keine Policy und
keinen Rechteweg an. Der Verzicht steht samt Begründung in `REVIEWS.md`, statt
stillschweigend zu passieren. Der **Code-Review auf dem Diff** findet statt — bei
AGE-1002 hat er vier zählende Befunde geliefert, davon einen kritischen, und die
Fläche hier ist dieselbe.
