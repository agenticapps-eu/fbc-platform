## ADDED Requirements

### Requirement: Ein einziger Icon-Satz trägt alle Glyphen

Das System SHALL alle Inline-Symbole aus einem Satz beziehen, der an einer Stelle
liegt und einen Stil führt (24er-Viewbox, `currentColor`, einheitliche
Strichstärke und Endenform). Ein Symbol SHALL NOT ein zweites Mal als eigene
Komponente in einer Feature-Datei entstehen.

Aufgelöst werden dabei die heute verstreuten Fassungen: die vier in der
Anwendungshülle, die Feedback- und Suchsymbole, die drei in der Aktivität, der
**doppelt vorhandene** Kronen-Glyph und der zweite Satz für die
Matching-Kategorien. Wer eine davon liegen lässt, hält zwei Wahrheiten.

Der Satz SHALL weiterhin ohne Icon-Bibliothek auskommen. Die Begründung dafür
gilt unverändert: eine Abhängigkeit für einige Dutzend Pfade brächte hunderte
ungenutzte Symbole und einen zweiten Stil ins Haus.

#### Scenario: Ein Symbol steht genau einmal im Baum

- **WHEN** der Quellbaum nach Komponenten durchsucht wird, die ein `<svg>` selbst
  zeichnen
- **THEN** findet sich außerhalb des Icon-Satzes keine, und kein Glyph existiert
  in zwei Fassungen

#### Scenario: Der Satz trägt beide Themes ohne Verzweigung

- **WHEN** dasselbe Symbol im hellen und im dunklen Theme gezeichnet wird
- **THEN** trägt es die jeweilige Vordergrundfarbe, ohne dass die Komponente das
  Theme kennt oder auf es verzweigt

### Requirement: Ein Kanon ordnet jedem Gegenstandsbereich Icon und Farbe zu

Das System SHALL die Zuordnung `Gegenstandsbereich → Icon + Farbe` als **eine**
Modulkonstante führen. Eine Fläche SHALL sie von dort beziehen und SHALL NOT sie
je Karte neu treffen; eine Verzweigung über Bereiche in mehreren Dateien SHALL
NOT entstehen.

Der Kanon SHALL ausschließlich Gegenstandsbereiche tragen — Events, Mitglieder,
Nachrichten, Aktivität, Kontakte, Kompass, Highlights. Bedien-Symbole wie
Chevron, Menü, Glocke und Lupe SHALL NOT im Kanon stehen: sie bezeichnen keinen
Bereich, und eine Bereichsfarbe für sie wäre erfunden. Sie gehören in den Satz.

#### Scenario: Zwei Flächen zeigen denselben Bereich gleich

- **WHEN** derselbe Gegenstandsbereich auf zwei verschiedenen Seiten als Karte
  erscheint
- **THEN** trägt er beide Male dasselbe Symbol in derselben Farbe

#### Scenario: Ein Bedien-Symbol hat keine Bereichsfarbe

- **WHEN** ein Chevron oder das Menü-Symbol gezeichnet wird
- **THEN** stammt der Glyph aus dem Satz, und der Kanon kennt für ihn keinen
  Eintrag

### Requirement: Bereichsfarben sind Tokens und in beiden Themes definiert

Das System SHALL die Farben des Kanons als Design-Tokens führen und SHALL NOT sie
als Farbwert im Bauteil schreiben. Jedes Token SHALL in **beiden** Themes einen
Wert haben; ein Token, das nur im hellen Block steht, trägt im dunklen einen
zufälligen Wert.

Die Bereichsfarben SHALL sich vom bestehenden Vokabular unterscheiden lassen und
SHALL NOT die semantischen Farben für Erfolg, Warnung und Gefahr überschreiben
oder ersetzen.

#### Scenario: Jede Bereichsfarbe hat zwei Werte

- **WHEN** die Token-Blöcke beider Themes verglichen werden
- **THEN** trägt jede Bereichsfarbe in beiden einen eigenen Wert, und keine ist
  nur in einem der beiden definiert

#### Scenario: Der Kontrast trägt in beiden Themes

- **WHEN** ein Bereichs-Icon vor dem Kartenhintergrund seines Themes steht
- **THEN** ist es in beiden Themes erkennbar, ohne dass eine Fläche für ein Theme
  eine Ausnahme definiert

### Requirement: Farbe trägt nie allein eine Bedeutung

Das System SHALL eine Aussage niemals nur über Farbe treffen. Eine Bereichsfarbe
SHALL immer neben einem Symbol oder einem Wort stehen, das dieselbe Aussage
trägt.

#### Scenario: Ohne Farbe bleibt die Karte lesbar

- **WHEN** eine Karte, die einen Gegenstandsbereich bezeichnet, ohne
  Farbunterscheidung betrachtet wird
- **THEN** geht aus Symbol oder Beschriftung weiterhin hervor, welchen Bereich
  sie meint

### Requirement: Karten mit einem Gegenstandsbereich zeigen ihn

Das System SHALL Karten, die einen Gegenstandsbereich bezeichnen, mit dessen
Symbol und Farbe aus dem Kanon versehen — auf dem Dashboard, in den Events und im
Mitgliederverzeichnis, dort wo eine Karte heute nur Text trägt.

Angewendet wird der Kanon auf die Flächen, die **bestehen**. Neue Karten SHALL
NOT allein deshalb entstehen, weil das Konzeptbild sie zeigt.

#### Scenario: Eine Textkarte bekommt ihr Symbol

- **WHEN** eine Dashboard-Karte einen Gegenstandsbereich bezeichnet
- **THEN** trägt sie dessen Symbol und Farbe aus dem Kanon, in beiden Themes
