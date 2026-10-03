# Beide Leisten tragen dasselbe Dunkelblau

Linear: **AGE-1003**

## Why

AGE-1002 hat der Nachrichtenleiste rechts im dunklen Modus `#002B51` gegeben und
dabei **eine Frage offen gelassen**: zieht die linke Navigation nach? Bis zur
Antwort unterschieden sich die beiden Leisten sichtbar — und weil das wie ein
Fehler aussieht, steht es in der Spec ausdrücklich als gewollt, „solange Frage E7
offen ist".

Donald hat die Frage am 03.10. beantwortet: **ja**. Damit ist die Anforderung,
die den Unterschied festschreibt, nicht mehr wahr, und eine Spec, die etwas
anderes behauptet als die Oberfläche, ist schlimmer als keine.

AGE-1002 hat die Nacharbeit als „Einzeiler in `--sidebar-surface`" angekündigt.
Das ist sie zur Hälfte. Die andere Hälfte ist gemessen worden, bevor diese Zeile
geschrieben wurde, und sie ist der Grund, dass hier ein Change steht und kein
Token-Tausch.

## What Changes

- Die linke Navigation ist im dunklen Modus dunkelblau (`#002B51`) — dieselbe
  Fläche wie die Nachrichtenleiste rechts. Die beiden Leisten rahmen die Seite
  damit in einer Farbe statt in zwei.
- Das gilt aufgeklappt wie eingeklappt und auch für die Navigationsschublade auf
  dem Telefon.
- Alles darin bleibt lesbar: Menüeinträge, Abschnittsmarken, der aktive
  Eintrag, die Wortmarke und der Zähler offener Anfragen. Die Kontraste sind
  ausgerechnet und liegen über dem, was die Barrierefreiheits-Norm verlangt.
- Die Tastaturbedienung bleibt sichtbar: der Rahmen, der ein Bedienelement als
  „jetzt am Zug" markiert, wird auf der neuen Fläche angepasst, statt in ihr zu
  verschwinden.
- Im hellen Modus ändert sich **nichts**.

Im Einzelnen:

**Der Einzeiler.** `--sidebar-surface` im Block `html[data-variant="navy"]` von
`#081527` auf `#002B51`. `.fbc-sidebar-surface` trägt den Token und sitzt auf dem
`aside`, auf der Schublade und auf dem Einklapp-Pill — alle drei wandern damit
mit, ohne dass eine vierte Stelle angefasst wird.

**Der Befund, der daneben steht: der Fokusring fällt durch.** `ring-accent`
(`#2F6BD1`) trägt auf `#081527` 3,61:1 und auf `#002B51` nur noch **2,83:1** —
unter den 3:1, die die Norm für Bedienelemente verlangt. Betroffen sind vier
Stellen auf der Leistenfläche: die Wortmarke, die aufklappbaren Abschnittsmarken
in `SidebarNav`, der Feedback-Knopf und der Einklapp-Pill. Das ist derselbe
Befund, den der Code-Review bei AGE-1002 auf der rechten Leiste erhoben hat, nur
eine Leiste weiter links — und er wäre mit dem angekündigten Einzeiler
stillschweigend mitgeliefert worden.

Deshalb bekommt die linke Leiste einen eigenen Fokus-Token: auf `:root` **genau**
den heutigen Wert `#2F6BD1`, im navy-Block `#B9CCE6` (8,77:1). Der Token wird
ausschliesslich von Elementen der linken Leiste gelesen; eine Definition auf
`html[data-variant="navy"]` kann damit nirgends durchschlagen.

**Und derselbe Befund ein zweites Mal, gefunden erst vom Code-Review.** Der
Zähler offener Anfragen las `bg-accent` — dieselbe Farbe, dieselbe Fläche,
dieselbe Zahl: von 3,61:1 auf **2,83:1**. Die erste Fassung dieses Changes hat
ihn übersehen, obwohl `design.md` die Stelle namentlich nennt, um damit eine
Alternative zu verwerfen. Benannt, benutzt, nicht gemessen.

Er bekommt deshalb ebenfalls eigene Tokens, und die Werte sind nicht neu
erfunden: es sind die, die AGE-1002 für **dasselbe Element auf derselben
Fläche** gerechnet hat (`#5B90E0` mit `#00172B`, 4,45:1 und 5,62:1). Beide
Leisten tragen jetzt dieselbe Fläche, also auch dasselbe Abzeichen.

**Was gemessen wurde und sich als unbedenklich erwiesen hat.** Drei Dinge, die
nach dem Farbwechsel verdächtig aussehen und es nicht sind:

| Element                 | Farbe     | auf `#081527` | auf `#002B51` |
| ----------------------- | --------- | ------------- | ------------- |
| inaktiver Eintrag       | `#9FB4D2` | 8,66:1        | 6,78:1 ✓      |
| Abschnittsmarke         | `#8FA5C4` | 7,28:1        | 5,70:1 ✓      |
| aktiv, Wortmarke, Hover | `#FFFFFF` | 18,31:1       | 14,34:1 ✓     |
| Punkte der Wortmarke    | `#5B90E0` | 5,68:1        | 4,45:1 ✓      |
| Hover-Fläche            | `#0E1F38` | 1,11:1        | 1,15:1        |
| Aktivfläche             | `#1F53B0` | 2,55:1        | 2,00:1        |

Die **Hover-Fläche** hebt sich schon heute mit 1,11:1 praktisch nicht ab; der
sichtbare Hinweis ist die Schrift, die auf Weiss wechselt (16,51:1 auf der
Hover-Fläche). Auf `#002B51` wird daraus 1,15:1 — marginal besser, keine
Verschlechterung.

