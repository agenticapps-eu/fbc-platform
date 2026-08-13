## MODIFIED Requirements

### Requirement: Der Composer trägt Text, Bilder, Video-Link, Tags und Sichtbarkeit

Das System SHALL im Composer erlauben: Text, bis zu sechs Bilder, einen
Video-Link, eine Auswahl aus den aktiven kuratierten Tags sowie freien
Tag-Text, und die Sichtbarkeit (`members` als Vorgabe).

Videos SHALL verlinkt und NOT hochgeladen werden. Es SHALL nur eingebettet
werden, was als YouTube- oder Vimeo-Link mit valider Video-ID erkannt wird. Der
Link SHALL im Beitragstext gespeichert und beim Rendern dort unterdrückt werden,
damit er nicht als Link **und** als Einbettung erscheint.

Der Beitragstext SHALL die **Quelle** der Video-URL bleiben: die Datenbank
leitet `posts.video_url` aus dem Body ab. Die frühere Fassung dieser Anforderung
untersagte ein solches Feld; das galt der Darstellung. Fürs Filtern und
Sortieren trägt es nicht — ein Regex über `body` ist weder indexierbar noch
verlässlich.

Die Ableitung SHALL **serverseitig** geschehen und SHALL NOT dem Client
überlassen werden. Der Grund SHALL festgehalten sein: `posts_write_own` erlaubt
`authenticated` INSERT und UPDATE direkt auf `posts`, die RPC ist also nicht der
einzige Schreibweg. Ein clientseitig berechneter Wert wäre frei wählbar, und
dann stünde ein Beitrag in der Academy, dessen Karte etwas anderes zeigt.

#### Scenario: Ein Beitrag mit Bildern und Tags wird veröffentlicht

- **WHEN** ein bestätigtes Mitglied Text, zwei Bilder, einen kuratierten und
  einen freien Tag sowie die Sichtbarkeit `members` wählt und veröffentlicht
- **THEN** entsteht ein Beitrag mit beiden Tags in `hashtags` und zwei
  `post_media`-Zeilen in der gewählten Reihenfolge

#### Scenario: Ein fremder Videolink wird nicht eingebettet

- **WHEN** im Video-Feld ein Link außerhalb von YouTube und Vimeo steht
- **THEN** wird er nicht eingebettet und der Beitrag ist so nicht absendbar

#### Scenario: Ein getippter und geklickter Tag ergibt einen Chip

- **WHEN** ein Mitglied `#Netzwerken` in den Text tippt und denselben Tag
  zusätzlich in der Auswahl anklickt
- **THEN** steht der Wert einmal in `hashtags` und erscheint als ein Chip

#### Scenario: Ein Fehlschlag beim Veröffentlichen hinterlässt keinen halben Beitrag

- **WHEN** das Anlegen der Bildzeilen eines Beitrags fehlschlägt
- **THEN** existiert kein Beitrag, und der Feed zeigt nichts Unvollständiges

#### Scenario: Ein veröffentlichtes Video steht in der Spalte und im Text

- **WHEN** ein Mitglied einen Beitrag mit einem gültigen YouTube-Link
  veröffentlicht
- **THEN** trägt der Beitrag die URL in `video_url`, der Link steht weiterhin im
  Body, und die Karte zeigt genau ein Embed und keinen zusätzlichen Link

## ADDED Requirements

### Requirement: Die Video-URL eines Beitrags wird in der Datenbank abgeleitet

Das System SHALL an `public.posts` eine Spalte `video_url text` führen, nullable,
weil die überwiegende Mehrheit der Beiträge kein Video trägt.

Das System SHALL den Wert über einen Trigger `before insert or update` **bei
jedem Schreibzugriff neu aus `body` berechnen**. Ein vom Client mitgeschickter
Wert SHALL überschrieben werden. Der Trigger SHALL NOT auf `update of body`
eingeschränkt sein — ein `update`, das nur `video_url` setzt, käme sonst an ihm
vorbei.

Die Erkennung SHALL in **einer** SQL-Funktion stehen, die der Trigger **und**
der Backfill aufrufen. Backfill und Laufzeit SHALL dadurch per Konstruktion
dieselbe Antwort geben und NOT per Zusicherung.

