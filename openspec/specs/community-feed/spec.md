# Community Feed

## Purpose

Defines the community activity feed (Aktivität) of the FBC platform: member
posts with hashtags, threaded comments, and likes, plus the discreet aggregate
engagement counters the feed renders. Visibility is enforced in the database via
RLS keyed on membership tier rank, never in the client alone. Reconstructed from
the code as of the OpenSpec migration; supersedes the legacy `prime`/`legacy`
post-visibility values, which the six-level migration folded into `members`.
## Requirements
### Requirement: Posts carry author, body, hashtags, and visibility

The system SHALL store each feed post with a non-null `author_id` referencing a
profile, a non-null `body`, an optional `hashtags` text array, a `visibility`
constrained to `public` or `members` (default `members`), and a `created_at`
timestamp. Deleting the author profile SHALL cascade-delete the post.

#### Scenario: A post is created with defaults

- **WHEN** a member creates a post supplying only `author_id` and `body`
- **THEN** the row is stored with `visibility = 'members'`, a generated `id`, and
  `created_at = now()`

#### Scenario: An unsupported visibility value is rejected

- **WHEN** a write sets a post's `visibility` to a value other than `public` or
  `members` (for example the retired `prime` or `legacy`)
- **THEN** the write is rejected by the `posts_visibility_check` constraint

### Requirement: Post readability is gated by tier rank

The system SHALL, via RLS, permit an authenticated member to read a post only
when the post is `public`, or the post is `members` and the member's tier rank is
at least `exchange` (rank 4), or the member is the post's author.

#### Scenario: Members-only post hidden below exchange

- **WHEN** an authenticated member with rank below 4 reads the feed
- **THEN** posts with `visibility = 'members'` that they did not author are not
  returned, while `public` posts remain visible

#### Scenario: Author always sees their own post

- **WHEN** a member reads a post they authored
- **THEN** the post is returned regardless of its visibility or the member's rank

### Requirement: Comments inherit the parent post's visibility

The system SHALL make a comment readable or insertable only when the parent post
is visible to the caller, delegating the tier decision to the post's own RLS, and
SHALL require an inserted comment's `author_id` to equal the caller.

#### Scenario: Comment on an invisible post is not readable

- **WHEN** a member who cannot see a post queries comments
- **THEN** comments on that post are not returned

#### Scenario: Comment insert requires visible parent and own authorship

- **WHEN** a member inserts a comment whose `author_id` is themselves and whose
  `post_id` references a post they can see
- **THEN** the insert succeeds; if the parent post is not visible to them, or
  `author_id` is another member, the insert is rejected

### Requirement: Likes are unique per member, owner-readable, and gated on visible posts

The system SHALL key `post_likes` on the composite primary key
`(post_id, profile_id)` so a member likes a post at most once, SHALL allow a
member to read only their own like rows, and SHALL permit a like only on a post
the member can see with `profile_id` equal to the caller.

#### Scenario: A member cannot like the same post twice

- **WHEN** a member inserts a second like for a post they already liked
- **THEN** the insert is rejected by the primary-key uniqueness constraint

#### Scenario: A member cannot see who else liked a post

- **WHEN** a member selects from `post_likes`
- **THEN** only rows where `profile_id` equals the caller are returned

#### Scenario: A like on an invisible post is rejected

- **WHEN** a member tries to like a post they cannot see under the post RLS
- **THEN** the insert is rejected

### Requirement: Engagement counts are aggregate-only and visibility-scoped

The system SHALL expose like and comment counts through a `SECURITY DEFINER`
function `post_engagement_counts(uuid[])` that returns only numeric counts (never
the identity of who liked or commented), computes counts only for posts the caller
is already permitted to see under the same visibility predicate as the post RLS,
and caps the input array at 200 ids.

#### Scenario: Counts are returned only for visible posts

- **WHEN** the caller passes a mix of post ids, some of which they cannot see
- **THEN** the function returns count rows only for the posts visible to them and
  omits the rest

#### Scenario: No identities are disclosed

- **WHEN** the function returns counts for a post
- **THEN** the result contains only `post_id`, `like_count`, and `comment_count`,
  and never reveals which members liked or commented

### Requirement: Beitragsbilder liegen geordnet in einer eigenen Tabelle