Die **Aktivfläche** hielt die 3:1 noch nie. Der Zustand ist durch weitere
Merkmale erkennbar — aber **nicht durch dieselben in beiden Zuständen**, und
die erste Fassung dieses Absatzes hat das verschwiegen:

**Aufgeklappt** sind es die weisse halbfette Schrift (7,19:1 auf der Füllung)
und der weisse Linksbalken.

**Eingeklappt gibt es beide nicht.** Der Balken hängt an
`isActive && !collapsed`, die Beschriftung an `!collapsed`. Übrig bleiben die
**Farbe** des Symbols (`#FFFFFF` statt `#9FB4D2`, 14,34:1 statt 6,78:1 gegen die
Leiste) und seine **Form** — `NavIcon` schaltet von `line` auf `solid`. Form und
Farbe zusammen, nicht Farbe allein: genau das verlangt die bestehende
Anforderung „Farbe trägt nie allein eine Bedeutung".

Die Füllung ist in beiden Fällen Dekoration, nicht das Signal — und das gehört
in die Spec, sonst wird beim nächsten Griff an die Farben eine Zahl verteidigt,
die nie gegolten hat. Beide Zustände sind jetzt als **Render**-Zusage geprüft;
die erste Fassung hat es mit einer Textsuche über die Quelldatei „belegt", und
die konnte die Bedingung `!collapsed` gar nicht sehen.

**`--color-chrome` bleibt `#081527`, und das ist eine Entscheidung.** Der Token
färbt nicht die Leiste. Er färbt die Vollflächen von `/onboarding` und
`/willkommen` (`min-h-screen bg-chrome`), `Button variant="secondary"` und — als
`text-chrome` — die Ziffer auf den `bg-accent`-Zählern. Ihn mitzuziehen hiesse,
drei unbeteiligte Flächen mitzufärben. Die Topbar ist `bg-canvas/85`, eine
Inhaltsfarbe, und in beiden Modi hell; sie ist nicht betroffen.

## Capabilities

### New Capabilities

Keine.

### Modified Capabilities

- `design-system`: Die Anforderung, dass die Nachrichtenleiste `#002B51` trägt
  und `SHALL NOT` das `#081527` der linken Navigation sein darf, wird zur
  Anforderung, dass **beide** angedockten Leisten dieselbe Fläche tragen. Dazu
  eine Anforderung für die Lesbarkeit auf der linken Leiste, mit den gerechneten
  Verhältnissen und der Begründung für die beiden Flächen, die die 3:1 nicht
  halten.

## Impact

- `src/index.css` — `--sidebar-surface` im navy-Block; der neue Fokus-Token in
  beiden Blöcken.
- `src/components/AppShell.tsx`, `src/components/ui/SidebarNav.tsx`,
  `src/components/feedback/FeedbackButton.tsx`,
  `src/components/LeistenPill.tsx` — je eine Klasse: der Fokusring liest den
  Token statt `ring-accent`. Dazu in `SidebarNav.tsx` der Zähler, der statt
  `bg-accent text-chrome` die beiden Abzeichen-Tokens liest.
- `src/components/ui/SidebarNav.active.test.tsx` — die Render-Zusage, woran der
  aktive Eintrag erkennbar ist, aufgeklappt und eingeklappt getrennt.
- `scripts/app-icons.logic.ts` und `src/pages/StyleguidePage.tsx` — zwei
  Kommentare bzw. Beschriftungen, die `--color-chrome` „Sidebar-Fläche" nennen.
  Die Styleguide-Seite wird ausgeliefert, der Satz steht also nicht nur im
  Quelltext.
- `src/index.chatleiste-tokens.test.ts` — die Zusage, dass `--sidebar-surface`
  `#081527` ist, dreht sich um und kommt um die Kontraste der linken Leiste
  erweitert zurück.
- `docs/technisches-handbuch.md` — der Satz, die Leiste sei „ausdrücklich nicht
  das `#081527` der linken Navigation", ist nicht mehr wahr.
- Keine Migration, kein `drift-gate`, kein `migrate-prod`.

## Was NICHT Teil dieses Changes ist

> Diese Liste gehört nicht zum Lieferumfang. Sie steht hier, damit die Grenze
> des Changes benannt ist und nicht beim nächsten Lesen neu verhandelt wird.

- `--color-chrome` und damit `/onboarding`, `/willkommen` und
  `Button variant="secondary"` — begründet oben.
- Die Topbar. Sie ist eine Inhaltsfläche und in beiden Modi hell.
- Die Trennlinien (`--color-chrome-border`, Weiss zu 8 %). Sie tragen 1,26:1
  gegen die neue Fläche, vorher 1,23:1 — also minimal **besser**. Eine Haarlinie
  zwischen zwei Abschnitten ist weder Bedienelement noch bedeutungstragende
  Grafik; die 3:1 gelten für sie nicht. Als benannte Entscheidung geprüft, mit
  einer unteren Grenze, damit sie nicht unsichtbar wird.
- Ein sichtbarer Fokusring für die Menüeinträge selbst. Sie tragen heute keinen
  und verlassen sich auf den Standardumriss des Browsers; das ist unverändert
  und gehört in einen eigenen Vorgang.
- `docs/design-system.html` und `docs/design-system.md` — die Vorlage aus der
  Entwurfsphase. AGE-1002 hat bereits von ihr abgewichen und die Abweichung in
  der Spec festgehalten statt die Vorlage umzuschreiben; dieser Change hält es
  genauso.
