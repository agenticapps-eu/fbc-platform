# community-feed — Delta für `geplante-beitraege`

## ADDED Requirements

### Requirement: Ein Beitrag kann einen Veröffentlichungszeitpunkt tragen

Das System SHALL auf `public.posts` eine Spalte `veroeffentlicht_ab
timestamptz not null default now()` führen und einen Beitrag genau dann als
sichtbar behandeln, wenn `veroeffentlicht_ab <= now()` gilt **oder** der
Betrachter sein Autor ist.

Der Zeitpunkt SHALL **gerechnet** und SHALL NOT geschaltet werden: es SHALL
keinen Lauf geben, der Beiträge freischaltet. Der Grund SHALL festgehalten
sein — ein solcher Lauf führte einen Fehlerfall ein, den es sonst nicht gibt:
fällt er aus, bleibt der Beitrag unsichtbar, und das ist von „nie geschrieben"
nicht zu unterscheiden.

Die Spalte SHALL `not null` sein. Ein `null` als „sofort" müsste in **jedem**
Prädikat gesondert behandelt werden; eine vergessene Stelle machte einen
Beitrag entweder unsichtbar oder zu früh sichtbar.

Bestandszeilen SHALL bei der Migration ihren eigenen `created_at` erhalten und
SHALL NOT den Migrationszeitpunkt tragen — sonst sortierte sich der ganze
Bestand um.

`created_at` SHALL der **Schreib**zeitpunkt bleiben. Der Feed SHALL nach
`veroeffentlicht_ab` sortieren, damit ein geplanter Beitrag beim Freischalten
oben steht und nicht an der Stelle seines Schreibdatums.

Die Seitengrenze des Feeds SHALL ihren Cursor auf **derselben** Spalte
vergleichen, nach der sortiert wird. Ein Cursor auf einer anderen Spalte als
der Ordnung überspringt Zeilen oder liefert sie doppelt.

#### Scenario: Ein geplanter Beitrag ist für Fremde nicht da

- **WHEN** ein Mitglied einen Beitrag mit einem Zeitpunkt in der Zukunft anlegt
- **THEN** liefert die Beitragsabfrage ihn für **jedes andere** Mitglied nicht,
  auch nicht für eines, dessen Stufe die gewählte Sichtbarkeit trägt

#### Scenario: Auch sein Bild ist nicht da

- **WHEN** ein Fremder das Bild eines geplanten Beitrags signieren lassen will
- **THEN** wird keine Signatur ausgestellt

#### Scenario: Auch seine Zahl ist nicht da

- **WHEN** ein Fremder Zähler für die Kennung eines geplanten Beitrags anfragt
- **THEN** wird für diese Kennung keine Zählzeile zurückgegeben

#### Scenario: Der Verfasser sieht ihn

- **WHEN** der Verfasser seinen geplanten Beitrag abfragt
- **THEN** erhält er ihn, mit dem Zeitpunkt, für den er geplant ist

#### Scenario: Nach dem Zeitpunkt erscheint er

- **WHEN** der geplante Zeitpunkt erreicht ist
- **THEN** erhalten ihn alle, deren Sichtbarkeit der Beitrag trägt, ohne dass
  ein Lauf ihn freigeschaltet hätte

#### Scenario: Der Bestand bleibt sichtbar

- **WHEN** die Migration auf einen Bestand angewendet wird
- **THEN** bleibt jeder vorhandene Beitrag sichtbar und behält seine Stelle in
  der Ordnung

#### Scenario: Ein Zeitpunkt in der Vergangenheit wird beim Anlegen angehoben

- **WHEN** ein Beitrag **über die Anlage-Funktion** mit einem Zeitpunkt vor
  `now()` entsteht
- **THEN** trägt er `now()` und erscheint oben, statt rückdatiert unter älteren
  Beiträgen zu stehen

#### Scenario: Ein veröffentlichter Beitrag lässt sich wieder zurückziehen

- **WHEN** der Verfasser den Zeitpunkt eines bereits sichtbaren eigenen
  Beitrags in die Zukunft setzt
- **THEN** ist der Beitrag für andere nicht mehr sichtbar, und das ist
  zugelassen — die Anhebung aus dem Szenario darüber gilt nur der Anlage, nicht
  dem Ändern

