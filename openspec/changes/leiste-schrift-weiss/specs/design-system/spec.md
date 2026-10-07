## MODIFIED Requirements

<!-- Titel zeichengleich zur bestehenden Anforderung. Er nennt die FLÄCHE, und
     die ändert sich hier nicht — es kommt die Schrift hinzu. Umbenennen hätte
     REMOVED+ADDED verlangt und neun Szenarien bewegt, ohne eine davon zu
     ändern.

     Geändert ist viererlei:
       1. Die Schrift der Leiste hängt nicht mehr an `--color-on-chrome` /
          `--color-on-chrome-muted`, sondern an zwei eigenen Token. Die beiden
          alten Token behalten ihre Werte und färben ab jetzt die beiden
          Vollseiten und den sekundären Knopf — nicht mehr die Leiste.
       2. Die Kontrasttabelle trägt die neuen Werte. Die alten bleiben als
          Zeile stehen, weil sie weiterhin gelten — nur eben woanders.
       3. Die Merkmalstabelle des aktiven Eintrags: eingeklappt fällt die
          Symbolfarbe als Merkmal weg, weil inaktive Symbole denselben Weisston
          erben. `NavIcon` nimmt keine Farbe an, es erbt `currentColor` —
          gemessen, nicht angenommen. Es bleibt die Form.
       4. Das Szenario „Eingeklappt trägt das Symbol den Zustand allein" sagte
          im THEN „Farbe UND Form". Name zeichengleich, Rumpf neu.
     Alle neun bestehenden Szenarien stehen unten, auch die unveränderten — ein
     MODIFIED-Block bekräftigt den GANZEN Satz. Zwei kommen hinzu. -->

### Requirement: Die linke Navigation trägt im dunklen Modus dieselbe Fläche wie die Nachrichtenleiste

Das System SHALL der angedockten Navigation links im Modus `navy` die Fläche
**`#002B51`** geben — dieselbe, die die Nachrichtenleiste rechts trägt. Das gilt
aufgeklappt, eingeklappt und für die Navigationsschublade auf schmalen Schirmen.

Die Fläche SHALL über den bestehenden Token `--sidebar-surface` gesetzt werden.
Er sitzt auf `.fbc-sidebar-surface`, und die Klasse trägt das `aside`, die
Schublade und den Einklapp-Pill — alle drei wandern damit mit, ohne dass eine
vierte Stelle angefasst wird. Im Modus `hell` SHALL der Token **unverändert**
weiss bleiben.

**Die Schrift SHALL dieselbe sein wie in der Nachrichtenleiste.** Beide Leisten
rahmen die Seite und tragen seit dieser Anforderung dieselbe Fläche; eine
dunklere Schrift links liest sich dann als Versehen. Die Leiste SHALL deshalb
zwei **eigene** Token führen:

| Token                | auf `@theme` | im Modus `navy` | entspricht        |
| -------------------- | ------------ | --------------- | ----------------- |
| `--leiste-ink`       | `#475569`    | `#FFFFFF`       | `--thread-ink`    |
| `--leiste-ink-muted` | `#64748B`    | `#B9CCE6`       | `--thread-muted`  |

Die Werte auf `@theme` SHALL **zeichengleich** die heutigen Werte von
`--color-on-chrome` und `--color-on-chrome-muted` sein. Damit ist „im hellen
Modus ändert sich nichts" eine Zusage am Wert und nicht ein Satz über eine
Absicht.

Es SHALL **zwei** Token sein und nicht eines. Die Leiste hat eine Rangfolge —
Abschnittsmarke über Menüeintrag —, und die Nachrichtenleiste führt für genau
diese Rangfolge ebenfalls zwei Töne. Ein einziger weisser Ton löschte sie.

Die beiden Token SHALL **ausschliesslich** von Elementen der Leistenfläche
gelesen werden. Der Grund ist gemessen: `text-on-chrome` und
`text-on-chrome-muted` stehen an 22 Stellen in `WillkommenPage`, an 17 in
`OnboardingPage` und in `Button variant="secondary"`. Ein Umlegen von
`--color-on-chrome` färbte zwei Vollseiten und einen Knopf mit, über dessen
Gestaltung eine offene Frage steht.

