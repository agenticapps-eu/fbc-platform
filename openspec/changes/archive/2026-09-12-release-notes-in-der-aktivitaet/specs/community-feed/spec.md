## MODIFIED Requirements

### Requirement: Beiträge tragen eine Art und einen Bezug

Das System SHALL an `public.posts` drei Spalten führen: `kind text not null
default 'member'`, beschränkt auf `member`, `event` und `release`, sowie
`ref_id uuid` und `release_note_id uuid`.

Bei `kind = 'event'` SHALL `ref_id` ein Fremdschlüssel auf `public.events (id)`
mit `on delete cascade` sein — ein gelöschtes Event nimmt seinen Feed-Beitrag
mit, ohne dass irgendwo aufgeräumt werden muss.

Bei `kind = 'release'` SHALL `release_note_id` ein Fremdschlüssel auf
`public.release_notes (id)` mit `on delete cascade` sein. Der Bezug SHALL NOT
über `ref_id` laufen: diese Spalte trägt bereits einen Fremdschlüssel auf
`public.events`, und eine Spalte kann nicht auf zwei Tabellen zeigen, ohne ihre
Integritätszusage aufzugeben.

Beide Fremdschlüssel SHALL **ausdrücklich benannt** werden. Der Client
bezeichnet sie in der PostgREST-Einbettung namentlich; ein von Postgres
generierter Name wäre eine stille Kopplung, die bei jeder Umbenennung bricht.

Das System SHALL erzwingen, dass die Spalten zusammenpassen: ein Beitrag mit
`kind = 'event'` SHALL ein `ref_id` und **kein** `release_note_id` tragen, ein
Beitrag mit `kind = 'release'` SHALL ein `release_note_id` und **kein** `ref_id`
tragen, und ein Beitrag mit `kind = 'member'` SHALL **keines von beiden**
tragen.

Ein Event SHALL an genau einer `posts`-Zeile hängen: `ref_id` SHALL für
`kind = 'event'` eindeutig sein, durchgesetzt über einen **partiellen**
Unique-Index. Ein zweiter, nicht-eindeutiger Index auf `ref_id` SHALL NOT
angelegt werden — der partielle Unique-Index trägt den Join bereits, und
`ref_id` ist außerhalb von `kind = 'event'` leer.

Dieselbe Zusage SHALL für Release-Notes gelten: `release_note_id` SHALL für
`kind = 'release'` eindeutig sein, ebenfalls über einen partiellen
Unique-Index. Ohne ihn stünde dieselbe Mitteilung doppelt im Feed, sobald ein
Trigger zweimal liefe.

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

#### Scenario: Ein Release-Beitrag ohne Bezug wird abgelehnt

- **WHEN** ein Schreibzugriff `kind = 'release'` ohne `release_note_id` setzt,
  oder `kind = 'release'` zusammen mit einem `ref_id`
- **THEN** wird der Schreibzugriff abgelehnt

#### Scenario: Dieselbe Mitteilung steht nicht zweimal im Feed

- **WHEN** versucht wird, eine zweite `posts`-Zeile mit `kind = 'release'` auf
  dasselbe `release_note_id` anzulegen
- **THEN** wird der Schreibzugriff abgelehnt

### Requirement: Der Feed filtert nach Beitragstyp

Das System SHALL einen Filter nach Beitragstyp anbieten: **Bild**, **Video**,
**Event**, **Text**. Der Filter SHALL **mehrere Typen gleichzeitig** zulassen und
sie als **ODER** verknüpfen. Der Filter SHALL Teil der Abfrage sein, nicht eine
Nachfilterung der geladenen Seite.

Der Typ SHALL aus dem Bestand abgeleitet werden, nicht aus einem zusätzlichen
Feld am Beitrag: Video über `video_url`, Event über `posts.kind`, Bild über das
Vorhandensein einer `post_media`-Zeile, Text als **Mitgliedsbeitrag** ohne all
das.

„Text" SHALL die Beitragsart **namentlich** prüfen und NOT als Abwesenheit einer
einzigen anderen Art bestimmt werden. Eine Bedingung, die nur `event`
ausschliesst, fängt jede künftige Art mit ein — eine Release-Karte erschiene
darin als Textbeitrag, mit leerem Text.