### Requirement: Jede Stelle, die über die Sichtbarkeit eines Beitrags entscheidet, liest den Zeitpunkt mit

Das System SHALL den Veröffentlichungszeitpunkt in **jedem** Prädikat prüfen,
das über die Sichtbarkeit eines Beitrags oder eines daran hängenden Gegenstands
entscheidet — namentlich in beiden Policies auf `public.posts` sowie in
`post_media_lesbar`, `post_engagement_counts` und `former_member_entries`.

Der Grund SHALL festgehalten sein: das Sichtbarkeitsprädikat ist an diesen
Stellen **abgeschrieben**, nicht geteilt. Eine Regel, die nur in der RLS steht,
lässt das **Bild** eines unsichtbaren Beitrags signierbar und seine **Zahl**
abfragbar — beides verrät, dass es ihn gibt.

Für Aufrufer **ohne Session** SHALL das Prädikat allein `veroeffentlicht_ab <=
now()` lauten; die Autoren-Ausnahme SHALL dort entfallen, weil es keinen Autor
gibt.

`event_feed_post_sync()` SHALL unberührt bleiben: sie schreibt Spiegelzeilen
für Events und entscheidet über keine Sichtbarkeit.

Das SHALL ausdrücklich auch für das **schreibende** Tor gelten:
`hinweis_neuer_beitrag()` feuert `after insert on public.posts` und kündigt
jedem aktivierten Mitglied an — in der Glocke **und** als Push. Ein geplanter
Beitrag SHALL beim Einfügen **keine** Ankündigung erzeugen. Der Grund SHALL
festgehalten sein: eine Hinweiszeile unterliegt nach dem Schreiben nicht mehr
der Sichtbarkeit ihres Gegenstands, und der Payload trägt den Namen des
Verfassers.

#### Scenario: Planen kündigt nichts an

- **WHEN** ein Mitglied einen Beitrag für einen Zeitpunkt in der Zukunft anlegt
- **THEN** entsteht keine Hinweiszeile und kein Push für irgendein Mitglied

### Requirement: Ein geplanter Beitrag kündigt sich beim Live-Gehen an

Das System SHALL einen geplanten Beitrag ankündigen, sobald sein Zeitpunkt
erreicht ist — wie jeden anderen Beitrag auch, in der Glocke und als Push.

Weil die Sichtbarkeit gerechnet wird und niemand sie schaltet, SHALL diese
Ankündigung von einem **Lauf** ausgehen. Der Unterschied zur Sichtbarkeit SHALL
festgehalten sein: fällt der Lauf aus, erscheint der Beitrag **trotzdem** und
ist nur unangekündigt. Der Lauf verbirgt also keinen Inhalt — deshalb ist er
hier vertretbar und für die Sichtbarkeit nicht.

Jeder Beitrag SHALL **genau einmal** angekündigt werden. Das System SHALL dafür
am Beitrag festhalten, dass er angekündigt wurde, und SHALL NOT die
Hinweiszeilen danach durchsuchen — dort steht je Empfänger eine Zeile.

#### Scenario: Nach dem Zeitpunkt wird angekündigt

- **WHEN** der Zeitpunkt eines geplanten Beitrags erreicht ist und der Lauf
  darüber geht
- **THEN** erhalten die Mitglieder genau eine Ankündigung dafür

#### Scenario: Zweimal laufen kündigt nicht zweimal an

- **WHEN** der Lauf ein zweites Mal über einen bereits angekündigten Beitrag
  geht
- **THEN** entsteht keine weitere Hinweiszeile

#### Scenario: Ein ausgefallener Lauf verbirgt nichts

- **WHEN** der Lauf nicht stattfindet, obwohl der Zeitpunkt erreicht ist
- **THEN** ist der Beitrag dennoch für alle sichtbar, deren Sichtbarkeit er
  trägt

Für `comments` und `post_likes` SHALL **belegt** werden, dass sie die Regel
erben, statt es anzunehmen: `comments_select_visible` prüft über eine
Unterabfrage auf `public.posts`, die unter deren RLS läuft.

#### Scenario: Das Bild eines geplanten Beitrags bleibt unsigniert