Ein Check-Constraint auf der Spalte SHALL es NOT geben: der Trigger ist die
Garantie, und ein Constraint, den nur die eigene Funktion verletzen könnte,
prüft nichts.

Die Funktion SHALL genau die Formen akzeptieren, die `parseVideoUrl` akzeptiert,
und SHALL NOT darüber hinausgehen — insbesondere SHALL `youtube-nocookie`
**nicht** aufgenommen werden, solange der TypeScript-Parser ihn nicht kennt.
Akzeptiert SHALL sein: `http` und `https`; optionales `www.`; `youtube.com` und
`m.youtube.com` mit `/watch?…v=<id>` oder `/embed/<id>`; `youtu.be/<id>`;
`vimeo.com/<zahl>`; `player.vimeo.com/video/<zahl>`; jeweils mit optionalem
Query-Teil und Fragment.

Der Vergleich SHALL **ohne Rücksicht auf Groß- und Kleinschreibung des Hosts**
erfolgen, weil `parseVideoUrl` den Host kleinschreibt. Eine case-sensitive
Prüfung lehnte `https://WWW.YouTube.com/watch?v=…` ab, das der Client akzeptiert.

Das Muster SHALL an der Host-Grenze **verankert** sein. Ein Präfix-Vergleich
SHALL NOT genügen: er ließe `https://youtube.com.boese.example/watch?v=x` durch,
und in `video_url` stünde ein Wert, den die Einbettung ablehnt.

Das System SHALL einen **partiellen** Index über `(created_at desc, id desc)
where video_url is not null` führen. Er trägt Filter und Sortierung der Academy
in einem; ein Index auf `video_url` allein trüge die Sortierung nicht.

Bestehende Beiträge SHALL einmalig nachbefüllt werden.

#### Scenario: Ein selbst gesetzter Wert wird überschrieben

- **WHEN** ein Schreibzugriff einen Beitrag ohne Videolink im Body anlegt und
  dabei `video_url` auf eine erlaubte URL setzt
- **THEN** steht nach dem Schreiben `video_url = null`, weil der Trigger den
  Wert aus dem Body neu berechnet

#### Scenario: Ein Host mit erlaubtem Präfix wird abgelehnt

- **WHEN** ein Beitrag `https://youtube.com.boese.example/watch?v=x` im Body
  trägt
- **THEN** bleibt `video_url` null

#### Scenario: Großschreibung im Host wird akzeptiert

- **WHEN** ein Beitrag `https://WWW.YouTube.com/watch?v=Ks-_Mh1QhMc` im Body
  trägt
- **THEN** steht diese URL in `video_url` — dieselbe Entscheidung, die
  `parseVideoUrl` trifft

#### Scenario: Ein Beitrag ohne Video trägt keinen Wert

- **WHEN** ein Beitrag ohne Videolink veröffentlicht wird
- **THEN** ist `video_url` null, und der Beitrag erscheint nicht in der Academy

#### Scenario: Ein Bestandsbeitrag mit Videolink wird nachbefüllt

- **WHEN** vor dieser Änderung ein Beitrag mit einem YouTube-Link im Body
  veröffentlicht wurde
- **THEN** trägt er nach der Migration diese URL in `video_url`

### Requirement: Beiträge tragen eine Art und einen Bezug

Das System SHALL an `public.posts` zwei Spalten führen: `kind text not null
default 'member'`, beschränkt auf `member` und `event`, sowie `ref_id uuid`.

Bei `kind = 'event'` SHALL `ref_id` ein Fremdschlüssel auf `public.events (id)`
mit `on delete cascade` sein — ein gelöschtes Event nimmt seinen Feed-Beitrag
mit, ohne dass irgendwo aufgeräumt werden muss.

Der Fremdschlüssel SHALL **ausdrücklich benannt** werden. Der Client bezeichnet
ihn in der PostgREST-Einbettung namentlich; ein von Postgres generierter Name
wäre eine stille Kopplung, die bei jeder Umbenennung bricht.

Das System SHALL erzwingen, dass die beiden Spalten zusammenpassen: ein Beitrag
mit `kind = 'event'` SHALL ein `ref_id` tragen, ein Beitrag mit
`kind = 'member'` SHALL keines tragen.

