## MODIFIED Requirements

<!-- Titel zeichengleich zur bestehenden Anforderung. Das Wort „eigene" meint
     dort „nicht die Inhaltsfläche", nicht „nicht die der linken Leiste" — und
     bleibt damit richtig, obwohl die beiden Leisten jetzt dieselbe Fläche
     tragen. Umbenennen hätte REMOVED+ADDED verlangt und sechs Szenarien
     bewegt, ohne eine Zusage zu ändern.

     Geändert ist dreierlei:
       1. Die SHALL-NOT-Klausel gegen `#081527` fällt — Frage E7 ist mit Ja
          beantwortet (Donald, 03.10.2026).
       2. Der Satz „die linke Navigation hängt an `--color-chrome`" war FALSCH.
          Gemessen: kein Element der linken Leiste malt mit `bg-chrome`; die
          Fläche kommt aus `--sidebar-surface`, die Topbar aus `bg-canvas/85`.
          Der Satz hatte die Absicht der Entwurfsvorlage übernommen, nicht den
          gebauten Zustand.
       3. Das Szenario „Eingeklappt dieselbe Fläche" sagte im THEN das
          Gegenteil der neuen Zusage. Name zeichengleich, Rumpf neu.
     Alle sechs bestehenden Szenarien stehen unten, auch die unveränderten —
     ein MODIFIED-Block bekräftigt den GANZEN Satz. -->

### Requirement: Die Nachrichtenleiste trägt im dunklen Modus eine eigene dunkle Fläche

Das System SHALL der angedockten Nachrichtenleiste rechts im Modus `navy` die
Fläche **`#002B51`** geben — ein- und ausgeklappt dieselbe. Die Farbe ist keine
Wahl: sie ist auf dkrealinvest.com gemessen (Elementor-`post-12.css`,
Fussbereich) und von Detlev im Meeting am 03.10.2026 benannt.

**Die linke Navigation SHALL dieselbe Fläche tragen.** Frage E7 — ob sie
nachzieht — ist am 03.10.2026 mit Ja beantwortet. Die vorige Fassung dieser
Anforderung verlangte das Gegenteil (`SHALL NOT` das `#081527` der linken
Navigation) und erklärte den Unterschied als gewollt, „solange Frage E7 offen
ist"; die Bedingung ist eingetreten. Beide angedockten Leisten rahmen die Seite
damit in **einer** Farbe. Was auf der linken Leiste dafür lesbar bleiben muss,
steht in der eigenen Anforderung dazu.

Im Modus `hell` SHALL die Leiste **unverändert** weiss bleiben — SPEC 12 verlangt
„dieselbe Grundwirkung wie die linke Navigation", und die ist dort weiss.

**Und zwar Wert für Wert**, nicht nur dem Eindruck nach: jeder Rückfall SHALL
genau der Wert sein, den die betroffene Fläche vorher trug. Das betrifft
besonders die Elemente, die vorher **Chrome**-Farben trugen und nicht
Inhaltsfarben — das Symbol im eingeklappten Rail und der Einklapp-Pill
(`#475569`, Hover `#1F53B0`). Sie SHALL eigene Tokens führen und SHALL NOT auf
den Vorschautext-Token fallen, der `#626F85` ist und im hellen Modus sichtbar
anders aussähe.

Die Fläche SHALL über **einen** Token `--chat-rail-surface` gesetzt werden und
SHALL NOT über `--color-chrome` laufen. Die Begründung dafür ist **berichtigt**:
die vorige Fassung schrieb, die linke Navigation hänge an `--color-chrome`. Das
ist gemessen falsch — kein Element der linken Leiste malt mit `bg-chrome`; ihre
Fläche kommt aus `--sidebar-surface`, die Topbar aus `bg-canvas/85`.
`--color-chrome` färbt im dunklen Modus die Vollflächen von `/onboarding` und
`/willkommen`, `Button variant="secondary"` und — als `text-chrome` — die Ziffer
auf den Zählern. Ein eigener Token für die Leiste ist deshalb nicht nötig, um
die linke Navigation zu verschonen, sondern um **diese drei** zu verschonen.

Die Zusage, dass `navy` **nur den Rahmen** färbt und kein Nachtmodus für Inhalte
ist (AGE-492), SHALL unberührt bleiben. Die Chat-Fenster und die Seite `/chat`
SHALL in beiden Modi hell bleiben.

#### Scenario: Ausgeklappt im dunklen Modus

- **WHEN** ein angemeldetes Mitglied im Modus `navy` die Nachrichtenleiste
  ausklappt
- **THEN** ist ihre Fläche `#002B51` und nicht weiss

#### Scenario: Eingeklappt dieselbe Fläche

- **WHEN** dasselbe Mitglied sie einklappt
- **THEN** bleibt die Fläche `#002B51` — und ist damit dieselbe, die die linke
  Navigation im Modus `navy` trägt

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

## ADDED Requirements