`--color-on-chrome` (`#9FB4D2`) und `--color-on-chrome-muted` (`#8FA5C4`) SHALL
ihre Werte im Modus `navy` **behalten**. Sie färben nach dieser Anforderung die
Vollflächen von `/onboarding` und `/willkommen` sowie den sekundären Knopf —
und SHALL NOT mehr der Leiste zugeschrieben werden, auch nicht im Kommentar.

`--color-chrome` SHALL `#081527` bleiben und SHALL NOT mitwandern. Es färbt
nicht die Leiste, sondern die Vollflächen von `/onboarding` und `/willkommen`,
`Button variant="secondary"` und als `text-chrome` die Ziffer auf den Zählern.
Die Topbar SHALL unberührt bleiben; sie ist `bg-canvas/85`, eine Inhaltsfarbe,
und in beiden Modi hell.

**Der Fokusring SHALL die Schwelle für Bedienelemente halten.** `ring-accent`
(`#2F6BD1`) trägt auf `#081527` 3,61:1 und auf `#002B51` nur noch **2,83:1** —
unter den 3:1 der Norm. Betroffen sind vier Elemente auf der Leistenfläche: die
Wortmarke, die aufklappbaren Abschnittsmarken in `SidebarNav`, der
Feedback-Knopf und der Einklapp-Pill.

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

| Element                                   | Farbe     | auf `#002B51`             |
| ----------------------------------------- | --------- | ------------------------- |
| inaktiver Menüeintrag, Symbol             | `#FFFFFF` | **14,34:1**               |
| Abschnittsmarke                           | `#B9CCE6` | **8,77:1**                |
| aktiver Eintrag, Wortmarke                | `#FFFFFF` | **14,34:1**               |
| Punkte der Wortmarke                      | `#5B90E0` | **4,45:1**                |
| Fokusring                                 | `#B9CCE6` | **8,77:1**                |
| Zähler offener Anfragen, Fläche           | `#5B90E0` | **4,45:1**                |
| Ziffer auf dem Zähler                     | `#00172B` | **5,62:1** auf dem Zähler |

Auf der Hover-Fläche (`#0E1F38`) SHALL dieselbe Schrift **16,51:1** tragen und
die Abschnittsmarke **10,10:1**; auf der Aktivfläche (`#1F53B0`) trägt die
weisse Schrift **7,19:1**. Alle drei Flächen SHALL damit abgedeckt sein, nicht
nur die Grundfläche.

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
1,11:1, also schon vorher nichts. Im Modus `navy` SHALL die Fläche den
Hover-Zustand allein tragen, denn die Schrift steht dort schon auf Weiss und
kann nicht heller werden; im Modus `hell` SHALL weiterhin die Schrift wechseln
(`#475569` → `#1F53B0`). Dieselbe Aufteilung gilt in der Nachrichtenleiste,
deren Hover-Fläche Weiss zu 6 % ist. Die Fläche SHALL NOT als Merkmal des
**aktiven** Zustands gelten.

Die **Aktivfläche** (`#1F53B0`) trägt **2,00:1** gegen die Leiste, vorher
2,55:1 — die Schwelle hielt sie noch nie. Der aktive Eintrag SHALL deshalb an
anderem erkennbar sein als an ihr, und die Merkmale SHALL **je Zustand** benannt
sein, weil sie sich unterscheiden:

|                                                        | aufgeklappt | eingeklappt |
| ------------------------------------------------------ | ----------- | ----------- |
| halbfette Beschriftung (7,19:1 auf der Füllung)        | ja          | **nein**    |
| weisser Linksbalken                                    | ja          | **nein**    |
| Symbolform `solid` statt `line`                        | ja          | ja          |

**Eingeklappt trägt die Symbolform den Zustand ALLEIN, und das SHALL hier
stehen.** Bis zu dieser Anforderung kam die Symbolfarbe als zweites Merkmal
hinzu (`#FFFFFF` aktiv gegen `#9FB4D2` inaktiv). Sie fällt weg, weil inaktive
Einträge denselben Weisston tragen: `NavIcon` nimmt keine Farbe an, es erbt
`currentColor` von der Textklasse seines Links.

