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
Chip unterhalb des Textes.

Ein ABSCHLIESSENDER Block von Hashtags SHALL deshalb nicht im Fließtext
erscheinen — er ist Verschlagwortung und steht bereits als Chip. Hashtags im
SATZINNEREN SHALL dagegen als normaler Text stehen bleiben: dort tragen sie
Grammatik, und ihre Entfernung zerlegte den Satz („Wir waren beim #Sommerfest
und …" würde zu „Wir waren beim und …"). Anklickbar SHALL in beiden Fällen nur
der Chip sein.

Der Grund SHALL festgehalten sein: die Chip-Reihe speist sich aus
`posts.hashtags`, und dieses Feld wird beim Anlegen aus genau denselben
Segmenten des Textes berechnet. Beide Darstellungen zeigen damit zwingend
dieselbe Menge, nicht gelegentlich.

> **Korrigiert 17.08.2026 (AGE-566).** Die Anforderung hiess schon vorher „an
> genau einer Stelle" und das Szenario „erscheint nicht doppelt" — die Zusage
> darunter lieferte aber ausdrücklich beides, Chip UND Fließtext. Titel und
> Inhalt widersprachen sich; aufgefallen ist es in der Vorführ-Umgebung, wo
> `#Persönlichkeitsentwicklung` zweimal auf demselben Bildschirm stand.

#### Scenario: Ein Hashtag am Textende erscheint nur als Chip

- **WHEN** ein Beitrag dargestellt wird, dessen Text auf `#Netzwerken` endet
- **THEN** erscheint `#Netzwerken` einmal als Chip unterhalb des Textes, und der
  Fließtext endet ohne ihn

#### Scenario: Ein Hashtag im Satzinneren bleibt stehen

- **WHEN** ein Beitrag mit `#Netzwerken` mitten im Satz dargestellt wird
- **THEN** steht `#Netzwerken` weiterhin im Fließtext, als normaler Text ohne
  Verweis, und erscheint zusätzlich als Chip

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

### Requirement: Das Bildlayout folgt der Anzahl der Bilder

Das System SHALL ein Bild groß darstellen, zwei nebeneinander, und drei oder
mehr als Raster. Trägt ein Beitrag mehr Bilder als das Raster Kacheln hat,
SHALL die letzte Kachel die Zahl der übrigen als „+n" ausweisen.

#### Scenario: Fünf Bilder zeigen ein Raster mit Rest-Hinweis

- **WHEN** ein Beitrag mit fünf Bildern dargestellt wird
- **THEN** zeigt das Raster vier Kacheln, und die vierte weist „+1" aus

### Requirement: Der Feed lädt seitenweise

Das System SHALL den Feed in Seiten zu 20 Beiträgen laden und weitere Seiten
auf Anforderung nachladen.

Die Ordnung SHALL wählbar sein: **Neueste zuerst** (Vorgabe), **Älteste zuerst**
und **Beliebteste**. Jede Ordnung SHALL einen **eigenen Keyset-Pfad** haben und
SHALL NOT durch ein bloßes Umdrehen der Sortierrichtung entstehen. Der Cursor
SHALL alle Felder der jeweiligen Ordnung tragen — bei „Beliebteste" also die
Beliebtheitszahl **und** `created_at` **und** `id`. Bei gleichen Werten im
führenden Feld überspränge eine Grenze über dieses Feld allein Beiträge still:
sie stünden weder auf der einen noch auf der nächsten Seite.

Ein Wechsel der Ordnung SHALL das Blättern zurücksetzen.

Die Ordnung nach Beliebtheit läuft über einen Wert, der sich während des
Blätterns ändern kann. Dass ein Beitrag dadurch doppelt oder gar nicht erscheint,
SHALL als Eigenschaft dieser Ordnung hingenommen werden und SHALL NOT durch eine
zweite Abfrageform ausgeglichen werden.

