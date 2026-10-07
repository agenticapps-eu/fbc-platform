## MODIFIED Requirements

<!-- Titel zeichengleich zur bestehenden Anforderung. Geändert ist genau eines:
     WAS gezählt wird. Die Anforderung sagte „gezählt SHALL nach Beiträgen
     werden" und meinte damit „nicht nach Beiträgen UND Kommentaren" — die Art
     des Beitrags kam darin nicht vor, und die Funktion zählte deshalb auch
     erzeugte Einträge mit.

     Die beiden bestehenden Szenarien stehen unten unverändert — ein
     MODIFIED-Block bekräftigt den ganzen Satz. VIER kommen hinzu.

     Die Fünferzahl ist von „SHALL fünf" auf „bis zu fünf" präzisiert — sie
     widersprach sonst dem eigenen Ergebnis dieses Changes, nach dem drei
     Konten übrig bleiben (Befund der Plan-Review, codex).

     NICHT geändert: `security invoker`, die Namensauflösung, die eindeutige
     Reihenfolge, und dass Veranstaltungs-Ankündigungen mitzählen. -->

### Requirement: „Aktivste Mitglieder" nennt nur zeigbare Profile

Das System SHALL die Liste der aktivsten Mitglieder über eine aggregierende
Funktion liefern, die **unter der RLS des Aufrufers** läuft und Namen
ausschließlich aus `profiles_public` bezieht. Ein zurückgezogenes,
unbestätigtes, deaktiviertes oder gelöschtes Profil SHALL NOT erscheinen —
`profiles_public` schließt sie selbst aus, und ein eigenes Prädikat hier wäre
eine weitere Kopie.

Die Liste SHALL **bis zu fünf** Mitglieder umfassen — jedes mit mindestens
einem für den Betrachter sichtbaren zählenden Beitrag. „Fünf" ist eine
Obergrenze und keine Zusage, dass immer fünf dastehen; nach dieser Anforderung
bleiben auf dem heutigen Bestand drei. Gezählt SHALL nach
**Beiträgen** werden, nicht nach Beiträgen und Kommentaren. Kommentare
mitzuzählen zöge ein zweites Sichtbarkeitsprädikat (`comments_select_visible`)
in dieselbe Funktion, für eine Zahl, die dasselbe aussagt.

**Produktmitteilungen der Anwendung SHALL NOT mitgezählt werden.** Ein Beitrag
mit `kind = 'release'` ist keine Wortmeldung eines Mitglieds, sondern eine
Mitteilung der Plattform; das Konto in `author_id` hat sie zugestellt, nicht
verfasst. Eine Liste der *aktivsten Mitglieder*, die sie mitzählt, misst Arbeit,
die niemand als Beitrag gemeint hat, und stellt das zustellende Konto
zwangsläufig an die Spitze.

**Veranstaltungs-Ankündigungen SHALL weiterhin mitzählen.** Das ist eine
ausdrückliche Entscheidung und keine Auslassung: ein Event-Beitrag steht als
Karte im Feed, wer ihn dort sieht, sieht eine Aktivität dieses Mitglieds, und
das Ausrichten einer Veranstaltung IST Aktivität. Der Preis ist benannt — ein
Gastgeber vieler Veranstaltungen steht weiter oben, ohne je etwas geschrieben zu
haben.

Die Bedingung SHALL eine **Positivliste** sein (`kind in ('member', 'event')`)
und NOT eine Ausschlussliste. Das Ergebnis ist heute dasselbe, die Haltbarkeit
nicht: eine vierte Beitragsart, die jemand später einführt, würde von einer
Ausschlussliste **still mitgezählt**. Genau das ist der Fehler, den diese
Anforderung behebt, und er darf nicht durch die Hintertür zurückkommen.

Die Urheberschaft einer Neuigkeit SHALL dabei in den Daten **bleiben**
(`posts.author_id` unverändert, `not null`, mit Fremdschlüssel) — sie wird nur
nicht gezählt. Ein eigenes „Plattform-Konto" in `profiles` SHALL NOT angelegt
werden: eine Profilzeile ist eine Mitgliedszeile, und jede Zählung und jede
Liste über Mitglieder müsste sie fortan ausnehmen.

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

#### Scenario: Veranstaltungs-Ankündigungen zählen weiterhin mit

- **WHEN** ein Mitglied eine Veranstaltung anlegt, zu der die Anwendung eine
  Ankündigung erzeugt
- **THEN** zählt diese Ankündigung in der Liste mit — die Entscheidung vom
  25.08. gilt unverändert

#### Scenario: Die Gegenprobe — ein sichtbarer eigener Beitrag zählt sehr wohl

- **WHEN** ein bereits gelistetes Mitglied einen veröffentlichten, für den
  Betrachter sichtbaren Beitrag schreibt
- **THEN** erhöht sich seine Zahl in der Liste um eins

#### Scenario: Ein terminierter Beitrag zählt noch nicht

- **WHEN** dasselbe Mitglied einen Beitrag für die Zukunft einplant
- **THEN** bleibt seine Zahl unverändert, bis der Beitrag erscheint
