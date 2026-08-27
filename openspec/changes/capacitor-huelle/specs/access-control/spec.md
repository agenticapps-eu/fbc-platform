## ADDED Requirements

### Requirement: Die Sitzung liegt in einem Speicher, den das System nicht abräumt

Die Anmeldesitzung SHALL auf jeder Plattform in einem Speicher liegen, der
**nicht unter Speicherdruck geleert** wird. In einer mobilen WebView darf das
Betriebssystem den Web-Speicher jederzeit abräumen; eine Sitzung, die nur dort
liegt, verschwindet ohne erkennbaren Anlass und nur bei manchen Mitgliedern.

Auf der Web-Fläche SHALL sich am Speicherort und am Schlüssel **nichts** ändern.
Eine bestehende, angemeldete Web-Sitzung SHALL diesen Umbau überleben und SHALL
NOT abgemeldet werden. Kein Wrapper, kein Präfix, kein zweiter Schlüssel.

Die Weiche zwischen den Speicherorten SHALL an der Laufzeitumgebung entscheiden
und SHALL NOT ein zweiter, eigener Umgebungsschalter sein.

Der gewählte Speicherort SHALL benannt sein, und mit ihm, ob er den Ausweis im
**Klartext** hält. Die verbreiteten nativen Schlüssel-Wert-Speicher tun das und
liegen im Gerätebackup; ein Refresh-Token ist ein langlebiger Ausweis. Diese
Eigenschaft SHALL eine bewusste, festgehaltene Entscheidung sein und SHALL NOT
eine stillschweigende Folge der Plugin-Wahl.

Das Abmelden SHALL den Eintrag im **tatsächlich verwendeten** Speicher
entfernen. Ein Speicher-Adapter, dessen Löschen ins Leere läuft, ergäbe ein
Konto, das sich nicht abmelden lässt — und das sähe in jedem Web-Test grün aus,
weil dort ein anderer Speicher geprüft wird.

#### Scenario: Eine bestehende Web-Sitzung überlebt den Umbau

- **WHEN** ein Mitglied vor dem Umbau im Browser angemeldet war und die Fläche
  nach dem Umbau erneut aufruft
- **THEN** ist es weiterhin angemeldet
- **AND** es musste sein Passwort nicht erneut eingeben

#### Scenario: Die Sitzung überlebt einen Neustart der App

- **WHEN** ein Mitglied sich in der mobilen Anwendung anmeldet und die Anwendung
  vollständig beendet und neu startet
- **THEN** ist es weiterhin angemeldet

#### Scenario: Abmelden entfernt den Ausweis dort, wo er liegt

- **WHEN** ein Mitglied sich in der mobilen Anwendung abmeldet
- **THEN** ist der Sitzungseintrag im nativen Speicher entfernt
- **AND** ein Neustart der Anwendung führt auf die Anmeldung, nicht in ein Konto
