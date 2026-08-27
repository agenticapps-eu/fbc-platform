## ADDED Requirements

### Requirement: Zugestelltes und als nicht relevant Markiertes steht in einem aufklappbaren Archiv

Das System SHALL jeden archivierten Change auf der Release-Notes-Fläche in genau
einem von zwei Zuständen führen: **offen** — er steht in der Auswahlliste — oder
**archiviert** — er steht im Archiv und SHALL NOT in der Auswahlliste
erscheinen.

Archiviert SHALL ein Change auf genau zwei Wegen werden:

- durch die **Zustellung** einer Release-Note, die ihn abdeckt. Dieser Weg SHALL
  endgültig sein: das System SHALL NOT einen zugestellten Change zurück in die
  Auswahlliste holen können, denn die Hinweise dazu stehen dann bereits in den
  Postfächern der Mitglieder.
- durch die Markierung **„nicht relevant"** durch einen Admin. Dieser Weg SHALL
  rücknehmbar sein.

Die Markierung „nicht relevant" SHALL für alle Admins gelten und SHALL NOT im
Browser des markierenden Admins verbleiben. Zwei Admins, die verschieden lange
Listen sehen, hätten keine gemeinsame Grundlage dafür, was noch anzukündigen
ist.

Nur ein aktivierter Admin SHALL Markierungen lesen, setzen und zurücknehmen
können, und die Grenze SHALL in der Datenbank liegen, nicht in der Fläche.

Trifft auf einen Change **beides** zu, SHALL das System „zugestellt" als Grund
nennen: ein verschickter Eintrag ist verschickt, unabhängig davon, was vorher
markiert wurde.

Ist ein Change von **mehreren** zugestellten Notes abgedeckt, SHALL das Archiv
die **früheste** nennen — den Zeitpunkt, an dem die Mitglieder es erfahren
haben. Die Auswahl SHALL NOT von der Reihenfolge der Abfrage abhängen.

Die Rechnung, was archiviert ist, SHALL **alle** zugestellten Notes umfassen und
SHALL NOT auf einer Seite davon beruhen. Eine Teilantwort ist von „nicht
angekündigt" nicht zu unterscheiden und holte Einträge stillschweigend zurück in
die Auswahlliste.

Solange die Markierungen nicht geladen sind oder ihre Abfrage gescheitert ist,
SHALL das System weder eine Auswahlliste noch einen Entwurf anbieten. Ein
Ausfall SHALL NOT als „nichts markiert" gelten — sonst stünden gerade die
abgeräumten Einträge wieder zur Wahl, die jüngeren davon vorangehakt.

Das Archiv SHALL zugeklappt beginnen, die Zahl seiner Einträge im Kopf tragen
und zu jedem Eintrag den Grund seiner Archivierung nennen.

Die Markierung „nicht relevant" SHALL den Eintrag zugleich aus der laufenden
Auswahl für den Entwurf nehmen. Ein Eintrag, der gerade als belanglos markiert
wurde, SHALL NOT angehakt in einer Mitteilung landen.

Das gilt auch, wenn bereits ein Entwurf **gespeichert** ist. Das System SHALL
NOT eine gespeicherte Note zustellen, die vom aktuellen Stand der Fläche
abweicht — weder in der Auswahl noch in Titel oder Text. Es SHALL stattdessen
erneutes Speichern verlangen. Andernfalls verschickte „speichern → markieren →
zustellen" genau den Eintrag, den der Admin gerade aussortiert hat.

Ein **Entwurf** SHALL weiterhin nichts archivieren. Nur eine zugestellte Note
zählt — sonst verschwände ein Change aus der Liste, sobald ihn jemand in einen
liegengebliebenen Entwurf gezogen hat.

#### Scenario: Nicht relevant räumt die Liste auf

- **WHEN** ein Admin einen offenen Eintrag als „nicht relevant" markiert
- **THEN** verschwindet er aus der Auswahlliste und steht im Archiv mit dem
  Grund „nicht relevant"

#### Scenario: Die Markierung nimmt den Eintrag aus der Auswahl

- **WHEN** ein Admin einen **vorangehakten** Eintrag als „nicht relevant"
  markiert und danach einen Entwurf erzeugt
- **THEN** deckt der Entwurf diesen Eintrag nicht ab

#### Scenario: Der Weg zurück steht offen

- **WHEN** ein Admin im Archiv einen als „nicht relevant" markierten Eintrag
  zurückholt
- **THEN** steht er wieder in der Auswahlliste

#### Scenario: Zugestelltes lässt sich nicht zurückholen

- **WHEN** ein Admin das Archiv öffnet und einen zugestellten Eintrag ansieht
- **THEN** nennt das Archiv Datum und Mitteilung, bietet aber keinen Weg zurück
  in die Auswahlliste

#### Scenario: Das Archiv beginnt zugeklappt und nennt seine Zahl

- **WHEN** ein Admin die Release-Notes-Fläche öffnet
- **THEN** ist das Archiv zugeklappt und trägt die Zahl der archivierten
  Einträge im Kopf

#### Scenario: Die Markierung gilt für alle Admins

- **WHEN** ein Admin einen Eintrag als „nicht relevant" markiert und ein
  **zweiter** Admin die Fläche öffnet
- **THEN** sieht auch dieser den Eintrag im Archiv und nicht in der Liste

#### Scenario: Ein Nicht-Admin kommt an die Markierungen nicht heran

- **WHEN** ein aktiviertes Mitglied ohne Adminrolle die Markierungen zu lesen,
  zu setzen oder zu löschen versucht
- **THEN** weist die Datenbank es ab

#### Scenario: Zugestellt schlägt nicht relevant

- **WHEN** ein Eintrag als „nicht relevant" markiert **und** von einer
  zugestellten Note abgedeckt ist
- **THEN** nennt das Archiv ihn als zugestellt

#### Scenario: Ein gespeicherter Entwurf lässt sich nach einer Markierung nicht unverändert zustellen

- **WHEN** ein Admin einen Entwurf speichert, danach einen darin enthaltenen
  Eintrag als „nicht relevant" markiert und zustellen will
- **THEN** ist das Zustellen gesperrt, bis er erneut gespeichert hat

#### Scenario: Fällt die Markierungsliste aus, bleibt die Fläche zu

- **WHEN** die Abfrage der Markierungen scheitert
- **THEN** zeigt die Fläche weder eine Auswahlliste noch einen Weg zum Entwurf,
  sondern sagt, dass sich gerade nicht bestimmen lässt, was offen ist

#### Scenario: Mehrfach zugestellt nennt die erste Zustellung

- **WHEN** zwei zugestellte Notes denselben Eintrag abdecken
- **THEN** nennt das Archiv die **frühere** von beiden

#### Scenario: Ein Entwurf archiviert nichts

- **WHEN** ein Eintrag nur in einem gespeicherten, aber nicht zugestellten
  Entwurf steht
- **THEN** bleibt er in der Auswahlliste und steht nicht im Archiv