### Requirement: Die linke Navigation trägt im dunklen Modus dieselbe Fläche wie die Nachrichtenleiste

Das System SHALL der angedockten Navigation links im Modus `navy` die Fläche
**`#002B51`** geben — dieselbe, die die Nachrichtenleiste rechts trägt. Das gilt
aufgeklappt, eingeklappt und für die Navigationsschublade auf schmalen Schirmen.

Die Fläche SHALL über den bestehenden Token `--sidebar-surface` gesetzt werden.
Er sitzt auf `.fbc-sidebar-surface`, und die Klasse trägt das `aside`, die
Schublade und den Einklapp-Pill — alle drei wandern damit mit, ohne dass eine
vierte Stelle angefasst wird. Im Modus `hell` SHALL der Token **unverändert**
weiss bleiben.

`--color-chrome` SHALL `#081527` bleiben und SHALL NOT mitwandern. Es färbt
nicht die Leiste, sondern die Vollflächen von `/onboarding` und `/willkommen`,
`Button variant="secondary"` und als `text-chrome` die Ziffer auf den Zählern.
Die Topbar SHALL unberührt bleiben; sie ist `bg-canvas/85`, eine Inhaltsfarbe,
und in beiden Modi hell.

**Der Fokusring SHALL die Schwelle für Bedienelemente halten.** Das ist der eine
Befund, der aus dem angekündigten Einzeiler eine Änderung mit Testbedarf macht:
`ring-accent` (`#2F6BD1`) trägt auf `#081527` 3,61:1 und auf `#002B51` nur noch
**2,83:1** — unter den 3:1 der Norm. Betroffen sind vier Elemente auf der
Leistenfläche: die Wortmarke, die aufklappbaren Abschnittsmarken in
`SidebarNav`, der Feedback-Knopf und der Einklapp-Pill.

Die linke Leiste SHALL deshalb einen **eigenen Fokus-Token** führen, der auf
`:root` **genau** den heutigen Wert `#2F6BD1` trägt — damit der helle Modus
nachweisbar Wert für Wert unverändert bleibt — und im Modus `navy` `#B9CCE6`
(**8,77:1**), dieselbe Farbe, die die Nachrichtenleiste nach dem Code-Review von
AGE-1002 bekommen hat. Der Token SHALL ausschliesslich von Elementen der linken
Leiste gelesen werden, damit eine Definition auf `html[data-variant="navy"]`
nirgends durchschlagen kann.

Jedes Element auf der Leistenfläche SHALL die Kontrastschwellen halten: **4,5:1**
für Text, **3:1** für Bedienelemente und bedeutungstragende Grafik. Die Werte
SHALL festgehalten sein:

| Element                                   | Farbe     | auf `#081527` (vorher) | auf `#002B51`             |
| ----------------------------------------- | --------- | ---------------------- | ------------------------- |
| inaktiver Menüeintrag                     | `#9FB4D2` | 8,66:1                 | **6,78:1**                |
| Abschnittsmarke                           | `#8FA5C4` | 7,28:1                 | **5,70:1**                |
| aktiver Eintrag, Wortmarke, Hover-Schrift | `#FFFFFF` | 18,31:1                | **14,34:1**               |
| Punkte der Wortmarke                      | `#5B90E0` | 5,68:1                 | **4,45:1**                |
| Fokusring (neuer Token)                   | `#B9CCE6` | —                      | **8,77:1**                |
| Zähler offener Anfragen, Fläche           | `#5B90E0` | —                      | **4,45:1**                |
| Ziffer auf dem Zähler                     | `#00172B` | —                      | **5,62:1** auf dem Zähler |

**Der Zähler offener Anfragen SHALL eigene Tokens führen.** Er las
`bg-accent` mit `text-chrome`, und `--color-accent` (`#2F6BD1`) trägt gegen die
neue Fläche nur **2,83:1** — dieselbe Zahl, die den eigenen Fokus-Token
begründet, am selben Ort. Die Werte SHALL die der Nachrichtenleiste sein
(`#5B90E0` / `#00172B`), denn AGE-1002 hat sie für **dasselbe Element auf
derselben Fläche** gerechnet. Im Modus `hell` SHALL beide Tokens genau die
heutigen Werte tragen (`#2F6BD1` und `#FFFFFF`).

**Die Trennlinien SHALL sichtbar bleiben, sind aber ausdrücklich KEIN
Bedienelement.** `--color-chrome-border` ist Weiss zu 8 % und trägt **1,26:1**
gegen die Fläche, vorher 1,23:1 — also minimal besser. Die 3:1 aus 1.4.11
gelten für sie nicht: eine Haarlinie zwischen zwei Abschnitten ist weder
Bedienelement noch bedeutungstragende Grafik. Eine untere Grenze SHALL
trotzdem gelten, damit sie nicht unsichtbar wird — als benannte Entscheidung,
nicht als Schwelle der Norm.

