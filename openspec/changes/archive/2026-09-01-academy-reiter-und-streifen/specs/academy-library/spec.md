## REMOVED Requirements

### Requirement: Academy lists curated video lessons

**Reason**: Die Anforderung legte die kuratierte Liste als „redaktionellen Block
**oben** auf der Seite, oberhalb der geteilten Videos" fest, und ihr Szenario
„Der kuratierte Block steht über den geteilten Videos" behauptet dasselbe. Diese
Aussage stirbt mit diesem Change — die Redaktion wird der dritte Reiter. Ein
Szenario, dessen Aussage hinfällig wird, lässt sich durch `MODIFIED` nicht
entfernen: `openspec archive` ordnet Szenarien über ihre Überschrift zu und
bricht ab, statt eines still zu löschen (gemessen am 09.08., und derselbe Grund,
aus dem `add-admin-member-list` am 22.08. abbrach).

**Migration**: Ersetzt durch „Die Redaktion ist der dritte Reiter und ihre
Kachel ein Streifen". Alles, was nicht die Platzierung betraf, steht dort
unverändert: die feste, im Code definierte Liste mit Titel, Beschreibung und
Einbettung je Lektion; dass die Plattform kein Video selbst hostet; das
Einwilligungstor des Design-Systems **ohne Ausnahme** für die Academy; und dass
die Liste eine Konstante im Code bleibt, samt Begründung. Entfällt allein die
Ortsangabe „oben".

## ADDED Requirements

### Requirement: Die Redaktion ist der dritte Reiter und ihre Kachel ein Streifen

Das System SHALL eine feste, im Code definierte Liste kuratierter Lektionen
führen, jede mit Titel, Beschreibung und einem eingebetteten Video eines
externen Anbieters (YouTube/Vimeo) über ein wiederverwendbares Bauteil. Die
Plattform SHALL NOT Videoinhalte selbst hosten.

Die Einbettung SHALL dem Einwilligungstor des Design-Systems folgen: die Karte
zeigt zuerst eine Fläche aus dem eigenen Ursprung, und der Player des Anbieters
wird erst auf Anforderung geladen. Die Academy SHALL dafür **keine Ausnahme**
kennen — sie erhält das Verhalten aus derselben Komponente wie jede andere
Fläche.

Sie SHALL eine Konstante im Code bleiben und SHALL NOT in die Datenbank
überführt werden. Der Grund SHALL festgehalten sein: drei von der Redaktion
gewählte Videos sind kein Inhaltsmodell. Sie in `posts` zu schreiben gäbe ihnen
einen Autor, eine Sichtbarkeit, Likes und Kommentare, die niemand bestellt hat —
und ein Kurs-Schema wäre AGE-262, nicht dieser Change.

Die kuratierte Liste SHALL als **dritter Reiter** stehen, hinter „Alle" und
„Meine Academy", und SHALL NOT als eigener Block oberhalb der Reiterzeile
liegen. Der Grund SHALL festgehalten sein: die Reiterzeile ist auf den übrigen
Flächen der Ort, an dem Sichten nebeneinander stehen; ein Block darüber ist eine
vierte Anordnung für dieselbe Sache. Der Startreiter SHALL „Alle" bleiben.

Die Kachel einer Lektion SHALL das Video **neben** Titel und Beschreibung
zeigen, nicht darüber. Der Grund SHALL festgehalten sein: über dem Text nimmt
ein `aspect-video`-Rahmen die volle Kachelbreite ein und schiebt den Titel aus
dem Bild — mit dem Einwilligungstor umso mehr, weil die ungeklickte Fläche
dieselbe Höhe als Grau einnimmt.

Unterhalb einer Behälter-Schwelle SHALL der Streifen in die gestapelte
Anordnung zurückfallen. Die Schwelle SHALL eine **Behälter**-Abfrage sein und
SHALL NOT am Fenster hängen: die Kachel steht in einem Raster, das die
Filterspalte verengt, während das Fenster gleich breit bleibt.

#### Scenario: Academy shows the curated lessons

- **WHEN** a member opens the Academy page
- **THEN** each hard-coded lesson is shown as a card with its title, its
  description, and the embed component in place of the player

#### Scenario: Die Redaktion ist der dritte Reiter

- **WHEN** ein Mitglied die Academy öffnet
- **THEN** trägt die Reiterzeile „Alle", „Meine Academy" und „Redaktion" in
  dieser Reihenfolge
- **AND** „Alle" ist ausgewählt
- **AND** oberhalb der Reiterzeile steht kein Block mit kuratierten Lektionen

#### Scenario: Die Kachel zeigt das Video neben dem Text