Eine feste Obergrenze ohne Nachladen SHALL NOT bestehen bleiben: mit Bildern
wird sie zu einer stillen Kappung, bei der ältere Beiträge unauffindbar sind,
ohne dass etwas darauf hinweist.

Signaturen für die Bilder einer Seite SHALL gebündelt angefordert werden, nicht
je Bild einzeln.

#### Scenario: Ältere Beiträge sind erreichbar

- **WHEN** mehr als 20 sichtbare Beiträge bestehen
- **THEN** zeigt der Feed die ersten 20 und lädt die älteren auf Anforderung nach

#### Scenario: Gleiche Beliebtheit überspringt keinen Beitrag

- **WHEN** in der Ordnung „Beliebteste" mehr als 20 Beiträge dieselbe
  Reaktionszahl tragen
- **THEN** erscheint jeder von ihnen auf genau einer Seite, und keiner fällt
  zwischen zwei Seiten

#### Scenario: Ein Ordnungswechsel beginnt von vorn

- **WHEN** ein Mitglied zwei Seiten „Neueste zuerst" geladen hat und dann auf
  „Beliebteste" wechselt
- **THEN** beginnt die Liste bei der ersten Seite der neuen Ordnung

### Requirement: Eine Leiste filtert über die kuratierten Tags

Das System SHALL in der rechten Spalte die aktiven kuratierten Tags als
**Auswahlkästchen mit Mehrfachauswahl** anbieten, jedes mit der Zahl der für den
Betrachter sichtbaren Beiträge.

Mehrere gewählte Tags SHALL als **ODER** wirken: gezeigt werden Beiträge, die
**mindestens einen** der gewählten Tags tragen. Auswahlkästchen versprechen
Mehrfachauswahl; ein UND-Filter hinter Kästchen wäre eine Lüge an der Oberfläche
und lieferte bei zwei Haken fast immer eine leere Liste.

Der leere Zustand SHALL weiterhin unterscheiden, ob überhaupt keine Beiträge
bestehen oder nur keine zum gewählten Filter passen.

Die rechte Spalte SHALL NOT verschwinden, wenn keine kuratierten Tags bestehen:
sie trägt nun auch die aktivsten Mitglieder und den Beitragstyp-Filter.

#### Scenario: Ein Filter ohne Treffer erklärt sich

- **WHEN** ein kuratierter Tag gewählt wird, zu dem es keinen sichtbaren Beitrag gibt
- **THEN** erscheint der leere Zustand mit dem Hinweis auf den Filter und der
  Möglichkeit, ihn zu entfernen

#### Scenario: Zwei Haken zeigen die Vereinigung

- **WHEN** zwei Tags angehakt sind und ein Beitrag nur den einen von beiden trägt
- **THEN** erscheint dieser Beitrag in der Liste

#### Scenario: Ohne kuratierte Tags bleibt die Spalte stehen

- **WHEN** kein kuratierter Tag aktiv ist
- **THEN** zeigt die rechte Spalte weiterhin die aktivsten Mitglieder und den
  Filter nach Beitragstyp

### Requirement: Ohne Session fragt der Feed keine Autorendaten ab

Der Client SHALL die Anreicherung der Beitrags-Autoren aus `profiles_public`
nur mit einer Session ausführen. Ohne Session SHALL er die Abfrage **gar nicht
erst absetzen**.

Der Grund ist nicht die Sichtbarkeit, sondern die Vergeblichkeit:
`profiles_public` trägt für `anon` bewusst kein Leserecht (AGE-239), die
Abfrage wird also mit `42501` abgewiesen. Diese Anforderung SHALL NOT als
Sicherheitsgrenze gelten — die Grenze bleibt das fehlende Recht in der
Datenbank. Die Maskierung der Anzeige regelt unverändert `displayAuthor`, das
ohne Session jeden Autor als „Ein Mitglied" ohne Avatarbild führt.

Eine Session SHALL an der bereits geführten Profil-Kennung erkannt werden, die
der Lesepfad für `likedByMe` ohnehin durchreicht — nicht an einer zweiten,
daneben gestellten Abfrage des Sitzungszustands.

