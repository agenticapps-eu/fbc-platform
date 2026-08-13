## ADDED Requirements

### Requirement: Ein Admin erreicht auch die Anschrift eines Mitglieds

Das System SHALL die fünf Adressfelder `street`, `postal_code`, `city`, `state`
und `country` in die Weißliste von `admin_update_profile(target, patch)`
aufnehmen und sie in denselben Upsert auf `public.profile_contacts` schreiben,
der heute `email` und `phone` trägt. Ohne das bräche der Admin-Weg an genau der
Stelle ab, an der er gebraucht wird: beim Nacharbeiten importierter Datensätze.

Der Lesepfad `admin_get_profile(target)` SHALL die Felder mitliefern; er gibt
die Kontaktzeile bereits als Ganzes zurück und braucht dafür keine Aufzählung.

Die Regeln der Funktion SHALL unverändert gelten: ein Schlüssel außerhalb der
Weißliste bricht ab, ein fehlender Schlüssel lässt das Feld unverändert, ein
Schlüssel mit JSON-`null` leert es, und jeder Aufruf hinterlässt eine Zeile in
`admin_audit`.

#### Scenario: Ein Admin trägt eine Anschrift nach

- **WHEN** ein Konto mit `admin`-Rolle `admin_update_profile` mit Adressfeldern
  im `patch` aufruft
- **THEN** wird die Kontaktzeile des Zielprofils geschrieben oder angelegt, auch
  wenn das Zielkonto noch nicht bestätigt ist

#### Scenario: Die Anschrift kommt im Admin-Lesepfad mit

- **WHEN** ein Admin `admin_get_profile` für ein Profil mit Anschrift aufruft
- **THEN** enthält der zurückgegebene Kontaktabschnitt die fünf Adressfelder

#### Scenario: Ein normales Mitglied kommt auch über die Adressfelder nicht durch

- **WHEN** ein bestätigtes Mitglied ohne `admin`-Rolle `admin_update_profile`
  mit Adressfeldern für ein fremdes Profil aufruft
- **THEN** bricht die Funktion mit einer Ausnahme ab und keine Zeile wird
  geändert