**Der Filter deckt die von Mitgliedern verfassten Beitragsarten ab.** Eine
Release-Karte SHALL **kein** Typ dieses Filters sein und SHALL NOT als fünfter
Haken erscheinen: sie ist keine Antwort auf „zeig mir Bilder, Videos, Events
oder Texte von Mitgliedern", und es gibt etwa eine je Woche.

Die **leere** Auswahl SHALL „alle Typen" bedeuten, nicht „kein Typ" — dieselbe
Regel, die für die leere Tagmenge gilt. Es SHALL deshalb **keinen** eigenen
Eintrag „Alle Typen" geben: „alle" ist der Zustand ohne Haken und nicht eine
fünfte Wahlmöglichkeit neben den vier Typen.

Alle vier angehakt SHALL dasselbe liefern wie gar keiner angehakt — **auch was
die Release-Karten betrifft**. Die volle Menge wird auf die leere abgebildet,
damit nicht zwei Schlüssel für ein Ergebnis stehen; die Abfrage ist danach
buchstäblich dieselbe, und eine Liste kann nicht zugleich denselben
Cache-Schlüssel tragen und andere Zeilen führen.

Sobald **irgendein echter** Typ angehakt ist, SHALL die Liste keine
Release-Karten tragen. Die volle Auswahl ist die **benannte Ausnahme**: sie ist
kein Filter, sondern dessen Abwesenheit unter anderem Namen. Ohne Haken SHALL
die Release-Karte erscheinen.

Der erste Entwurf dieser Anforderung verlangte beides zugleich — einen Schlüssel
für vier Haken und keinen Haken, und trotzdem verschiedene Zeilen. Das ist
unerfüllbar, und die Auflösung ist eine Produktentscheidung (Donald, 11.09.):
die Zusammenlegung wiegt schwerer als die Ausnahmslosigkeit der Regel.

Ein Beitrag SHALL höchstens **einmal** in der Liste stehen, auch wenn er auf
mehrere gewählte Typen zutrifft — ein Beitrag mit Video und Bild erscheint bei
der Auswahl „Video + Bild" also einmal, nicht zweimal.

#### Scenario: Der Bildfilter findet bebilderte Beiträge

- **WHEN** „Bild" gewählt wird
- **THEN** enthält die Liste genau die sichtbaren Beiträge mit mindestens einem
  Bild, und das Blättern bleibt seitenweise

#### Scenario: Zwei Typen zeigen die Vereinigung

- **WHEN** „Video" und „Bild" angehakt sind
- **THEN** enthält die Liste die sichtbaren Beiträge mit Video **und** die mit
  mindestens einem Bild, und ein Beitrag mit beidem steht genau einmal darin

#### Scenario: Kein Haken heißt alle Typen

- **WHEN** kein Beitragstyp angehakt ist
- **THEN** enthält die Liste dieselben Beiträge wie ohne jeden Typfilter,
  einschliesslich der Release-Karten

#### Scenario: „Text" bleibt auch in der Vereinigung die Abwesenheit der anderen

- **WHEN** „Text" und „Event" angehakt sind
- **THEN** enthält die Liste die Event-Beiträge sowie die Mitgliedsbeiträge ohne
  Video und ohne Bild — und keinen bebilderten Beitrag und **keine
  Release-Karte**

#### Scenario: Der Typfilter überlebt das Blättern

- **WHEN** bei zwei angehakten Typen die zweite Seite nachgeladen wird
- **THEN** trägt auch die zweite Seite ausschließlich Beiträge dieser beiden
  Typen, weil der Filter in der Abfrage steht und nicht in der Anzeige

#### Scenario: Die Reihenfolge der Haken erzeugt keine zweite Auswahl

- **WHEN** dieselben zwei Typen in umgekehrter Reihenfolge angehakt werden
- **THEN** verwendet der Feed denselben Cache-Schlüssel und lädt die Auswahl
  nicht ein zweites Mal

#### Scenario: Alle vier Haken sind dasselbe wie kein Haken

- **WHEN** alle vier Beitragstypen angehakt sind
- **THEN** enthält die Liste dieselben Beiträge wie ohne jeden Typfilter,
  **einschliesslich der Release-Karten**, und der Feed verwendet denselben
  Cache-Schlüssel wie im Zustand ohne Haken

#### Scenario: Der Typfilter gilt auch ohne Sitzung

