## ADDED Requirements

### Requirement: Die Eventliste hat Suche und Facetten in einer rechten Spalte

Die Eventübersicht SHALL eine rechte Inhaltsspalte führen, die beim Blättern
mitläuft, mit denselben Massen und demselben Umbruchverhalten wie die
Filterspalte der Aktivität: 16rem breit, 24 px Abstand, ab `lg` neben der
Liste, darunter im Fluss hinter einem zugeklappten Schalter.

Die Spalte SHALL enthalten:

- ein **Volltextfeld**, das über Titel, Beschreibung und Ort sucht,
- die Facette **Art**, deren Werte aus dem CHECK-Constraint `events_type_check`
  stammen SHALL — heute `online`, `presence`, `dinner`, `workshop`,
  `mastermind`,
- die Facette **Themen**, deren Werte aus dem Bestand abgeleitet werden SHALL.

Das Volltextfeld SHALL immer stehen. Eine Facettenkarte ohne auswählbare Werte
SHALL **nicht rendern** — dasselbe Muster, nach dem die Filterspalte der
Aktivität ihre Tag-Karte nur bei vorhandenen Zählern zeigt. Eine Spalte trägt
damit auf jeder Datenlage, ohne leere Hüllen zu zeigen.

Die Werte der Art-Facette SHALL durch einen Test an den CHECK-Constraint
gebunden sein: weichen Liste und Constraint voneinander ab, SHALL der Testlauf
fehlschlagen. Ohne diese Bindung liefe die Liste aus dem Ruder, sobald eine
Migration einen sechsten Typ zulässt, und niemand merkte es.

Die Reiter **Kommende · Vergangene · Meine Events** SHALL bleiben. Suche und
Facetten SHALL innerhalb des gewählten Reiters wirken, nicht über ihn hinweg.

#### Scenario: Die Art-Facette kennt genau die Werte des Constraints

- **WHEN** die Liste der auswählbaren Arten mit `events_type_check` verglichen
  wird
- **THEN** stimmen beide Mengen überein

#### Scenario: Eine Facette ohne Werte rendert nicht

- **WHEN** kein sichtbares Event ein Thema trägt
- **THEN** erscheint keine Themen-Karte in der Spalte
- **AND** das Volltextfeld steht trotzdem

#### Scenario: Die Suche wirkt im gewählten Reiter

- **WHEN** im Reiter „Vergangene" ein Suchbegriff eingegeben wird
- **THEN** werden nur vergangene Events gefiltert

## MODIFIED Requirements

### Requirement: The events overview shows three tiles per row

The system SHALL lay out the event list at three tiles per row when the list's
own **container** is wide enough, degrading to two and then one as that
container narrows. The trigger SHALL be the container's width, not the
viewport's: with a filter column beside it, the list column narrows while the
window does not, and a viewport-bound grid keeps three tiles in a space that
carries one. Measured on 2026-08-31, that produced 115-px tiles at a 1280-px
window.

Three tiles remain the maximum. That number was decided in the meeting of
2026-08-03 (AGE-531) and is unchanged here — only what triggers it moves.

Each tile SHALL show the cover image with the start date as a badge on it, the
type badge, the title, the time span, the location, the number of attendees and
a link into the detail page. An event without a cover SHALL render a neutral
placeholder rather than a collapsed tile.

The attendee **number** on the tile SHALL come from `event_registration_counts`,
not from `event_attendees`: the overview shows a count, and the count is
already available to every caller who can see the event.

#### Scenario: A wide viewport shows three tiles

- **WHEN** the events list is rendered in a container of at least 656 px with
  at least three events
- **THEN** three tiles sit side by side

#### Scenario: A narrowed list column drops to fewer tiles

- **WHEN** the filter column narrows the list's container to 409 px
- **THEN** one tile spans the container
- **AND** no tile is narrower than 208 px

#### Scenario: An event without a cover keeps its tile

- **WHEN** an event has no `cover_path`
- **THEN** the tile renders a placeholder in the cover's place and keeps its
  height
