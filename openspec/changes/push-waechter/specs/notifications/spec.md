## ADDED Requirements

### Requirement: Ein ausgefallener Zustellweg meldet sich, statt still zu bleiben

Das System SHALL den Zustand des Push-Zustellwegs regelmäßig prüfen und die
Prüfung SHALL fehlschlagen, sobald einer von fünf Befunden vorliegt:

1. **Antwort** — im Beobachtungsfenster ist eine HTTP-Antwort mit einem anderen
   Status als `200`, eine Zeitüberschreitung oder ein Übertragungsfehler
   aufgezeichnet.
2. **Stillstand** — der jüngste erfolgreiche Lauf des Wiederholungslaufs ist
   älter als seine erlaubte Höchstpause, oder im Beobachtungsfenster liegen
   weniger erfolgreiche Läufe als die Hälfte der aus seiner Zeitplanung
   erwarteten.
3. **Stummheit** — der Wiederholungslauf läuft, aber es kommt kaum oder gar
   keine Antwort zurück. Ein erfolgreicher Lauf belegt nur, dass das SQL lief:
   die asynchrone Übergabe reiht den Aufruf lediglich ein. Steht der Arbeiter,
   der sie abholt, bleiben Takt und Protokoll fehlerfrei, während nichts
   zugestellt wird — dieser Befund SHALL das auffangen.
4. **Aufgabe** — eine Zustellung, deren Zeile im Beobachtungsfenster entstanden
   ist, hat den Zustand `aufgegeben` erreicht.
5. **Messausfall** — die Prüfung selbst konnte nicht messen. Ein leeres
   Messergebnis SHALL als Fehler gelten und NOT als Stillstand gemeldet werden:
   die beiden haben verschiedene Ursachen und verschiedene erste Handgriffe.

Die Prüfung SHALL außerhalb der Datenbank laufen, die sie prüft. Ein Wächter,
der auf derselben Anlage läuft, kann deren Ausfall nicht melden und verschwindet
mit ihr — beides ist am 28.–31.08.2026 eingetreten.

Das Stillstand-Signal SHALL seine Zahlen aus der Laufhistorie der Zeitplanung
beziehen, die den Lauf **benennt**, und NOT aus der Antworttabelle des
HTTP-Wegs: diese trägt keine Ziel-URL, und eine Antwort eines anderen Aufrufers
würde den Befund verdecken.

Das Antwort-Signal SHALL seinen Befund als gescheiterten Aufruf des HTTP-Wegs
benennen und NOT als Aussage über Push allein — dieselbe Tabelle trägt die
Antworten aller Aufrufer dieses Wegs.

Das Beobachtungsfenster SHALL kürzer sein als die Aufbewahrungsfrist der
gelesenen Antworten, und die Prüfung SHALL diese Frist bei jedem Lauf messen und
fehlschlagen, wenn sie das Fenster nicht mehr übersteigt. Das Fenster SHALL
länger sein als die längstmögliche Dauer der Zustellversuche, damit eine im
Fenster aufgegebene Zustellung an ihrer Entstehungszeit erkennbar ist.

Das Fenster SHALL eine benannte Verspätung des geplanten Laufs tragen. Es SHALL
NOT als Zusage gelesen werden, dass keine Lücke entstehen kann: für geplante
Läufe ist kein Takt zugesagt, und ein ausgefallener Lauf hinterlässt eine
ungeprüfte Zeitspanne.

Die Prüfung SHALL beide Projekte abdecken, DEV wie PROD, und je Projekt einen
eigenen Befund erzeugen — ein Ausfall auf der einen Seite SHALL den auf der
anderen nicht verdecken. Jeder Lauf SHALL das gemessene Projekt benennen.