#### Scenario: Ausgeloggt wird nicht gefragt

- **WHEN** ein ausgeloggter Besucher die Aktivitätenseite oder die Startseite
  öffnet und der Feed Beiträge enthält
- **THEN** wird keine Abfrage auf `profiles_public` abgesetzt
- **AND** die Konsole bleibt frei von `42501 permission denied for view
  profiles_public`

#### Scenario: Die Anzeige bleibt unverändert maskiert

- **WHEN** ein ausgeloggter Besucher einen Beitrag sieht
- **THEN** trägt der Autor weiterhin den Namen „Ein Mitglied" und kein
  Avatarbild
- **AND** dieses Ergebnis stammt aus der Maskierung der Anzeige, nicht aus dem
  Fehlschlag einer Abfrage

#### Scenario: Eingeloggt bleibt die Anreicherung unverändert

- **WHEN** ein authentifiziertes, aktiviertes Mitglied denselben Feed öffnet
  und die Autoren über `profiles_public` sichtbar sind
- **THEN** wird `profiles_public` wie bisher abgefragt
- **AND** Name, Avatarbild und Stufen-Badge dieser Autoren erscheinen
- **AND** für Autoren, die `profiles_public` nicht führt, bleibt es beim
  bisherigen Rückfall auf „Mitglied"

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

### Requirement: Der Feed trennt drei Reiter

Das System SHALL den Feed in drei Reiter gliedern: **Alle Beiträge**, **Beiträge
von mir** und **Gespeichert**. Der gewählte Reiter SHALL Teil der Abfrage sein,
nicht eine Filterung der bereits geladenen Seite — sonst trüge eine Seite von 20
gelesenen Zeilen nur die wenigen passenden, und „Ältere Beiträge" liefe durch den
ganzen Bestand, um eine Seite zu füllen.

Ein Reiterwechsel SHALL das Blättern zurücksetzen: der Cursor der einen Ordnung
ist in der anderen Auswahl bedeutungslos.

#### Scenario: „Beiträge von mir" zeigt nur eigene

- **WHEN** ein Mitglied den Reiter „Beiträge von mir" wählt
- **THEN** enthält die Liste ausschließlich Beiträge, deren Autor es selbst ist,
  und die Seitengröße bleibt dieselbe wie im Reiter „Alle Beiträge"

#### Scenario: Der Reiterwechsel verwirft den Cursor

- **WHEN** ein Mitglied im Reiter „Alle Beiträge" eine zweite Seite nachgeladen
  hat und dann auf „Gespeichert" wechselt
- **THEN** beginnt die Liste bei der ersten Seite der neuen Auswahl und nicht an
  der Stelle, an der die vorige endete

### Requirement: Ein Mitglied speichert Beiträge nur für sich

Das System SHALL gespeicherte Beiträge in einer Tabelle `post_saves` mit dem
Primärschlüssel `(profile_id, post_id)` führen. Die RLS SHALL jedem Mitglied
ausschließlich **eigene** Zeilen zum Lesen, Anlegen und Löschen freigeben; wer
etwas gespeichert hat, SHALL für niemanden sonst sichtbar sein — auch nicht für
den Autor des Beitrags und auch nicht als Zahl.

Alle drei Policies SHALL zusätzlich `is_activated()` verlangen. Jede andere
Feed-Interaktion ist serverseitig so gegatet — `posts_write_own`,
`likes_write_own` und `post_media_insert_own` tragen es alle. Ohne dieses
Prädikat dürfte ein nie bestätigtes oder deaktiviertes Konto weiter speichern,
lesen und löschen, während ihm alles andere verwehrt ist.

Die Rechte der Tabelle SHALL in der Migration ausgesprochen werden. Neue Tabellen
erben in diesem Projekt keine Rechte, und der Golden-Snapshot in
`grants_test.sql` SHALL im selben Zug mitgepflegt werden.