- **WHEN** ein Fremder den Objektnamen eines Bildes kennt, das an einem
  geplanten Beitrag hängt
- **THEN** verweigert die Lesefunktion des Buckets die Freigabe

#### Scenario: Kommentare erben die Regel

- **WHEN** ein Fremder die Kommentare eines geplanten Beitrags abfragt
- **THEN** erhält er keine, weil die Unterabfrage auf `posts` den Beitrag nicht
  findet

#### Scenario: Ohne Session zählt nur der Zeitpunkt

- **WHEN** ein ausgeloggter Besucher einen öffentlichen, aber noch geplanten
  Beitrag abfragt
- **THEN** erhält er ihn nicht

## MODIFIED Requirements

### Requirement: Der Composer trägt Text, Bilder, Video-Link, Tags und Sichtbarkeit

Das System SHALL im Composer erlauben: Text, bis zu sechs Bilder, einen
Video-Link, eine Auswahl aus den aktiven kuratierten Tags, freien Tag-Text, die
Sichtbarkeit (`members` als Vorgabe) sowie **einen Veröffentlichungszeitpunkt**.

Der Zeitpunkt SHALL Datum **und** Uhrzeit tragen und SHALL vorbelegt „sofort"
bedeuten. Der Verfasser SHALL ihn bis zum Erreichen ändern und zurücknehmen
können; ein zurückgenommener Zeitpunkt SHALL den Beitrag sofort veröffentlichen.

Ein geplanter Beitrag SHALL dem Verfasser mit dem Zeitpunkt gekennzeichnet
erscheinen, für den er geplant ist, damit er nicht für veröffentlicht gehalten
wird.

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
überlassen werden. Der Grund SHALL festgehalten sein: `posts_write_own` steht
`for all` auf der eigenen Zeile, `authenticated` hält also ein **spaltenweises
UPDATE-Recht** direkt auf `posts` — die RPC ist nicht der einzige Schreibweg.
Ein clientseitig berechneter Wert wäre frei wählbar, und dann stünde ein Beitrag
in der Academy, dessen Karte etwas anderes zeigt. *(Die frühere Fassung
begründete dies mit einem INSERT-Recht für `authenticated`; das gibt es seit der
Anforderung „Das Schreibrecht auf `posts` nennt seine Spalten" nicht mehr.)*

#### Scenario: Ein Beitrag mit Bildern und Tags wird veröffentlicht

- **WHEN** ein bestätigtes Mitglied Text, zwei Bilder, einen kuratierten und
  einen freien Tag sowie die Sichtbarkeit `members` wählt und veröffentlicht
- **THEN** entsteht ein Beitrag mit beiden Tags in `hashtags` und zwei
  `post_media`-Zeilen in der gewählten Reihenfolge

#### Scenario: Ein Beitrag wird für einen Zeitpunkt geplant

- **WHEN** ein Mitglied im Composer einen Zeitpunkt in der Zukunft wählt und
  absendet
- **THEN** entsteht der Beitrag mit diesem Zeitpunkt, erscheint dem Verfasser
  als geplant und für niemanden sonst

#### Scenario: Eine Planung wird zurückgenommen

- **WHEN** der Verfasser die Planung eines noch nicht erschienenen Beitrags
  aufhebt
- **THEN** ist der Beitrag sofort sichtbar

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

### Requirement: Das Schreibrecht auf `posts` nennt seine Spalten

Das System SHALL `authenticated` auf `public.posts` **kein** INSERT-Recht
gewähren und das UPDATE-Recht auf die vom Client tatsächlich beschreibbaren
Spalten einschränken — einschliesslich `veroeffentlicht_ab`, damit der
Verfasser einen geplanten Zeitpunkt verschieben oder aufheben kann.

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
Tabellenzeilen für `posts` und `post_likes` und die Spalten-Zeile
`posts.UPDATE=…` **mit der neuen Spalte darin**.

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

#### Scenario: Den eigenen Zeitpunkt verschieben gelingt

- **WHEN** der Verfasser den geplanten Zeitpunkt eines eigenen Beitrags ändert
- **THEN** gelingt die Änderung, weil die Spalte im Spalten-UPDATE-Recht steht