Das System SHALL Bilder eines Beitrags in `public.post_media` führen, mit `id`
(uuid), `post_id` (uuid, FK auf `public.posts`, `on delete cascade`),
`storage_path` (text), `sort` (int), `width` und `height` (int) sowie
`created_at` (timestamptz).

`width` und `height` SHALL beim Anlegen mitgeschrieben werden, damit die Karte
ihr Bildlayout ohne Nachladen der Datei bestimmen kann.

Es SHALL **keine** Spalte `posts.media jsonb` geben: mehrere Bilder brauchen
Reihenfolge und einzelne Löschbarkeit, und beides ist in einer Tabelle
ausdrückbar, in einem JSON-Feld nicht ohne Neuschreiben des ganzen Werts.

Ein Beitrag SHALL höchstens **sechs** Bilder tragen.

#### Scenario: Ein gelöschter Beitrag nimmt seine Bildzeilen mit

- **WHEN** ein Beitrag gelöscht wird
- **THEN** werden seine `post_media`-Zeilen mitgelöscht

#### Scenario: Ein einzelnes Bild wird entfernt

- **WHEN** der Autor eine einzelne `post_media`-Zeile seines Beitrags löscht
- **THEN** bleiben die übrigen Bilder des Beitrags mit ihrer Reihenfolge erhalten

#### Scenario: Das siebte Bild wird abgelehnt

- **WHEN** ein Beitrag bereits sechs Bilder trägt und ein weiteres angelegt wird
- **THEN** wird der Schreibzugriff abgelehnt

### Requirement: Beitragsbilder liegen in einem privaten Bucket

Das System SHALL Beitragsbilder in einem Storage-Bucket `post-media` mit
`public = false` ablegen, mit `file_size_limit` von 1 MiB und
`allowed_mime_types` von ausschließlich `image/webp`.

Der Bucket SHALL privat sein, weil die Sichtbarkeit des Bildes an der
Sichtbarkeit seines Beitrags hängt. Ein öffentlicher Bucket mit schwer
erratbaren Pfaden SHALL NOT als Zugriffskontrolle gelten — er ist
Verschleierung.

Dateigröße und Dateityp SHALL am Bucket ausgesprochen sein und nicht nur im
Client: die Client-Grenze umgeht jeder handgebaute Upload. Der bestehende
`avatars`-Bucket trägt beide Grenzen NICHT und SHALL NOT als Vorlage dafür
dienen; Vorlage ist `covers`.

Objekte SHALL ausschließlich über signierte URLs ausgeliefert werden. Es SHALL
keinen Weg geben, ein Objekt über eine öffentliche Bucket-URL abzurufen.

#### Scenario: Ein zu großes Bild wird abgelehnt

- **WHEN** ein Upload nach `post-media` 1 MiB überschreitet
- **THEN** lehnt der Bucket ihn ab

#### Scenario: Ein anderer Dateityp wird abgelehnt

- **WHEN** ein Upload nach `post-media` einen anderen MIME-Typ als `image/webp` trägt
- **THEN** lehnt der Bucket ihn ab

#### Scenario: Die öffentliche Bucket-URL liefert nichts

- **WHEN** ein Objekt aus `post-media` über die öffentliche Bucket-URL abgerufen wird
- **THEN** wird kein Bild ausgeliefert, unabhängig von der Sichtbarkeit seines Beitrags

### Requirement: Ein Bild ist genau so sichtbar wie sein Beitrag

Das System SHALL über eine SELECT-Policy auf `storage.objects` entscheiden, wer
sich für ein Objekt in `post-media` eine Signatur ausstellen lassen darf.

Für `anon` SHALL das nur für Objekte gelten, die zu einem Beitrag mit
`visibility = 'public'` gehören. Für `authenticated` SHALL dasselbe Prädikat
gelten wie in `posts_select_by_visibility`: `public.is_activated()` und
(`public`, oder `members` ab Rang 4 `exchange`, oder Autorschaft).

Das Prädikat SHALL NOT dupliziert werden: die Policy SHALL es über eine
`SECURITY DEFINER`-Funktion aus dem Beitrag ableiten, damit eine Änderung der
Stufe an einer Stelle geschieht.

