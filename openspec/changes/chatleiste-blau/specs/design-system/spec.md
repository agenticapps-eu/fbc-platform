
## ADDED Requirements

### Requirement: Die Nachrichtenleiste trägt im dunklen Modus eine eigene dunkle Fläche

Das System SHALL der angedockten Nachrichtenleiste rechts im Modus `navy` die
Fläche **`#002B51`** geben — ein- und ausgeklappt dieselbe. Die Farbe ist keine
Wahl: sie ist auf dkrealinvest.com gemessen (Elementor-`post-12.css`,
Fussbereich) und von Detlev im Meeting am 03.10.2026 benannt. Sie SHALL NOT das
`#081527` der linken Navigation sein; dass die beiden Leisten sich dadurch
unterscheiden, ist ausdrücklich gewollt, solange Frage E7 offen ist.

Im Modus `hell` SHALL die Leiste **unverändert** weiss bleiben — SPEC 12 verlangt
„dieselbe Grundwirkung wie die linke Navigation", und die ist dort weiss.

**Und zwar Wert für Wert**, nicht nur dem Eindruck nach: jeder Rückfall SHALL
genau der Wert sein, den die betroffene Fläche vorher trug. Das betrifft
besonders die Elemente, die vorher **Chrome**-Farben trugen und nicht
Inhaltsfarben — das Symbol im eingeklappten Rail und der Einklapp-Pill
(`#475569`, Hover `#1F53B0`). Sie SHALL eigene Tokens führen und SHALL NOT auf
den Vorschautext-Token fallen, der `#626F85` ist und im hellen Modus sichtbar
anders aussähe.

Die Fläche SHALL über **einen** Token `--chat-rail-surface` gesetzt werden, nicht
über `--color-chrome`: die linke Navigation hängt an `--color-chrome`, und sie
soll hier gerade nicht mitwandern.

Die Zusage, dass `navy` **nur den Rahmen** färbt und kein Nachtmodus für Inhalte
ist (AGE-492), SHALL unberührt bleiben. Die Chat-Fenster und die Seite `/chat`
SHALL in beiden Modi hell bleiben.

#### Scenario: Ausgeklappt im dunklen Modus

- **WHEN** ein angemeldetes Mitglied im Modus `navy` die Nachrichtenleiste
  ausklappt
- **THEN** ist ihre Fläche `#002B51` und nicht weiss

#### Scenario: Eingeklappt dieselbe Fläche

- **WHEN** dasselbe Mitglied sie einklappt
- **THEN** bleibt die Fläche `#002B51` — und ist damit NICHT das `#081527` der
  linken Navigation

#### Scenario: Im hellen Modus ändert sich nichts

- **WHEN** ein Mitglied im Modus `hell` die Leiste in beiden Zuständen ansieht
- **THEN** ist sie weiss, wie die linke Navigation dort

#### Scenario: Auch die Schrift im hellen Modus ist unverändert

- **WHEN** die Rückfallwerte der Leisten-Tokens geprüft werden
- **THEN** trägt jeder genau den Wert, den die betroffene Fläche vor der
  Änderung hatte — einschliesslich des Symbols im eingeklappten Rail und des
  Pills, die Chrome-Farben trugen und keine Inhaltsfarben

#### Scenario: Der Fokus ist auf der Leiste sichtbar

- **WHEN** ein Mitglied den Einklapp-Pill oder eine Zeile der Thread-Liste im
  Modus `navy` mit der Tastatur erreicht
- **THEN** hebt sich der Ring mit mindestens 3:1 von der Fläche ab

#### Scenario: Die Chat-Fenster bleiben hell

- **WHEN** ein Mitglied im Modus `navy` ein Gesprächsfenster öffnet
- **THEN** ist dessen Fläche hell, nicht `#002B51`

### Requirement: Alles in der Nachrichtenleiste bleibt auf ihrer Fläche lesbar

Jedes Element in der Leiste SHALL die Kontrastschwellen der
Barrierefreiheits-Norm erfüllen: **4,5:1** für Fliesstext, **3:1** für
Bedienelemente und bedeutungstragende Grafik. Das gilt auf **allen drei**
Flächen, die in der Leiste vorkommen — Grundfläche, Zeile unter dem Mauszeiger
und aktive Zeile.