Die Ausgabe der Prüfung SHALL ausschließlich Aggregate enthalten: Anzahl,
Statuscode und Zeitpunkt. Sie SHALL weder Antwortrümpfe noch Kopfzeilen noch
Kennungen von Hinweisen oder Gerätetoken noch den gespeicherten Fehlergrund
einer Zustellung ausgeben. Der Fehlergrund ist Freitext einer Ausnahme und kann
eine Anbieter-Adresse mitsamt Gerätetoken enthalten; die Protokolle sind
öffentlich.

Ihre Abfragen SHALL ihre Spalten einzeln benennen und NOT alle Spalten einer
Tabelle auswählen. Eine Verbotsliste einzelner Namen fängt eine
Alle-Spalten-Auswahl nicht, und sie träfe auch jede Spalte, die eine spätere
Migration hinzufügt.

Meldet die Prüfung einen **Messausfall**, SHALL sie dafür einen Kennzeichner
aus einem festen Vokabular ausgeben — den Fehlercode — und NOT den rohen
Meldungstext des Treibers, der Infrastrukturangaben tragen kann.

#### Scenario: Der Zustellweg antwortet dauerhaft mit einem Fehler

- **WHEN** der Aufruf des Zustellwegs im Beobachtungsfenster mit `401` oder
  `502` beantwortet wird
- **THEN** schlägt die Prüfung fehl und benennt Statuscode und Anzahl

#### Scenario: Der Wiederholungslauf steht still

- **WHEN** die Zeitplanung des Wiederholungslaufs entfernt, abbestellt oder
  inaktiv gesetzt wurde und deshalb kein erfolgreicher Lauf mehr hinzukommt
- **THEN** schlägt die Prüfung fehl

#### Scenario: Ein fremder Aufruf verdeckt den Stillstand nicht

- **WHEN** der Wiederholungslauf steht, im selben Fenster aber ein anderer
  Aufrufer desselben HTTP-Wegs erfolgreich geantwortet hat
- **THEN** schlägt die Prüfung trotzdem fehl, weil das Stillstand-Signal die
  Laufhistorie der Zeitplanung liest und nicht die Antworttabelle

#### Scenario: Der Takt läuft, aber es kommt nichts zurück

- **WHEN** der Wiederholungslauf im Beobachtungsfenster erfolgreich läuft,
  aber keine oder fast keine Antwort aufgezeichnet wurde
- **THEN** schlägt die Prüfung fehl, statt den fehlerfreien Takt für Gesundheit
  zu nehmen

#### Scenario: Eine Zustellung wird endgültig aufgegeben

- **WHEN** eine Zustellung, deren Zeile im Beobachtungsfenster entstanden ist,
  nach ihren Versuchen den Zustand `aufgegeben` erreicht
- **THEN** schlägt die Prüfung fehl und nennt die Anzahl aufgegebener
  Zustellungen

#### Scenario: Der Wächter kommt nicht an die Zahlen

- **WHEN** die Verbindung scheitert oder eine Bestandsabfrage nichts liefert,
  wo Zeilen stehen müssen
- **THEN** schlägt die Prüfung mit dem Befund „Messausfall" fehl, und nicht mit
  „Stillstand"

#### Scenario: Die Aufbewahrungsfrist wird unter das Fenster gesenkt

- **WHEN** die Aufbewahrungsfrist der Antworttabelle auf einen Wert unterhalb
  des Beobachtungsfensters gesetzt wird
- **THEN** schlägt die Prüfung fehl, statt ein Fenster zu messen, das bereits
  geleert ist

#### Scenario: Der laufende Betrieb erzeugt keinen Alarm

- **WHEN** der Zustellweg antwortet, der Wiederholungslauf läuft und keine
  Zustellung aufgegeben wurde
- **THEN** ist die Prüfung grün, ohne dass ein Mensch sie liest

#### Scenario: Das Protokoll trägt keine Mitgliederdaten

- **WHEN** die Prüfung einen Befund meldet
- **THEN** enthält ihre Ausgabe keinen Antwortrumpf, keine Kopfzeilen, keinen
  gespeicherten Fehlergrund und keine Kennung eines Hinweises oder Gerätetokens