**Zwei Flächen halten die 3:1 nicht, und das SHALL hier stehen statt beim
nächsten Griff an die Farben neu verhandelt zu werden.**

Die **Hover-Fläche** (`#0E1F38`) hebt sich mit **1,15:1** von `#002B51` ab —
praktisch nicht. Das ist aber keine Verschlechterung: auf `#081527` waren es
1,11:1, also schon vorher nichts. Der sichtbare Hinweis ist die Schrift, die auf
Weiss wechselt und auf der Hover-Fläche 16,51:1 trägt. Die Fläche SHALL NOT als
Zustandsmerkmal gelten.

Die **Aktivfläche** (`#1F53B0`) trägt **2,00:1** gegen die Leiste, vorher
2,55:1 — die Schwelle hielt sie noch nie. Der aktive Eintrag SHALL deshalb an
anderem erkennbar sein als an ihr, und die Merkmale SHALL **je Zustand** benannt
sein, weil sie sich unterscheiden:

|                                                              | aufgeklappt | eingeklappt |
| ------------------------------------------------------------ | ----------- | ----------- |
| halbfette weisse Beschriftung (7,19:1 auf der Füllung)       | ja          | **nein**    |
| weisser Linksbalken                                          | ja          | **nein**    |
| Symbolfarbe `#FFFFFF` statt `#9FB4D2` (14,34:1 statt 6,78:1) | ja          | ja          |
| Symbolform `solid` statt `line`                              | ja          | ja          |

Eingeklappt bleiben also **zwei** Merkmale, und sie SHALL Farbe **und** Form
zusammen sein — die bestehende Anforderung „Farbe trägt nie allein eine
Bedeutung" verlangt genau das. Die Füllung SHALL in beiden Fällen als Dekoration
gelten, nicht als Signal.

Diese Zusage SHALL **gerendert** geprüft werden, in beiden Zuständen getrennt.
Eine Textsuche über die Quelldatei genügt nicht: der Balken hängt an
`isActive && !collapsed`, und eine Suche nach seiner Klasse sieht keine
Bedingung.

#### Scenario: Die linke Navigation im dunklen Modus

- **WHEN** ein angemeldetes Mitglied im Modus `navy` die Navigation ansieht
- **THEN** ist ihre Fläche `#002B51` — dieselbe wie die der Nachrichtenleiste
  rechts, und nicht mehr `#081527`

#### Scenario: Eingeklappt und als Schublade dieselbe Fläche

- **WHEN** dasselbe Mitglied die Navigation einklappt oder sie auf einem
  schmalen Schirm als Schublade öffnet
- **THEN** trägt sie dieselbe Fläche wie aufgeklappt

#### Scenario: Im hellen Modus ändert sich an der Navigation nichts

- **WHEN** ein Mitglied im Modus `hell` die Navigation ansieht
- **THEN** ist sie weiss, und auch der Fokusring trägt dort genau den Wert, den
  er vor dieser Änderung hatte

#### Scenario: Der Fokus bleibt auf der neuen Fläche sichtbar

- **WHEN** ein Mitglied die Wortmarke, eine Abschnittsmarke, den Feedback-Knopf
  oder den Einklapp-Pill im Modus `navy` mit der Tastatur erreicht
- **THEN** hebt sich der Ring mit mindestens 3:1 von der Leistenfläche ab

#### Scenario: Menüeinträge und Abschnittsmarken bleiben lesbar

- **WHEN** ein Mitglied die Navigation im Modus `navy` liest
- **THEN** erfüllen inaktive Einträge, Abschnittsmarken und der aktive Eintrag
  mindestens 4,5:1 auf der Leistenfläche

#### Scenario: Der aktive Eintrag ist nicht an seiner Füllung erkennbar

- **WHEN** ein Mitglied im Modus `navy` den aufgeklappten aktiven Eintrag sieht
- **THEN** ist er an weisser halbfetter Schrift und am weissen Linksbalken
  erkennbar, nicht an der Füllung allein

#### Scenario: Eingeklappt trägt das Symbol den Zustand allein

- **WHEN** dasselbe Mitglied die Navigation einklappt
- **THEN** gibt es weder Balken noch Beschriftung, und der aktive Eintrag ist
  an der Farbe **und** der Form seines Symbols erkennbar

#### Scenario: Der Zähler offener Anfragen hebt sich ab und ist lesbar

- **WHEN** ein Mitglied im Modus `navy` einen Eintrag mit offenen Anfragen sieht
- **THEN** hebt sich der Zähler mit mindestens 3:1 von der Leiste ab, und seine
  Ziffer erfüllt auf dem Zähler mindestens 4,5:1

#### Scenario: Die unbeteiligten Flächen bleiben, wie sie waren

- **WHEN** ein Mitglied im Modus `navy` `/onboarding` oder `/willkommen` öffnet
  oder einen sekundären Knopf ausserhalb der Leisten ansieht
- **THEN** tragen sie weiterhin `#081527` und sind von dieser Änderung
  unberührt
