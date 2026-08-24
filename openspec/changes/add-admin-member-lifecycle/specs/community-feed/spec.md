## ADDED Requirements

### Requirement: Der Beitrag eines entfernten Mitglieds bleibt lesbar und nennt keinen Namen

Das System SHALL Beiträge und Kommentare eines deaktivierten oder gelöschten
Mitglieds weiterhin anzeigen. Sie zu entfernen veränderte fremde Beiträge: ein
Gesprächsfaden, aus dem der Anfang verschwindet, ist für alle anderen kaputt.

Der Autor eines solchen Beitrags SHALL als **„Ehemaliges Mitglied"** erscheinen,
ohne Anzeigename, ohne Bild, ohne Stufe und **ohne Verweis** auf ein Profil, das
nicht mehr erreichbar ist.

**Dieser Zustand SHALL unterscheidbar sein von einem Autor, der lediglich sein
Profil nicht öffentlich stellt.** Letzterer erscheint seit AGE-530 als
„Ein Mitglied" — er ist da und hat sich nur zurückgezogen. Beide auf denselben
Text fallen zu lassen, machte zwei verschiedene Sachverhalte ununterscheidbar,
und der Feed hätte für „Autor fehlt" zwei Ursachen, die gleich aussehen.

Die Unterscheidung SHALL über eine `SECURITY DEFINER`-Funktion laufen. Diese
SHALL **Beitrags- und Kommentar-IDs** entgegennehmen, nicht Profil-IDs, und je
Eintrag zurückgeben, ob dessen Urheber ein entferntes Mitglied ist.

**Warum nicht Profil-IDs.** Eine Funktion, der man Profil-IDs übergibt, kann
nicht prüfen, woher der Aufrufer sie hat. Die Zusage „nur über Autoren, die aus
einem sichtbaren Beitrag stammen" wäre dann eine Bitte an den Aufrufer, keine
Eigenschaft der Funktion — jeder Angemeldete könnte beliebige bekannte IDs
durchreichen und erfahren, wer aus dem Verein entfernt wurde. Nimmt sie dagegen
Beitrags-IDs, löst sie den Urheber **selbst** auf und wendet dabei **dasselbe
Sichtbarkeitsprädikat** an, das für den Beitrag gilt: über einen Beitrag, den
der Aufrufer nicht sehen darf, gibt sie keine Auskunft.

Sie SHALL keinen Namen, kein Bild und keine Stufe liefern und SHALL NOT die
Unterscheidung zwischen deaktiviert und gelöscht preisgeben. Damit gibt sie
genau eine Information preis: dass der Urheber eines Beitrags, den der Aufrufer
ohnehin vor sich hat, kein Mitglied mehr ist.

Die Zahl der Einträge je Aufruf SHALL begrenzt sein. Eine unbegrenzte Liste
machte die Funktion zu einem Weg, den gesamten Bestand in einem Aufruf
durchzuprüfen.

**Kommentare SHALL gleich behandelt werden wie Beiträge.** Der Urheber eines
Kommentars ist ebenso sichtbar wie der eines Beitrags, und ein Gesprächsfaden,
in dem nur die Beitragsautoren neutralisiert sind, hält die Zusage nicht.

Ohne Session SHALL sie **nicht aufgerufen** werden, wie die Autorenabfrage auch
(AGE-530).

#### Scenario: Der Beitrag bleibt, der Name geht

- **GIVEN** ein Beitrag eines Mitglieds, das danach gelöscht wurde
- **WHEN** ein angemeldetes Mitglied den Feed öffnet
- **THEN** ist der Beitrag lesbar und sein Autor heisst „Ehemaliges Mitglied" —
  ohne Bild und ohne Verweis auf eine Profilseite

#### Scenario: Zurückgezogen ist nicht dasselbe wie entfernt

- **GIVEN** zwei Beiträge — einer von einem Mitglied, das sein Profil nicht
  öffentlich stellt, einer von einem gelöschten Mitglied
- **WHEN** ein angemeldetes Mitglied den Feed öffnet
- **THEN** heisst der erste Autor „Ein Mitglied" und der zweite „Ehemaliges
  Mitglied"

#### Scenario: Deaktiviert und gelöscht sehen gleich aus

- **GIVEN** ein Beitrag eines deaktivierten und einer eines gelöschten Mitglieds
- **WHEN** ein angemeldetes Mitglied den Feed öffnet
- **THEN** tragen beide denselben Text — welche der beiden Handlungen ein Admin
  vorgenommen hat, geht keinen Leser etwas an

#### Scenario: Die Auskunft trägt kein Mitgliedsdatum

- **WHEN** die Rückgabe der Funktion untersucht wird
- **THEN** enthält sie ausschliesslich Beitrags- beziehungsweise Kommentar-IDs
  und einen Wahrheitswert — keinen Namen, kein Bild, keine Stufe und keinen
  Zeitpunkt

#### Scenario: Über einen unsichtbaren Beitrag gibt es keine Auskunft

- **GIVEN** ein Beitrag, den der Aufrufer nach den Sichtbarkeitsregeln nicht
  lesen darf, von einem entfernten Mitglied
- **WHEN** der Aufrufer dessen ID an die Funktion übergibt
- **THEN** kommt für diese ID keine Auskunft zurück — die Funktion ist kein Weg,
  an der Sichtbarkeit vorbei zu erfahren, wer entfernt wurde

#### Scenario: Ein Kommentarautor wird ebenso neutralisiert

- **GIVEN** ein Kommentar eines gelöschten Mitglieds unter einem sichtbaren
  Beitrag
- **WHEN** ein angemeldetes Mitglied den Beitrag öffnet
- **THEN** heisst auch der Kommentarautor „Ehemaliges Mitglied"

#### Scenario: Die Eingabemenge ist begrenzt

- **WHEN** ein Aufrufer mehr IDs übergibt, als je auf einer Seite stehen
- **THEN** weist die Funktion den Aufruf ab, statt die Liste abzuarbeiten

#### Scenario: Ohne Session wird nicht gefragt

- **GIVEN** ein ausgeloggter Besucher auf einem öffentlichen Beitrag
- **WHEN** die Seite die Autorendarstellung aufbaut
- **THEN** wird die Funktion nicht aufgerufen, und die Maskierung bleibt die
  bestehende aus AGE-530
