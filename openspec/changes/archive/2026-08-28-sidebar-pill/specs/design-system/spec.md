## ADDED Requirements

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
sich wölbt. Wechselt eine Leiste ihre Fläche (die rechte tut das beim
Aufklappen), SHALL der Pill mitwechseln.

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
