## ADDED Requirements

### Requirement: Suche und Filter stehen in einer mitlaufenden rechten Spalte

Das Mitgliederverzeichnis SHALL sein Suchfeld und seine Facetten in einer
rechten Inhaltsspalte führen, die beim Blättern mitläuft. Die Spalte SHALL
**innerhalb** des Inhaltsbereichs unter der Kopfzeile sitzen, nicht an der
Viewport-Kante — das unterscheidet sie von den beiden angedockten Leisten.

Die Spalte SHALL erst ab `lg` neben der Liste stehen. Darunter SHALL sie in den
Fluss fallen und hinter einem Aufklapp-Schalter liegen, der zugeklappt startet.

Die erweiterten Filter SHALL in der Spalte **dauerhaft offen** stehen. Ihr
bisheriges Zuklappen war eine Antwort auf fehlende Höhe über der Liste; in einer
eigenen Spalte gibt es diesen Mangel nicht mehr.

Die Spalte SHALL 16rem breit sein und 24 px Abstand zur Liste halten — dieselben
Masse wie die Filterspalte der Aktivität, damit beide Flächen dieselbe Kante
zeigen.

#### Scenario: Ab lg steht die Spalte rechts und läuft mit

- **WHEN** das Verzeichnis ab `lg` dargestellt und die Liste gescrollt wird
- **THEN** bleibt die Spalte sichtbar, statt wegzuscrollen

#### Scenario: Unterhalb von lg klappt sie zu

- **WHEN** das Verzeichnis unterhalb von `lg` geöffnet wird
- **THEN** steht die Spalte im Fluss und ist zugeklappt
- **AND** ein Schalter klappt sie auf

#### Scenario: Die erweiterten Filter stehen offen

- **WHEN** das Verzeichnis ab `lg` geöffnet wird
- **THEN** sind die erweiterten Filter ohne weiteres Zutun sichtbar

## MODIFIED Requirements

### Requirement: Die Galerie-Karte ordnet ein, statt den ganzen Kompass zu zeigen

Das System SHALL auf der Karte im Mitgliederverzeichnis Avatar, Name, Rollen,
Ort und Firma, die Mitgliedsstufe, die Kurzbio und die **Branche** zeigen. Sie
SHALL NOT die Kompass-Kategorien des Mitglieds zeigen — weder als
„Bietet: …"/„Sucht: …" je Kategorie noch als pauschale „Bietet"/„Sucht"-Marke
für ein Mitglied, dessen Kompasszeile keine Kategorie trägt.

Das nimmt die Kartendarstellung aus AGE-494 zurück, und zwar nur dort. Der
Grund ist Menge, nicht Richtigkeit: ein Mitglied mit gepflegtem Kompass trägt
zehn und mehr Marken, seine Karte wird doppelt so hoch wie die seiner Nachbarn,
und im Raster liest sich das als Unordnung statt als Information. Die
Kategorien SHALL an den beiden Stellen unverändert bleiben, an denen sie eine
Frage beantworten: als **Filter in der rechten Inhaltsspalte** und auf dem
**Profil**.

Die Karte SHALL das Hintergrundbild des Mitglieds zeigen, wenn eines hinterlegt
ist. Eine Karte ohne Bild SHALL dieselbe Höhe behalten wie eine mit Bild, damit
das Raster bei gemischtem Bestand nicht ausfranst — derselbe Grund, aus dem die
Event-Kachel ihren Platzhalter trägt.

Das Bildfeld der Karte SHALL 3:1 sein und das Bild **einpassen**, nicht
beschneiden. Die Zusage steht hier und nicht in der allgemeinen Bildregel: jene
zählt ihre Bauteile auf und schließt die Verzeichnis-Karte ausdrücklich aus, weil
eine Anforderung, die eine Fläche bindet, die ihr eigener Change nicht anfasst,
mit dem Archivieren sofort verletzt wäre. Damit hängt diese Anforderung an keiner
Landereihenfolge.

`cover_url` SHALL über den Bild-Auflöser des Buckets `covers` in eine
darstellbare Adresse übersetzt werden. Die Spalte trägt seit AGE-580 einen
**relativen Pfad**, keine fertige URL; eine Karte, die den Wert direkt in `src`
schreibt, rendert tote Bilder, und ein Test mit einem `https://…`-Fixture wäre
dabei grün. Prüffixtures SHALL deshalb Pfade tragen.

Dass die Karte die Kategorien nicht mehr zeigt, SHALL NOT heissen, dass die RPC
sie nicht mehr liefert. `offer_categories` und `need_categories` bleiben im
Rückgabesatz: der Filter in der Spalte liest sie, und eine Anforderung, die eine
Darstellung ändert, darf keine Datenschicht mitreissen.

#### Scenario: Eine Karte zeigt keine Kompass-Marken

- **WHEN** ein Mitglied mit Kategorien in `offers` und `needs` als Karte
  gerendert wird
- **THEN** erscheint keine Marke der Form „Bietet: …" oder „Sucht: …"

#### Scenario: Auch die pauschale Marke fällt weg

- **WHEN** ein Mitglied genau eine Kompasszeile ohne `category` hat, also
  `has_offers` gesetzt und `offer_categories` leer
- **THEN** erscheint auch keine nackte „Bietet"-Marke

#### Scenario: Die Branche bleibt

- **WHEN** ein Mitglied eine Branche trägt
- **THEN** zeigt die Karte sie weiterhin

#### Scenario: Der Filter behält seine Kategorien

- **WHEN** das Verzeichnis ab `lg` geöffnet wird
- **THEN** stehen die Kompass-Kategorien in der rechten Spalte unverändert zur
  Auswahl

#### Scenario: Eine Karte ohne Hintergrundbild franst nicht aus

- **WHEN** ein Mitglied ohne `cover_url` neben einem mit `cover_url` im Raster
  steht
- **THEN** haben beide Karten dieselbe Höhe