- **WHEN** ein Ausgeloggter zwei Typen anhakt
- **THEN** enthält die Liste die Vereinigung dieser Typen unter den öffentlich
  sichtbaren Beiträgen, ohne dass eine zusätzliche Abfrage abgesetzt wird, die
  ohne Sitzung mit `42501` abgewiesen würde

#### Scenario: Der Typfilter steht neben der Blättergrenze, nicht statt ihr

- **WHEN** die zweite Seite bei aktivem Typfilter geladen wird
- **THEN** wirken Typvereinigung **und** Blättergrenze zugleich — die Seite trägt
  nur Beiträge der gewählten Typen, die hinter dem Cursor liegen

## RENAMED Requirements

- FROM: `### Requirement: Der Feed zeigt zwei Kartentypen`
- TO: `### Requirement: Der Feed zeigt Event-Beiträge als eigene Karte`

## ADDED Requirements

### Requirement: Release-Beiträge sind systemverwaltet

Das System SHALL eine `posts`-Zeile mit `kind = 'release'` ausschließlich beim
Übergang einer Release-Note von `draft` auf `sent` erzeugen. Ein Mitglied SHALL
eine solche Zeile NOT anlegen, ändern oder löschen können — das Schreibrecht auf
`posts` bleibt auf `kind = 'member'` beschränkt.

Der Beitrag SHALL an denselben Riegel gebunden sein, der die Doppelzustellung
verhindert: allein `send_release_note()` kann den Zustandswechsel schreiben,
weil die UPDATE-Policy auf `release_notes` `status = 'draft'` erzwingt. Ein
zweiter Versand erzeugt damit weder einen zweiten Hinweis noch einen zweiten
Feed-Beitrag.

Ein **Entwurf** SHALL keinen Feed-Beitrag haben. Er ist eine Absicht, keine
Mitteilung — dieselbe Grenze, die schon für `/neues` gilt.

`posts.author_id` SHALL unverändert `not null` bleiben und den Admin tragen, der
zugestellt hat. Die Spalte nullable zu machen berührte 86 Stellen in den
Migrationen und jede Policy, die Autorschaft prüft; der Gewinn wäre allein
kosmetisch, weil die Oberfläche den Autor einer Release-Karte ohnehin nicht
zeigt.

Der Auslöser SHALL `visibility` **ausdrücklich** auf `members` setzen und sich
NOT auf den Spaltenvorgabewert verlassen. Sichtbarkeit ist eine
Zugriffsentscheidung; sie gehört ausgesprochen und geprüft, auch wenn die
Vorgabe heute zufällig dasselbe ergibt. `members` deckt sich mit
`release_notes_read_sent`, das ebenfalls Aktivierung verlangt — eine
Release-Karte erscheint damit **nicht** im ausgeloggten Schaufenster.

Die Funktion des Auslösers SHALL `security definer` mit leerem `search_path`
sein, und das Ausführungsrecht SHALL Rollen entzogen werden, die es nicht
brauchen. Als `invoker` scheiterte ihr Insert an der Schreibregel, die
`kind = 'member'` verlangt — und weil ein Fehler im Auslöser das umgebende
`update` zurückrollt, erreichte die Mitteilung dann **nie** den Zustand
`sent`.

#### Scenario: Ein Ausgeloggter sieht keine Release-Karte

- **WHEN** ein Besucher ohne Sitzung die Aktivität öffnet, während eine
  Release-Note zugestellt ist
- **THEN** erscheint dort keine Release-Karte

#### Scenario: Die Sichtbarkeit steht am Beitrag, nicht im Vorgabewert

- **WHEN** eine Release-Note zugestellt wird
- **THEN** trägt die erzeugte Zeile `visibility = 'members'`, vom Auslöser
  gesetzt

#### Scenario: Das Zustellen erzeugt den Beitrag

- **WHEN** ein Admin eine Release-Note zustellt
- **THEN** entsteht genau eine `posts`-Zeile mit `kind = 'release'`, die auf
  diese Note zeigt

#### Scenario: Ein Entwurf erzeugt keinen Beitrag

- **WHEN** ein Admin eine Release-Note als Entwurf speichert, ohne sie
  zuzustellen
- **THEN** entsteht keine `posts`-Zeile

#### Scenario: Ein zweiter Versand erzeugt keinen zweiten Beitrag

- **WHEN** das Zustellen einer bereits zugestellten Release-Note erneut versucht
  wird
- **THEN** bricht der Versuch ab und es entsteht keine weitere `posts`-Zeile

