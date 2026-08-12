## ADDED Requirements

### Requirement: Ohne Session löst die Eventliste keine Hosts auf

Der Client SHALL Hosts eines Events nur mit einer Session auflösen. Ohne
Session SHALL er **weder** `profiles_public` **noch** `partners` abfragen; ein
Event SHALL dann ohne Host-Angabe erscheinen.

Beide Quellen sind für `anon` gesperrt — `partners` trägt sein `select`
ausschließlich für `authenticated` und die Anforderung „Partner reads are gated
behind authentication" verlangt genau das. Eine Regel, die nur die
Profil-Hälfte überspränge, ließe die zweite Abweisung stehen.

Die Eventseiten SHALL für Nicht-Mitglieder erreichbar bleiben; die Regel
betrifft die Anreicherung, nicht den Zugang.

#### Scenario: Ausgeloggt wird kein Host abgefragt

- **WHEN** ein ausgeloggter Besucher die Eventliste oder ein einzelnes Event
  öffnet und die Events Profil- und Partner-Hosts tragen
- **THEN** wird weder `profiles_public` noch `partners` abgefragt
- **AND** die Events erscheinen ohne Host-Angabe
- **AND** die Konsole bleibt frei von `42501`

#### Scenario: Eingeloggt bleiben beide Host-Arten unverändert

- **WHEN** ein authentifiziertes, aktiviertes Mitglied dieselben Events öffnet
- **THEN** werden `profiles_public` und `partners` wie bisher abgefragt
- **AND** ein Partner-Host erscheint mit Name und Logo, ein über
  `profiles_public` sichtbarer Profil-Host mit Name, Avatarbild und Stufe
- **AND** ein Partner-Host hat weiterhin Vorrang vor einem Profil-Host
