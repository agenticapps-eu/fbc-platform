## MODIFIED Requirements

<!-- Titel zeichengleich zur bestehenden Anforderung. Geändert ist genau eines:
     WAS gezählt wird. Die Anforderung sagte „gezählt SHALL nach Beiträgen
     werden" und meinte damit „nicht nach Beiträgen UND Kommentaren" — die Art
     des Beitrags kam darin nicht vor, und die Funktion zählte deshalb auch
     erzeugte Einträge mit.

     Die beiden bestehenden Szenarien stehen unten unverändert — ein
     MODIFIED-Block bekräftigt den ganzen Satz. Drei kommen hinzu.

     NICHT geändert: `security invoker`, die Namensauflösung, die Fünferzahl,
     die eindeutige Reihenfolge. -->

### Requirement: „Aktivste Mitglieder" nennt nur zeigbare Profile

Das System SHALL die Liste der aktivsten Mitglieder über eine aggregierende
Funktion liefern, die **unter der RLS des Aufrufers** läuft und Namen
ausschließlich aus `profiles_public` bezieht. Ein zurückgezogenes,
unbestätigtes, deaktiviertes oder gelöschtes Profil SHALL NOT erscheinen —
`profiles_public` schließt sie selbst aus, und ein eigenes Prädikat hier wäre
eine weitere Kopie.

Die Liste SHALL **fünf** Mitglieder umfassen, und gezählt SHALL nach
**Beiträgen** werden, nicht nach Beiträgen und Kommentaren. Kommentare
mitzuzählen zöge ein zweites Sichtbarkeitsprädikat (`comments_select_visible`)
in dieselbe Funktion, für eine Zahl, die dasselbe aussagt.

**Gezählt SHALL ausschliesslich werden, was ein Mitglied selbst geschrieben
hat.** Beiträge mit `kind = 'release'` sind Produktmitteilungen der Anwendung,
Beiträge mit `kind = 'event'` sind erzeugte Ankündigungen — beides sind keine
Wortmeldungen, und eine Liste der *aktivsten Mitglieder*, die sie mitzählt,
misst Arbeit, die niemand als Beitrag gemeint hat. Auf PROD gemessen waren das
**23 von 44** Beiträgen unter einem einzigen Konto, das damit zwangsläufig an
der Spitze stand.

Die Bedingung SHALL eine **Positivliste** sein (`kind = 'member'`) und NOT eine
Ausschlussliste. Das Ergebnis ist heute dasselbe, die Haltbarkeit nicht: eine
vierte Beitragsart, die jemand später einführt, würde von einer Ausschlussliste
**still mitgezählt**. Genau das ist der Fehler, den diese Anforderung behebt, und
er darf nicht durch die Hintertür zurückkommen.

Die Urheberschaft einer Neuigkeit SHALL dabei in den Daten **bleiben**
(`posts.author_id` unverändert, `not null`, mit Fremdschlüssel) — sie wird nur
nicht gezählt. Ein eigenes „Plattform-Konto" in `profiles` SHALL NOT angelegt
werden: die Zeile stünde sofort im Mitgliederverzeichnis, in der Suche und in
jeder Zählung über Mitglieder, und jede dieser Stellen müsste sie fortan
ausnehmen.

Die Zahl SHALL kein Umweg zur Sichtbarkeit sein: Beiträge, die der Betrachter
nicht sehen darf, zählen nicht mit.

Die Reihenfolge SHALL bei gleicher Zahl eindeutig entschieden sein.

#### Scenario: Ein deaktiviertes Mitglied verschwindet aus der Liste

- **WHEN** ein Mitglied mit vielen sichtbaren Beiträgen deaktiviert wird
- **THEN** erscheint es nicht mehr in „Aktivste Mitglieder", und seine Beiträge
  zählen für niemanden sonst mit

#### Scenario: Die Zahl folgt der Sichtbarkeit des Betrachters

- **WHEN** dasselbe Mitglied von zwei Betrachtern unterschiedlicher Stufe
  betrachtet wird
- **THEN** nennt die Liste für den Betrachter mit der geringeren Stufe eine
  Zahl, die die für ihn unsichtbaren Beiträge nicht enthält

#### Scenario: Neuigkeiten zählen nicht mit

- **WHEN** ein Konto ausschliesslich Neuigkeiten zustellt und ein Mitglied die
  Liste der aktivsten Mitglieder ansieht
- **THEN** erscheint dieses Konto **nicht** in der Liste

#### Scenario: Erzeugte Veranstaltungs-Ankündigungen zählen nicht mit

- **WHEN** ein Mitglied neben eigenen Beiträgen auch Veranstaltungen anlegt,
  zu denen die Anwendung Ankündigungen erzeugt
- **THEN** nennt die Liste nur die Zahl seiner eigenen Beiträge

#### Scenario: Die Gegenprobe — eigene Beiträge zählen sehr wohl

- **WHEN** ein Mitglied einen gewöhnlichen Beitrag schreibt
- **THEN** erhöht sich seine Zahl in der Liste um eins