- **WHEN** der Reiter „Redaktion" ab der Behälter-Schwelle dargestellt wird
- **THEN** steht das Video links und Titel samt Beschreibung rechts daneben

#### Scenario: Schmal fällt der Streifen zurück

- **WHEN** der Behälter der Kachel unter die Schwelle fällt
- **THEN** steht das Video über Titel und Beschreibung

#### Scenario: Eine kuratierte Lektion lädt den Anbieter nicht ungefragt

- **WHEN** ein Mitglied die Academy öffnet
- **THEN** geht für keine der kuratierten Lektionen ein Aufruf an den Anbieter
  hinaus, bevor die jeweilige Fläche aktiviert wurde

## MODIFIED Requirements

### Requirement: Die Academy zeigt geteilte Videos in zwei Reitern

Das System SHALL für geteilte Videos zwei Reiter anbieten, in **derselben
Reiterzeile** wie die Redaktion:

- **Alle** — alle für den Betrachter sichtbaren Beiträge mit `video_url`,
  neueste zuerst.
- **Meine Academy** — zwei Regale: die eigenen geteilten Videos, und die
  gelikten (die eigenen mit „gefällt mir" markierten Videos).

Die Academy SHALL **kein eigenes Datenmodell** bekommen. Sie SHALL eine
gefilterte Sicht auf `public.posts` sein: Beiträge mit einer nicht-leeren
`video_url`. Es SHALL keine Tabelle für Kurse, Lektionen, Einschreibungen oder
Fortschritt entstehen — das ist AGE-262.

Sichtbarkeit SHALL ausschließlich die RLS von `posts` entscheiden. Die Academy
SHALL NOT ein zweites Sichtbarkeitsprädikat führen; sie stellt dieselbe Abfrage
wie der Feed, nur mit einem zusätzlichen Filter auf `video_url`.

Ein in der Aktivität geteiltes Video SHALL **ohne weiteres Zutun** in der
Academy erscheinen — kein Abgleich, kein Übertragen, kein zweiter Eintrag.

Beide Reiter SHALL **seitenweise** laden, mit derselben Keyset-Paginierung wie
der Feed (Cursor über `(created_at, id)`), und SHALL NOT auf eine feste
Obergrenze ohne Nachladen setzen. Der Grund SHALL festgehalten sein: PostgREST
begrenzt Resultsets ohnehin. Ein Reiter, der „alle sichtbaren Videos"
verspricht und dabei still abschneidet, sagt die Unwahrheit, ohne dass etwas
darauf hinweist — dieselbe Begründung, aus der der Feed seine Paginierung
bekommen hat.

Der leere Zustand SHALL unterscheiden, ob es überhaupt keine geteilten Videos
gibt oder nur keine eigenen, und im zweiten Fall den Weg zum Teilen zeigen statt
den Mangel zu benennen.

#### Scenario: Ältere Videos sind erreichbar

- **WHEN** mehr sichtbare Videos bestehen, als eine Seite trägt
- **THEN** zeigt der Reiter die erste Seite und lädt die älteren auf
  Anforderung nach, statt den Rest wegzulassen

#### Scenario: Ein geteiltes Video erscheint ohne Zutun in der Academy

- **WHEN** ein Mitglied in der Aktivität einen Beitrag mit einem YouTube-Link
  veröffentlicht und danach die Academy öffnet
- **THEN** steht das Video unter „Alle" und unter „Meine Academy", ohne dass
  irgendwo etwas übertragen wurde

#### Scenario: Das Regal „selbst geteilt" zeigt nur die eigenen

- **WHEN** ein Mitglied den Reiter „Meine Academy" öffnet und andere Mitglieder
  ebenfalls Videos geteilt haben
- **THEN** enthält das Regal der selbst geteilten Videos nur die eigenen — für
  fremde Videos ist das zweite Regal zuständig

#### Scenario: Ein unsichtbarer Beitrag erscheint auch in der Academy nicht

- **WHEN** ein Mitglied unter Rang 4 die Academy öffnet und ein fremdes
  `members`-Video besteht
- **THEN** erscheint es nicht — dieselbe Entscheidung wie im Feed, getroffen an
  derselben Stelle

#### Scenario: Der leere Zustand zeigt den Weg

- **WHEN** ein Mitglied „Meine Academy" öffnet und selbst noch kein Video
  geteilt hat
- **THEN** erscheint ein leerer Zustand, der zum Teilen führt, statt nur das
  Fehlen zu benennen

### Requirement: Die Academy hat Suche, Hashtags und Sortierung in einer rechten Spalte

Die Academy SHALL eine rechte Inhaltsspalte führen, die beim Blättern mitläuft,
mit denselben Massen und demselben Umbruchverhalten wie die Filterspalte der
Aktivität: 16rem breit, 24 px Abstand, ab `lg` neben dem Inhalt, darunter im
Fluss hinter einem zugeklappten Schalter.

Die Spalte SHALL die **ganze Seite** umspannen und SHALL NOT im Inhalt eines
einzelnen Reiters liegen. Das Raster SHALL Reiterzeile **und** Reiterinhalt
umfassen, sodass die Spalte in derselben Zeile beginnt wie die Reiter — dasselbe
Muster wie bei der Aktivität. Der Grund SHALL festgehalten sein: innerhalb eines
Reiterinhalts beginnt die Spalte erst unterhalb der Reiterzeile und liest sich
als Kasten neben einer Liste, und die übrigen Reiter tragen sie überhaupt nicht.

Die Spalte SHALL enthalten:

- ein **Volltextfeld**, das über den Beitragstext sucht,
- die Facette **Hashtags**, deren Werte aus dem Bestand der sichtbaren Videos
  abgeleitet werden SHALL,
- die **Sortierung** mit den Ordnungen, die die Feed-Schicht bereits führt —
  „Neueste" und „Beliebteste".

Die Sortierung SHALL die vorhandenen Ordnungen der Feed-Schicht benutzen und
keine eigene einführen. Die Academy ist eine gefilterte Sicht auf `posts`, und
deren Blätterung trägt seit AGE-667 in allen drei Ordnungen
`veroeffentlicht_ab` als führendes Feld, in der Ordnung „Beliebteste"
zusätzlich `like_count` im Cursor. Eine zweite, eigene Ordnung hier hiesse, den
Cursorvertrag ein zweites Mal zu bauen.

Volltextfeld und Sortierung SHALL immer stehen. Die Hashtag-Karte SHALL **nicht
rendern**, wenn kein sichtbares Video ein Hashtag trägt. Damit trägt die Spalte
auch auf dünnem Bestand, ohne eine leere Hülle zu zeigen — auf der Produktion
steht heute genau ein Video, und keines trägt ein Hashtag.

Die Spalte SHALL ihre Felder nur auf dem Reiter anbieten, auf den sie
**wirkt** — „Alle". Auf „Meine Academy" und „Redaktion" SHALL sie stattdessen
benennen, warum hier nicht gefiltert wird. Der Grund SHALL festgehalten sein:
die Redaktion ist eine Konstante im Code, und „Meine Academy" lädt sein zweites
Regal über `fetchGelikteVideos`, das weder Suche noch Ordnung kennt — ein Feld,
das die Hälfte der Liste nicht erreicht, ist eine Zusage ohne Deckung.

Sie SHALL dabei auf allen drei Reitern **stehen bleiben** und SHALL NOT
verschwinden: eine Spalte, die beim Reiterwechsel weggeht, ändert die
Inhaltsbreite um 16rem und lässt die Seite springen.

#### Scenario: Die Spalte trägt auch ohne Hashtags

- **WHEN** die Academy geöffnet wird und kein sichtbares Video ein Hashtag
  trägt
- **THEN** erscheint keine Hashtag-Karte
- **AND** Volltextfeld und Sortierung stehen trotzdem

#### Scenario: Die Hashtag-Facette kommt aus dem Bestand

- **WHEN** sichtbare Videos die Hashtags `leadership` und `marketing` tragen
- **THEN** bietet die Facette genau diese beiden zur Auswahl

#### Scenario: Die Sortierung nutzt die vorhandenen Ordnungen

- **WHEN** „Beliebteste" gewählt und weitergeblättert wird
- **THEN** führt `like_count` die Ordnung
- **AND** der Cursor trägt `likeCount`, wie es die Feed-Schicht für diese
  Ordnung verlangt

#### Scenario: Die kuratierten Lektionen bleiben oben

- **WHEN** der Reiter „Redaktion" ab `lg` geöffnet wird
- **THEN** stehen die kuratierten Lektionen im Reiterinhalt und nicht in der
  Spalte
- **AND** die Spalte steht weiterhin da, mit einem Hinweis statt mit Feldern
- **AND** dasselbe gilt auf „Meine Academy"

#### Scenario: Die Spalte beginnt auf Höhe der Reiter

- **WHEN** die Academy ab `lg` geöffnet wird
- **THEN** beginnt die Spalte in derselben Zeile wie die Reiterzeile, nicht
  unterhalb des Reiterinhalts
- **AND** sie steht auf jedem der drei Reiter
