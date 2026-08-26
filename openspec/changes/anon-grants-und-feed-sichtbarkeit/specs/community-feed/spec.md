## REMOVED Requirements

### Requirement: Post readability is gated by tier rank

**Reason:** `members` bedeutet ab AGE-601 „jedes aktivierte Mitglied". Die
Lesbarkeit hängt damit nicht mehr am Rang, und der Name der Anforderung wäre
eine falsche Auskunft für jeden, der die Regel sucht. Ersetzt durch
„Post readability is gated by activation".

**Migration:** Der Zweig `visibility = 'members' and public.has_level(4)` in
`posts_select_by_visibility` wird zu `visibility = 'members'`. `is_activated()`
steht bereits davor und bleibt die Hürde.

## ADDED Requirements

### Requirement: Post readability is gated by activation

The system SHALL, via RLS, permit an authenticated member to read a post only
when the member is activated **and** the post is `public`, or the post is
`members`, or the member is the post's author.

Der `members`-Zweig SHALL **keine** Stufenschwelle tragen. In der Produktion trägt
jeder Beitrag `members`; eine Schwelle darüber macht den Feed für jedes Mitglied
darunter nicht dünner, sondern **leer**. Der Preis SHALL ausgesprochen sein: die
Anmeldung ist offen, `basic` ist der Selbstregistrierungs-Rang, und die
**Aktivierung ist damit die einzige Hürde** vor dem Feed.

Diese Regel SHALL NOT auf andere `exchange`-Schwellen übertragen werden.
Kontaktanfragen und Event-Teilnahme bleiben eigene Entscheidungen mit eigenen
Schwellen.

#### Scenario: Ein aktiviertes Mitglied sieht members-Beiträge unabhängig vom Rang

- **WHEN** ein aktiviertes Mitglied mit Rang unter 4 den Feed liest
- **THEN** werden Beiträge mit `visibility = 'members'` zurückgegeben, die es
  nicht selbst verfasst hat

#### Scenario: Ohne Aktivierung bleibt der Feed verschlossen

- **WHEN** ein bestätigtes, aber nicht aktiviertes Konto den Feed liest
- **THEN** wird keine Zeile zurückgegeben — auch keine `public`-Zeile und auch
  kein selbst verfasster Beitrag

#### Scenario: Author always sees their own post

- **WHEN** an activated member reads a post they authored
- **THEN** the post is returned regardless of its visibility or the member's rank

## MODIFIED Requirements

### Requirement: Engagement counts are aggregate-only and visibility-scoped

The system SHALL expose like and comment counts through a `SECURITY DEFINER`
function `post_engagement_counts(uuid[])` that returns only numeric counts (never
the identity of who liked or commented), computes counts only for posts the caller
is already permitted to see under the same visibility predicate as the post RLS,
and caps the input array at 200 ids.

Weil die Funktion das Prädikat **abschreibt**, SHALL jede Änderung der
Sichtbarkeitsregel diese Abschrift mitziehen. Eine Zahl, die zu einer Zeile
gehört, die der Aufrufer nicht bekommt — oder die für eine Zeile fehlt, die er
bekommt — verrät oder verbirgt genau diese Zeile.

#### Scenario: Counts are returned only for visible posts

- **WHEN** the caller passes a mix of post ids, some of which they cannot see
- **THEN** the function returns count rows only for the posts visible to them and
  omits the rest

#### Scenario: Die Zähler folgen der Sichtbarkeitsregel ohne Stufenschwelle

- **WHEN** ein aktiviertes Mitglied mit Rang unter 4 Zähler für einen fremden
  `members`-Beitrag anfragt, den es lesen darf
- **THEN** wird eine Zählzeile zurückgegeben

#### Scenario: No identities are disclosed

- **WHEN** the function returns counts for a post
- **THEN** the result contains only `post_id`, `like_count`, and `comment_count`,
  and never reveals which members liked or commented

### Requirement: Ein Bild ist genau so sichtbar wie sein Beitrag

Das System SHALL über eine SELECT-Policy auf `storage.objects` entscheiden, wer
sich für ein Objekt in `post-media` eine Signatur ausstellen lassen darf.

