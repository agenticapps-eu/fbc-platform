## ADDED Requirements

### Requirement: Die Academy verlangt die Clubstufe

Das System SHALL `/academy` hinter eine Stufenschwelle bei **Rang 4**
(`discover` nach AGE-903) stellen. Ein aktiviertes Konto darunter SHALL die
Fläche nicht erreichen und stattdessen die Wand mit der nötigen Stufe sehen,
wie jede andere stufengebundene Route.

**Das ist eine neue Zusage, keine Anhebung.** Gemessen am 25.09. trug
`/academy` ausschliesslich `requiresAuth: true`: kein `minTier`, keine
Rangprüfung, und keine Tabelle mit einer Policy, an der eine Stufe hinge — die
Lektionen sind kuratierte Inhalte ohne eigene RLS. Jedes aktivierte Konto sah
die Academy, auch auf Rang 1. Die Beschreibung „Academy ab `discover`" stand
seit dem Sechs-Stufen-Modell in den Stufentexten und war nie gebaut.

**Die Schwelle ist Komfort, nicht Sicherheitsgrenze, und das SHALL benannt
bleiben.** Hinter der Academy liegen keine Mitgliederdaten, die eine RLS
schützen müsste; sie zeigt geteilte Videos. Die Schranke setzt die Zusage der
Stufentexte durch, sie verteidigt keine Zeile. Wo die Academy Mitgliederdaten
anfasst — die Namensauflösung der Teilenden über `profiles_public` —, gilt
unverändert, was dort gilt.

Der Navigationseintrag SHALL derselben Schwelle folgen wie die Route. Ein
sichtbarer Eintrag, der in eine Wand führt, ist schlechter als kein Eintrag.

#### Scenario: Ein Konto unterhalb des Clubs erreicht die Academy nicht

- **GIVEN** ein aktiviertes Konto auf Rang 1, 2 oder 3
- **WHEN** es `/academy` aufruft
- **THEN** erscheint die Stufenwand mit der nötigen Stufe, nicht die Academy

#### Scenario: Der Navigationseintrag verschwindet mit der Fläche

- **GIVEN** dasselbe Konto
- **WHEN** es die Seitenleiste ansieht
- **THEN** trägt „Entdecken" keinen Eintrag „Academy"

#### Scenario: Ab Rang 4 ist die Academy unverändert erreichbar

- **GIVEN** ein aktiviertes Konto ab Rang 4
- **WHEN** es `/academy` aufruft
- **THEN** erscheinen die Reiter unverändert, mit allen Zusagen dieser
  Capability
