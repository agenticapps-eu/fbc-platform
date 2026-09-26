## ADDED Requirements

### Requirement: Die Stufenauswahl bietet nur die drei Clubstufen an

Das System SHALL in der Verwaltung beim Setzen der Stufe eines Mitglieds
ausschliesslich **DISCOVER, FOCUS und IMPACT** zur Auswahl stellen. ACTIVE,
BOOST und CONNECT SHALL NOT wählbar sein (Detlev, 25.09.).

**Eine bestehende tiefere Stufe SHALL trotzdem angezeigt werden.** Ein Konto
auf ACTIVE — etwa aus der Selbstregistrierung — SHALL seine Stufe im Bestand
korrekt ausweisen; nur der Weg dorthin zurück fehlt. Eine Auswahl, die eine
gesetzte Stufe verschweigt, liesse den Admin glauben, das Konto stehe auf der
ersten angebotenen.

Die Beschränkung SHALL in der **Oberfläche** liegen, nicht in
`admin_set_tier()`. Die Funktion SHALL alle sechs Schlüssel weiter annehmen und
weiter in beide Richtungen setzen können. Zwei Gründe: eine Korrektur nach
unten muss möglich bleiben, wenn ein Konto versehentlich zu hoch gesetzt wurde
— genau dafür gibt es `admin_set_tier()` neben `apply_upgrade()`; und eine
Oberflächenregel in einer `SECURITY DEFINER`-Funktion zu verankern machte aus
einer Anzeigeentscheidung eine Rechtegrenze, die niemand mehr ändern kann, ohne
eine Migration zu schreiben.

Daraus folgt ausdrücklich: diese Anforderung ist **keine Sicherheitsgrenze**.
Wer die Funktion direkt aufruft, setzt weiterhin jede Stufe.

#### Scenario: Die Auswahl zeigt drei Stufen

- **WHEN** ein Admin die Stufe eines Mitglieds setzen will
- **THEN** stehen genau DISCOVER, FOCUS und IMPACT zur Wahl

#### Scenario: Eine bestehende ACTIVE-Stufe wird angezeigt

- **GIVEN** ein Konto auf `active`
- **WHEN** ein Admin es im Bestand ansieht
- **THEN** weist die Fläche `active` als aktuelle Stufe aus, obwohl sie nicht
  wählbar ist

#### Scenario: Die Funktion nimmt weiterhin jede Stufe an

- **WHEN** `admin_set_tier()` mit `active` aufgerufen wird
- **THEN** setzt sie die Stufe — die Beschränkung liegt in der Oberfläche, und
  die Korrektur eines zu hoch importierten Kontos bleibt möglich