Für `anon` SHALL das nur für Objekte gelten, die zu einem Beitrag mit
`visibility = 'public'` gehören. Für `authenticated` SHALL dasselbe Prädikat
gelten wie in `posts_select_by_visibility`: `public.is_activated()` und
(`public`, oder `members`, oder Autorschaft) — **ohne Stufenschwelle**.

Die Policy SHALL das Prädikat **nicht selbst** tragen, sondern an **einen**
Helfer (`post_media_lesbar`) delegieren. Dieser Helfer ist eine **bewusste,
benannte Abschrift** des Post-Prädikats — die einzige an dieser Stelle. So
kostet eine Änderung der Regel hier genau eine Zeile statt einer je Policy;
sie kostet aber nicht null, und dieser Change zählt den Helfer deshalb zu den
vier Stellen, die gemeinsam wandern müssen.

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

#### Scenario: Ein aktiviertes Mitglied sieht das Bild unabhängig vom Rang

- **WHEN** ein aktiviertes Mitglied mit Rang unter 4 eine Signatur für ein Objekt
  eines fremden `members`-Beitrags anfordert
- **THEN** wird eine Signatur ausgestellt

#### Scenario: Ein nicht aktiviertes Konto bekommt keine Signatur

- **WHEN** ein bestätigtes, aber nicht aktiviertes Konto eine Signatur für ein
  Objekt eines fremden `members`-Beitrags anfordert
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

### Requirement: Die Sidebar zählt nur, was der Betrachter sehen darf

Das System SHALL die Zähler der beliebten Tags über eine aggregierende
Funktion liefern, die **unter der RLS des Aufrufers** läuft (`security invoker`).
Eine Zahl über Beiträge, die der Betrachter nicht sehen darf, verrät genau diese
Beiträge.

Die Funktion SHALL das Sichtbarkeitsprädikat **nicht kopieren**. Unter
`security invoker` greift `posts_select_by_visibility` selbst, und die Zahl ist
richtig, weil die Regel wirkt — nicht, weil eine Abschrift sie nachspricht.
Dieses Repo führt das Prädikat bereits an **vier** Stellen
(`posts_select_by_visibility`, `post_engagement_counts`, `post_media_lesbar`,
`former_member_entries`); eine fünfte und sechste Kopie wäre Aufwand für ein
Ergebnis, das ohne sie schon stimmt. Ein `security definer`-Weg SHALL nur
bestehen, wenn ein konkreter, belegter Rechtebedarf ihn verlangt.

**Der Nutzen dieser Regel SHALL an einer Änderung der Sichtbarkeit ablesbar
sein:** wo das Prädikat nicht abgeschrieben ist, folgt die Zahl der neuen Regel,
ohne dass die Funktion angefasst wird.

Gezählt SHALL ausschließlich über die **aktiven kuratierten Tags** aus
`public.tags` werden. Eine Zählung über `unnest(posts.hashtags)` legte freie und
stillgelegte Schlagworte offen und stellte sie womöglich vor die kuratierten.

Die Reihenfolge SHALL eindeutig sein: bei gleicher Zahl entscheidet ein
festgelegtes zweites Merkmal, damit zwei Aufrufe dieselbe Liste ergeben.

Die Funktion SHALL eine Obergrenze je Aufruf tragen.

#### Scenario: Die Zahl folgt der geänderten Regel ohne eigene Änderung

- **WHEN** die Sichtbarkeitsregel für `members` geändert wird und die
  aggregierende Funktion unverändert bleibt
- **THEN** zählt sie nach der neuen Regel, weil sie unter `security invoker` läuft

### Requirement: Der Feed-Beitrag folgt seinem Event über dessen Lebenszyklus

Das System SHALL den gespiegelten Feed-Beitrag eines Events dessen Lebenszyklus
folgen lassen: eine Sichtbarkeitsänderung zieht ihn nach, ein Hostwechsel zieht
den Autor nach, und ein entzogener Host entfernt den Beitrag, während das Event
bestehen bleibt.