Der Primärschlüssel SHALL die Eindeutigkeit tragen, nicht die Anwendungslogik:
zweimaliges Speichern desselben Beitrags SHALL keine zweite Zeile erzeugen.

#### Scenario: Fremde Speicherungen bleiben unsichtbar

- **WHEN** ein Mitglied `post_saves` liest, während ein anderes Mitglied denselben
  Beitrag gespeichert hat
- **THEN** enthält das Ergebnis nur die eigene Zeile, und die fremde ist weder
  einzeln noch als Zähler erkennbar

#### Scenario: Zweimal speichern erzeugt keine zweite Zeile

- **WHEN** derselbe Beitrag zweimal gespeichert wird
- **THEN** besteht genau eine Zeile, und der zweite Versuch scheitert nicht mit
  einem Fehler an der Oberfläche

#### Scenario: Speichern und wieder lösen

- **WHEN** ein Mitglied einen Beitrag speichert und ihn danach wieder löst
- **THEN** erscheint er im Reiter „Gespeichert" und verschwindet dort wieder,
  ohne dass die Seite neu geladen werden muss

#### Scenario: Ein unbestätigtes Konto speichert nicht

- **WHEN** ein angemeldetes, aber nicht bestätigtes oder ein deaktiviertes Konto
  eine Zeile in `post_saves` anzulegen, zu lesen oder zu löschen versucht
- **THEN** wird es abgewiesen, wie bei jeder anderen Feed-Interaktion auch

### Requirement: Die Beitragskarte weiß, ob sie gespeichert ist

Das System SHALL zu jedem Beitrag einer geladenen Seite mitliefern, ob der
Betrachter ihn gespeichert hat, und zwar **gebündelt** über die IDs der Seite —
nicht je Karte einzeln. Ohne das kennt die Karte in den Reitern „Alle Beiträge"
und „Beiträge von mir" ihren eigenen Zustand nicht und müsste ihn raten.

Der Lesepfad SHALL unter der RLS von `post_saves` laufen und deshalb ohnehin nur
eigene Zeilen zurückgeben; ein Filter im Client SHALL NOT die Grenze sein.

Speichern und Lösen SHALL den Zustand der Karte **und** den Reiter
„Gespeichert" gemeinsam fortschreiben — sonst zeigt die eine Fläche einen
Zustand, den die andere schon verworfen hat.

#### Scenario: Der Knopf kennt seinen Zustand ohne Umweg

- **WHEN** eine Feed-Seite im Reiter „Alle Beiträge" geladen wird und einer der
  20 Beiträge gespeichert ist
- **THEN** zeigt genau dessen Karte den Knopf im gespeicherten Zustand, und für
  die Seite wurde **eine** Abfrage nach den Speicherungen gestellt, nicht zwanzig

#### Scenario: Lösen wirkt auf beiden Flächen

- **WHEN** ein Beitrag im Reiter „Alle Beiträge" gelöst wird, nachdem der Reiter
  „Gespeichert" bereits geladen war
- **THEN** zeigt der Reiter „Gespeichert" ihn beim nächsten Betreten nicht mehr

### Requirement: Ein gespeicherter Beitrag verliert seine Sichtbarkeit still

Das System SHALL den Reiter „Gespeichert" über dieselbe Sichtbarkeitsregel führen
wie den übrigen Feed. Wird ein gespeicherter Beitrag später unsichtbar — weil sein
Autor entfernt wurde, weil die Sichtbarkeit zurückgedreht wurde oder weil der
Beitrag gelöscht ist —, SHALL er aus der Liste verschwinden, **ohne** einen
Fehler zu erzeugen und ohne den Reiter leer laufen zu lassen, solange andere
gespeicherte Beiträge sichtbar bleiben.

Eine gespeicherte Zeile SHALL kein Recht begründen: sie hält fest, dass gespeichert
wurde, und niemals, dass gezeigt werden darf.

