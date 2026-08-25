## ADDED Requirements

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

## MODIFIED Requirements

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
