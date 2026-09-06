## ADDED Requirements

### Requirement: Eine Vorlage hält die inhaltlichen Felder eines Events

Das System SHALL Hosts erlauben, die inhaltlichen Felder eines Events einmal als
Vorlage abzulegen — Titel, Typ, Ort, Beschreibung, Kapazität, Sichtbarkeit,
Topics und Cover — und daraus wiederholt Termine zu erzeugen. Eine Vorlage ist
selbst **kein** Event: sie erscheint in keiner Eventliste, trägt keine
Anmeldungen und hat keinen Termin.

Wer eine Vorlage anlegen darf, MUSS genau der Personenkreis sein, der heute ein
Event anlegen darf: ein Mitglied mit bestätigtem Zugang, für seine eigenen
Vorlagen. Diese Änderung führt keine neue Stufenregel und keine Admin-Sonderrolle
ein.

#### Scenario: Host legt eine Vorlage an

- **WHEN** ein Host, der ein Event anlegen dürfte, eine Vorlage mit Titel, Typ
  und Kapazität speichert
- **THEN** wird die Vorlage seinem Konto zugeordnet gespeichert
- **AND** sie erscheint in keiner Eventliste und in keiner Anmeldeansicht

#### Scenario: Fremde Vorlage ist unerreichbar

- **WHEN** ein Mitglied die Vorlage eines anderen Hosts zu lesen oder zu ändern
  versucht
- **THEN** liefert die Datenbank keine Zeile zurück
- **AND** der Versuch ändert nichts

#### Scenario: Wer kein Event anlegen darf, legt auch keine Vorlage an

- **WHEN** ein Mitglied ohne bestätigten Zugang eine Vorlage zu speichern
  versucht
- **THEN** wird der Versuch abgewiesen

### Requirement: Ein Termin kann nur der eigenen Vorlage zugeordnet werden

Die Zuordnung eines Termins zu einer Vorlage SHALL nur möglich sein, wenn die
Vorlage demselben Host gehört wie der Termin. Das MUSS auf **jedem** Schreibweg
gelten, auch bei einem unmittelbaren Einfügen an der Erzeugungsfunktion vorbei.

Der Grund ist nicht Ordnungsliebe: die Zuordnung entscheidet mit darüber, welche
Termine als bereits vorhanden gelten. Könnte ein Mitglied Termine mit fremder
Vorlagenzugehörigkeit schreiben, besetzte es damit die Slots einer fremden Reihe,
und deren Erzeugung liefe still ins Leere.

#### Scenario: Fremde Vorlagenzugehörigkeit wird abgewiesen

- **WHEN** ein Host ein eigenes Event einfügt und dabei die Vorlage eines
  anderen Hosts als Zugehörigkeit angibt
- **THEN** wird der Schreibvorgang abgewiesen
- **AND** es entsteht kein Event

#### Scenario: Die Abweisung gilt auch unter Umgehung der Oberfläche

- **WHEN** derselbe Versuch als unmittelbarer Datenbankschreibvorgang erfolgt,
  ohne die Erzeugungsfunktion zu benutzen
- **THEN** wird er ebenso abgewiesen

### Requirement: Die Wiederholungsregel kennt drei Formen

Eine Vorlage MAY eine Wiederholungsregel tragen. Das System SHALL genau drei
Formen unterstützen:

1. **Wöchentlich an einem Wochentag** — „jeden Dienstag"
2. **Monatlich an einem Tag des Monats** — „jeden 1."
3. **Monatlich am n-ten Wochentag** — „jeden ersten Dienstag im Monat"

Form 3 MUSS als Position-plus-Wochentag ausgewertet werden und darf **nicht**
als feste Tagesdifferenz angenähert werden: der Abstand zwischen zwei ersten
Dienstagen ist nicht konstant.

Eine Vorlage ohne Regel bleibt zulässig. Aus ihr erzeugt der Host einzelne
Termine, indem er **ein einzelnes Datum** angibt; eine Anzahl ist für eine
regellose Vorlage nicht zulässig.

#### Scenario: Jeden Dienstag

- **WHEN** die Regel „wöchentlich, Dienstag" ab dem 01.09.2026 (ein Dienstag)
  vier Termine erzeugt
- **THEN** liegen die Termine am 01.09., 08.09., 15.09. und 22.09.2026
- **AND** jeder davon ist ein Dienstag

#### Scenario: Jeden ersten Dienstag im Monat

- **WHEN** die Regel „monatlich, erster Dienstag" ab September 2026 vier Termine
  erzeugt
