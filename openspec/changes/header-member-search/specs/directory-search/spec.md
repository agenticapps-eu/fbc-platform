## ADDED Requirements

### Requirement: Die Mitgliedersuche ist aus der Kopfzeile erreichbar

Der Rahmen SHALL ein Suchfeld tragen, das Mitglieder über dieselbe RPC
`search_directory` findet, die das Verzeichnis benutzt. Es SHALL NOT eine zweite
Suchimplementierung, eine zweite RPC oder einen zweiten Index einführen — die
Kopfzeile ist ein **Einstieg**, keine eigene Fähigkeit.

Ab **zwei** eingegebenen Zeichen SHALL eine Abfrage laufen, **entprellt mit
300 ms**, sodass nicht jeder Tastendruck eine Server-Abfrage auslöst. Unter zwei
Zeichen SHALL gar nicht abgefragt werden.

Es SHALL höchstens **fünf** Treffer zeigen, je mit Avatarbild, Name und
Berufsbezeichnung. Ein Treffer SHALL beim Auswählen das Profil dieses Mitglieds
öffnen.

Die Suche SHALL **nur Mitglieder** durchsuchen. Events, Beiträge und
Academy-Inhalte SHALL NOT durchsucht werden; das bliebe eine übergreifende Suche
über vier Tabellen und ist für den Go-Live ausdrücklich zurückgestellt.

#### Scenario: Ab zwei Zeichen erscheinen Treffer

- **WHEN** ein aktiviertes Mitglied ab Stufe `discover` zwei oder mehr Zeichen
  eingibt, die auf mindestens ein Profil passen
- **THEN** erscheint nach der Entprellung eine Liste von höchstens fünf
  Treffern mit Avatarbild, Name und Berufsbezeichnung

#### Scenario: Ein einzelnes Zeichen fragt nicht ab

- **WHEN** genau ein Zeichen im Feld steht
- **THEN** läuft keine Abfrage und es erscheint keine Trefferliste

#### Scenario: Schnelles Tippen löst eine Abfrage aus, nicht viele

- **WHEN** mehrere Zeichen innerhalb der Entprellzeit nacheinander eingegeben
  werden
- **THEN** läuft genau eine Abfrage, und zwar mit dem zuletzt eingegebenen Text

#### Scenario: Ein Treffer öffnet das Profil

- **WHEN** ein Treffer ausgewählt wird
- **THEN** öffnet sich das Profil dieses Mitglieds

### Requirement: Der Suchbegriff geht an das Verzeichnis über

Enter im Suchfeld sowie ein Weg „alle Ergebnisse" SHALL auf das
Mitgliederverzeichnis führen und den eingegebenen Suchbegriff **dorthin
übernehmen**, sodass das Verzeichnis unmittelbar dieselbe Suche zeigt.

Die Übernahme SHALL auch dann greifen, wenn das Verzeichnis **bereits geöffnet
ist**. Ein Anfangswert, der nur beim ersten Aufbau der Oberfläche gelesen wird,
SHALL NOT genügen: ein Suchbegriff, der danach eintrifft, käme nie an, und die
Oberfläche zeigte weiter die alte Suche, während die Adresszeile die neue
behauptet.

#### Scenario: Enter führt mit Begriff ins Verzeichnis

- **WHEN** ein Suchbegriff eingegeben und Enter gedrückt wird
- **THEN** öffnet sich das Mitgliederverzeichnis
- **AND** sein Suchfeld trägt denselben Begriff und seine Liste zeigt dessen
  Treffer

#### Scenario: Erneute Suche auf dem bereits geöffneten Verzeichnis

- **WHEN** das Verzeichnis geöffnet ist und aus der Kopfzeile ein **anderer**
  Begriff abgeschickt wird
- **THEN** übernimmt das Verzeichnis den neuen Begriff und zeigt dessen Treffer

### Requirement: Der Sucheinstieg zeigt sich nur, wem er nützt

Ein Einstieg, der für den Betrachter nichts finden kann, SHALL NOT als
funktionsfähiges Feld erscheinen. Welche Zeilen zurückkommen, entscheidet
unverändert allein die RLS; diese Anforderung regelt, was die Oberfläche daraus
macht.

