## ADDED Requirements

### Requirement: Der Verlauf eines Gesprächs lädt eine begrenzte Seite, nicht alles

Das Laden eines Gesprächsverlaufs SHALL eine **begrenzte** Zahl von Nachrichten
anfordern. Die Grenze SHALL als ausdrückliche Angabe auf der Abfrage stehen, und
die Ordnung SHALL **von der Datenbank vor der Grenze** hergestellt werden. Eine
Grenze nach beliebiger Ordnung wählte willkürlich, welche Nachrichten fehlen.

Geladen SHALL vom **jüngsten Ende** her werden. Ein Gespräch beginnt für das
Mitglied bei der letzten Nachricht, nicht bei der ersten.

Jede Fläche, die einen Verlauf zeigt, SHALL einen Weg zu den **älteren**
Nachrichten anbieten. Eine Grenze ohne diesen Weg ist keine Seite, sondern eine
dauerhafte Abschneidung, die sich als eine ausgibt.

Diese Anforderung ergänzt „The conversation list loads a bounded page, not every
message" und ersetzt sie nicht: jene bindet die **Liste der Gespräche** und die
eine Vorschauzeile je Gespräch, diese den **Verlauf innerhalb** eines Gesprächs.
Beide bestehen aus demselben Grund — die Last wächst damit, wie viel Mitglieder
**schreiben**, ist deshalb bei der Einführung unsichtbar und am grössten, wenn
das Nachrichtensystem angenommen wird.

Bereits nachgeladene ältere Nachrichten SHALL erhalten bleiben, bis das Mitglied
das Gespräch verlässt. Insbesondere SHALL **keine erneute Abfrage** des Verlaufs
den sichtbaren Bestand kürzen — auch dann nicht, wenn sie **vor** dem Nachladen
begonnen hat und erst danach antwortet. Ein Verlauf, der sich auf die neueste
Seite zurückstellt, nähme dem Mitglied genau das weg, wofür es den Weg zu den
älteren benutzt hat; dass es davon abhinge, in welcher Reihenfolge zwei Abfragen
antworten, machte es unvorhersehbar statt selten.

Ist einmal festgestellt, dass es nichts Älteres mehr gibt, SHALL das so bleiben.
Eine erneute Abfrage SHALL diese Feststellung nicht zurücknehmen — ein
Bedienelement, das nach jedem Fensterwechsel wieder erscheint und dann eine leere
Seite lädt, behauptet Inhalt, den es nicht gibt.

Die Grenze SHALL NOT als Sichtbarkeitsgrenze gelten. Welche Nachrichten ein
Mitglied lesen darf, SHALL weiterhin allein die Zeilenpolitik auf `messages`
entscheiden; eine Seitengrenze ist Komfort und Last, keine Berechtigung.

#### Scenario: Eine Seite des Verlaufs ist begrenzt

- **WHEN** ein Mitglied ein Gespräch öffnet, das mehr Nachrichten hält als eine
  Seite fasst
- **THEN** trägt die Abfrage eine ausdrückliche Grenze, und die Antwort hält
  höchstens so viele Nachrichten

#### Scenario: Die Seite hält das jüngste Ende

- **WHEN** ein Mitglied ein Gespräch öffnet, das mehr Nachrichten hält als eine
  Seite fasst
- **THEN** sind die zuletzt gesendeten Nachrichten die geladenen

#### Scenario: Die älteren Nachrichten bleiben erreichbar

- **WHEN** ein Mitglied einen Verlauf betrachtet, von dem ältere Nachrichten
  ungeladen sind
- **THEN** bietet ein Bedienelement die älteren an, und seine Betätigung setzt
  sie vor die bereits sichtbaren

#### Scenario: Ist nichts Älteres da, gibt es auch kein Bedienelement

- **WHEN** ein Verlauf vollständig geladen ist
- **THEN** wird kein Weg zu älteren Nachrichten angeboten

#### Scenario: Eine eintreffende Nachricht kürzt den Verlauf nicht

- **GIVEN** ein Mitglied hat ältere Nachrichten nachgeladen
- **WHEN** in demselben Gespräch eine neue Nachricht eintrifft
- **THEN** bleiben die nachgeladenen älteren sichtbar, und die neue tritt unten
  hinzu

#### Scenario: Eine Neuabfrage aus der Zeit vor dem Nachladen kürzt nicht

- **GIVEN** eine erneute Abfrage des Verlaufs ist unterwegs
- **WHEN** das Mitglied währenddessen ältere Nachrichten nachlädt und die alte
  Abfrage erst danach antwortet
- **THEN** bleiben die nachgeladenen älteren sichtbar

#### Scenario: Ein erschöpfter Verlauf bleibt erschöpft

- **GIVEN** ein Verlauf ist vollständig geladen und bietet keinen Weg zu älteren
  Nachrichten mehr an
- **WHEN** der Verlauf erneut abgefragt wird
- **THEN** erscheint das Bedienelement nicht wieder

#### Scenario: Der Tagesmarker wandert zur ältesten Zeile seines Tages

- **GIVEN** die oberste geladene Nachricht ist nicht die erste ihres Kalendertages
- **WHEN** ältere Nachrichten desselben Tages nachgeladen werden
- **THEN** steht der Tagesmarker danach über der ältesten Nachricht dieses Tages
  und nicht mehr über der vorher obersten