#### Scenario: Der unsichtbar gewordene Beitrag bricht den Reiter nicht

- **WHEN** ein Mitglied drei Beiträge gespeichert hat und einer davon auf
  `members` zurückgedreht wird, während das Mitglied die Stufe dafür nicht trägt
- **THEN** zeigt der Reiter die zwei verbliebenen Beiträge, meldet keinen Fehler,
  und die dritte Zeile bleibt in `post_saves` bestehen

### Requirement: Die Beliebtheit eines Beitrags steht als Zahl an seiner Zeile

Das System SHALL die Zahl der Reaktionen eines Beitrags an der `posts`-Zeile
führen und bei jeder Reaktion fortschreiben. Ohne das ist eine Sortierung nach
Beliebtheit nicht möglich: die Zahlen kommen sonst aus
`post_engagement_counts(uuid[])` und entstehen erst **nach** dem Blättern über
die IDs der bereits geladenen Seite.

Die Zahl SHALL von einem Trigger geführt werden, nicht vom Client geschrieben.
Der Bestand SHALL beim Anlegen der Spalte einmalig nachgetragen werden.

`post_engagement_counts(uuid[])` SHALL unverändert die maßgebliche Quelle für die
**Anzeige** der Zahlen bleiben; die Spalte dient der **Ordnung**. Beide SHALL
denselben Wert liefern.

#### Scenario: Eine Reaktion schreibt die Zahl fort

- **WHEN** ein Mitglied auf einen Beitrag reagiert und die Reaktion danach
  zurücknimmt
- **THEN** steht die Zahl an der Zeile danach wieder auf ihrem Ausgangswert

#### Scenario: Ordnung und Anzeige stimmen überein

- **WHEN** eine Feed-Seite nach Beliebtheit geladen und für dieselben Beiträge
  `post_engagement_counts` gerufen wird
- **THEN** stimmt die Zahl an der Zeile für jeden Beitrag mit `like_count` aus
  der Funktion überein

### Requirement: Ein Zähler ist nur so echt wie die Rechte auf seiner Quelle

Das System SHALL `authenticated` **kein** UPDATE-Recht auf `public.post_likes`
gewähren.

Ein Trigger, der nur auf INSERT und DELETE hört, führt den Zähler falsch,
solange die Reaktionszeile **verschoben** werden kann. Heute kann sie das:
`authenticated` hält UPDATE auf `post_likes`, `likes_write_own` ist `for all`
auf die eigene Zeile, und ihr `with check` verlangt vom Zielbeitrag nur, dass er
**existiert** — nicht, dass er sichtbar ist. Aus „reagieren, verschieben,
zurücknehmen" wird damit ein Zähler, der am Ursprungsbeitrag zu hoch bleibt und
am Zielbeitrag ins Negative läuft.

Der Entzug ist der richtige Weg und nicht der bequeme: eine Reaktion **hat**
keinen Änderungsfall. Sie entsteht und sie vergeht; der Client schreibt
`post_likes` ausschließlich über `upsert` und `delete`. Das Recht ist damit
schon heute unbenutzt.

Wird das Recht später doch gebraucht, SHALL der Trigger den Fall `UPDATE OF
post_id` als Abzug beim alten und Zuschlag beim neuen Beitrag behandeln — nicht
gar nicht.

#### Scenario: Die Reaktionszeile lässt sich nicht verschieben

- **WHEN** ein Mitglied versucht, `post_id` seiner eigenen Reaktionszeile auf
  einen anderen Beitrag zu setzen
- **THEN** wird das Recht verweigert

#### Scenario: Der Angriffsablauf trägt nicht

- **WHEN** die Folge „reagieren auf A · Zeile auf B verschieben · Reaktion
  zurücknehmen" versucht wird
- **THEN** scheitert sie am zweiten Schritt, und die Zähler von A und B stehen
  danach auf ihren richtigen Werten

#### Scenario: Reagieren und Zurücknehmen bleiben möglich