**Ausgeloggt SHALL das Suchfeld entfallen** — samt Lupensymbol. `search_directory`
ist für `anon` nicht ausführbar; jede Eingabe liefe in einen Rechtefehler. Eine
namenlose Ersatzfassung SHALL NOT an seine Stelle treten (siehe „Neue
anon-Flächen geben keine Mitgliedsnamen preis").

**Unterhalb von `discover` SHALL statt eines Nulltreffers ein Aufstiegs-Hinweis
erscheinen.** Die Policy `profiles_select_self_or_discover` gibt einem Konto
unterhalb Rang 3 höchstens die **eigene** Zeile zurück — kein Fehler, nur Leere.
„Keine Mitglieder gefunden" wäre dort unwahr: es gibt Treffer, das Konto darf sie
nicht sehen. Der Hinweis SHALL die nötige Stufe benennen und einen Weg zum
Aufstieg anbieten.

**Ein echter Nulltreffer SHALL benannt sein**, nicht als leere Liste erscheinen,
und einen Weg ins Verzeichnis anbieten.

Ein nicht aktiviertes Konto SHALL über diesen Einstieg nichts finden. Die Sperre
SHALL das bestehende Aktivierungs-Gate bleiben und SHALL NOT in der Oberfläche
nachgebaut werden; der **Nachweis** SHALL an der Datenbank geführt werden, nicht
an der Oberfläche.

#### Scenario: Ausgeloggt gibt es kein Suchfeld

- **WHEN** ein ausgeloggter Besucher den Rahmen sieht, in beliebiger Fensterbreite
- **THEN** trägt die Kopfzeile weder ein Suchfeld noch ein Lupensymbol

#### Scenario: Unterhalb von discover erscheint der Aufstiegs-Hinweis

- **WHEN** ein aktiviertes Mitglied unterhalb von `discover` einen Suchbegriff
  eingibt
- **THEN** erscheint ein Hinweis, der die nötige Stufe nennt und zum Aufstieg
  führt
- **AND** es erscheint keine Meldung, es sei nichts gefunden worden

#### Scenario: Echter Nulltreffer ist formuliert

- **WHEN** ein Mitglied ab `discover` einen Begriff eingibt, auf den kein Profil
  passt
- **THEN** erscheint eine benannte Meldung samt Weg ins Verzeichnis, keine leere
  Liste

#### Scenario: Ein nicht aktiviertes Konto findet nichts

- **WHEN** ein Konto ohne bestätigte Aktivierung `search_directory` mit einem
  Begriff aufruft, der auf mehrere Profile passt
- **THEN** kommt keine fremde Zeile zurück

### Requirement: Der Sucheinstieg ist mit Tastatur und auf dem Telefon bedienbar

Das Feld und seine Trefferliste SHALL vollständig mit der Tastatur bedienbar
sein: ↑ und ↓ wandern durch die Treffer, Enter wählt den hervorgehobenen Treffer
(und ohne Hervorhebung führt es ins Verzeichnis), Escape schließt die Liste und
lässt den Fokus im Feld.

Die Trefferliste SHALL für Hilfstechnik als solche erkennbar sein: Feld und Liste
SHALL als zusammengehörige Auswahl ausgezeichnet sein, und der jeweils
hervorgehobene Treffer SHALL als der aktive benannt sein.

Unterhalb der Umbruchbreite, ab der das Feld heute entfällt, SHALL ein
Lupensymbol die Suche öffnen. Die geöffnete Fassung SHALL dieselbe Sperre und
Fokus-Falle benutzen wie die übrigen Overlays, statt eine eigene mitzubringen.

#### Scenario: Pfeiltasten und Enter wählen einen Treffer

- **WHEN** bei offener Trefferliste ↓ und dann Enter gedrückt wird
- **THEN** öffnet sich das Profil des hervorgehobenen Treffers

#### Scenario: Escape schließt, ohne den Fokus zu verlieren

- **WHEN** bei offener Trefferliste Escape gedrückt wird
- **THEN** schließt die Liste und der Fokus bleibt im Suchfeld

#### Scenario: Enter ohne Hervorhebung führt ins Verzeichnis

- **WHEN** Enter gedrückt wird, ohne dass ein Treffer hervorgehoben ist
- **THEN** öffnet sich das Verzeichnis mit dem eingegebenen Begriff

#### Scenario: Auf dem Telefon öffnet ein Lupensymbol die Suche

- **WHEN** ein eingeloggtes Mitglied den Rahmen in schmaler Fensterbreite sieht
  und das Lupensymbol betätigt
- **THEN** öffnet sich das Suchfeld, ist beschreibbar und liefert dieselben
  Treffer wie in breiter Ansicht
