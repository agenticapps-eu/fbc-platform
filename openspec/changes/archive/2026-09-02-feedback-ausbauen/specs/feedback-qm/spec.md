## ADDED Requirements

### Requirement: Ein Feedback trägt ein Thema aus einer geschlossenen Menge

Das System SHALL an jeder `feedback`-Zeile ein `theme` führen, dessen Wert aus
einer **in der Datenbank** festgelegten Menge stammt, und diese Menge SHALL den
Wert für „Generell" enthalten. Die Spalte SHALL NOT Freitext aufnehmen.

Die Menge SHALL für die Oberfläche **lesbar** sein, samt Beschriftung und
Reihenfolge — sonst müsste sie ein zweites Mal im Code stehen, und zwei
Abschriften einer Menge driften, ohne dass etwas es misst.

Der Grund: ein Filter über einer Spalte, die alles aufnimmt, filtert nicht,
sondern sortiert, was zufällig gleich geschrieben wurde. Bestehende Zeilen SHALL beim Einführen der Spalte
„Generell" erhalten und die Spalte SHALL `not null` sein: eine leere Spalte
ginge in der Filterliste als eigenes, namenloses Thema durch.

Das QM-Formular SHALL das Thema zur Auswahl anbieten und mit „Generell"
vorbelegt sein.

Die Spalte SHALL einen **Vorgabewert** „Generell" tragen. Ohne ihn bräche jeder
Schreibzugriff, der die Spalte nicht nennt — und das sind nach der Migration und
vor dem Frontend-Deploy **alle**: die ausgelieferte Oberfläche, zwischen-
gespeicherte Clients, die Seeds und die bestehenden SQL-Tests. Die Reihenfolge
„Datenbank zuerst" ist damit nur haltbar, wenn die Spalte sich selbst füllt.

#### Scenario: Das Formular schickt ein Thema mit

- **WHEN** ein Mitglied das QM-Formular absendet, ohne das Thema anzufassen
- **THEN** trägt die neue Zeile das Thema „Generell"

#### Scenario: Ein Thema ausserhalb der Menge wird abgewiesen

- **WHEN** ein Schreibzugriff `theme` auf einen Wert setzt, der nicht in der
  festgelegten Menge steht
- **THEN** weist die Datenbank den Schreibzugriff ab

#### Scenario: Ein Schreibzugriff ohne Thema bleibt möglich

- **WHEN** ein Schreibzugriff eine `feedback`-Zeile anlegt, ohne `theme` zu
  nennen — so wie die Oberfläche es tut, die vor dem Deploy noch läuft
- **THEN** wird die Zeile angelegt und trägt „Generell"

#### Scenario: Der Bestand bekommt „Generell", nicht NULL

- **WHEN** die Migration auf eine Datenbank mit vorhandenen Feedback-Zeilen
  angewendet wird
- **THEN** tragen alle vorhandenen Zeilen danach das Thema „Generell"
- **AND** keine Zeile trägt `null`

### Requirement: Ein Feedback kann ein Bild tragen

Das System SHALL beim Abgeben eines QM-Feedbacks das Mitschicken **eines**
Bildes erlauben und den Verweis darauf an der `feedback`-Zeile führen. Die
Bilder SHALL in einem **privaten** Bucket liegen.

Die Grössenbegrenzung und die erlaubten MIME-Typen SHALL am Bucket hängen, nicht
allein im Formular: eine Grenze, die nur der Browser kennt, ist keine Grenze. Der
Upload SHALL mit `upsert: false` erfolgen — bei `true` scheitert er an der
SELECT-Policy, weil der Aufrufer die Zieldatei erst lesen müsste.

Ein Feedback ohne Bild SHALL weiterhin möglich sein; das Bild ist optional.

Der Bildverweis SHALL an den Verfasser gebunden sein: ein nicht-leerer Pfad
SHALL im Präfix des Verfassers liegen. Ohne diese Bindung könnte ein Mitglied
seine Zeile auf ein **fremdes** Objekt zeigen lassen, und die Admin-Fläche
signierte oder löschte daraufhin das falsche Bild — sie handelte im Auftrag
eines Angreifers, ohne es zu merken. Die Zuordnung SHALL zusätzlich eindeutig
sein: ein Objekt gehört zu höchstens einer Feedback-Zeile.

Das Löschen SHALL über die geprüfte **Feedback-Identität** geschehen und NOT
über einen vom Aufrufer gelieferten Pfad. Es SHALL den Verweis an der Zeile
mit aufräumen — ein Verweis, der ins Leere zeigt, ist schlimmer als keiner,
weil die Fläche ihn weiter zu signieren versucht.

Das Bild SHALL vom Verfasser **und** von einem Admin gelöscht werden können.
Das Leserecht allein genügt hier nicht: ein missbräuchlich hochgeladenes Bild
bliebe sonst liegen, bis sein Verfasser es selbst entfernt — und genau der
hätte keinen Anlass dazu. Das Löschrecht des Admins SHALL an derselben Rolle
hängen wie sein Leserecht und SHALL NOT weiter reichen als auf diesen Bucket.