- **THEN** liegen die Termine am 01.09., 06.10., 03.11. und 01.12.2026
- **AND** die Abstände sind ungleich, was eine feste Tagesdifferenz ausschlösse

#### Scenario: Der Monatsstart ist selbst der gesuchte Wochentag

- **WHEN** die Regel „erster Dienstag" einen Monat auswertet, dessen 1. bereits
  ein Dienstag ist
- **THEN** ist der 1. dieses Monats der Termin
- **AND** nicht der darauffolgende Dienstag

#### Scenario: Ein Monat ohne den geforderten Tag wird übersprungen

- **WHEN** die Regel „monatlich am 31." einen Monat mit 30 oder weniger Tagen
  erreicht
- **THEN** erzeugt sie für diesen Monat keinen Termin
- **AND** sie setzt im nächsten Monat fort, der einen 31. hat

#### Scenario: Regellose Vorlage verlangt ein Datum

- **WHEN** aus einer Vorlage ohne Wiederholungsregel mit einer Anzahl statt
  eines Datums erzeugt werden soll
- **THEN** wird der Aufruf abgewiesen

### Requirement: Erzeugte Termine sind gewöhnliche Events

Das System SHALL die Regel zu echten Zeilen in `events` auswerten, nicht zu
einer erst beim Lesen berechneten Liste. Ein erzeugter Termin MUSS sich in jeder
Hinsicht wie ein einzeln angelegtes Event verhalten: Anmeldung, Kapazität,
Warteliste, Check-in und Sichtbarkeit gelten unverändert und je Termin.

Anmeldungen MÜSSEN weiterhin ausschließlich über die bestehende
kapazitätsprüfende RPC entstehen. Das Erzeugen von Terminen erzeugt **keine**
Anmeldungen.

Jeder erzeugte Termin MUSS die Vorlage benennen, aus der er stammt, und den von
der Regel errechneten **ursprünglichen Slot** festhalten. Bei einzeln angelegten
und allen bereits bestehenden Events sind beide Angaben leer.

#### Scenario: Anmeldung an einem erzeugten Termin

- **WHEN** ein Mitglied sich für einen aus einer Vorlage erzeugten Termin
  anmeldet
- **THEN** durchläuft die Anmeldung dieselbe kapazitätsprüfende RPC wie bei
  jedem anderen Event
- **AND** ist die Kapazität erschöpft, landet es auf der Warteliste

#### Scenario: Kapazität gilt je Termin, nicht je Serie

- **WHEN** eine Vorlage mit Kapazität 10 vier Termine erzeugt
- **THEN** trägt jeder der vier Termine eine eigene Kapazität von 10
- **AND** eine Anmeldung an einem Termin verbraucht keinen Platz an einem anderen

#### Scenario: Das Erzeugen legt keine Anmeldungen an

- **WHEN** eine Erzeugung Termine schreibt
- **THEN** entsteht dabei keine einzige Anmeldezeile

#### Scenario: Bestehende Events bleiben unberührt

- **WHEN** die Änderung ausgerollt wird
- **THEN** tragen alle vorher bestehenden Events weder Vorlagenzugehörigkeit
  noch Slot
- **AND** ihr Verhalten ändert sich nicht

### Requirement: Eine Erzeugung kündigt die Reihe genau einmal an

Ein einzeln angelegtes Event löst heute einen Hinweis an die gesamte
Mitgliedschaft aus. Für eine Erzeugung aus einer Vorlage SHALL dieser Rundruf je
Termin **unterdrückt** und durch **genau einen** Hinweis je Erzeugung ersetzt
werden, der die Reihe ankündigt.

Der Feed-Beitrag MUSS dagegen je Termin bestehen bleiben — Termine sind
listenrelevant.

Ohne diese Regel schriebe eine Erzeugung von 52 Terminen 52 plattformweite
Rundrufe samt Push in einer einzigen Transaktion.

#### Scenario: Zweiundfünfzig Termine, ein Rundruf

- **WHEN** eine Erzeugung 52 Termine schreibt
- **THEN** entsteht höchstens ein Rundruf an die Mitgliedschaft
- **AND** es entstehen 52 Feed-Beiträge

#### Scenario: Ein einzeln angelegtes Event bleibt, wie es war

- **WHEN** ein Host ein Event ohne Vorlage anlegt
- **THEN** löst es wie bisher genau einen Rundruf aus

### Requirement: Die Erzeugung ist nach oben begrenzt

