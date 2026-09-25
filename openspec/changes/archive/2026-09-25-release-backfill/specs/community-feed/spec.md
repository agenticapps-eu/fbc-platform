## MODIFIED Requirements

### Requirement: Release-Beiträge sind systemverwaltet

Das System SHALL eine `posts`-Zeile mit `kind = 'release'` ausschließlich beim
Übergang einer Release-Note von `draft` auf `sent` erzeugen. Ein Mitglied SHALL
eine solche Zeile NOT anlegen, ändern oder löschen können — das Schreibrecht auf
`posts` bleibt auf `kind = 'member'` beschränkt.

**Kein Client** SHALL den Zustandswechsel schreiben können: die UPDATE-Policy
auf `release_notes` erzwingt `status = 'draft'`, und `status` auf `sent` zu
setzen bleibt damit den Wegen mit erhöhtem Recht vorbehalten — heute
`send_release_note()` und eine versionierte Migration. Jeder solche Weg SHALL
denselben Auslöser durchlaufen und damit denselben Riegel gegen die zweite
Zeile: den partiellen Eindeutigkeitsindex auf `release_note_id`. Ein zweiter
Versand erzeugt weder einen zweiten Hinweis noch einen zweiten Feed-Beitrag.

> Diese Anforderung sagte bis AGE-905, **allein** `send_release_note()` könne
> den Zustandswechsel schreiben. Das war eine Aussage über die Menge der
> Aufrufer, nicht über die Zusage — und der Nachtrag der kuratierten
> Geschichten macht sie falsch. Die Zusage, die wirklich trägt, ist die
> Client-Grenze plus der gemeinsame Auslöser: sie gilt für jeden künftigen
> Weg, ohne dass die Anforderung ihn kennen muss.

Ein **Entwurf** SHALL keinen Feed-Beitrag haben. Er ist eine Absicht, keine
Mitteilung — dieselbe Grenze, die schon für `/neues` gilt.

`posts.author_id` SHALL unverändert `not null` bleiben. Bei einer **Zustellung**
SHALL die Spalte den Admin tragen, der zugestellt hat. Bei einem **Nachtrag**
SHALL sie eine System-Zuschreibung tragen: ein Admin-Profil, das nichts
zugestellt hat und allein deshalb dort steht, weil die Spalte einen Wert
verlangt. Die Anforderung SHALL diesen Unterschied benennen, statt beide Fälle
„der Admin, der zugestellt hat" zu nennen — das wäre für den Nachtrag eine
Behauptung über eine Handlung, die nie stattfand.

Die Spalte nullable zu machen berührte 86 Stellen in den Migrationen und jede
Policy, die Autorschaft prüft; der Gewinn wäre allein kosmetisch. Die
Oberfläche zeigt den Autor einer Release-Karte nämlich nicht: der Feed ersetzt
ihn durch einen festen Absendernamen der Anwendung, und die Karte zeichnet
keinen Verweis auf ein Profil. Die Wahl der Zeile SHALL deshalb ohne Wirkung
auf die Darstellung sein — und diese Zusage SHALL geprüft sein, nicht
angenommen.

Ein Weg, der eine Release-Note **ohne** `created_by` auf `sent` setzt, SHALL
NOT stillschweigend eine Note ohne Feed-Karte hinterlassen: der Auslöser
verlässt sich in diesem Fall ohne Insert, damit ein fehlender Autor die
Zustellung nicht mitreisst. Ein Nachtrag SHALL seinen Autor deshalb **vor** dem
Zustandswechsel auflösen.

Findet er keinen, SHALL er **zwei Lagen unterscheiden**, denn dieselbe Antwort
wäre an der einen Stelle ein roter Aufbau und an der anderen ein stiller
Datenverlust:

- Gibt es **überhaupt keine Profile**, SHALL der Nachtrag folgenlos
  übersprungen werden. Eine frische Datenbank hat niemanden, dem etwas
  zuzuschreiben wäre, und niemanden, der die Karten sähe; es ist nichts zu tun.
  Ein Abbruch liesse hier jeden Aufbau aus einer leeren Datenbank scheitern.
- Gibt es **Profile, aber keinen Admin**, SHALL der Nachtrag laut abbrechen.
  Das ist eine bestückte Fläche ohne Zuschreibung — genau die Lage, in der
  Mitteilungen ohne Feed-Karte entstünden.

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

#### Scenario: Ein Nachtrag durchläuft denselben Auslöser

- **WHEN** eine versionierte Migration eine nachgetragene Release-Note von
  `draft` auf `sent` setzt
- **THEN** entsteht genau eine `posts`-Zeile mit `kind = 'release'`,
  `visibility = 'members'` und einem Verweis auf diese Note — über denselben
  Auslöser wie beim Zustellen, ohne einen zweiten Insert-Pfad in den Feed

#### Scenario: Eine bestückte Fläche ohne Admin bricht laut ab

- **WHEN** ein Nachtrag auf einer Fläche läuft, die Profile trägt, aber keinen
  Admin als Autor auflösen kann
- **THEN** bricht er mit einem Fehler ab, statt Notes ohne Feed-Karte zu
  hinterlassen

#### Scenario: Eine leere Datenbank überspringt den Nachtrag folgenlos

- **WHEN** der Nachtrag auf einer Datenbank ohne ein einziges Profil läuft —
  ein frischer Aufbau, wie ihn die Prüfstrecke aus den Migrationen erzeugt
- **THEN** läuft er ohne Fehler durch, legt nichts an, und der Aufbau bleibt
  grün

#### Scenario: Die Wahl des Autors ändert die Karte nicht

