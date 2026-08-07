## ADDED Requirements

### Requirement: Geänderte Edge Functions erreichen beide Projekte ohne Zutun

Ändert sich eine Edge Function im Repository, SHALL das System sie nach dem
Zusammenführen auf **beide** Zielprojekte ausliefern, ohne dass jemand daran
denken muss. Andernfalls trägt das Repository einen Stand, den kein Projekt
ausführt — und weil nichts diesen Unterschied anzeigt, gilt die Änderung als
ausgeliefert, obwohl sie es nicht ist.

Das SHALL für **alle** im Repository geführten Functions gelten, nicht nur für
die einer bestimmten Fachlichkeit.

Ausgeliefert SHALL nur werden, was sich geändert hat. Ein pauschales Ausliefern
aller Functions SHALL NOT stattfinden: Es überschriebe einen bewusst
abweichenden Stand auf einem Projekt, ohne dass jemand es bemerkt. Was dabei
übergangen wird, SHALL **namentlich** protokolliert werden — eine Beschränkung,
die nicht ausgesprochen wird, liest sich hinterher wie Vollständigkeit.

Das Ausliefern SHALL denselben Vorbedingungen unterliegen wie das Ausliefern der
Anwendung. Eine Function kann eine Datenbankfunktion aufrufen, die auf einem
Projekt noch nicht angelegt ist; liefe sie voraus, wäre die Function dort
sofort kaputt. Weicht der Migrationsstand eines Zielprojekts vom Repository ab,
SHALL deshalb **weder** Anwendung **noch** Function ausgeliefert werden.

Nach dem Ausliefern SHALL das System je Projekt nachlesen, welche Fassung dort
nun läuft, und das protokollieren. Dass ein Befehl ohne Fehler zurückkam,
SHALL NOT als Nachweis gelten, dass das Ziel den neuen Stand trägt.

Das Ziel SHALL aus einer versionierten Datei des Repositories stammen und
SHALL NOT allein aus einem Secret. Ein Ziel, das nur im Secret steht, ist im
Review nicht sichtbar.

#### Scenario: Eine geänderte Function geht auf beide Projekte

- **GIVEN** ein Merge verändert genau eine Edge Function
- **WHEN** die Auslieferung läuft
- **THEN** trägt diese Function auf **beiden** Projekten den neuen Stand, und
  das Protokoll nennt für jedes Projekt die dort laufende Fassung

#### Scenario: Unveränderte Functions bleiben unangetastet

- **GIVEN** auf einem Projekt liegt für eine Function bewusst ein älterer Stand
- **WHEN** ein Merge eine **andere** Function verändert
- **THEN** bleibt der ältere Stand erhalten, und das Protokoll nennt die
  übergangene Function beim Namen

#### Scenario: Ein Merge ohne Function-Änderung liefert nichts aus

- **WHEN** ein Merge keine Edge Function berührt
- **THEN** wird nichts ausgeliefert, und das Protokoll sagt das ausdrücklich,
  statt zu schweigen

#### Scenario: Abweichender Migrationsstand hält auch die Functions an

- **GIVEN** das Repository trägt Migrationen, die ein Zielprojekt noch nicht
  angewendet hat
- **WHEN** ein Merge eine Edge Function verändert
- **THEN** wird sie nicht ausgeliefert — sonst riefe sie dort eine
  Datenbankfunktion auf, die es noch nicht gibt
