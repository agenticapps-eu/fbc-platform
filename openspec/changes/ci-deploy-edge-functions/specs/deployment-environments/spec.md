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

Als geändert SHALL gelten, was sich seit dem zuletzt **nachweislich
ausgelieferten** Stand geändert hat — nicht, was sich seit dem vorigen Commit
geändert hat. Sonst fällt jede Änderung, deren Auslieferung ausfiel oder
übersprungen wurde, dauerhaft heraus: der nächste Lauf sieht sie nicht mehr an,
und nichts holt sie je nach. Wovon ausgegangen wird, SHALL das System **selbst
gemessen** haben — dass eine Auslieferung stattfand, SHALL NOT aus dem Ergebnis
anderer Arbeitsschritte erschlossen werden.

Lässt sich dieser Stand nicht ermitteln, SHALL das System auf den vorigen Commit
zurückfallen, das **ausdrücklich** melden — und der Lauf SHALL NOT als Nachweis
einer Auslieferung gelten. Andernfalls würde er selbst zum Ausgangspunkt des
nächsten Vergleichs und verwandelte damit eine vorübergehende Lücke in eine
dauerhafte: was vor ihm ausfiel, läge ab dann außerhalb jedes künftigen
Vergleichs, und nichts könnte es je wieder herleiten.

Die gewählte Vergleichsbasis und der Grund für ihre Wahl SHALL bei **jedem** Lauf
protokolliert werden, auch im Normalfall — eine Basis, die nur im Ausnahmefall
genannt wird, ist im Normalfall unbelegt.

Ein Fehlschlag beim Ermitteln des Standes SHALL vom Zustand „es gibt ihn nicht"
unterscheidbar gemeldet werden. Ein dauerhafter Schaden — etwa eine Suche, die
ins Leere greift, weil sich benannte Voraussetzungen geändert haben — SHALL NOT
dieselbe Meldung erzeugen wie ein vorübergehender Zustand, sonst liest er sich
als Rauschen.

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

#### Scenario: Eine ausgefallene Auslieferung wird nachgeholt

- **GIVEN** ein Merge verändert eine Edge Function, und ihre Auslieferung fällt
  aus oder wird übersprungen — etwa weil der Migrationsstand abwich
- **WHEN** ein **späterer** Merge läuft, der diese Function nicht anfasst
- **THEN** wird sie trotzdem ausgeliefert, weil der Vergleich beim zuletzt
  ausgelieferten Stand ansetzt und nicht beim vorigen Commit

#### Scenario: Die Vergleichsbasis steht in jedem Protokoll

- **WHEN** die Auslieferung läuft
- **THEN** nennt das Protokoll die gewählte Vergleichsbasis und den Grund ihrer
  Wahl — auch dann, wenn nichts auszuliefern war

#### Scenario: Unermittelbare Basis fällt zurück und sagt es

- **GIVEN** der zuletzt ausgelieferte Stand ist nicht zu ermitteln
- **WHEN** die Auslieferung läuft
- **THEN** wird gegen den vorigen Commit verglichen und ausgeliefert, der Lauf
  gilt aber **nicht** als erfolgreich — sonst wäre er der Ausgangspunkt des
  nächsten Vergleichs

#### Scenario: Nach einem Rückfall holt der nächste Lauf die Lücke nach

- **GIVEN** ein Lauf musste auf den vorigen Commit zurückfallen und gilt deshalb
  nicht als Nachweis
- **WHEN** der nächste Merge läuft
- **THEN** setzt er beim letzten **echten** Nachweis an, und alles seither
  Übersprungene liegt wieder im Vergleich

#### Scenario: Abweichender Migrationsstand hält auch die Functions an

- **GIVEN** das Repository trägt Migrationen, die ein Zielprojekt noch nicht
  angewendet hat
- **WHEN** ein Merge eine Edge Function verändert
- **THEN** wird sie nicht ausgeliefert — sonst riefe sie dort eine
  Datenbankfunktion auf, die es noch nicht gibt