Die Funktion SHALL den zugehörigen Beitrag über die `post_media`-Zeile mit
diesem `storage_path` bestimmen und SHALL NOT den Objektnamen zerlegen. Der
Objektname ist vom Hochladenden frei wählbar — die Schreib-Policy prüft nur
seinen ersten Abschnitt. Eine aus dem Pfad geschnittene Beitrags-Kennung ließe
sich damit fälschen und behauptete eine Sichtbarkeit, die mit dem Objekt nichts
zu tun hat.

Ein Objekt ohne zugehörige `post_media`-Zeile SHALL für niemanden signierbar
sein.

`post_media`-Zeilen SHALL genauso lesbar sein wie ihr Beitrag: ein ausgeloggter
Besucher SHALL die Zeilen eines `public`-Beitrags lesen können — ohne sie kennt
er weder Pfad noch Maße — und die eines `members`-Beitrags nicht.

#### Scenario: Das Bild eines members-Beitrags ist ohne Session nicht abrufbar

- **WHEN** ein ausgeloggter Besucher eine Signatur für ein Objekt anfordert, das
  zu einem Beitrag mit `visibility = 'members'` gehört
- **THEN** wird die Anforderung abgelehnt, und es gibt keine URL, über die das
  Bild abrufbar wäre

#### Scenario: Das Bild eines public-Beitrags ist ausgeloggt sichtbar

- **WHEN** ein ausgeloggter Besucher den Feed öffnet und dieser einen Beitrag mit
  `visibility = 'public'` und Bild enthält
- **THEN** wird das Bild angezeigt

#### Scenario: Ein Mitglied unter Rang 4 sieht das Bild nicht

- **WHEN** ein bestätigtes Mitglied mit Rang unter 4 eine Signatur für ein Objekt
  eines fremden `members`-Beitrags anfordert
- **THEN** wird die Anforderung abgelehnt

#### Scenario: Ein verwaistes Objekt ist für niemanden signierbar

- **WHEN** ein Objekt in `post-media` zu keiner `post_media`-Zeile gehört
- **THEN** wird für niemanden eine Signatur ausgestellt

#### Scenario: Ein gefälschter Pfad erschleicht keine Sichtbarkeit

- **WHEN** ein Mitglied ein Objekt in seinem eigenen Pfadpräfix ablegt, dessen
  weitere Abschnitte die Kennung eines fremden Beitrags nachbilden
- **THEN** entscheidet weiterhin die `post_media`-Zeile, zu der das Objekt
  tatsächlich gehört; gibt es keine, wird keine Signatur ausgestellt

#### Scenario: Ausgeloggt sind nur die Bildzeilen öffentlicher Beiträge lesbar

- **WHEN** ein ausgeloggter Besucher `post_media` liest
- **THEN** erhält er die Zeilen von `public`-Beiträgen und keine Zeile eines
  `members`-Beitrags

### Requirement: In fremde Pfade kann niemand schreiben

Das System SHALL Schreibzugriffe auf `post-media` über INSERT-, UPDATE- und
DELETE-Policies auf den eigenen Pfad begrenzen: der erste Pfadabschnitt SHALL
der `auth.uid()` des Aufrufers entsprechen. Alle drei SHALL zusätzlich
`public.is_activated()` verlangen, wie die Schreib-Policies von `avatars` und
`covers`.

#### Scenario: Schreiben in einen fremden Pfad wird abgelehnt

- **WHEN** ein Mitglied ein Objekt unter dem Pfadpräfix einer anderen `auth.uid()`
  anzulegen versucht
- **THEN** wird der Zugriff abgelehnt

#### Scenario: Ein unbestätigtes Konto kann kein Bild hochladen

- **WHEN** ein Konto mit gültiger Session, aber ohne Aktivierung ein Objekt nach
  `post-media` hochlädt
- **THEN** wird der Zugriff abgelehnt

### Requirement: Bilder werden vor dem Hochladen verkleinert und konvertiert

Das System SHALL Bilder im Client auf eine Maximalkante von 1600 px verkleinern
und nach WebP konvertieren, bevor sie hochgeladen werden. Das Seitenverhältnis
SHALL erhalten bleiben; es SHALL kein Zuschnitt stattfinden.

Die Zielmaße SHALL als reine Funktion berechenbar und ohne Canvas prüfbar sein,
weil jsdom keinen 2D-Kontext hat und ein Render-Test sonst nur behaupten kann,
dass nichts wirft.