Die Farben SHALL als **Tokens der Leiste** geführt werden
(`--thread-ink`, `--thread-muted`, `--thread-hover`, `--thread-active`,
`--thread-line`, `--thread-badge`, `--thread-badge-ink`), die auf `:root` auf die
Inhaltsfarben zurückfallen und **ausschliesslich innerhalb der Leiste**
überschrieben werden. `ThreadList` SHALL deshalb **keinen** Variantenschalter
tragen und SHALL NOT in zwei Fassungen existieren: dieselbe Komponente steht auf
`/chat` auf heller Fläche und in der Leiste auf dunkler, und welche gilt,
entscheidet der Ort, nicht ein Argument.

Die Werte für `navy` und die gerechneten Verhältnisse SHALL festgehalten sein:

| Element | Farbe | auf Fläche | auf Hover | auf aktiver Zeile |
|---|---|---|---|---|
| Name, Kopfzeile | `#FFFFFF` | 14,3:1 | 12,1:1 | 10,1:1 |
| Vorschautext, Zeitstempel | `#B9CCE6` | 8,8:1 | 7,4:1 | 6,2:1 |
| Ungelesen-Abzeichen (Fläche) | `#5B90E0` | 4,4:1 | 3,8:1 | 3,1:1 |
| Ziffer auf dem Abzeichen | `#00172B` | 5,6:1 auf dem Abzeichen | — | — |

Hover SHALL `rgb(255 255 255 / 0.06)` sein, die aktive Zeile
`rgb(255 255 255 / 0.12)`, die Trennlinie `rgb(255 255 255 / 0.16)`.

**Der Leerzustand gehört dazu, und er ist der Normalfall.** „Noch kein
Gespräch … Mitglieder entdecken" sieht jedes neue Mitglied, und sein sekundärer
Knopf trägt `bg-chrome text-on-chrome`. Im dunklen Modus ist Chrome `#081527`
und hebt sich von `#002B51` mit **1,3:1** ab — praktisch nicht.

Die Tokens dieses Knopfes SHALL deshalb **innerhalb der Leiste** umgelegt
werden, und zwar **alle fünf, die er liest**: `--color-chrome` (`#D7E4F2`,
11,1:1 gegen die Fläche), `--color-on-chrome` (`#0C2043`, 12,5:1 darauf),
`--color-chrome-elevated` (der Zustand unter dem Zeiger, `#C3D6EC`),
`--color-chrome-border` und `--color-soft` (der Versatz des Fokusrings, der auf
die Fläche **dahinter** gehört, also auf die Leiste).

**Die Teilmenge ist der Fehler, vor dem diese Aufzählung warnt.** Eine Umlegung
nur der ersten beiden verschiebt den Defekt in den Hover-Zustand: die Schrift
`#0C2043` stünde dann auf dem unveränderten `#0E1F38` und wäre mit **1,0:1**
weg. Ebenso SHALL die Zusage nicht auf **einen** Knopf lauten — neben dem
Leerzustand steht „Weitere Gespräche", sobald die Liste blättert.

Diese Umlegung SHALL auf die Leiste beschränkt bleiben und SHALL NOT auf
`html[data-variant="navy"]` stehen.

**Der Fokusring SHALL die Schwelle für Bedienelemente halten.** Der
Einklapp-Pill ist der einzige Weg, die Leiste wieder einzuklappen; `ring-accent`
(`#2F6BD1`) trägt auf `#002B51` nur **2,8:1** und wäre damit schlechter als vor
dieser Änderung (3,6:1 auf dem Chrome-Rail, 5,1:1 auf Weiss). Die Leiste SHALL
einen eigenen Fokus-Token führen (`#B9CCE6`, mindestens 3:1 auf allen drei
Flächen), und die Zeilen der Thread-Liste SHALL ihn ebenfalls tragen — sie
hatten vorher **gar keinen** sichtbaren Fokus und verliessen sich auf den
Standardumriss des Browsers.

**Was bewusst NICHT umgelegt wird:** der Avatar in der Thread-Zeile
(`bg-accent-soft` mit `text-accent-strong`). Gerechnet: die Initialen stehen mit
**6,5:1** auf der Scheibe, und die Scheibe hebt sich deutlich von der Leiste ab.
Eine Umlegung wäre eine dritte Keule für ein Element, das die Schwelle hält.

