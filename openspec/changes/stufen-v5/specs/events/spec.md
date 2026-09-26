## MODIFIED Requirements

### Requirement: Registration goes through a capacity-aware RPC with a visibility-dependent threshold

The system SHALL register a member through the `SECURITY DEFINER` function
`register_for_event(uuid)`, which locks the event row to serialize concurrent
sign-ups, assigns `registered` while `capacity` is null or unfilled and otherwise
`waitlist`, and enforces a participation threshold that depends on the event's
visibility: for `public` events any authenticated member (including rank 1,
`active`) may register, while for `members` events the caller must hold at least
rank 4 (`discover` in the ladder introduced by AGE-903) or be the host.

The function SHALL additionally require the caller's account to be **activated**,
and SHALL apply that requirement to `public` events as well. This is a
deliberate behavioural change (AGE-495): a self-registered guest who was usable
immediately SHALL now confirm their address before signing up for anything,
including a public event. The cost is accepted because the alternative — one
ungated write path into member data — would make the gate a matter of taste
rather than a boundary. The threshold by tier SHALL remain unchanged behind it.

#### Scenario: Sign-up past capacity goes to the waitlist

- **WHEN** an activated member registers for a `registered`-full event with a set
  `capacity`
- **THEN** the function returns `waitlist` and stores the row with
  `status = 'waitlist'`

#### Scenario: Public event admits a basic member

<!-- Titel zeichengleich; `basic` heisst nach AGE-903 `active` und trägt
     denselben Rang 1. -->

- **WHEN** an `active` (rank 1) authenticated **and activated** member registers
  for a `public` event
- **THEN** registration succeeds

#### Scenario: An unconfirmed account cannot register for a public event

- **WHEN** an authenticated member whose account is not yet activated registers
  for a `public` event
- **THEN** the function raises `not activated` and no registration row is
  written

#### Scenario: Members event requires discover

- **WHEN** an authenticated, activated member below rank 4 registers
  for a `members` event they do not host
- **THEN** the function raises `membership level too low to register`

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

- **WHEN** ein Mitglied unter Rang 4 ein `members`-Event ansieht, das es
  nicht selbst ausrichtet
- **THEN** ist der Anmeldeknopf gesperrt, und der Grund samt der nötigen Stufe
  steht sichtbar daneben

#### Scenario: Ab der Schwelle ist der Knopf frei

- **WHEN** ein Mitglied ab Rang 4 dasselbe Event ansieht
- **THEN** ist der Anmeldeknopf bedienbar

## ADDED Requirements

### Requirement: Wer sich anmelden darf, darf auch absagen

Das System SHALL die Bedingung, unter der ein Mitglied seine eigene Anmeldung
ändern darf, **gleich** der Bedingung halten, unter der es sich anmelden darf.
Die `WITH CHECK`-Klausel von `regs_write_own` SHALL dieselbe
sichtbarkeitsabhängige Prüfung tragen wie `register_for_event`: bei einem
`public`-Event keine Rangprüfung, bei einem `members`-Event Rang 4 oder Host.

**Das behebt einen Widerspruch, der schon vor AGE-903 bestand.** Gemessen am
25.09. verlangte `register_for_event` Rang 3 für ein `members`-Event, während
`regs_write_own` für das UPDATE Rang 4 verlangte — ein Konto auf Rang 3 konnte
sich anmelden und danach nicht absagen. Bei einem `public`-Event war der Bruch
noch grösser: die Anmeldung trug gar keine Rangprüfung, das Absagen verlangte
Rang 4. Ein aktiviertes Konto auf Rang 1 konnte sich also zu einem öffentlichen
Event anmelden und **nie** wieder abmelden.

Der Widerspruch verschwindet nicht von selbst, wenn beide Zahlen auf 4 steigen:
der `public`-Zweig hätte weiter keine Entsprechung. Deshalb wird die Bedingung
gespiegelt, nicht die Zahl angeglichen.

Abgesagt SHALL weiterhin über `status` werden, nicht über DELETE; welche
Spalten ein Mitglied schreiben darf, sagt unverändert das Spaltenrecht und
nicht diese Bedingung.

#### Scenario: Absagen zu einem öffentlichen Event gelingt auf jedem Rang

- **GIVEN** ein aktiviertes Mitglied auf Rang 1, das zu einem `public`-Event
  angemeldet ist
- **WHEN** es seine Anmeldung auf `cancelled` setzt
- **THEN** gelingt das UPDATE

#### Scenario: Absagen zu einem Mitglieder-Event verlangt dieselbe Stufe wie Anmelden

- **GIVEN** ein aktiviertes Mitglied ab Rang 4, das zu einem `members`-Event
  angemeldet ist
- **WHEN** es seine Anmeldung ändert
- **THEN** gelingt das UPDATE

#### Scenario: Unterhalb der Schwelle entsteht gar keine Anmeldung, die hängen bliebe

- **GIVEN** ein aktiviertes Mitglied unter Rang 4 und ein `members`-Event, das
  es nicht ausrichtet
- **WHEN** es sich anzumelden versucht
- **THEN** scheitert bereits die Anmeldung — es kann keine Anmeldung geben, die
  es anschliessend nicht mehr ändern dürfte

#### Scenario: Der Host ändert seine eigene Anmeldung unabhängig von der Stufe

- **GIVEN** der Host eines `members`-Events, dessen eigener Rang unter 4 liegt
- **WHEN** er seine eigene Anmeldung ändert
- **THEN** gelingt das UPDATE — dieselbe Host-Ausnahme wie beim Anmelden
