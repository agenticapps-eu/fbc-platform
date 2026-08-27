## MODIFIED Requirements

### Requirement: Die Admin-Fläche kennt eine Mitgliederliste, aber keinen Massenversand

The system SHALL NOT provide, in the current prototype, a mass-mail/broadcast
capability, an in-platform CRM, or topic newsletters (AGE-304). Die gebaute
Admin-Fläche SHALL begrenzt sein auf: den Plattform-Einstellungs-Schalter, die
Routing-Queue der Matching-Manager, die lesende Feedback-Sicht, die **Suche nach
einem einzelnen Mitglied** über `admin_find_profile`, die Bearbeitung von dessen
Stamm-, Kontakt- und Altdaten über `admin_update_profile`, die Änderung seiner
Login-Adresse, die **Mitgliederliste** über `admin_list_members`, und die
**Release-Notes-Fläche** (AGE-631).

Die Mitgliederliste SHALL NOT als Empfängerauswahl dienen. Sie listet, filtert
und blättert; eine Fläche, aus der ein Admin Empfänger für einen Massenversand
zusammenstellt, SHALL weiterhin nicht bestehen — das ist AGE-304.

Die Release-Notes-Fläche SHALL diese Zusage nicht aufweichen, und der Grund
SHALL benannt bleiben: sie kennt **keine Empfängerauswahl**. Der Kreis ist
festgelegt auf alle Mitglieder mit gesetztem `activated_at` und SHALL NOT
wählbar, filterbar oder eingrenzbar sein. Verboten war das Bilden und Bespielen
von Zielgruppen; eine einzelne, redigierte In-App-Mitteilung ohne Zielgruppe ist
davon nicht erfasst. Ein E-Mail-Weg SHALL für Release-Notes weiterhin nicht
bestehen.

Der Unterschied zwischen Suche und Liste SHALL benannt bleiben:
`admin_find_profile` beantwortet „wo ist diese Person?" und entschärft dafür
Jokerzeichen; `admin_list_members` beantwortet „wer ist da und wer wartet noch?"
und darf deshalb ohne Suchbegriff aufgerufen werden. Die
Jokerzeichen-Entschärfung SHALL in **beiden** bestehen — sie schützt vor kaputten
Mustern, nicht mehr vor dem Aufzählen.

#### Scenario: No mass-mail, CRM or newsletter surface exists

- **WHEN** an admin looks for a mass-mail action, a CRM surface or a newsletter editor
- **THEN** none is present in the code — only `AdminSettingsPage` (settings toggle),
  the routing queue, `admin_list_feedback()`, die Bearbeitung **eines** gesuchten
  Mitglieds, die Mitgliederliste und die Release-Notes-Fläche sind verfügbar

#### Scenario: Die Liste ist keine Empfängerauswahl

- **WHEN** ein Admin die Mitgliederliste öffnet
- **THEN** bietet sie Filtern, Blättern und die Handlungen je **einzelnem**
  Mitglied — und keine Mehrfachauswahl, kein „an alle", keine Übernahme der
  Treffermenge in eine andere Fläche

#### Scenario: Die Release-Notes-Fläche wählt keine Empfänger

- **WHEN** ein Admin eine Release-Note zusammenstellt und zustellt
- **THEN** gibt es an keiner Stelle eine Auswahl, eine Filterung oder eine
  Eingrenzung der Empfänger — der Kreis ist alle aktivierten Mitglieder

#### Scenario: Release-Notes gehen nicht per E-Mail

- **WHEN** eine Release-Note zugestellt wird
- **THEN** entstehen ausschliesslich `notifications`-Zeilen, und kein
  E-Mail-Versand wird ausgelöst

## ADDED Requirements

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
Gemessen am 27.08. fehlt bei 21 von 50 Archiven die Titelzeile und bei 19 die
Linear-Zeile; ein Erzeuger, der darauf besteht, erzeugte eine Fläche, die
niemand benutzen kann.

Der vorgeschlagene Text SHALL ein **Entwurf** sein. Das System SHALL NOT
Proposal-Text ungeprüft zustellen: er ist für Entwickler geschrieben und sagt
einem Mitglied nichts.

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

### Requirement: Die Release-Notes-Fläche steht im Administrationsmenü

Das System SHALL die Release-Notes-Fläche im Administrationsmenü führen. Eine
Fläche, die nur über die getippte Adresse erreichbar ist, ist nicht auffindbar.

#### Scenario: Der Eintrag steht im Menü

- **WHEN** ein Admin das Administrationsmenü öffnet
- **THEN** enthält es einen Eintrag, der auf die Release-Notes-Fläche führt
