## ADDED Requirements

### Requirement: Der Anmeldeknopf verspricht nichts, was die Stufe nicht hergibt

Die Event-Fläche SHALL den Anmeldeknopf **sperren**, wenn der Betrachter die
Teilnahmeschwelle des Events nicht erreicht, und SHALL den Grund **vor** dem
Klick nennen — einschließlich der dafür nötigen Stufe und eines Wegs zur
Mitgliedschaft.

Sie SHALL dabei dieselbe Bedingung spiegeln wie `register_for_event`, mit allen
ihren Ausnahmen: `public`-Events stehen jedem eingeloggten, aktivierten Mitglied
offen, und der **Host** darf zu seinem eigenen `members`-Event unabhängig von
seiner Stufe.

Sie SHALL NOT sperren, solange die Stufe des Betrachters noch **unbekannt** ist.
Ein Ladezustand ist kein Ausschlussgrund, und die Funktion hält ohnehin.

Diese Anforderung ist **keine Sicherheitsgrenze** und SHALL NOT als solche
gelesen werden: Die Hürde bleibt `register_for_event`. Sie ersetzt lediglich eine
Fehlermeldung nach dem Klick — den rohen englischen Text der Datenbank
(„membership level too low to register") — durch eine Auskunft davor.

#### Scenario: Eine zu niedrige Stufe sperrt den Knopf

- **WHEN** ein Mitglied unter `discover` ein `members`-Event ansieht, das es
  nicht selbst ausrichtet
- **THEN** ist der Anmeldeknopf gesperrt, und der Grund samt der nötigen Stufe
  steht sichtbar daneben

#### Scenario: Ab der Schwelle ist der Knopf frei

- **WHEN** ein Mitglied ab `discover` dasselbe Event ansieht
- **THEN** ist der Anmeldeknopf bedienbar

#### Scenario: Ein öffentliches Event sperrt nicht

- **WHEN** ein `basic`-Mitglied ein `public`-Event ansieht
- **THEN** ist der Anmeldeknopf bedienbar

#### Scenario: Der Host darf zu seinem eigenen Mitglieder-Event

- **WHEN** ein `basic`-Mitglied ein `members`-Event ansieht, dessen Host es selbst
  ist
- **THEN** ist der Anmeldeknopf bedienbar

#### Scenario: Der rohe Datenbanktext erscheint nicht

- **WHEN** die Sperre greift
- **THEN** erscheint der Text „membership level too low to register" nirgends