**Warum die Werte und nicht nur die Schwelle hier stehen:** die drei Flächen
unterscheiden sich um wenige Prozent, und die naheliegende Wahl fällt durch. Eine
gefüllte Aktivfläche in der Akzentfarbe der Navigation (`#1F53B0`) trägt den
Vorschautext nur noch mit **2,9:1**; erst eine aufgehellte Grundfläche und ein
helleres Grau für den Vorschautext halten alle drei Fälle. Das ist gerechnet
worden, nicht geschätzt, und ohne die Tabelle wäre es beim nächsten Griff an die
Farben wieder offen.

#### Scenario: Der Name ist auf allen drei Flächen lesbar

- **WHEN** ein Gesprächspartner in der Leiste im Modus `navy` erscheint — normal,
  unter dem Mauszeiger und als aktiver Thread
- **THEN** erfüllt sein Name in allen drei Fällen mindestens 4,5:1

#### Scenario: Der Vorschautext ebenso

- **WHEN** derselbe Thread seinen Vorschautext zeigt
- **THEN** erfüllt er in allen drei Fällen mindestens 4,5:1

#### Scenario: Das Ungelesen-Abzeichen hebt sich ab und ist lesbar

- **WHEN** ein Thread ungelesene Nachrichten hat
- **THEN** hebt sich das Abzeichen mit mindestens 3:1 von der Fläche ab, und
  seine Ziffer erfüllt auf dem Abzeichen mindestens 4,5:1

#### Scenario: Der Leerzustand ist bedienbar

- **WHEN** ein Mitglied ohne Gespräche die Leiste im Modus `navy` ausklappt
- **THEN** ist der Hinweistext lesbar, und der Knopf „Mitglieder entdecken"
  hebt sich mit mindestens 3:1 von der Fläche ab, mit mindestens 4,5:1 für
  seine Schrift

#### Scenario: Auf `/chat` gilt weiter die helle Fassung

- **WHEN** dieselbe Thread-Liste auf der Seite `/chat` erscheint
- **THEN** trägt sie die Inhaltsfarben und nicht die der Leiste — in beiden Modi

## MODIFIED Requirements

### Requirement: Beide angedockten Leisten klappen über dasselbe Bedienelement ein

Das System SHALL für das Ein- und Ausklappen **beider** angedockter Leisten
**ein** Bedienelement führen: einen halben Pill am inneren Rand der Leiste, der
über deren Kante hinausragt und an der zweiten Leiste gespiegelt steht.

Der Pill SHALL an beiden Leisten **an derselben Stelle** sitzen: oben, auf Höhe
der Kopfzeile. Zwei Leisten, die gespiegelt gebaut sind und ihren Schalter an
verschiedenen Enden tragen, lesen sich als zwei verschiedene Dinge.

Der Pill SHALL **dauerhaft sichtbar** sein und SHALL NOT erst bei Mauskontakt
erscheinen. Ein Schalter, der Mauskontakt voraussetzt, ist auf Geräten ohne
Zeiger nicht erreichbar und verlangte dort ein zweites Verhalten.