- **WHEN** eine Release-Karte gelesen wird, gleich welches Admin-Profil in
  `author_id` steht
- **THEN** zeigt sie den festen Absendernamen der Anwendung und keinen Verweis
  auf ein Profil

#### Scenario: Ein fremder Entwurf wird vom Nachtrag nicht zugestellt

- **WHEN** ein Nachtrag läuft, während zu einem seiner Slugs bereits ein
  Entwurf liegt, den er nicht angelegt hat
- **THEN** bricht er ab, und dieser Entwurf bleibt ein Entwurf

#### Scenario: Eine bereits nachgetragene Geschichte hält den zweiten Lauf nicht auf

- **WHEN** ein Nachtrag ein zweites Mal läuft, während seine Slugs bereits
  **zugestellten** Notes gehören
- **THEN** überspringt er sie ohne Fehler und legt nichts an

## ADDED Requirements

### Requirement: Ein nachgetragener Release-Beitrag trägt das Datum seiner Ausgabe

Das System SHALL einem nachgetragenen Release-Beitrag `veroeffentlicht_ab` aus
dem **Ausgabe-Datum** des Blogs geben, nicht aus dem Datum des Archiveintrags
und nicht aus dem Zeitpunkt des Nachtrags. Das Ausgabe-Datum ist der Tag, an
dem die Geschichte den Mitgliedern vorgestellt wurde; das Archiv-Datum sagt nur,
wann wir etwas gebaut haben.

`created_at` und `veroeffentlicht_ab` des Beitrags SHALL beide aus
`release_notes.sent_at` stammen. Der Feed ordnet und blättert über
`veroeffentlicht_ab`; ein Nachtrag, der nur `created_at` zurückdatiert, stünde
vollständig als Block „heute" am Kopf der Aktivität.

Innerhalb einer Ausgabe SHALL die Reihenfolge der Beiträge der **Leseordnung**
des Feldes `geschichten[]` folgen und durch verschiedene Zeitstempel
festgelegt sein. Gleiche Zeitstempel ordnete der Feed über den zweiten Teil
seines Schlüssels — die zufällige `id` —, und dieselbe Ausgabe erschiene auf
jedem Bestand in einer anderen Reihenfolge.

Ein Nachtrag SHALL NOT einen Zeitstempel in der Zukunft erzeugen: ein Beitrag
mit `veroeffentlicht_ab > now()` gilt als geplant und erschiene niemandem.

#### Scenario: Die Karte steht an ihrem Ausgabe-Datum

- **WHEN** eine Geschichte nachgetragen wird, deren Ausgabe auf den 01.08.
  datiert ist, während ihr Archiveintrag den 25.08. trägt
- **THEN** trägt die entstandene `posts`-Zeile `veroeffentlicht_ab` am 01.08.

#### Scenario: Beide Zeitspalten tragen dasselbe Datum

- **WHEN** eine Geschichte nachgetragen wird
- **THEN** tragen `created_at` und `veroeffentlicht_ab` des Beitrags denselben
  zurückdatierten Zeitpunkt, und keiner von beiden den Zeitpunkt des Nachtrags

#### Scenario: Die Geschichten einer Ausgabe stehen in Leseordnung

- **WHEN** eine Ausgabe mit mehreren Geschichten nachgetragen wird
- **THEN** tragen ihre Beiträge paarweise verschiedene Zeitstempel, und die
  Ordnung des Feeds gibt die Reihenfolge aus `geschichten[]` wieder

#### Scenario: Kein nachgetragener Beitrag liegt in der Zukunft

- **WHEN** der Nachtrag läuft
- **THEN** trägt keine entstandene Zeile ein `veroeffentlicht_ab` nach dem
  Zeitpunkt des Laufs

### Requirement: Der Nachtrag ist über den Slug wiederholbar

Das System SHALL einen Nachtrag an `release_notes.entry_slugs` erkennen: der
Slug der Geschichte ist zeichengleich mit dem Verzeichnisnamen ihres
Archiveintrags, und `entry_slugs` ist die Spalte, die diese Zuordnung führt.

Ein zweiter Lauf SHALL **keine** zweite `release_notes`-Zeile und **keine**
zweite `posts`-Zeile erzeugen. Die Wiederholbarkeit SHALL an zwei Stellen
gehalten sein: am Slug-Wächter vor dem Anlegen der Note und am partiellen
Eindeutigkeitsindex auf `posts.release_note_id`, den der Auslöser mit
`on conflict … do nothing` bedient.

Ein Nachtrag SHALL eine bereits vorhandene Note **nicht ändern**. Eine
erschienene Karte ist ein historischer Stand; eine spätere Textänderung an der
Quelle SHALL nichts Nachgetragenes umschreiben — dieselbe Zusage, die
`release-blog` für Zugestelltes schon gibt.

#### Scenario: Der zweite Lauf legt nichts an

- **WHEN** der Nachtrag ein zweites Mal läuft
- **THEN** entstehen 0 neue Zeilen in `release_notes` und 0 neue Zeilen in
  `posts`

#### Scenario: Eine Geschichte ohne Freigabe wird nicht nachgetragen

- **WHEN** der Nachtrag läuft und eine Geschichte trägt `freigegeben: false`
- **THEN** entsteht für sie weder eine Note noch ein Beitrag

#### Scenario: Ein geänderter Text schreibt die Karte nicht um

- **WHEN** der Text einer Geschichte in der Quelle geändert wird und der
  Nachtrag erneut läuft
- **THEN** trägt die vorhandene Note unverändert ihren ursprünglichen Text