Ein Event SHALL an genau einer `posts`-Zeile hängen: `ref_id` SHALL für
`kind = 'event'` eindeutig sein, durchgesetzt über einen **partiellen**
Unique-Index. Ein zweiter, nicht-eindeutiger Index auf `ref_id` SHALL NOT
angelegt werden — der partielle Unique-Index trägt den Join bereits, und
`ref_id` ist außerhalb von `kind = 'event'` leer.

#### Scenario: Ein gelöschtes Event nimmt seinen Beitrag mit

- **WHEN** ein Event gelöscht wird
- **THEN** verschwindet sein Feed-Beitrag mit ihm, ohne dass ein weiterer
  Schritt nötig ist

#### Scenario: Eine unpassende Kombination wird abgelehnt

- **WHEN** ein Schreibzugriff `kind = 'event'` ohne `ref_id` setzt, oder
  `kind = 'member'` mit einem `ref_id`
- **THEN** wird der Schreibzugriff abgelehnt

#### Scenario: Bestehende Beiträge bleiben Mitgliedsbeiträge

- **WHEN** die Migration auf eine Tabelle mit bestehenden Beiträgen angewandt wird
- **THEN** tragen alle bestehenden Zeilen `kind = 'member'` und kein `ref_id`

### Requirement: Event-Beiträge sind systemverwaltet

Das System SHALL Mitgliedern erlauben, ausschließlich Beiträge mit
`kind = 'member'` und ohne `ref_id` anzulegen, zu ändern und zu löschen.
Event-Beiträge SHALL für jedes Konto unbeschreibbar sein — auch für den Host,
der ihr Autor ist.

Der Grund SHALL festgehalten sein: `posts_write_own` gilt `for all` auf
`author_id = auth.uid()`, und der Host **ist** der Autor seines Event-Beitrags.
Ohne diese Einschränkung könnte er ihn löschen, auf `kind = 'member'`
umschreiben oder die vom Trigger gesetzte Sichtbarkeit danach wieder ändern —
Eindeutigkeit und Sichtbarkeitsspiegelung gälten dann nur zufällig, weil der
Trigger sie setzt und nichts sie hält.

Daraus SHALL folgen, dass ein Event-Beitrag **niemals** `post_media`-Zeilen
trägt: der Trigger legt keine an, und niemand kann welche nachtragen. Die
Signaturvergabe im Bucket (`post_media_lesbar`) SHALL dadurch von diesem Change
unberührt bleiben.

`public.is_activated()` SHALL als äußere Bedingung erhalten bleiben.

#### Scenario: Ein Mitglied kann keinen Event-Beitrag anlegen

- **WHEN** ein bestätigtes Mitglied einen Beitrag mit `kind = 'event'` und einem
  `ref_id` einzufügen versucht
- **THEN** wird der Schreibzugriff abgelehnt

#### Scenario: Der Host kann seinen Event-Beitrag nicht löschen

- **WHEN** der Host eines Events die zugehörige `posts`-Zeile zu löschen
  versucht
- **THEN** wird der Zugriff abgelehnt, und der Beitrag bleibt

#### Scenario: Der Host kann die gespiegelte Sichtbarkeit nicht umschreiben

- **WHEN** der Host die `visibility` oder das `kind` seines Event-Beitrags
  ändern will
- **THEN** wird der Zugriff abgelehnt

### Requirement: Der Feed-Beitrag folgt seinem Event über dessen Lebenszyklus

Das System SHALL beim Anlegen eines Events dessen `visibility` und `host_id` in
den Feed-Beitrag übernehmen und beide bei späteren Änderungen nachziehen.

Das System SHALL diese Regel an **einer** Stelle führen — einem Trigger-Paar auf
`events` — und NOT als Join im RLS-Prädikat von `posts`. Der Grund SHALL
festgehalten sein: Sichtbarkeit von `posts` wird an **vier** Orten entschieden —
`posts_select_public_anon`, `posts_select_by_visibility`, der `SECURITY
DEFINER`-Funktion `post_engagement_counts` und der `SECURITY DEFINER`-Funktion
`post_media_lesbar`. Ein Join müsste in alle vier; eine dort vergessene Stelle
wäre eine offene Flanke, die jeder Policy-Test grün meldet.

Der Lebenszyklus SHALL vollständig abgedeckt sein:

| Übergang an `events` | Wirkung auf den Feed-Beitrag |
|---|---|
| `visibility` ändert sich | `visibility` zieht nach |
| `host_id` null → Host | der fehlende Beitrag entsteht jetzt |
| `host_id` Host → anderer Host | `author_id` zieht nach |
| `host_id` Host → null | der Beitrag wird entfernt |

`host_id → null` SHALL den Beitrag entfernen und NOT ihn beim alten Autor
belassen: `posts.author_id` ist `not null`, es gäbe also niemanden, dem er
gehört. Das ist dieselbe Regel wie beim Anlegen, nur später angewandt.

Es SHALL benannt sein, dass der gespiegelte Beitrag damit **strenger** ist als
sein Event: `events` sind für jedes bestätigte Konto sichtbar, `members`-Posts
erst ab Rang 4 (`exchange`). Ein Mitglied unter Rang 4 sieht das
`members`-Event, aber nicht seinen Feed-Eintrag. Die Richtung ist die
ungefährliche; unbenannt wäre sie ein Rätsel.

#### Scenario: Der Beitrag eines members-Events ist ausgeloggt unsichtbar

- **WHEN** ein Host ein Event mit `visibility = 'members'` anlegt und ein
  ausgeloggter Besucher den Feed öffnet
- **THEN** erscheint weder das Event noch sein Beitrag

#### Scenario: Eine spätere Sichtbarkeitsänderung zieht den Beitrag nach

- **WHEN** ein Host die Sichtbarkeit seines Events von `public` auf `members`
  ändert
- **THEN** trägt auch sein Feed-Beitrag danach `members`, und ein ausgeloggter
  Besucher sieht ihn nicht mehr

#### Scenario: Ein später zugewiesener Host bringt das Event in den Feed

- **WHEN** ein Event ohne Host besteht und ihm später ein Host zugewiesen wird
- **THEN** entsteht in diesem Moment sein Feed-Beitrag

#### Scenario: Ein Hostwechsel zieht den Autor nach

- **WHEN** der Host eines Events auf ein anderes Profil geändert wird
- **THEN** trägt der Feed-Beitrag danach das neue Profil als Autor

#### Scenario: Ein entzogener Host entfernt den Beitrag

- **WHEN** `events.host_id` auf null gesetzt wird
- **THEN** verschwindet der Feed-Beitrag, und das Event bleibt bestehen

#### Scenario: Ein nicht aktiviertes Konto sieht keinen Event-Beitrag

- **WHEN** ein eingeloggtes, aber nicht aktiviertes Konto den Feed liest
- **THEN** liefert die Abfrage keinen Event-Beitrag, so wenig wie einen
  Mitgliedsbeitrag

#### Scenario: Ein Mitglied unter Rang 4 sieht den Beitrag eines members-Events nicht

- **WHEN** ein bestätigtes Mitglied mit Rang unter 4 den Feed liest und ein
  `members`-Event besteht
- **THEN** fehlt dessen Feed-Beitrag, während das Event unter /events sichtbar
  bleibt

### Requirement: Der Event-Beitrag speichert keinen Event-Inhalt

Das System SHALL im Feed-Beitrag eines Events **keinen** Titel, kein Datum,
keinen Ort und kein Titelbild speichern. Der Beitrag SHALL einen leeren `body`
tragen; die Darstellung SHALL zur Laufzeit über `ref_id` auf `events` joinen.

Der Grund SHALL festgehalten sein: eine Kopie veraltet still. Stünde der Titel
im Beitrag, zeigte der Feed nach einer Umbenennung einen Titel, den es nicht
mehr gibt — und jede Änderung am Event bräuchte einen weiteren Trigger, der die
Kopie nachzieht. So gibt es genau eine Wahrheit, und sie steht in `events`.

#### Scenario: Ein umbenanntes Event ändert die Feed-Darstellung sofort

- **WHEN** der Host den Titel seines Events ändert
- **THEN** zeigt der Feed beim nächsten Abruf den neuen Titel, ohne dass am
  Beitrag etwas geschrieben wurde

#### Scenario: Der Beitrag selbst trägt keinen Event-Text

- **WHEN** die `posts`-Zeile eines Event-Beitrags gelesen wird
- **THEN** enthält sie keinen Titel, kein Datum, keinen Ort und keinen Bildpfad

### Requirement: Ein Event ohne Host erzeugt keinen Feed-Beitrag

