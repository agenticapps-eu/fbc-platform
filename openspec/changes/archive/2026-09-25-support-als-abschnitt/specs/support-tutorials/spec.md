## REMOVED Requirements

### Requirement: Der Support-Abschnitt steht am Fuss der Seitenleiste und führt genau zwei Einträge

**Reason**: Die Verortung „am Fuss der Seitenleiste, über dem Einklapp-Schalter"
war der Sonderbau, den AGE-929 abschafft. Sie hat den Abschnitt aus der Reihe
der übrigen Abschnitte herausgenommen: nicht klappbar, andere Trennlinie, andere
Abstände, und er scrollte nicht mit. Die Anforderung wird durch die
gleichnamige, neu verortete unten ersetzt.

**Migration**: Keine — kein Pfad, kein Recht und kein gespeicherter Zustand
hängen daran. Was die alte Anforderung inhaltlich zusagte (genau zwei Einträge,
erreichbar in allen drei Zuständen der Leiste, kein achter Menüeintrag), sagt die
neue unverändert weiter zu; sie fügt Verortung, Reihenfolge und Form hinzu.

## ADDED Requirements

### Requirement: Der Support-Abschnitt steht zwischen „Mein Bereich" und „Administration" und führt genau zwei Einträge

Die Anwendung SHALL in der Seitenleiste einen Abschnitt **„Support"** führen. Er
SHALL zwischen dem persönlichen Bereich und der Administration stehen — die
Reihenfolge der Abschnitte ist Hauptnavigation → **Mein Bereich** → **Support** →
**Administration**. Für ein Konto ohne Admin-Rolle SHALL er der letzte Abschnitt
sein.

Einem **angemeldeten** Konto SHALL er genau zwei Einträge tragen: **Tutorials**
und **Feedback**. Ohne Konto SHALL „Feedback" entfallen — es ist ohne Konto nicht
speicherbar, und ein Knopf, der nur scheitern kann, ist ein Versprechen ins
Leere. Das ist keine Neuerung dieses Changes; es steht hier, weil der Abschnitt
jetzt eine eigene Überschrift und eine eigene Trennlinie hat und der Fall damit
sichtbarer ist als am Fuss der Leiste.

Er SHALL die Form der übrigen Abschnitte haben und SHALL NOT als Sonderbau
danebenstehen: Überschrift, zuklappbar über die Überschrift, dieselbe Trennlinie
nach oben, dieselben Abstände. Insbesondere SHALL der Eintrag „Feedback", der
kein Ziel öffnet sondern eine Aktion auslöst, in Polsterung und Symbolabstand
nicht von einem Eintrag mit Pfad zu unterscheiden sein — ein Abschnitt, dessen
zweite Zeile anders sitzt als seine erste, ist als Fremdkörper zu sehen, auch
wenn niemand benennen kann, woran es liegt.

Der Abschnitt SHALL NOT die Hauptnavigation verändern: die sieben sichtbaren
Menüeinträge und ihre Reihenfolge bleiben unberührt. Support ist der
nachgeordnete Ort, an dem Hilfe liegt — nicht ein achter Menüpunkt.

Er SHALL NOT auf Mitgliedschaft, Stufenwechsel oder einen Kaufweg verweisen.
Support ist Hilfe, kein Verkaufsweg.

Beide Einträge SHALL in allen drei Zuständen der Leiste erreichbar sein: offen,
eingeklappt und als mobile Schublade. In der eingeklappten Leiste SHALL jeder
Eintrag einen zugänglichen Namen behalten, auch wo seine Beschriftung verborgen
ist — ein Symbol ohne Namen ist für Vorlesesoftware ein leerer Knopf.

Jeder Eintrag SHALL sein eigenes Symbol tragen. Ein Eintrag, dessen Symbol nicht
zugeordnet ist, fällt auf einen Platzhalter zurück; zwei Platzhalter
nebeneinander unterscheiden nichts mehr.

#### Scenario: Die Abschnitte stehen in der Reihenfolge Mein Bereich, Support, Administration

- **WHEN** die Seitenleiste einem Konto mit Admin-Rolle offen dargestellt wird
- **THEN** folgt der Abschnitt „Support" auf „Mein Bereich"
- **AND** „Administration" folgt auf „Support"

#### Scenario: Ohne Admin-Rolle beschliesst Support die Leiste

- **WHEN** die Seitenleiste einem Konto ohne Admin-Rolle offen dargestellt wird
- **THEN** ist „Support" der letzte Abschnitt
- **AND** es erscheint kein Abschnitt „Administration"

#### Scenario: Der Abschnitt zeigt beide Einträge unter seiner Überschrift

- **WHEN** die Seitenleiste einem angemeldeten Konto offen dargestellt wird
- **THEN** steht über den Einträgen die Überschrift „Support"
- **AND** der Abschnitt führt „Tutorials" und „Feedback", und sonst nichts

#### Scenario: Ohne Konto entfällt der Feedback-Eintrag

- **WHEN** die Seitenleiste ohne angemeldetes Konto dargestellt wird
- **THEN** erscheint „Feedback" nicht
- **AND** der Abschnitt führt keinen Eintrag, der ohne Konto nur scheitern kann

#### Scenario: Die Überschrift klappt den Abschnitt zu

- **WHEN** die Überschrift „Support" in der offenen Leiste gewählt wird
- **THEN** sind „Tutorials" und „Feedback" nicht mehr dargestellt
- **AND** ein zweites Wählen stellt beide wieder her

#### Scenario: Der Eintrag mit Aktion sitzt wie ein Eintrag mit Pfad

- **WHEN** der Abschnitt offen dargestellt wird
- **THEN** trägt „Feedback" dieselbe Polsterung und denselben Symbolabstand wie
  „Tutorials"

#### Scenario: Eingeklappt bleiben beide Einträge benennbar

- **WHEN** die Seitenleiste eingeklappt dargestellt wird
- **THEN** sind beide Einträge weiterhin bedienbar
- **AND** jeder trägt einen zugänglichen Namen („Tutorials", „Feedback")
- **AND** die Überschrift „Support" ist nicht dargestellt

#### Scenario: In der mobilen Schublade stehen beide Einträge

- **WHEN** die Navigationsschublade unterhalb des `lg`-Breakpoints geöffnet ist
- **THEN** sind „Tutorials" und „Feedback" aus ihr heraus erreichbar

#### Scenario: Der Weg ins Tutorial schliesst die Schublade

- **WHEN** „Tutorials" aus der geöffneten Schublade heraus gewählt wird
- **THEN** führt die Anwendung auf die Tutorial-Fläche
- **AND** die Schublade ist danach geschlossen

#### Scenario: Die Hauptnavigation behält ihre sieben sichtbaren Einträge

- **WHEN** die Navigation dargestellt wird
- **THEN** führt sie unverändert sieben sichtbare Menüeinträge
- **AND** weder „Tutorials" noch „Feedback" ist einer von ihnen

#### Scenario: Der Tutorial-Eintrag trägt ein eigenes Symbol

- **WHEN** der Abschnitt dargestellt wird
- **THEN** trägt „Tutorials" ein zugeordnetes Symbol und nicht den Platzhalter