#### Scenario: Ein Bild wird mitgeschickt und ist am Feedback auffindbar

- **WHEN** ein Mitglied ein QM-Feedback mit einem Bild absendet
- **THEN** liegt das Bild im privaten Bucket
- **AND** die `feedback`-Zeile trägt den Verweis darauf

#### Scenario: Ein zu grosses Bild wird serverseitig abgewiesen

- **WHEN** ein Upload die am Bucket gesetzte Grössenbegrenzung überschreitet,
  auch wenn er die Prüfung im Formular umgeht
- **THEN** weist der Speicher den Upload ab

#### Scenario: Ohne Bild bleibt der Verweis leer

- **WHEN** ein Mitglied ein QM-Feedback ohne Bild absendet
- **THEN** wird die Zeile angelegt und trägt keinen Bildverweis

#### Scenario: Ein Fremder kommt an das Bild nicht heran

- **WHEN** ein authentifiziertes Mitglied, das weder Verfasser noch Admin ist,
  das Bild eines fremden Feedbacks anfordert
- **THEN** verweigert der Speicher den Zugriff

#### Scenario: Der Admin entfernt ein missbräuchliches Bild

- **WHEN** ein Admin das Bild eines fremden Feedbacks löscht
- **THEN** lässt der Speicher das Löschen zu
- **AND** die Feedback-Zeile trägt danach keinen Bildverweis mehr

#### Scenario: Ein fremder Pfad wird gar nicht erst angenommen

- **WHEN** ein Mitglied seine Feedback-Zeile auf einen Pfad im Präfix eines
  anderen Mitglieds zeigen lässt
- **THEN** weist die Datenbank den Schreibzugriff ab

#### Scenario: Ein deaktivierter Admin kommt nicht heran

- **WHEN** ein Konto mit gesetzter Admin-Rolle, aber deaktiviert, ein fremdes
  Bild lesen oder löschen will
- **THEN** verweigert der Speicher beides

#### Scenario: Ein Fremder kann das Bild nicht löschen

- **WHEN** ein authentifiziertes Mitglied ohne Admin-Rolle das Bild eines
  fremden Feedbacks löschen will
- **THEN** verweigert der Speicher das Löschen

### Requirement: Die Admin-Fläche filtert über die RPC, nicht über die geladene Seite

Das System SHALL das Filtern der Feedback-Übersicht nach Thema und nach Bewertung
**in `admin_list_feedback()`** vornehmen, nicht im Browser über die bereits
geladene Seite.

Der Grund ist die Paginierung: die Fläche lädt seit AGE-587 eine begrenzte Seite.
Ein Filter über der geladenen Seite filterte diese Seite und nicht den Bestand —
er zeigte damit nicht „alle Zeilen zum Thema X", sondern „die Zeilen zum Thema X,
die zufällig auf Seite 1 stehen", ohne dass die Fläche den Unterschied nennt.

Die Auswahl SHALL als Auswahlkästchen angeboten werden und Mehrfachauswahl
zulassen, die als ODER wirkt; sie SHALL in der bestehenden `FilterSpalte`
sitzen. Ein leerer Filter SHALL alles zeigen und nicht nichts.

#### Scenario: Der Filter greift über den ganzen Bestand

- **WHEN** ein Admin ein Thema auswählt, zu dem es Zeilen jenseits der ersten
  Seite gibt
- **THEN** enthält das Ergebnis auch diese Zeilen

#### Scenario: Mehrere Marken wirken als ODER

- **WHEN** ein Admin zwei Themen auswählt
- **THEN** enthält das Ergebnis die Zeilen beider Themen

#### Scenario: Kein Filter heisst alles

- **WHEN** ein Admin keine Marke gesetzt hat
- **THEN** zeigt die Fläche den ungefilterten Bestand

#### Scenario: Ein Filter ohne Treffer ist nicht dasselbe wie ein Fehler

- **WHEN** eine Filterkombination auf kein Feedback passt
- **THEN** sagt die Fläche, dass zu dieser Auswahl nichts vorliegt, und
  unterscheidet das von einem gescheiterten Aufruf

### Requirement: Aus einer Feedback-Zeile führt ein Weg zum Verfasser

Das System SHALL an jeder Zeile der Admin-Feedback-Fläche einen Weg anbieten,
das Gespräch mit dem Verfasser zu öffnen, und SHALL dafür dessen `profile_id`
verwenden und nicht den angezeigten Namen. Ein Name ist keine Kennung, und zwei
Mitglieder dürfen denselben tragen.

Der Weg SHALL das bestehende Gespräch öffnen, wenn es eines gibt, und sonst
genau eines anlegen — nach derselben Normalisierung des Paares, die für jedes
andere Gespräch gilt. Er SHALL NOT ein zweites Gespräch zu einem Paar erzeugen,
das bereits eines hat.

