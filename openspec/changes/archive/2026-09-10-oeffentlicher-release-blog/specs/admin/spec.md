## MODIFIED Requirements

### Requirement: Ein Admin stellt aus archivierten Changes eine redigierte Release-Note zusammen

Das System SHALL eine Admin-Fläche führen, auf der ein Admin die **noch nicht
angekündigten** archivierten Changes sieht, mehrere davon zu **einer** Nachricht
zusammenfasst, deren Text **vollständig überschreibt** und sie erst dann
zustellt.

Die Liste der Changes SHALL zur Bauzeit aus `openspec/changes/archive/`
entstehen und mit dem Bündel ausgeliefert werden, damit ein Eintrag per
Konstruktion nur dann erscheint, wenn er auch ausgeliefert wurde. Sie SHALL NOT
über einen schreibenden Weg aus der CI in die Datenbank gelangen.

Der Erzeuger SHALL auf den Verzeichnisnamen zurückfallen, wenn ein Proposal
keine Titelzeile trägt, und die Linear-Kennung als **optional** behandeln.
Gemessen am 08.09. fehlt bei 21 von 75 Archiven die Titelzeile und bei 18 die
Linear-Zeile; ein Erzeuger, der darauf besteht, erzeugte eine Fläche, die
niemand benutzen kann.

Der vorgeschlagene Text SHALL ein **Entwurf** sein. Das System SHALL NOT
Proposal-Text ungeprüft zustellen: er ist für Entwickler geschrieben und sagt
einem Mitglied nichts.

Liegt zu einem ausgewählten Eintrag eine **kuratierte Release-Geschichte** vor,
SHALL deren Text der vorgeschlagene Text sein. Nur wo keine vorliegt, SHALL der
aus dem Proposal erzeugte Entwicklertext vorgeschlagen werden. Der Rückfall
SHALL erhalten bleiben: jeder künftige Change legt einen Archiveintrag an, für
den noch keine Geschichte geschrieben ist, und ohne Rückfall bliebe die Fläche
für genau diesen Eintrag leer.

Damit ist die kuratierte Datei die Stelle, an der der lesbare Text **verfasst**
wird. Die Fläche bleibt gleichwohl überschreibbar, und eine dort geänderte
Fassung gilt **nur für diese Zustellung**: sie wirkt NOT in die Datei zurück und
erscheint NOT im öffentlichen Blog. Das ist keine zweite Pflegestelle derselben
Geschichte, sondern die Anpassung einer einzelnen Mitteilung an ihren Anlass.

Umfasst eine Auswahl mehrere Einträge, SHALL der Entwurf die Beiträge in der
Reihenfolge der Liste führen, jeden mit seiner eigenen Überschrift, und die
Absatztrennung jedes Textes SHALL erhalten bleiben. Bei genau einem kuratierten
Eintrag SHALL dessen Titel der Titel des Entwurfs sein und sein Text der Text —
ohne zusätzliche Überschrift und ohne Einpassung in eine Aufzählungsvorlage.

Ein Change SHALL nach der Zustellung nicht mehr in der Liste der noch nicht
angekündigten erscheinen.

#### Scenario: Nur was noch nicht angekündigt wurde

- **WHEN** ein Admin die Release-Notes-Fläche öffnet
- **THEN** listet sie die archivierten Changes, die von keiner zugestellten
  Release-Note abgedeckt sind, die jüngsten zuerst

#### Scenario: Mehrere Changes werden zu einer Nachricht

- **WHEN** ein Admin mehrere Einträge auswählt
- **THEN** entsteht **ein** Entwurf, der alle abdeckt — nicht einer je Eintrag

#### Scenario: Der Entwurf ist überschreibbar

- **WHEN** ein Admin den vorgeschlagenen Titel und Text ändert
- **THEN** wird der geänderte Text zugestellt, nicht der vorgeschlagene

#### Scenario: Ein Archiv ohne Titelzeile blockiert nichts

- **WHEN** ein archivierter Change keine `# Titel`-Zeile trägt
- **THEN** erscheint er trotzdem, benannt nach seinem Verzeichnis

#### Scenario: Angekündigtes verschwindet aus der Liste

- **WHEN** eine Release-Note zugestellt wurde
- **THEN** erscheinen die von ihr abgedeckten Changes nicht mehr als noch nicht
  angekündigt

#### Scenario: Zu einem kuratierten Eintrag wird die Geschichte vorgeschlagen

- **WHEN** ein Admin einen Eintrag auswählt, zu dem eine kuratierte Geschichte
  mit demselben Slug vorliegt
- **THEN** steht deren Text im Entwurf, nicht der aus dem Proposal erzeugte

#### Scenario: Ohne Geschichte bleibt der erzeugte Entwurf

- **WHEN** ein Admin einen Eintrag auswählt, zu dem keine kuratierte Geschichte
  vorliegt
- **THEN** steht der aus dem Proposal erzeugte Entwicklertext im Entwurf

#### Scenario: Eine Auswahl aus beidem trägt beides

- **WHEN** ein Admin einen kuratierten und einen nicht kuratierten Eintrag
  gemeinsam auswählt
- **THEN** entsteht ein Entwurf, der für den einen die Geschichte und für den
  anderen den erzeugten Text führt

#### Scenario: Ein einzelner kuratierter Eintrag behält Titel und Absätze

- **WHEN** ein Admin genau einen kuratierten Eintrag auswählt
- **THEN** trägt der Entwurf dessen Titel und dessen Text mit unveränderter
  Absatztrennung, ohne zusätzliche Überschrift

#### Scenario: Eine geänderte Zustellung erscheint nicht im Blog

- **WHEN** ein Admin den Entwurf überschreibt und zustellt
- **THEN** zeigt der öffentliche Blog weiterhin den Text aus der kuratierten
  Datei
