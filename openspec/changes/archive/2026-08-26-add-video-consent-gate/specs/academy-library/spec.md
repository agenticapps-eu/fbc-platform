## MODIFIED Requirements

### Requirement: Academy lists curated video lessons

The system SHALL render an Academy page that displays a fixed, code-defined list
of curated lessons, each with a title, a description, and an embedded video from
an external host (YouTube/Vimeo) via a reusable embed component. The platform
SHALL NOT host video content itself.

Die Einbettung SHALL dem Einwilligungstor des Design-Systems folgen: die Karte
zeigt zuerst eine Fläche aus dem eigenen Ursprung, und der Player des Anbieters
wird erst auf Anforderung geladen. Die Academy SHALL dafür **keine Ausnahme**
kennen — sie erhält das Verhalten aus derselben Komponente wie jede andere
Fläche.

Die kuratierte Liste SHALL als **redaktioneller Block oben** auf der Seite
stehen, oberhalb der geteilten Videos, damit die Academy am Starttag nicht leer
ist.

Sie SHALL eine Konstante im Code bleiben und SHALL NOT in die Datenbank
überführt werden. Der Grund SHALL festgehalten sein: drei von der Redaktion
gewählte Videos sind kein Inhaltsmodell. Sie in `posts` zu schreiben gäbe ihnen
einen Autor, eine Sichtbarkeit, Likes und Kommentare, die niemand bestellt hat —
und ein Kurs-Schema wäre AGE-262, nicht dieser Change.

#### Scenario: Academy shows the curated lessons

- **WHEN** a member opens the Academy page
- **THEN** each hard-coded lesson is shown as a card with its title, its
  description, and the embed component in place of the player

#### Scenario: Der kuratierte Block steht über den geteilten Videos

- **WHEN** ein Mitglied die Academy öffnet und Beiträge mit Video bestehen
- **THEN** stehen die drei kuratierten Lektionen oben, die geteilten Videos
  darunter

#### Scenario: Eine kuratierte Lektion lädt den Anbieter nicht ungefragt

- **WHEN** ein Mitglied die Academy öffnet
- **THEN** geht für keine der kuratierten Lektionen ein Aufruf an den Anbieter
  hinaus, bevor die jeweilige Fläche aktiviert wurde