Eine Erzeugung SHALL entweder eine ausdrückliche Anzahl Termine oder ein
Enddatum nennen. Das System MUSS je Aufruf höchstens **52 Termine** erzeugen und
einen Aufruf abweisen, der mehr verlangt — eine wöchentliche Regel ohne Grenze
wäre unendlich.

Die Grenze gilt **je Aufruf der Erzeugungsfunktion**, auch unter Umgehung der
Oberfläche. Sie ist ein Schutz gegen Versehen und **keine** Sicherheitsgrenze:
wer viele Events anlegen will, kann sie seit jeher einzeln anlegen.

`anzahl` zählt **erzeugte Termine**, nicht durchlaufene Monate. Die Obergrenze
wird an der Kandidatenliste **vor** dem Einfügen geprüft.

#### Scenario: Anzahl über der Obergrenze

- **WHEN** eine Erzeugung 53 Termine anfordert
- **THEN** wird der Aufruf abgewiesen
- **AND** es entsteht kein einziger Termin, auch kein Teilergebnis von 52

#### Scenario: Enddatum jenseits der Obergrenze

- **WHEN** eine wöchentliche Regel mit einem Enddatum aufgerufen wird, das mehr
  als 52 Vorkommnisse einschlösse
- **THEN** wird der Aufruf abgewiesen
- **AND** es entsteht kein einziger Termin

#### Scenario: Weder Anzahl noch Enddatum

- **WHEN** eine Erzeugung ohne Anzahl und ohne Enddatum aufgerufen wird
- **THEN** wird der Aufruf abgewiesen

#### Scenario: Übersprungene Monate zählen nicht mit

- **WHEN** die Regel „monatlich am 31." mit einer Anzahl von 4 erzeugt
- **THEN** entstehen 4 Termine
- **AND** die übersprungenen Monate ohne 31. sind darin nicht mitgezählt

### Requirement: Jeder erzeugte Termin bekommt eine eigene Cover-Kopie

Trägt die Vorlage ein Cover, SHALL jeder erzeugte Termin auf eine **eigene**
Kopie der Bilddatei im `{uid}/`-Präfix des Hosts zeigen. Zwei Termine MÜSSEN
niemals denselben Cover-Pfad tragen, und die Eindeutigkeit des Cover-Pfads an
`events` MUSS erhalten bleiben — sie ist eine Sicherheitszusage.

Der Name jeder Kopie MUSS unvorhersagbar sein. Ein ableitbarer Name machte eine
verwaiste Datei wiederauffindbar und damit an ein fremdes Event anhängbar.

Das Cover der **Vorlage** selbst SHALL ausschließlich für ihren eigenen Host
lesbar sein. Eine Vorlage trägt keine Sichtbarkeit; ihr Bild darf deshalb weder
öffentlich noch für die Mitgliedschaft signierbar sein.

#### Scenario: Vier Termine, vier Cover-Dateien

- **WHEN** eine Vorlage mit Cover vier Termine erzeugt
- **THEN** tragen die vier Termine vier verschiedene Cover-Pfade
- **AND** jeder liegt im `{uid}/`-Präfix des Hosts

#### Scenario: Vorlage ohne Cover

- **WHEN** eine Vorlage ohne Cover Termine erzeugt
- **THEN** tragen die Termine kein Cover
- **AND** die Erzeugung schlägt deswegen nicht fehl

#### Scenario: Die Eindeutigkeit bleibt bestehen

- **WHEN** versucht wird, zwei Events auf denselben Cover-Pfad zu setzen
- **THEN** weist die Datenbank den zweiten Versuch ab

#### Scenario: Das Vorlagen-Cover ist für Fremde unlesbar

- **WHEN** ein anderes Mitglied oder ein nicht angemeldeter Besucher das
  Cover-Objekt einer fremden Vorlage abrufen will
- **THEN** wird es nicht ausgeliefert

#### Scenario: Der eigene Host sieht sein Vorlagen-Cover

- **WHEN** der Host seiner Vorlage deren Cover anzeigt
- **THEN** wird es ausgeliefert

#### Scenario: Die Sichtbarkeit von Event-Covern ändert sich nicht

- **WHEN** ein nicht angemeldeter Besucher das Cover eines öffentlichen Events
  abruft
- **THEN** verhält sich das System wie vor dieser Änderung

### Requirement: Die Ortszeit der Regel überlebt beide Zeitumstellungen

Eine Wiederholungsregel SHALL ihre Uhrzeit als **Ortszeit** samt Zeitzone
führen, nicht als festen Zeitpunkt. Die Zeitzone MUSS beim Speichern gegen die
bekannten Zonennamen geprüft werden; ein Tippfehler darf nicht erst beim
Erzeugen auffallen.