Die Norm ist damit gehalten — 1.4.1 verlangt, dass Farbe nicht das **einzige**
Mittel ist, und eine Form ist kein Farbmittel. Es ist aber eine bewusste
Verringerung von zwei Merkmalen auf eines, und sie SHALL als solche benannt
sein statt beim nächsten Griff an die Leiste als Versehen zu erscheinen. Die
Nachrichtenleiste macht denselben Tausch: alle Namen stehen dort auf
`--thread-ink`, und der aktive Faden ist allein an seiner Fläche erkennbar.

Die Füllung SHALL in beiden Zuständen als Dekoration gelten, nicht als Signal.

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

#### Scenario: Die Schrift ist dieselbe wie in der Leiste rechts

- **WHEN** ein Mitglied im Modus `navy` beide angedockten Leisten nebeneinander
  sieht
- **THEN** tragen Menüeinträge links und Gesprächsnamen rechts denselben
  Weisston, und Abschnittsmarken links denselben hellen Ton wie Vorschautext
  und Uhrzeit rechts

#### Scenario: Im hellen Modus ändert sich an der Navigation nichts

- **WHEN** ein Mitglied im Modus `hell` die Navigation ansieht
- **THEN** ist sie weiss, und Schrift, Abschnittsmarken und Fokusring tragen
  dort genau die Werte, die sie vor dieser Änderung hatten

#### Scenario: Ausserhalb der Leiste ändert die Schrift sich nicht

- **WHEN** ein Mitglied im Modus `navy` `/onboarding` oder `/willkommen` öffnet
- **THEN** trägt deren Text weiterhin `#9FB4D2` beziehungsweise `#8FA5C4` und
  ist von dieser Änderung unberührt

#### Scenario: Der Fokus bleibt auf der neuen Fläche sichtbar

- **WHEN** ein Mitglied die Wortmarke, eine Abschnittsmarke, den Feedback-Knopf
  oder den Einklapp-Pill im Modus `navy` mit der Tastatur erreicht
- **THEN** hebt sich der Ring mit mindestens 3:1 von der Leistenfläche ab

#### Scenario: Menüeinträge und Abschnittsmarken bleiben lesbar

- **WHEN** ein Mitglied die Navigation im Modus `navy` liest
- **THEN** erfüllen inaktive Einträge, Abschnittsmarken und der aktive Eintrag
  mindestens 4,5:1 — auf der Grundfläche, auf der Hover-Fläche und auf der
  Aktivfläche

#### Scenario: Der aktive Eintrag ist nicht an seiner Füllung erkennbar

- **WHEN** ein Mitglied im Modus `navy` den aufgeklappten aktiven Eintrag sieht
- **THEN** ist er an halbfetter Schrift und am weissen Linksbalken erkennbar,
  nicht an der Füllung allein

#### Scenario: Eingeklappt trägt das Symbol den Zustand allein

- **WHEN** dasselbe Mitglied die Navigation einklappt
- **THEN** gibt es weder Balken noch Beschriftung, und der aktive Eintrag ist
  an der **Form** seines Symbols erkennbar — `solid` gegen `line` —, nicht an
  dessen Farbe, denn alle Symbole der Leiste tragen dort denselben Weisston

#### Scenario: Der Zähler offener Anfragen hebt sich ab und ist lesbar

- **WHEN** ein Mitglied im Modus `navy` einen Eintrag mit offenen Anfragen sieht
- **THEN** hebt sich der Zähler mit mindestens 3:1 von der Leiste ab, und seine
  Ziffer erfüllt auf dem Zähler mindestens 4,5:1

#### Scenario: Die unbeteiligten Flächen bleiben, wie sie waren

- **WHEN** ein Mitglied im Modus `navy` `/onboarding` oder `/willkommen` öffnet
  oder einen sekundären Knopf ausserhalb der Leisten ansieht
- **THEN** tragen sie weiterhin `#081527` und sind von dieser Änderung
  unberührt