#### Scenario: Ein Mitglied kann keinen Release-Beitrag schreiben

- **WHEN** ein aktiviertes Mitglied versucht, eine `posts`-Zeile mit
  `kind = 'release'` anzulegen
- **THEN** wird der Schreibzugriff von der Policy abgelehnt

### Requirement: Der Release-Beitrag speichert keinen Mitteilungsinhalt

Das System SHALL im Release-Beitrag **keinen** Titel und **keinen** Text
ablegen. `body` SHALL leer bleiben; die Darstellung SHALL Titel und Text zur
Laufzeit über `release_note_id` aus `public.release_notes` lesen.

Zwei Kopien desselben Textes könnten auseinanderlaufen, und die redigierte
Fassung steht in `release_notes` bereits. Dieselbe Regel gilt schon für den
Event-Beitrag.

Ist die bezogene Release-Note für den Betrachter nicht lesbar, SHALL die Karte
**entfallen** statt leer zu erscheinen.

**Eine Folge, die ausgesprochen gehört:** die Volltextsuche des Feeds sucht über
`posts.body`. Weil der Beitrag keinen Text trägt, SHALL eine Release-Karte über
diese Suche **nicht** auffindbar sein. Derselbe Inhalt ist damit im Feed sichtbar
und dort nicht suchbar. Das ist hingenommen, nicht übersehen: die Suche auf eine
zweite Tabelle auszuweiten wäre ein eigener Zuschnitt, und `/neues` führt die
Mitteilungen vollständig.

#### Scenario: Der Beitrag trägt keinen Text

- **WHEN** eine Release-Note zugestellt wurde
- **THEN** ist der `body` der erzeugten `posts`-Zeile leer

#### Scenario: Der Text kommt aus der Mitteilung, nicht aus dem Beitrag

- **WHEN** der Text einer Release-Note als **Entwurf** geändert und die Note
  danach zugestellt wird
- **THEN** zeigt die Karte im Feed den geänderten Text, obwohl der Beitrag ihn
  nie gespeichert hat

#### Scenario: Die Feedsuche findet eine Release-Karte nicht

- **WHEN** ein Mitglied im Feed nach einem Wort sucht, das nur im Text einer
  Release-Note steht
- **THEN** erscheint die Release-Karte nicht in den Suchtreffern

### Requirement: Die Release-Karte nennt keinen Autor

Das System SHALL an einer Karte mit `kind = 'release'` **weder** Name **noch**
Avatar des Mitglieds zeigen, das in `author_id` steht. Es SHALL stattdessen
`eff.bee.zee` als Absender ausweisen — die Anwendung spricht unter ihrem eigenen
Namen.

Der Admin, der zustellt, ist nicht der Verfasser der Mitteilung, und eine Karte,
die ihn nennt, behauptete eine Autorschaft, die es nicht gibt.

Der Absender SHALL NOT auf ein Profil verlinken. Es gibt keines, und ein Verweis
ins Leere wäre schlechter als keiner.

#### Scenario: Die Karte zeigt nicht den versendenden Admin

- **WHEN** ein Admin eine Release-Note zustellt und ein Mitglied den Feed öffnet
- **THEN** trägt die Release-Karte weder Namen noch Avatar dieses Admins

#### Scenario: Der Absender führt nirgendwohin

- **WHEN** ein Mitglied den Absender einer Release-Karte anzusteuern versucht
- **THEN** gibt es dort keinen Verweis auf ein Profil

### Requirement: An der Release-Karte funktionieren Reaktionen und Kommentare

Das System SHALL an einer Karte mit `kind = 'release'` Reaktionen und
Kommentare **ohne Sonderweg** zulassen — es ist eine echte `posts`-Zeile, und
`post_likes` wie `comments` hängen an der Sichtbarkeit des Beitrags, nicht an
seiner Art.

Der Interaktionsbereich SHALL mit der Beitragskarte **geteilt** und NOT kopiert
werden — dieselbe Zusage, die schon für die Event-Karte gilt.

Ein Kommentar an einer Release-Karte hat keinen zuständigen Absender, der
antwortet. Das ist eine bewusst in Kauf genommene Folge und SHALL NOT durch
einen automatischen Hinweis oder eine gesperrte Eingabe verdeckt werden.

#### Scenario: Eine Release-Karte lässt sich liken und kommentieren