Für die beiden Umstellungstage MUSS das Verhalten festgelegt sein:

- **Frühjahr**, wenn die Ortszeit in die übersprungene Stunde fällt: der Termin
  schaltet weiter und entfällt **nicht**.
- **Herbst**, wenn die Ortszeit doppelt vorkommt: es gilt die erste Lesart.

#### Scenario: Über die Umstellung im Oktober hinweg

- **WHEN** die Regel „jeden Dienstag 19:00" Termine erzeugt, die den letzten
  Sonntag im Oktober 2026 umschließen
- **THEN** liegt jeder Termin um 19:00 Ortszeit
- **AND** die UTC-Zeitpunkte vor und nach der Umstellung unterscheiden sich um
  eine Stunde gegenüber der reinen Wochendifferenz

#### Scenario: Die Stunde, die es nicht gibt

- **WHEN** eine Regel einen Termin auf 02:30 Ortszeit am Tag der
  Frühjahrsumstellung legt
- **THEN** entsteht ein Termin
- **AND** er liegt um 03:30 Ortszeit

#### Scenario: Die Stunde, die es zweimal gibt

- **WHEN** eine Regel einen Termin auf 02:30 Ortszeit am Tag der
  Herbstumstellung legt
- **THEN** entsteht genau ein Termin
- **AND** er liegt auf der ersten der beiden Lesarten

#### Scenario: Unbekannte Zeitzone

- **WHEN** eine Vorlage mit einer Zeitzone gespeichert wird, die es nicht gibt
- **THEN** wird das Speichern abgewiesen

### Requirement: Ein einzelner Termin lässt sich ändern oder absagen

Weil erzeugte Termine gewöhnliche Events sind, SHALL das Verschieben eines
einzelnen Termins das Bearbeiten dieser Zeile sein und das Absagen das Löschen.
Ein eigenes Ausnahmemodell ist nicht erforderlich.

Der festgehaltene Slot eines Termins MUSS beim Verschieben **unverändert**
bleiben. Nur so bleibt der Slot belegt und die Regel legt ihn nicht erneut an.

#### Scenario: Einzelner Termin verschoben

- **WHEN** der Host den Beginn eines erzeugten Termins ändert
- **THEN** gilt die Änderung nur für diesen Termin
- **AND** die übrigen Termine der Vorlage bleiben unverändert

#### Scenario: Ein verschobener Termin kehrt nicht zurück

- **WHEN** ein Termin verschoben wurde und danach aus derselben Vorlage erneut
  erzeugt wird
- **THEN** entsteht für seinen ursprünglichen Slot **kein** zweiter Termin

#### Scenario: Einzelner Termin abgesagt

- **WHEN** der Host einen erzeugten Termin löscht
- **THEN** verschwindet nur dieser Termin
- **AND** die Vorlage und die übrigen Termine bestehen fort

### Requirement: Eine geänderte Vorlage aktualisiert nur unbelegte Zukunft

Wird eine Vorlage geändert und erneut erzeugt, SHALL das System bestehende
Termine derselben Vorlage aktualisieren, die **in der Zukunft liegen und keine
Anmeldungen tragen**. Termine mit Anmeldungen und alle vergangenen Termine
MÜSSEN unangetastet bleiben.

Es DARF dabei kein zweiter Termin für einen bereits belegten Slot entstehen.

#### Scenario: Uhrzeit der Vorlage geändert

- **WHEN** die Ortszeit einer Vorlage von 19:00 auf 20:00 geändert und erneut
  erzeugt wird
- **THEN** liegen die zukünftigen anmeldungsfreien Termine danach um 20:00
- **AND** es steht kein 19:00-Termin derselben Woche daneben

#### Scenario: Termine mit Anmeldungen bleiben, wie sie sind

- **WHEN** dieselbe Änderung erfolgt und ein zukünftiger Termin Anmeldungen
  trägt
- **THEN** bleibt dieser Termin unverändert
- **AND** seine Anmeldungen bleiben erhalten

#### Scenario: Vergangene Termine bleiben, wie sie sind

- **WHEN** dieselbe Änderung erfolgt
- **THEN** bleibt jeder bereits vergangene Termin unverändert

#### Scenario: Erneute Erzeugung schont angemeldete Termine

- **WHEN** aus einer Vorlage erneut Termine erzeugt werden und ein bestehender
  Termin Anmeldungen trägt
- **THEN** bleibt dieser Termin bestehen
- **AND** seine Anmeldungen bleiben erhalten