Der Weg SHALL NOT angeboten werden, wenn er ins Leere führte: nicht bei
Feedback, das der handelnde Admin **selbst** geschrieben hat, und nicht bei
einem Verfasser, dessen Konto deaktiviert oder gelöscht ist. `profile_id not
null` belegt nur, dass eine Profilzeile existiert — nicht, dass sie zu jemand
anderem gehört und nicht, dass dahinter noch jemand erreichbar ist.

#### Scenario: Am eigenen Feedback gibt es keinen Weg

- **WHEN** ein Admin eine Feedback-Zeile sieht, die er selbst geschrieben hat
- **THEN** bietet die Fläche dort keinen Weg ins Gespräch an

#### Scenario: Bei einem stillgelegten Verfasser gibt es keinen Weg

- **WHEN** der Verfasser einer Feedback-Zeile deaktiviert oder gelöscht ist
- **THEN** bietet die Fläche dort keinen Weg ins Gespräch an, und sagt warum

#### Scenario: Der Admin springt in ein bestehendes Gespräch

- **WHEN** ein Admin den Weg an einer Feedback-Zeile benutzt und mit dem
  Verfasser bereits ein Gespräch besteht
- **THEN** öffnet sich dieses Gespräch, und es entsteht kein zweites

#### Scenario: Ohne bestehendes Gespräch entsteht genau eines

- **WHEN** ein Admin den Weg benutzt und zwischen beiden noch kein Gespräch
  besteht
- **THEN** entsteht genau ein Gespräch mit dem normalisierten Paar

#### Scenario: Angesprochen wird die Kennung, nicht der Name

- **WHEN** zwei Mitglieder denselben Anzeigenamen tragen und eines davon ein
  Feedback geschrieben hat
- **THEN** führt der Weg zum Verfasser dieser Zeile und nicht zum
  gleichnamigen anderen Mitglied

## MODIFIED Requirements

### Requirement: Admin-only aggregate read

The system SHALL restrict aggregate reads of all feedback to admins. A
`SECURITY DEFINER` function `is_admin()` SHALL report whether the caller holds the
`admin` staff role, the `feedback_admin_read` policy SHALL grant admins `select` on
all `feedback` rows, and the `SECURITY DEFINER` function `admin_list_feedback()`
SHALL return feedback rows with the resolved author name — returning no rows to
any non-admin caller (including `matching_manager`).

The function SHALL take `p_limit` and `p_offset`, both with defaults, and SHALL
clamp `p_limit` into a bounded range rather than rejecting an out-of-range value:
a listing RPC has no error case its caller could act on. It SHALL additionally
return the author's `profile_id`, so that a later capability can address the
author directly instead of matching on a display name — a name is not an
identity, and two members may share one.

Die Funktion SHALL zusätzlich das `theme` und den Bildverweis der Zeile
zurückgeben, und SHALL Filterargumente für Thema und Bewertung entgegennehmen.
Ein nicht gesetztes Filterargument SHALL als „keine Einschränkung" wirken und
NOT als „passt auf nichts" — sonst lieferte der Normalfall eine leere Liste. Die
Filterung SHALL vor der Begrenzung durch `p_limit`/`p_offset` greifen, damit die
Seiten den gefilterten Bestand durchblättern und nicht den ungefilterten.

#### Scenario: Admin lists all feedback with author names

- **WHEN** a caller for whom `is_admin()` is true calls `admin_list_feedback()`
- **THEN** it returns feedback rows joined to the author's name (falling back
  to a placeholder when the name cannot be resolved), ordered by `created_at`
  descending

#### Scenario: Non-admin receives no rows

- **WHEN** a non-admin caller invokes `admin_list_feedback()`
- **THEN** the `where public.is_admin()` filter yields an empty result

#### Scenario: The admin pages through the feedback

- **WHEN** an admin calls `admin_list_feedback(p_limit => 2, p_offset => 2)` over
  a stock of more than four rows
- **THEN** it returns the third and fourth row of the same descending order, and
  no row appears in both the first and the second page

#### Scenario: An out-of-range page size is clamped, not refused

- **WHEN** an admin calls the function with a `p_limit` of zero, of `null`, or of
  a number far above the permitted maximum
- **THEN** the call succeeds and returns a row count inside the permitted range,
  rather than raising

#### Scenario: The author is identified, not just named

- **WHEN** an admin lists feedback written by a member
- **THEN** each row carries that member's `profile_id` alongside the display
  name, and the two refer to the same member

#### Scenario: Thema und Bildverweis kommen mit

- **WHEN** ein Admin die Liste abruft
- **THEN** trägt jede Zeile ihr `theme` und, sofern vorhanden, den Bildverweis

#### Scenario: Ohne Filterargument bleibt der Bestand unbeschnitten

- **WHEN** ein Admin die Funktion ohne Filterargumente aufruft
- **THEN** liefert sie dieselbe Menge wie vor Einführung der Filter

#### Scenario: Der Filter greift vor der Seitengrenze

- **WHEN** ein Admin nach einem Thema filtert, dessen Zeilen im ungefilterten
  Bestand erst jenseits der ersten Seite lägen
- **THEN** stehen diese Zeilen auf der ersten Seite des gefilterten Ergebnisses