- **WHEN** ein aktiviertes Mitglied eine Release-Karte im Feed likt, den Like
  wieder entfernt, den Kommentarfaden öffnet und einen Kommentar anlegt
- **THEN** funktionieren alle vier Schritte wie an einem Mitgliedsbeitrag

### Requirement: Eine Reaktion auf eine Release-Karte benachrichtigt niemanden

Das System SHALL für eine Reaktion oder einen Kommentar an einem Beitrag mit
`kind = 'release'` **keine** Benachrichtigung an das Mitglied in `author_id`
erzeugen.

Dort steht der Admin, der zugestellt hat — er hat die Mitteilung nicht verfasst
und ist für Rückfragen dazu nicht zuständig. Eine Mitteilung erreicht jedes
aktivierte Mitglied; entstünde je Reaktion ein Hinweis, träfe die Summe aller
Reaktionen **eine einzelne Person**, die nichts geschrieben hat.

Das ist die Stelle, an der zwei für sich harmlose Entscheidungen zusammen einen
Fehler ergeben: der Interaktionsbereich bleibt an der Karte, und `author_id`
trägt den Admin. Der Hinweisauslöser für Reaktionen kennt heute keine
Beitragsart und liest allein `posts.author_id`.

Der Auslöser für **neue Beiträge** ist davon nicht betroffen: er prüft bereits
`kind is distinct from 'member'` und lässt damit jede andere Art aus — auch eine
künftige. Diese Zusage SHALL erhalten bleiben, damit eine Zustellung nicht
zweimal ankündigt: einmal als Release-Hinweis, einmal als neuer Beitrag.

#### Scenario: Ein Kommentar an einer Release-Karte erreicht den Admin nicht

- **WHEN** ein Mitglied eine Release-Karte kommentiert
- **THEN** entsteht keine Benachrichtigung für das Mitglied in `author_id`

#### Scenario: Eine Reaktion auf eine Release-Karte erreicht den Admin nicht

- **WHEN** ein Mitglied auf eine Release-Karte reagiert
- **THEN** entsteht keine Benachrichtigung für das Mitglied in `author_id`

#### Scenario: Eine Zustellung kündigt sich nicht zweimal an

- **WHEN** eine Release-Note zugestellt wird und dabei ein Feed-Beitrag entsteht
- **THEN** erhält ein Mitglied den Release-Hinweis und **keinen** zusätzlichen
  Hinweis über einen neuen Beitrag

### Requirement: Ohne Autor entsteht kein Release-Beitrag statt eines Fehlers

Das System SHALL die Zustellung einer Release-Note **nicht** daran scheitern
lassen, dass sich für ihren Feed-Beitrag kein Autor bestimmen lässt.

`posts.author_id` ist `not null`. Lässt sich weder die urhebende noch die
zustellende Person bestimmen, SHALL der Auslöser **keinen** Beitrag anlegen und
die Zustellung unberührt lassen — nicht die umgebende Transaktion mit einem
`not null`-Fehler abbrechen. Eine Mitteilung ohne Feed-Karte ist ein Verlust;
eine Mitteilung, die gar nicht zugestellt wird, ist ein größerer.

Dieselbe Regel gilt bereits für Event-Beiträge: kein Host, kein Beitrag.

#### Scenario: Ohne bestimmbaren Autor wird trotzdem zugestellt

- **WHEN** eine Release-Note zugestellt wird und sich für den Feed-Beitrag kein
  Autor bestimmen lässt
- **THEN** wird die Mitteilung zugestellt und es entsteht kein Feed-Beitrag,
  statt dass die Zustellung fehlschlägt

### Requirement: Der Feed zeigt eine Release-Karte zwischen den Beiträgen

Das System SHALL eine zugestellte Release-Note als eigene Karte in der
Beitragsliste darstellen — chronologisch zwischen den übrigen Beiträgen und NOT
als getrennte Liste daneben.

Die Karte SHALL Titel und Text der Mitteilung zeigen und einen Weg zur vollen
Mitteilung auf `/neues` anbieten.

Die Karte SHALL jedem aktivierten Mitglied erscheinen und **keine**
Mitgliedsstufe verlangen — was die Anwendung kann, ist keine Frage der Stufe.
Das deckt sich mit der Fläche `/neues`, die dieselbe Grenze zieht.

#### Scenario: Eine zugestellte Mitteilung erscheint im Feed