- **WHEN** ein Mitglied auf einen Beitrag reagiert und die Reaktion zurücknimmt
- **THEN** gelingt beides wie zuvor, auch mehrfach hintereinander

### Requirement: Das Schreibrecht auf `posts` nennt seine Spalten

Das System SHALL `authenticated` auf `public.posts` **kein** INSERT-Recht
gewähren und das UPDATE-Recht auf die vom Client tatsächlich beschreibbaren
Spalten einschränken.

Begründet ist beides einzeln:

- **INSERT entfällt**, weil Beiträge ausschließlich über die
  `security definer`-Funktion `create_post_with_media` entstehen und
  Event-Beiträge von Triggern geschrieben werden. Ein Recht, das kein Weg
  benutzt, ist keine Bequemlichkeit, sondern eine offene Tür.
- **UPDATE wird eng**, weil `posts_write_own` `for all` auf `author_id =
  auth.uid()` steht. Mit einem tabellenweiten UPDATE-Recht könnte ein Autor jede
  Spalte seiner eigenen Zeile setzen — mit der Beliebtheitszahl also seine eigene
  Reichweite.

Der Golden-Snapshot in `grants_test.sql` SHALL alle Änderungen abbilden: die
Tabellenzeilen für `posts` und `post_likes` und eine neue Spalten-Zeile
`posts.UPDATE=…`.

#### Scenario: Die Zahl ist nicht fälschbar

- **WHEN** ein Mitglied versucht, die Beliebtheitszahl seines eigenen Beitrags
  per direktem UPDATE zu setzen
- **THEN** wird das Recht verweigert, und die Zahl bleibt die des Triggers

#### Scenario: Beiträge entstehen weiter

- **WHEN** ein Mitglied einen Beitrag über den Composer anlegt
- **THEN** entsteht er unverändert, obwohl `authenticated` kein INSERT-Recht auf
  `posts` mehr hält

#### Scenario: Bearbeiten bleibt möglich

- **WHEN** ein Mitglied Text, Schlagworte oder Sichtbarkeit eines eigenen
  Beitrags ändert
- **THEN** gelingt die Änderung wie zuvor

### Requirement: Die Sidebar zählt nur, was der Betrachter sehen darf

Das System SHALL die Zähler der beliebten Tags über eine aggregierende
Funktion liefern, die **unter der RLS des Aufrufers** läuft (`security invoker`).
Eine Zahl über Beiträge, die der Betrachter nicht sehen darf, verrät genau diese
Beiträge.

Die Funktion SHALL das Sichtbarkeitsprädikat **nicht kopieren**. Unter
`security invoker` greift `posts_select_by_visibility` selbst, und die Zahl ist
richtig, weil die Regel wirkt — nicht, weil eine Abschrift sie nachspricht.
Dieses Repo führt das Prädikat bereits an drei Stellen (`posts_select_by_visibility`,
`post_engagement_counts`, `former_member_entries`); eine vierte und fünfte Kopie
wäre Aufwand für ein Ergebnis, das ohne sie schon stimmt. Ein `security definer`-Weg
SHALL nur bestehen, wenn ein konkreter, belegter Rechtebedarf ihn verlangt.

Gezählt SHALL ausschließlich über die **aktiven kuratierten Tags** aus
`public.tags` werden. Eine Zählung über `unnest(posts.hashtags)` legte freie und
stillgelegte Schlagworte offen und stellte sie womöglich vor die kuratierten.

Die Reihenfolge SHALL eindeutig sein: bei gleicher Zahl entscheidet ein
festgelegtes zweites Merkmal, damit zwei Aufrufe dieselbe Liste ergeben.

Die Funktion SHALL eine Obergrenze je Aufruf tragen.

#### Scenario: Ein Tag zählt nur sichtbare Beiträge

- **WHEN** ein Tag an fünf Beiträgen hängt, von denen der Betrachter nur zwei
  sehen darf
