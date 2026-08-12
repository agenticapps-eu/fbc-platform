## ADDED Requirements

### Requirement: Ohne Session fragt der Feed keine Autorendaten ab

Der Client SHALL die Anreicherung der Beitrags-Autoren aus `profiles_public`
nur mit einer Session ausführen. Ohne Session SHALL er die Abfrage **gar nicht
erst absetzen**.

Der Grund ist nicht die Sichtbarkeit, sondern die Vergeblichkeit:
`profiles_public` trägt für `anon` bewusst kein Leserecht (AGE-239), die
Abfrage wird also mit `42501` abgewiesen. Diese Anforderung SHALL NOT als
Sicherheitsgrenze gelten — die Grenze bleibt das fehlende Recht in der
Datenbank. Die Maskierung der Anzeige regelt unverändert `displayAuthor`, das
ohne Session jeden Autor als „Ein Mitglied" ohne Avatarbild führt.

Eine Session SHALL an der bereits geführten Profil-Kennung erkannt werden, die
der Lesepfad für `likedByMe` ohnehin durchreicht — nicht an einer zweiten,
daneben gestellten Abfrage des Sitzungszustands.

#### Scenario: Ausgeloggt wird nicht gefragt

- **WHEN** ein ausgeloggter Besucher die Aktivitätenseite oder die Startseite
  öffnet und der Feed Beiträge enthält
- **THEN** wird keine Abfrage auf `profiles_public` abgesetzt
- **AND** die Konsole bleibt frei von `42501 permission denied for view
  profiles_public`

#### Scenario: Die Anzeige bleibt unverändert maskiert

- **WHEN** ein ausgeloggter Besucher einen Beitrag sieht
- **THEN** trägt der Autor weiterhin den Namen „Ein Mitglied" und kein
  Avatarbild
- **AND** dieses Ergebnis stammt aus der Maskierung der Anzeige, nicht aus dem
  Fehlschlag einer Abfrage

#### Scenario: Eingeloggt bleibt die Anreicherung unverändert

- **WHEN** ein authentifiziertes, aktiviertes Mitglied denselben Feed öffnet
  und die Autoren über `profiles_public` sichtbar sind
- **THEN** wird `profiles_public` wie bisher abgefragt
- **AND** Name, Avatarbild und Stufen-Badge dieser Autoren erscheinen
- **AND** für Autoren, die `profiles_public` nicht führt, bleibt es beim
  bisherigen Rückfall auf „Mitglied"