Der Pill SHALL ein echtes `button`-Element sein, SHALL einen Namen tragen, der
die **Handlung** und die betroffene Leiste nennt („Navigation einklappen"), und
SHALL `aria-expanded` führen sowie, wo umsetzbar, die Leiste über `aria-controls`
benennen. Ein Name, der nur einen Zustand nennt („Navigation offen"), sagt nicht,
was ein Auslösen bewirkt.

Die Richtung seines Pfeils SHALL von **beiden** Achsen abhängen — Seite und
Zustand —, also vier Fälle abdecken. Am linken Rand zeigt er offen nach links
und eingeklappt nach rechts; rechts gespiegelt.

Der Pill SHALL die **Fläche und Schriftfarbe seiner Leiste** tragen und SHALL
NOT einen eigenen Rahmen führen. Er ist eine **Ausbuchtung der Leiste**, kein
Bedienelement, das darauf liegt — und eine Wölbung hat die Farbe dessen, was
sich wölbt. Wechselt eine Leiste ihre Fläche, SHALL der Pill mitwechseln.

**Berichtigt mit AGE-1002: die rechte Leiste wechselt ihre Fläche nicht mehr.**
Der eingeklammerte Einschub „die rechte tut das beim Aufklappen" beschrieb einen
Zustand, der mit diesem Change entfällt — sie trägt ein- und ausgeklappt
dieselbe Fläche. Die Regel selbst bleibt und ist nicht leer geworden: sie gilt
weiter für jede Leiste, die ihre Fläche wechselt, und sie ist der Grund, warum
der Pill der rechten Leiste nach dem Change in **beiden** Zuständen dunkelblau
ist statt in einem navy und im anderen weiss.

Abgehoben SHALL er über einen **Schatten** werden, nicht über einen Rand. Das
ist keine reine Geschmacksfrage: im hellen Theme sind Leiste und Kopf beide
weiss, und eine gleichfarbige Wölbung ohne Schatten wäre dort unsichtbar.

Das „gleiche Bedienelement an beiden Leisten" SHALL als **dieselbe Geste**
verstanden werden, nicht als dieselbe Farbe: an beiden wölbt sich die Leiste,
an derselben Stelle, in ihre eigene Richtung.

Die Zusage, dass eine angedockte Leiste **nicht gerundet und nicht schwebend**
ist, SHALL unberührt bleiben und SHALL sich weiterhin auf die **Fläche** der
Leiste beziehen: bündig am Rand, volle Höhe, ungerundet. Der Pill ist ihr
Bedienelement, nicht ihre Kante.

Die eingeklappte rechte Leiste SHALL Ungelesenes weiterhin **melden**, und diese
Meldung SHALL NOT ein zweiter Schalter zum Ausklappen sein. In einem Rail von
4,5 rem Breite stünden Melder und Pill in derselben Kopfzeile, keine 40 px
auseinander und mit derselben Wirkung — zwei Bedienelemente, die dasselbe tun,
sind an dieser Stelle keine Erleichterung, sondern eine Mehrdeutigkeit.

Der alte Einklapp-Knopf im Kopf der rechten Leiste SHALL entfallen. Er neben dem
Pill stehen zu lassen, verfehlte den Zweck dieser Anforderung vollständig.

Das Ein- und Ausklappen SHALL sich sonst nicht ändern: getrennte Zustände je
Leiste, beide überdauern das Neuladen, und das Einklappen der einen SHALL NOT
die andere mitnehmen.

#### Scenario: Beide Leisten tragen denselben Schalter an derselben Stelle

- **WHEN** ein angemeldetes Mitglied den Rahmen auf einem breiten Schirm sieht
- **THEN** trägt jede angedockte Leiste oben an ihrem inneren Rand einen halben
  Pill, der über die Kante hinausragt — an der rechten gespiegelt

#### Scenario: Der Pill klappt ein und aus

- **WHEN** ein Mitglied den Pill einer Leiste auslöst
- **THEN** wechselt genau diese Leiste zwischen offen und Rail, und die andere
  bleibt, wie sie war

#### Scenario: Der Pill steht auch ohne Mauskontakt da

- **WHEN** der Zeiger die Leiste nicht berührt
- **THEN** ist der Pill trotzdem sichtbar und auslösbar

#### Scenario: Es gibt links keine zweite Einklapp-Fläche mehr

- **WHEN** ein Mitglied die Navigationsleiste ansieht
- **THEN** trägt sie **keine** untere Einklapp-Zeile mehr; der Feedback-Zugang
  an ihrem unteren Rand bleibt bestehen

#### Scenario: Der eingeklappte rechte Rail meldet, ohne zu schalten

- **WHEN** ein Mitglied die eingeklappte rechte Leiste mit ungelesenen
  Nachrichten sieht
- **THEN** ist die Zahl ablesbar und angesagt, und der einzige Schalter zum
  Ausklappen ist der Pill

#### Scenario: Der alte Knopf im Kopf der rechten Leiste ist weg

- **WHEN** ein Mitglied die aufgeklappte rechte Leiste ansieht
- **THEN** trägt ihre Kopfzeile keinen eigenen Einklapp-Knopf mehr

#### Scenario: Der Pfeil zeigt in allen vier Fällen richtig

- **WHEN** eine Leiste offen oder eingeklappt ist, links oder rechts
- **THEN** zeigt der Pfeil des Pills in die Richtung, in die das Auslösen die
  Leiste bewegt

#### Scenario: Die rechte Leiste wechselt ihre Fläche nicht mehr

- **WHEN** ein Mitglied die rechte Leiste im dunklen Modus ein- und ausklappt
- **THEN** trägt sie in beiden Zuständen dieselbe Fläche, und der Pill ebenfalls
