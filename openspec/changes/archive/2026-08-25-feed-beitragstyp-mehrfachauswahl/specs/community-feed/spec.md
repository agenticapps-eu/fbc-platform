## MODIFIED Requirements

### Requirement: Der Feed filtert nach Beitragstyp

Das System SHALL einen Filter nach Beitragstyp anbieten: **Bild**, **Video**,
**Event**, **Text**. Der Filter SHALL **mehrere Typen gleichzeitig** zulassen und
sie als **ODER** verknüpfen. Der Filter SHALL Teil der Abfrage sein, nicht eine
Nachfilterung der geladenen Seite.

Der Typ SHALL aus dem Bestand abgeleitet werden, nicht aus einem zusätzlichen
Feld am Beitrag: Video über `video_url`, Event über `posts.kind`, Bild über das
Vorhandensein einer `post_media`-Zeile, Text als Beitrag ohne all das.

Die **leere** Auswahl SHALL „alle Typen" bedeuten, nicht „kein Typ" — dieselbe
Regel, die für die leere Tagmenge gilt. Es SHALL deshalb **keinen** eigenen
Eintrag „Alle Typen" geben: „alle" ist der Zustand ohne Haken und nicht eine
fünfte Wahlmöglichkeit neben den vier Typen.

Alle vier angehakt SHALL dasselbe liefern wie gar keiner angehakt: die vier
Typen decken den Bestand lückenlos ab, weil „Text" als Abwesenheit der drei
anderen bestimmt ist.

Ein Beitrag SHALL höchstens **einmal** in der Liste stehen, auch wenn er auf
mehrere gewählte Typen zutrifft — ein Beitrag mit Video und Bild erscheint bei
der Auswahl „Video + Bild" also einmal, nicht zweimal.

#### Scenario: Der Bildfilter findet bebilderte Beiträge

- **WHEN** „Bild" gewählt wird
- **THEN** enthält die Liste genau die sichtbaren Beiträge mit mindestens einem
  Bild, und das Blättern bleibt seitenweise

#### Scenario: Zwei Typen zeigen die Vereinigung

- **WHEN** „Video" und „Bild" angehakt sind
- **THEN** enthält die Liste die sichtbaren Beiträge mit Video **und** die mit
  mindestens einem Bild, und ein Beitrag mit beidem steht genau einmal darin

#### Scenario: Kein Haken heißt alle Typen

- **WHEN** kein Beitragstyp angehakt ist
- **THEN** enthält die Liste dieselben Beiträge wie ohne jeden Typfilter

#### Scenario: „Text" bleibt auch in der Vereinigung die Abwesenheit der anderen

- **WHEN** „Text" und „Event" angehakt sind
- **THEN** enthält die Liste die Event-Beiträge sowie die Beiträge ohne Video,
  ohne Bild und ohne Event-Bezug — und keinen bebilderten Beitrag

#### Scenario: Der Typfilter überlebt das Blättern

- **WHEN** bei zwei angehakten Typen die zweite Seite nachgeladen wird
- **THEN** trägt auch die zweite Seite ausschließlich Beiträge dieser beiden
  Typen, weil der Filter in der Abfrage steht und nicht in der Anzeige

#### Scenario: Die Reihenfolge der Haken erzeugt keine zweite Auswahl

- **WHEN** dieselben zwei Typen in umgekehrter Reihenfolge angehakt werden
- **THEN** verwendet der Feed denselben Cache-Schlüssel und lädt die Auswahl
  nicht ein zweites Mal

#### Scenario: Alle vier Haken sind dasselbe wie kein Haken

- **WHEN** alle vier Beitragstypen angehakt sind
- **THEN** enthält die Liste dieselben Beiträge wie ohne jeden Typfilter, und der
  Feed verwendet denselben Cache-Schlüssel wie im Zustand ohne Haken

#### Scenario: Der Typfilter gilt auch ohne Sitzung

- **WHEN** ein Ausgeloggter zwei Typen anhakt
- **THEN** enthält die Liste die Vereinigung dieser Typen unter den öffentlich
  sichtbaren Beiträgen, ohne dass eine zusätzliche Abfrage abgesetzt wird, die
  ohne Sitzung mit `42501` abgewiesen würde

#### Scenario: Der Typfilter steht neben der Blättergrenze, nicht statt ihr

- **WHEN** die zweite Seite bei aktivem Typfilter geladen wird
- **THEN** wirken Typvereinigung **und** Blättergrenze zugleich — die Seite trägt
  nur Beiträge der gewählten Typen, die hinter dem Cursor liegen
