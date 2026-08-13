## ADDED Requirements

### Requirement: Ein neues Event kündigt sich selbst im Feed an

Das System SHALL beim Anlegen eines Events einen Beitrag im Aktivitätsfeed
erzeugen — über einen Trigger auf `public.events`, nicht über den Client. Der
Grund SHALL festgehalten sein: ein Event entsteht über mehr als einen Weg
(Formular, künftig Import oder Admin), und eine Regel im Client gilt nur für
den Weg, der sie kennt.

Der Beitrag SHALL `kind = 'event'` und `ref_id = events.id` tragen, seinen
Autor aus `events.host_id` nehmen und seine Sichtbarkeit aus
`events.visibility`. Er SHALL **keinen** Inhalt des Events kopieren.

Das System SHALL spätere Änderungen an `events.visibility` **und**
`events.host_id` nachziehen: die Sichtbarkeit folgt, ein später zugewiesener
Host lässt den fehlenden Beitrag entstehen, ein Hostwechsel zieht den Autor
nach, und ein entzogener Host entfernt den Beitrag.

Der Grund SHALL festgehalten sein: hörte der Trigger nur auf `visibility`, käme
ein Event, das ohne Host angelegt und später einem Host zugeordnet wird, nie in
den Feed — die Zusage „neue Events erscheinen in der Aktivität" bräche still.
Bei admin-gepflegten Events ist das kein Sonderfall.

Das System SHALL für ein Event ohne `host_id` keinen Beitrag erzeugen und das
Anlegen des Events dadurch NOT scheitern lassen.

Das System SHALL den Beitrag ausschließlich über diese Trigger schreiben. Weder
der Host noch ein anderes Konto SHALL ihn anlegen, ändern oder löschen können.

Bestehende Events SHALL einmalig ihren Beitrag nachbekommen, mit
`posts.created_at = events.created_at`. Ohne das hätte der Feed am Starttag
keinen einzigen Event-Eintrag; mit `now()` verdrängten alte Events den echten
Feed von oben.

#### Scenario: Ein neu angelegtes Event steht im Feed

- **WHEN** ein Host ein Event anlegt
- **THEN** entsteht ein Beitrag mit `kind = 'event'`, dem Host als Autor und der
  Sichtbarkeit des Events

#### Scenario: Ein bestehendes Event bekommt seinen Beitrag mit seinem Datum

- **WHEN** die Migration auf eine Datenbank mit bestehenden Events angewandt wird
- **THEN** trägt jeder nachgezogene Beitrag das `created_at` seines Events und
  steht nicht als neuester Beitrag oben

#### Scenario: Das Anlegen eines Events schlägt durch den Trigger nie fehl

- **WHEN** ein Event ohne Host angelegt wird
- **THEN** gelingt das Anlegen, und es entsteht kein Beitrag

#### Scenario: Ein später zugewiesener Host holt den Beitrag nach

- **WHEN** einem Event ohne Host später ein Host zugewiesen wird
- **THEN** entsteht in diesem Moment sein Feed-Beitrag mit diesem Host als Autor

#### Scenario: Der Host kann den erzeugten Beitrag nicht anfassen

- **WHEN** der Host seinen automatisch erzeugten Feed-Beitrag zu ändern oder zu
  löschen versucht
- **THEN** wird der Zugriff abgelehnt — der Beitrag folgt dem Event, nicht dem
  Autor