- **WHEN** eine Release-Note zugestellt wurde und ein aktiviertes Mitglied die
  Aktivität öffnet
- **THEN** steht dort eine Karte mit Titel und Text der Mitteilung,
  chronologisch zwischen den übrigen Beiträgen

#### Scenario: Die Karte führt zur vollen Mitteilung

- **WHEN** ein Mitglied die Release-Karte im Feed aktiviert
- **THEN** öffnet sich die Mitteilung auf `/neues`

#### Scenario: Auch die unterste Stufe sieht die Karte

- **WHEN** ein aktiviertes Mitglied der untersten Stufe die Aktivität öffnet
- **THEN** erscheint die Release-Karte

### Requirement: Die Beitragsart wird an der Grenze verengt, nicht geraten

Das System SHALL beim Lesen aus der Datenbank jede der drei Arten `member`,
`event` und `release` **namentlich** erkennen. Ein unbekannter Wert SHALL NOT
stillschweigend zu `member` werden.

Die Verengung stammt aus einer Zeit mit zwei Arten, als „alles Unerwartete gilt
als Mitgliedsbeitrag" die harmlose Richtung war. Mit einer dritten Art ist sie
es nicht mehr: ein als Mitgliedsbeitrag gelesener Release-Beitrag trüge einen
leeren Text und den Namen des versendenden Admins.

Ein Filter, der eine Beitragsart ausschließen soll, SHALL die Arten nennen, die
er meint, und NOT über die Verneinung einer einzigen Art arbeiten. Der Filter
für Textbeiträge schloss bisher `kind.neq.event` aus und finge einen
Release-Beitrag mit ein.

#### Scenario: Ein Release-Beitrag wird als Release gelesen

- **WHEN** der Feed eine Zeile mit `kind = 'release'` lädt
- **THEN** trägt der gelesene Beitrag die Art `release` und NOT `member`

#### Scenario: Der Textfilter fängt keinen Release-Beitrag

- **WHEN** ein Mitglied im Feed auf den Beitragstyp „Text" filtert
- **THEN** erscheint kein Release-Beitrag in der gefilterten Liste

### Requirement: Bereits zugestellte Mitteilungen erscheinen rückwirkend im Feed

Das System SHALL für Release-Notes, die vor dieser Änderung zugestellt wurden,
je einen Feed-Beitrag nachtragen.

**Sowohl `created_at` als auch `veroeffentlicht_ab`** SHALL aus `sent_at` der
Note stammen und NOT aus dem Zeitpunkt des Nachtragens. Dasselbe SHALL für jeden
Beitrag gelten, den der Auslöser beim Zustellen anlegt.

Die zweite Spalte namentlich zu nennen ist kein Detail, sondern der Kern dieser
Zusage: **der Feed ordnet und blättert über `veroeffentlicht_ab`**, nicht über
`created_at`, und die Spalte trägt `default now()`. Ein Beitrag, der nur
`created_at` gesetzt bekommt, steht deshalb trotzdem ganz oben — also genau der
Fehler, den diese Anforderung ausschließt.

Der Event-Backfill taugt hier **nicht** als Vorlage: er entstand, bevor es
`veroeffentlicht_ab` gab, und die Spalte wurde für die damaligen Zeilen
einmalig nachgezogen. Für neue Zeilen gibt es diesen Nachzug nicht.

Ein **Entwurf** SHALL auch rückwirkend keinen Beitrag bekommen.

#### Scenario: Eine früher zugestellte Mitteilung steht an ihrem Datum

- **WHEN** die Migration auf eine Datenbank mit bereits zugestellten
  Release-Notes angewandt wird
- **THEN** trägt jeder nachgetragene Beitrag in **beiden** Zeitspalten den
  Zeitstempel der Zustellung und NOT den der Migration

#### Scenario: Eine nachgetragene Mitteilung steht nicht oben im Feed

- **WHEN** eine Release-Note mit weit zurückliegendem `sent_at` nachgetragen
  wird und ein Mitglied den Feed in der Voreinstellung öffnet
- **THEN** steht ihre Karte an der Stelle ihres Zustelldatums und NOT vor den
  neuesten Beiträgen

#### Scenario: Ein alter Entwurf bleibt unsichtbar

- **WHEN** die Migration auf eine Datenbank angewandt wird, die einen nicht
  zugestellten Entwurf enthält
- **THEN** entsteht für diesen Entwurf kein Feed-Beitrag