- **THEN** nennt der Zähler zwei

#### Scenario: Ein Tag ohne sichtbaren Beitrag erscheint nicht

- **WHEN** alle Beiträge zu einem Tag für den Betrachter unsichtbar sind
- **THEN** erscheint der Tag nicht in der Liste — auch nicht mit der Zahl null,
  denn schon sein Erscheinen verriete, dass es ihn gibt

#### Scenario: Ein freies Schlagwort erscheint nicht

- **WHEN** ein Beitrag ein Schlagwort trägt, das nicht in `public.tags` steht
  oder dort stillgelegt ist
- **THEN** erscheint es nicht in der Liste, unabhängig davon, wie oft es vorkommt

#### Scenario: Gleiche Zahl ergibt dieselbe Reihenfolge

- **WHEN** zwei Tags dieselbe Zahl tragen und die Liste zweimal geholt wird
- **THEN** stehen sie beide Male in derselben Reihenfolge

### Requirement: „Aktivste Mitglieder" nennt nur zeigbare Profile

Das System SHALL die Liste der aktivsten Mitglieder über eine aggregierende
Funktion liefern, die **unter der RLS des Aufrufers** läuft und Namen
ausschließlich aus `profiles_public` bezieht. Ein zurückgezogenes,
unbestätigtes, deaktiviertes oder gelöschtes Profil SHALL NOT erscheinen —
`profiles_public` schließt sie selbst aus, und ein eigenes Prädikat hier wäre
eine weitere Kopie.

Die Liste SHALL **fünf** Mitglieder umfassen, und gezählt SHALL nach
**Beiträgen** werden, nicht nach Beiträgen und Kommentaren. Kommentare
mitzuzählen zöge ein zweites Sichtbarkeitsprädikat (`comments_select_visible`)
in dieselbe Funktion, für eine Zahl, die dasselbe aussagt.

Die Zahl SHALL kein Umweg zur Sichtbarkeit sein: Beiträge, die der Betrachter
nicht sehen darf, zählen nicht mit.

Die Reihenfolge SHALL bei gleicher Zahl eindeutig entschieden sein.

#### Scenario: Ein deaktiviertes Mitglied verschwindet aus der Liste

- **WHEN** ein Mitglied mit vielen sichtbaren Beiträgen deaktiviert wird
- **THEN** erscheint es nicht mehr in „Aktivste Mitglieder", und seine Beiträge
  zählen für niemanden sonst mit

#### Scenario: Die Zahl folgt der Sichtbarkeit des Betrachters

- **WHEN** dasselbe Mitglied von zwei Betrachtern unterschiedlicher Stufe
  betrachtet wird
- **THEN** nennt die Liste für den Betrachter mit der geringeren Stufe eine
  Zahl, die die für ihn unsichtbaren Beiträge nicht enthält

### Requirement: Der Feed filtert nach Beitragstyp

Das System SHALL einen Filter nach Beitragstyp anbieten: **Bild**, **Video**,
**Event**, **Text**. Der Filter SHALL Teil der Abfrage sein, nicht eine
Nachfilterung der geladenen Seite.

Der Typ SHALL aus dem Bestand abgeleitet werden, nicht aus einem zusätzlichen
Feld am Beitrag: Video über `video_url`, Event über `posts.kind`, Bild über das
Vorhandensein einer `post_media`-Zeile, Text als Beitrag ohne all das.

#### Scenario: Der Bildfilter findet bebilderte Beiträge

- **WHEN** „Bild" gewählt wird
- **THEN** enthält die Liste genau die sichtbaren Beiträge mit mindestens einem
  Bild, und das Blättern bleibt seitenweise

### Requirement: Ohne Sitzung bleibt die Aktivität ein Schaufenster

Die Aktivitätsseite ist **ohne Anmeldung erreichbar** — sie trägt in der
Navigation weder `requiresAuth` noch eine Mindeststufe, und die Aktivierungswand
lässt Ausgeloggte durch. Alles, was dieser Change hinzufügt, SHALL deshalb seinen
anonymen Fall benennen.