#### Scenario: Ein großes Foto wird verkleinert

- **WHEN** ein Bild mit 4032×3024 gewählt wird
- **THEN** wird es auf eine Maximalkante von 1600 px verkleinert, behält sein
  Seitenverhältnis und wird als WebP hochgeladen

#### Scenario: Ein kleines Bild wird nicht vergrößert

- **WHEN** ein Bild kleiner als die Maximalkante gewählt wird
- **THEN** bleiben seine Maße unverändert

### Requirement: Jeder Tag erscheint genau einmal

Das System SHALL einen Tag pro Beitrag an genau einer Stelle darstellen: als
Chip unterhalb des Textes. Hashtag-Segmente im Fließtext SHALL als normaler
Text gerendert werden.

Der Grund SHALL festgehalten sein: die Chip-Reihe speist sich aus
`posts.hashtags`, und dieses Feld wird beim Anlegen aus genau denselben
Segmenten des Textes berechnet. Beide Darstellungen zeigen damit zwingend
dieselbe Menge, nicht gelegentlich.

#### Scenario: Ein Hashtag im Text erscheint nicht doppelt

- **WHEN** ein Beitrag mit `#Netzwerken` im Fließtext dargestellt wird
- **THEN** erscheint `#Netzwerken` einmal als Chip, und im Fließtext steht es als
  normaler Text ohne Verweis

#### Scenario: Erwähnungen und Links bleiben unberührt

- **WHEN** derselbe Beitrag eine Erwähnung und eine URL enthält
- **THEN** bleiben beide im Fließtext als Verweis erhalten

### Requirement: Kuratierte Tags sind eine redaktionelle Liste

Das System SHALL eine Tabelle `public.tags` mit `key` (text, Primärschlüssel),
`label` (text), `sort` (int) und `active` (boolean) führen und sie mit einer
Startbefüllung anlegen.

Es SHALL **keine** Verknüpfungstabelle zwischen `posts` und `tags` geben.
`posts.hashtags text[]` SHALL unverändert bleiben und beide Sorten halten. Ein
Chip SHALL als kuratiert gelten, wenn sein Wert als `key` in `tags` vorkommt,
sonst als freier Tag.

Kuratierte und freie Chips SHALL optisch unterscheidbar und beide klickbar
sein.

Die bestehende Filterung über `hashtags` SHALL unverändert weiterarbeiten.

Es SHALL benannt sein, dass ein umbenannter oder deaktivierter kuratierter Tag
**nicht** rückwirkend auf Beiträge wirkt: sie tragen weiter ihre Zeichenkette
und erscheinen danach als freier Tag.

`tags.key` SHALL kleingeschrieben sein und ausschließlich aus Buchstaben,
Ziffern und Unterstrich bestehen — dieselbe Zeichenklasse, die ein Hashtag im
Fließtext erkennt. Beides SHALL als Constraint durchgesetzt sein, nicht als
Konvention.

Der Grund SHALL festgehalten sein: weil es keine Verknüpfungstabelle gibt, ist
die Zeichenkette selbst die Verbindung. Ein Schlüssel, den die
Hashtag-Normalisierung nie erzeugen kann — weil er einen Großbuchstaben, ein
Leerzeichen oder einen Bindestrich trägt —, führt dazu, dass derselbe Tag
getippt und geklickt zu zwei verschiedenen Werten wird. Der Filter zerfällt
dann still in zwei Töpfe, ohne Fehlermeldung.

Umlaute SHALL erlaubt bleiben, weil die Normalisierung sie nicht ersetzt.

#### Scenario: Ein Beitrag trägt einen kuratierten und einen freien Tag

- **WHEN** ein Beitrag mit einem Wert aus `tags` und einem selbst getippten Wert
  dargestellt wird
- **THEN** erscheinen beide als Chip, optisch unterscheidbar, und beide filtern
  den Feed beim Klick

#### Scenario: Ein deaktivierter Tag lässt Bestandsbeiträge unverändert

- **WHEN** ein kuratierter Tag auf `active = false` gesetzt wird
- **THEN** behalten bestehende Beiträge ihren Wert in `hashtags` und zeigen ihn
  als freien Tag

