# community-feed — Delta für `composer-aktionen-zusammen`

## MODIFIED Requirements

### Requirement: Ein begonnener Beitrag lässt sich verwerfen

Das System SHALL im aufgeklappten Composer einen Weg anbieten, den Entwurf zu
verwerfen und den Composer zu schliessen, **ohne** zu veröffentlichen. Der Weg
SHALL in derselben Aktionszeile stehen wie „Posten".

Der Grund SHALL festgehalten sein: bis zu dieser Anforderung hatte der Composer
genau **einen** Ausgang, und er führte durch das Veröffentlichen. Das Aufklappen
war damit eine Entscheidung, die sich nur durch einen Schreibvorgang oder durch
Verlassen der Seite widerrufen liess.

Verworfen SHALL der **gesamte** Entwurf werden, in einem Zug:

- der Text,
- der Video-Link samt dem aufgeklappten Videofeld,
- die Sichtbarkeit, zurück auf die Vorgabe `members`,
- der Veröffentlichungszeitpunkt, zurück auf „sofort",
- die gewählten Bilder,
- eine stehende Fehlermeldung zur Bildauswahl,
- die gewählten Themen.

Ein Teil-Zurücksetzen SHALL NOT genügen. Bliebe auch nur eines dieser Felder
stehen, fände der Verfasser es beim nächsten Aufklappen unerwartet vor —
schlechter als gar kein Weg zurück, weil er dann einen Entwurf für leer hält,
der es nicht ist.

Die Objekt-URLs der Bildvorschauen SHALL dabei freigegeben werden. Sie sind an
das Dokument gebunden und nicht an die Komponente; ohne Freigabe hielte jeder
verworfene Entwurf seine Bilder bis zum Neuladen der Seite im Speicher.

Der Weg SHALL **ohne Rückfrage** wirken. Er steht neben „Posten", trägt kein
zerstörerisches Gewicht und ist mit einem Klick wiederholbar; eine Bestätigung
belastete den häufigen Fall, um den seltenen zu decken.

Diese Anforderung SHALL NOT als Zusage gelesen werden, dass ein Entwurf
irgendwo aufbewahrt wird. Der Entwurf überlebt weiterhin weder Navigieren noch
Neuladen — verworfen wird hier nur ausdrücklich, was ohnehin flüchtig ist.

Die Aktionszeile SHALL den dritten Knopf **umbrechen** können, statt die Karte
aufzuweiten. Der Grund SHALL mit der Messung festgehalten sein: die Gruppe
rechts konnte bis zu dieser Anforderung nicht umbrechen. Auf 375 × 812 (Chrome,
an der echten Feed-Karte gemessen) braucht sie mit dem dritten Knopf **353 px**
bei **293 px** Innenmaß — sie weitete die Karte von 341 auf 401 px und erzeugte
**44 px** waagerechten Überlauf im ganzen Dokument. Ein Composer, der die Seite
seitlich verschiebt, ist ein schlechterer Tausch als ein fehlender Rückweg.

**Der Umbruch SHALL die zwei Aktionsknöpfe nicht trennen.** „Abbrechen" und
„Posten" SHALL gemeinsam umbrechen; umbrechen SHALL die Medien-Zeile über sie,
nicht die Aktionszeile zwischen ihnen.

Der Grund SHALL mit der Messung festgehalten sein, und er ist eine Folge der
Klausel darüber: mit dem blossen Umbruch brach die Zeile auf 375 × 812 als
`[Bild] [Video] [Abbrechen]` über `[Posten]` — die beiden Aktionsknöpfe lagen
auf `top` **388** und **432**, also in verschiedenen Zeilen. „Abbrechen" stand
damit bei den Knöpfen, die etwas **hinzufügen**, statt bei dem, der abschliesst.
Kein Überlauf, kein abgeschnittener Inhalt — eine Gruppierung, die die falsche
Geschichte erzählt. Gemeinsam gefasst sind es **430/430**, die Hülle misst
**178 px** in 293 px Innenmaß, und der Überlauf bleibt **0**.

Diese Klausel SHALL NOT als Vorgabe für die Reihenfolge gelesen werden. Sie
sagt, dass die beiden zusammenbleiben, nicht welcher links steht.

#### Scenario: Der dritte Knopf erzeugt keinen waagerechten Überlauf

- **WHEN** der Composer auf einem 375 px breiten Schirm aufgeklappt ist
- **THEN** bleibt die Aktionszeile innerhalb der Karte, und das Dokument
  scrollt nicht seitlich

#### Scenario: Der Umbruch trennt „Abbrechen" nicht von „Posten"

- **WHEN** der Composer auf einem 375 px breiten Schirm aufgeklappt ist und die
  Aktionszeile umbricht
- **THEN** stehen „Abbrechen" und „Posten" weiterhin in derselben Zeile

#### Scenario: Verwerfen schliesst den Composer, ohne zu veröffentlichen

- **WHEN** ein Mitglied den Composer aufklappt, Text eingibt und dann verwirft
- **THEN** klappt der Composer zu, und es entsteht **kein** Beitrag

#### Scenario: Nach dem Verwerfen beginnt der Composer leer

- **WHEN** ein Mitglied einen Entwurf mit Text, einem gewählten Thema und einem
  Veröffentlichungszeitpunkt verwirft und den Composer erneut aufklappt
- **THEN** stehen Textfeld und Zeitpunkt leer, kein Thema ist gewählt, und die
  Sichtbarkeit steht wieder auf „Mitglieder"

#### Scenario: Verwerfen gibt die Vorschauen der gewählten Bilder frei

- **WHEN** ein Mitglied Bilder in den Composer gewählt und den Entwurf dann
  verworfen hat
- **THEN** ist die Objekt-URL jeder Vorschau freigegeben
