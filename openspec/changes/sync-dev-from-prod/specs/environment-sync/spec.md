## ADDED Requirements

### Requirement: Der Spiegel läuft in genau einer Richtung

Das System SHALL einen Datenbestand ausschließlich von PROD nach DEV übertragen.
Der Lauf SHALL sein Ziel aus der Projektkennung im Datenbank-Benutzernamen
(`postgres.<ref>`) bestimmen und abbrechen, bevor er schreibt, wenn die Kennung
des Ziels nicht die des DEV-Projekts ist.

Die Prüfung SHALL NOT über den Host erfolgen: der Pooler-Host ist regionsweit
gleich und unterscheidet die Projekte nicht.

Ein Lauf, der PROD als Ziel trägt, SHALL mit einem Fehler enden und SHALL NOT
eine einzige Zeile geschrieben haben.

#### Scenario: Ein Lauf gegen PROD als Ziel bricht ab

- **WHEN** der Spiegel mit einer Ziel-Zugangszeile gestartet wird, deren
  Benutzername die PROD-Kennung trägt
- **THEN** endet er mit einem Fehler, nennt die erkannte Kennung, und die
  Zeilenzahlen in PROD sind unverändert

#### Scenario: Gleicher Host, anderes Projekt wird erkannt

- **WHEN** Quelle und Ziel denselben Pooler-Host tragen, aber verschiedene
  Kennungen im Benutzernamen
- **THEN** unterscheidet der Lauf sie korrekt und behandelt nicht beide als
  dasselbe Projekt

### Requirement: Der Auszug entsteht vollständig, bevor das Ziel angefasst wird

Das System SHALL den Auszug aus PROD vollständig erzeugt und abgelegt haben,
bevor es den ersten schreibenden Befehl gegen DEV absetzt. Bricht das Erzeugen
ab, SHALL DEV unverändert bleiben.

Der Auszug SHALL ausserhalb des Arbeitsbaums abgelegt werden und SHALL die
Rechte `0600` tragen — er enthält Namen, Anschriften und Anmeldeadressen echter
Menschen, und das Repository ist öffentlich.

Der Auszug SHALL nach dem Lauf erhalten bleiben. Er ist die Sicherung, die der
PROD-Neuaufbau als Schritt 1 verlangt.

#### Scenario: Ein Abbruch beim Auszug lässt DEV unberührt

- **WHEN** das Erzeugen des Auszugs mit einem Fehler endet
- **THEN** sind die Zeilenzahlen in DEV dieselben wie vor dem Lauf, weil noch
  kein schreibender Befehl abgesetzt wurde

#### Scenario: Der Auszug liegt nicht im Arbeitsbaum

- **WHEN** ein Lauf abgeschlossen ist
- **THEN** meldet `git status --porcelain --ignored` keine neue Datei, und der
  Auszug trägt die Rechte `0600`

### Requirement: Der Spiegel überträgt Datenbank und Ablage gemeinsam

Das System SHALL neben den Tabellenzeilen auch die Objekte der Ablage
übertragen — `avatars`, `covers`, `event-covers` und `post-media`. Ein Lauf, der
nur die Datenbank überträgt, SHALL als unvollständig gelten und SHALL fehlschlagen.

Der Grund SHALL NOT als Kosmetik behandelt werden: Profilzeilen ohne die
zugehörigen Objekte tragen Bild-Adressen, die ins Leere zeigen, und als
Sicherung wäre ein solcher Auszug wertlos.

Beim Schreiben in die Ablage SHALL `upsert` abgeschaltet bleiben. In privaten
Buckets verlangt `ON CONFLICT` ein Leserecht, das für ein noch unverknüpftes
Objekt verweigert wird — der Fehler zeigt dann auf die RLS, obwohl die Policy
richtig ist.

#### Scenario: Die Objektzahl je Bucket stimmt nach dem Lauf überein

- **WHEN** ein Lauf abgeschlossen ist
- **THEN** trägt jeder der vier Buckets in DEV dieselbe Objektzahl wie in PROD

#### Scenario: Eine fehlgeschlagene Ablage-Übertragung lässt den Lauf scheitern

- **WHEN** die Übertragung eines Objekts fehlschlägt
- **THEN** endet der Lauf mit einem Fehler und meldet, welches Objekt fehlt,
  statt einen unvollständigen Spiegel als Erfolg zu melden

### Requirement: Der Lauf ist wiederholbar und ersetzt vollständig

Das System SHALL bei jedem Lauf den übertragenen Bestand in DEV **vollständig
ersetzen**, nicht abgleichen. Zwei aufeinanderfolgende Läufe gegen denselben
Quellstand SHALL zum selben Zielzustand führen.

Der Vollersatz SHALL der Grund für die Wiederholbarkeit sein: ein zeilenweiser
Abgleich müsste für jede künftig angelegte Tabelle `upsert`-treu gehalten werden
und veraltete still — eine neue Spalte würde nicht übertragen, und kein Test
könnte es bemerken.

#### Scenario: Zweimal laufen ergibt denselben Zustand

- **WHEN** der Spiegel zweimal hintereinander gegen denselben Quellstand läuft
- **THEN** sind die Zeilenzahlen aller übertragenen Tabellen und die
  Objektzahlen aller Buckets nach dem zweiten Lauf dieselben wie nach dem ersten

#### Scenario: Ein Bestand, den die Quelle nicht mehr trägt, verschwindet

- **WHEN** in DEV Zeilen stehen, die in PROD nicht vorkommen, und ein Lauf
  abgeschlossen wird
- **THEN** sind sie fort, sofern sie nicht ausdrücklich zum geschützten
  DEV-Bestand gehören

### Requirement: Ein benannter DEV-Bestand überlebt jeden Lauf

Das System SHALL nach dem Ersetzen einen Nachbereitungsschritt ausführen, der
den Bestand herstellt, den DEV braucht und PROD nicht kennt: die drei
`@fbcdemo.com`-Zugänge und die Einträge in `staff_roles`.

Der geschützte Bestand SHALL an einer Stelle aufgezählt sein. Er SHALL NOT
dadurch entstehen, dass der Ersatz bestimmte Zeilen „auslässt" — was
ausgelassen wird, ist nicht prüfbar; was hergestellt wird, ist es.

#### Scenario: Die Demo-Zugänge sind nach dem Lauf wieder anmeldefähig

- **WHEN** ein Lauf abgeschlossen ist
- **THEN** kann sich jeder der drei `@fbcdemo.com`-Zugänge anmelden, obwohl der
  Vollersatz sie zwischenzeitlich entfernt hat

#### Scenario: Ein Admin bleibt Admin

- **WHEN** ein Lauf abgeschlossen ist
- **THEN** trägt DEV dieselben `staff_roles`-Einträge wie vor dem Lauf

### Requirement: Der Lauf wird angestossen und läuft nicht von selbst

Das System SHALL den Spiegel ausschließlich auf ausdrückliche Ausführung hin
starten. Es SHALL NOT einen Zeitplan einrichten, der ihn wiederkehrend auslöst.

Der Grund SHALL festgehalten sein: jeder Lauf verwirft den Arbeitsstand auf DEV.
Ein Zeitplan darf erst entstehen, wenn der Lauf sich von Hand bewährt hat, und
ist dann eine eigene Entscheidung.

#### Scenario: Das Repository richtet keinen wiederkehrenden Lauf ein

- **WHEN** die Workflows und Zeitpläne des Repositories durchgesehen werden
- **THEN** findet sich kein Eintrag, der den Spiegel zeitgesteuert startet