#### Scenario: Ein nicht tippbarer Schlüssel wird abgelehnt

- **WHEN** ein `tags.key` mit Großbuchstaben, Leerzeichen oder Bindestrich
  angelegt wird
- **THEN** wird der Schreibzugriff abgelehnt

#### Scenario: Derselbe Tag getippt und geklickt ergibt denselben Wert

- **WHEN** ein Mitglied `#Persönlichkeitsentwicklung` in den Text tippt und ein
  anderes denselben Tag im Composer auswählt
- **THEN** tragen beide Beiträge denselben Wert in `hashtags`, beide Chips
  gelten als kuratiert, und ein Filter findet beide

### Requirement: Der Composer trägt Text, Bilder, Video-Link, Tags und Sichtbarkeit

Das System SHALL im Composer erlauben: Text, bis zu sechs Bilder, einen
Video-Link, eine Auswahl aus den aktiven kuratierten Tags sowie freien
Tag-Text, und die Sichtbarkeit (`members` als Vorgabe).

Videos SHALL verlinkt und NOT hochgeladen werden. Es SHALL nur eingebettet
werden, was als YouTube- oder Vimeo-Link mit valider Video-ID erkannt wird. Der
Link SHALL im Beitragstext gespeichert und beim Rendern dort unterdrückt werden,
damit er nicht als Link **und** als Einbettung erscheint; es SHALL dafür kein
neues Feld am Beitrag geben.

Die im Composer ausgewählten Tags SHALL mit den im Text getippten **vereinigt
und dedupliziert** werden. Ohne das erscheint ein Tag, den jemand tippt *und*
anklickt, zweimal in `hashtags` — und damit als doppelter Chip, also genau der
Fehler, den dieser Change behebt.

Ein Beitrag mit Bildern SHALL niemals ohne seine Bilder erscheinen: der Beitrag
und seine `post_media`-Zeilen SHALL in **einem** Schritt entstehen. Ein
Fehlschlag SHALL keinen halb veröffentlichten Beitrag hinterlassen, sondern
höchstens Objekte im Bucket, die zu keiner Zeile gehören und deshalb für
niemanden abrufbar sind.

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

### Requirement: Das Bildlayout folgt der Anzahl der Bilder

Das System SHALL ein Bild groß darstellen, zwei nebeneinander, und drei oder
mehr als Raster. Trägt ein Beitrag mehr Bilder als das Raster Kacheln hat,
SHALL die letzte Kachel die Zahl der übrigen als „+n" ausweisen.

#### Scenario: Fünf Bilder zeigen ein Raster mit Rest-Hinweis

- **WHEN** ein Beitrag mit fünf Bildern dargestellt wird
- **THEN** zeigt das Raster vier Kacheln, und die vierte weist „+1" aus

### Requirement: Der Feed lädt seitenweise

Das System SHALL den Feed in Seiten zu 20 Beiträgen laden und weitere Seiten
auf Anforderung nachladen, chronologisch absteigend.

Eine feste Obergrenze ohne Nachladen SHALL NOT bestehen bleiben: mit Bildern
wird sie zu einer stillen Kappung, bei der ältere Beiträge unauffindbar sind,
ohne dass etwas darauf hinweist.

Signaturen für die Bilder einer Seite SHALL gebündelt angefordert werden, nicht
je Bild einzeln.

#### Scenario: Ältere Beiträge sind erreichbar

- **WHEN** mehr als 20 sichtbare Beiträge bestehen
- **THEN** zeigt der Feed die ersten 20 und lädt die älteren auf Anforderung nach

### Requirement: Eine Leiste filtert über die kuratierten Tags

Das System SHALL neben dem bestehenden Hashtag-Filter eine sichtbare Leiste mit
den aktiven kuratierten Tags anbieten, über die der Feed gefiltert werden kann.

Der leere Zustand SHALL weiterhin unterscheiden, ob überhaupt keine Beiträge
bestehen oder nur keine zum gewählten Filter passen.

#### Scenario: Ein Filter ohne Treffer erklärt sich

- **WHEN** ein kuratierter Tag gewählt wird, zu dem es keinen sichtbaren Beitrag gibt
- **THEN** erscheint der leere Zustand mit dem Hinweis auf den Filter und der
  Möglichkeit, ihn zu entfernen