Ohne Sitzung SHALL gelten:

- Es SHALL **nur** „Alle Beiträge" bestehen. Die Reiter „Beiträge von mir" und
  „Gespeichert" SHALL NOT erscheinen.
- Es SHALL **kein** Speichern-Knopf erscheinen.
- „Aktivste Mitglieder" SHALL NOT erscheinen. `profiles_public` hält für `anon`
  kein Recht; ein Aufruf liefe in einen Fehler, und der Name eines Mitglieds
  gehört ohnehin nicht ins Schaufenster.
- Die Tag-Zähler SHALL entweder nachweislich nur öffentliche Beiträge zählen
  oder ebenfalls entfallen. Eine Zahl, die für `anon` aus einem Fehler eine Null
  macht, SHALL NOT gezeigt werden.

„Beiträge von mir" ohne Kennung SHALL NOT zu „alle Beiträge" entarten. Ein
fehlender Autorenfilter ist kein leerer Filter, sondern ein Fehler im
Aufrufweg — und ein Reiter, den es ohne Sitzung nicht gibt, SHALL erst gar nicht
abgefragt werden können.

#### Scenario: Der ausgeloggte Besucher sieht einen Reiter

- **WHEN** die Aktivitätsseite ohne Sitzung geöffnet wird
- **THEN** erscheint weder ein Reiter „Beiträge von mir" noch „Gespeichert",
  noch ein Speichern-Knopf an einer Karte

#### Scenario: Ohne Kennung keine Autorenliste

- **WHEN** der Reiter „Beiträge von mir" ohne Kennung angefordert wird
- **THEN** liefert die Abfrage keine Liste aller Beiträge, sondern verweigert
  sich

#### Scenario: Keine Mitgliedernamen im Schaufenster

- **WHEN** die Seite ohne Sitzung geöffnet wird
- **THEN** wird „Aktivste Mitglieder" weder angezeigt noch angefordert

### Requirement: Der Composer steht über der Feed-Spalte

Das System SHALL den Composer innerhalb der Feed-Spalte anordnen, nicht über
Feed und Sidebar zugleich. Die Sidebar SHALL oben auf gleicher Höhe beginnen wie
der Composer.

Auf schmalen Schirmen **ändert sich die Reihenfolge**, und das ist eine
Entscheidung, keine Nebenwirkung. Heute steht die Filterleiste im Markup vor dem
Feed und liegt auf dem Telefon über ihm — was mit einer Leiste aus wenigen Chips
trug. Die gefüllte Spalte trägt Zähler, aktivste Mitglieder und den Typfilter und
wäre an derselben Stelle eine Wand vor dem Inhalt.

Auf schmalen Schirmen SHALL deshalb gelten: der Composer zuoberst, darunter der
Feed. Die Inhalte der Spalte SHALL erreichbar bleiben, ohne dass der Besucher an
zwanzig Karten vorbeikommen muss — als zusammengeklappter Bereich über dem Feed
oder als eigene Fläche. Sie SHALL NOT ungeklappt zwischen Composer und ersten
Beitrag treten, und sie SHALL NOT ersatzlos unter zwanzig Karten wandern.

#### Scenario: Sidebar und Composer beginnen auf gleicher Höhe

- **WHEN** die Aktivitätsseite auf einem breiten Schirm geöffnet wird
- **THEN** liegt die Oberkante der Sidebar auf der Oberkante des Composers, und
  der Composer reicht nicht über die Sidebar hinweg

#### Scenario: Auf dem Telefon versperrt die Spalte den Feed nicht

- **WHEN** dieselbe Seite bei 375 px Breite geöffnet wird
- **THEN** steht der Composer zuoberst, der erste Beitrag folgt ohne eine
  ausgeklappte Filterspalte dazwischen, und die Filter sind erreichbar, ohne bis
  ans Ende der Liste zu blättern