`host_id → null` SHALL den Beitrag entfernen und NOT ihn beim alten Autor
belassen: `posts.author_id` ist `not null`, es gäbe also niemanden, dem er
gehört. Das ist dieselbe Regel wie beim Anlegen, nur später angewandt.

**Die frühere Asymmetrie zwischen Event und Beitrag entfällt.** Bis AGE-601 war
der gespiegelte Beitrag **strenger** als sein Event: `events` sind für jedes
aktivierte Konto sichtbar, `members`-Posts waren es erst ab Rang 4. Ein Mitglied
unter Rang 4 sah das Event, aber nicht seinen Feed-Eintrag — eine Richtung, die
als „ungefährlich, aber ohne Benennung ein Rätsel" ausgeschrieben war. Da
`members` jetzt jedes aktivierte Mitglied meint, SHALL beides **übereinstimmen**:
wer das Event sieht, sieht auch seinen Beitrag. Das Rätsel ist damit nicht
benannt, sondern aufgelöst.

Ausgeloggt SHALL weiterhin **keines von beiden** erscheinen.

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

#### Scenario: Event und Beitrag stimmen unterhalb von Rang 4 überein

- **WHEN** ein aktiviertes Mitglied mit Rang unter 4 den Feed liest und ein
  `members`-Event besteht
- **THEN** erscheint dessen Feed-Beitrag, ebenso wie das Event unter /events
  sichtbar ist

### Requirement: Ein gespeicherter Beitrag verliert seine Sichtbarkeit still

Das System SHALL den Reiter „Gespeichert" über dieselbe Sichtbarkeitsregel führen
wie den übrigen Feed. Wird ein gespeicherter Beitrag später unsichtbar — weil sein
Autor entfernt wurde oder weil der Beitrag gelöscht ist —, SHALL er aus der Liste
verschwinden, **ohne** einen Fehler zu erzeugen und ohne den Reiter leer laufen zu
lassen, solange andere gespeicherte Beiträge sichtbar bleiben.

Eine gespeicherte Zeile SHALL kein Recht begründen: sie hält fest, dass gespeichert
wurde, und niemals, dass gezeigt werden darf.

**Der dritte Weg — „die Sichtbarkeit wurde zurückgedreht" — ist mit AGE-601
entfallen und SHALL nicht mehr zugesichert werden.** Für ein aktiviertes Mitglied
sind beide zulässigen Sichtbarkeiten lesbar; ein einzelner Beitrag kann ihm also
nicht mehr unsichtbar werden. Die einzige verbliebene Sperre ist die Aktivierung,
und die nimmt ihm **sämtliche** Beiträge — sie lässt den Reiter leer laufen statt
eine Zeile aus ihm zu entfernen, ist also kein Fall dieser Anforderung.

Die Regel selbst SHALL bestehen bleiben. Sie ist die Zusicherung, dass der Reiter
über `posts` joint und dort die Regel entscheiden lässt, statt aus der
Speicherzeile ein Zeigerecht abzuleiten — und sie trägt sofort wieder, wenn die
Sichtbarkeit sich je erneut verengt.

Es SHALL benannt sein, dass die Speicherzeile die beiden verbliebenen Wege **nicht
überdauert**: `post_saves.post_id → posts` und `posts.author_id → profiles` sind
beide `on delete cascade`. Das widerspricht der Regel nicht — eine Speicherung
begründet kein Recht und überdauert ihren Beitrag auch nicht.

#### Scenario: Ein gelöschter Beitrag bricht den Reiter nicht

- **WHEN** ein Mitglied drei Beiträge gespeichert hat und einer davon gelöscht wird
- **THEN** zeigt der Reiter die zwei verbliebenen Beiträge und meldet keinen Fehler
- **AND** die Speicherzeile des gelöschten Beitrags ist per Kaskade mit ihm
  verschwunden

#### Scenario: Eine Speicherzeile begründet kein Zeigerecht

- **WHEN** der Reiter „Gespeichert" gelesen wird
- **THEN** entscheidet die Sichtbarkeitsregel auf `posts`, welche Zeilen erscheinen
- **AND** nicht das Vorhandensein einer Zeile in `post_saves`
