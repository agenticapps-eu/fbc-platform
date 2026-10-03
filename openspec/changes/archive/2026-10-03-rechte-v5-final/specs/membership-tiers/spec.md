## ADDED Requirements

### Requirement: Die drei genannten Stufen unterscheiden sich in Rechten

Das System SHALL DISCOVER (Rang 4), FOCUS (Rang 5) und IMPACT (Rang 6) nicht nur
im Namen unterscheiden, sondern in dem, was sie dürfen. Welche Rechte das sind,
SHALL in `public.berechtigungen` stehen und nirgends sonst; die Stufen selbst
SHALL weiterhin nur ihren Rang tragen.

Zum Go-live SHALL die Zuordnung Detlevs SPEC 01 (V5 FINAL, 01.10.2026) folgen:

- **DISCOVER** trägt **kein** Recht aus `berechtigungen`. Was es kann, kann es
  über die Clubschwelle: Feed und Inhalte, Academy ansehen, an Events
  teilnehmen, ein einzelnes Profil lesen, eine Kontaktanfrage senden, mit
  angenommenen Kontakten schreiben.
- **FOCUS** trägt zusätzlich `profil.business`, `organisation.verwalten`,
  `suche_biete`, `vorschlaege`.
- **IMPACT** trägt zusätzlich `verzeichnis.suchen`, `events.erstellen`,
  `community.erstellen`, `projekt.erstellen`, `academy.anbieten`,
  `fbc_format.initiieren`.

Dass DISCOVER kein Recht trägt, SHALL als Aussage gelten und nicht als Lücke:
die Clubschwelle ist die Leistung dieser Stufe, und sie steht nicht in der
Rechtetabelle.

Ein Rechtegewinn SHALL **ohne Neuanmeldung** wirken, weil er wie die Stufe
selbst bei jedem Aufruf aus der Datenbank kommt.

#### Scenario: DISCOVER trägt kein Recht

- **GIVEN** ein aktiviertes Konto auf Rang 4
- **WHEN** es `meine_rechte()` aufruft
- **THEN** kommt ein leeres Array zurück

#### Scenario: FOCUS trägt vier Rechte

- **GIVEN** ein aktiviertes Konto auf Rang 5
- **WHEN** es `meine_rechte()` aufruft
- **THEN** kommen genau vier Schlüssel zurück, und `verzeichnis.suchen` ist
  nicht darunter

#### Scenario: IMPACT trägt alle zehn

- **GIVEN** ein aktiviertes Konto auf Rang 6
- **WHEN** es `meine_rechte()` aufruft
- **THEN** kommen alle zehn Schlüssel zurück

#### Scenario: Eine gesetzte Stufe wirkt ohne Neuanmeldung

- **GIVEN** ein angemeldetes Konto auf Rang 4
- **WHEN** ein Admin seine Stufe auf Rang 6 setzt und das Konto erneut
  `meine_rechte()` aufruft, ohne sich abzumelden
- **THEN** kommen die zehn Schlüssel zurück