Das System SHALL beim Anlegen eines Events ohne `host_id` **keinen**
Feed-Beitrag erzeugen und das Anlegen des Events dadurch NOT scheitern lassen.
`events.host_id` ist nullable, `posts.author_id` ist `not null` — ein Trigger,
der es dennoch versuchte, ließe das Anlegen mit einem rohen Datenbankfehler
scheitern.

Es SHALL benannt sein, dass die Kaskaden asymmetrisch sind: das Löschen eines
Host-Profils setzt `events.host_id` auf null, löscht aber über
`posts.author_id` dessen Event-Beitrag. Das Event bleibt und verliert seinen
Feed-Eintrag. Das ist hingenommen, nicht übersehen, und SHALL durch einen Test
festgehalten sein — sonst wird „beheben" oder „behalten" später Zufall.

#### Scenario: Ein Event ohne Host wird angelegt

- **WHEN** ein Event ohne `host_id` entsteht
- **THEN** wird es angelegt, und es entsteht kein Feed-Beitrag

#### Scenario: Ein gelöschtes Host-Profil nimmt den Beitrag mit, nicht das Event

- **WHEN** das Profil eines Event-Hosts gelöscht wird
- **THEN** verschwindet sein Event-Beitrag aus dem Feed, und das Event bleibt
  bestehen

### Requirement: Der Feed zeigt zwei Kartentypen

Das System SHALL Event-Beiträge als eigene Karte darstellen — mit Titelbild,
Datum, Ort und einem Weg zur Detailseite —, nicht im Aufbau eines Textbeitrags.
Die Event-Karte SHALL sich in die Beitragsliste einfügen, chronologisch
zwischen den übrigen Beiträgen, und NOT als getrennte Liste danebenstehen.

Likes und Kommentare SHALL an einer Event-Karte ohne Sonderweg funktionieren:
es ist eine echte `posts`-Zeile. Der Interaktionsbereich SHALL mit der
Beitragskarte **geteilt** und NOT kopiert werden.

Das Titelbild SHALL über dieselbe signierte URL geladen werden wie auf der
Event-Seite (privater Bucket `event-covers`). Ist keine Signatur zu bekommen,
SHALL die Karte ohne Bild erscheinen und NOT verschwinden.

Ist das bezogene Event für den Betrachter nicht lesbar, SHALL die Karte
entfallen statt leer zu erscheinen.

**Jede** Oberfläche, die `posts` liest, SHALL die neue Art berücksichtigen —
nicht nur der Feed. Ein Event-Beitrag trägt einen leeren `body`; eine Ansicht,
die ihn ungeprüft rendert, zeigt eine leere Karte. Wo eine Ansicht auf wenige
Zeilen begrenzt ist, SHALL sie zusätzlich echte Beiträge nicht verdrängen:
Ansichten, die ausschließlich Mitgliedsbeiträge zeigen wollen, SHALL auf
`kind = 'member'` filtern.

#### Scenario: Ein neues Event erscheint als Event-Karte im Feed

- **WHEN** ein Host ein öffentliches Event anlegt und ein Mitglied den Feed öffnet
- **THEN** steht dort eine Karte mit Titel, Datum, Ort und einem Weg zur
  Detailseite des Events, chronologisch zwischen den übrigen Beiträgen

#### Scenario: Eine Event-Karte lässt sich liken und kommentieren

- **WHEN** ein bestätigtes Mitglied ab Rang 4 eine Event-Karte im Feed likt,
  den Like wieder entfernt, den Kommentarfaden öffnet und einen Kommentar anlegt
- **THEN** funktionieren alle vier Schritte wie an einem Mitgliedsbeitrag

#### Scenario: Die Startseite zeigt keine leere Vorschau

- **WHEN** ein Event-Beitrag unter den neuesten Beiträgen ist und ein Besucher
  die Startseite öffnet
- **THEN** benennt die Vorschau das Event, statt eine Karte ohne Text zu zeigen

#### Scenario: Die eigenen Beiträge im Dashboard bleiben Mitgliedsbeiträge

- **WHEN** ein Host mit eigenen Events und eigenen Beiträgen sein Dashboard oder
  sein öffentliches Profil öffnet
- **THEN** erscheinen dort nur seine Mitgliedsbeiträge, und seine Event-Beiträge
  verdrängen keinen davon aus der begrenzten Liste
