## ADDED Requirements

### Requirement: Ein nachgetragener Release-Beitrag bleibt still

Das System SHALL beim Nachtragen einer Release-Geschichte **keine**
`notifications`-Zeile und **keine** `push_zustellungen`-Zeile erzeugen — weder
vom Typ `release_note` noch vom Typ `post_created`. Weder Glocke noch
Ungelesen-Zähler noch Push SHALL auf einen Nachtrag ansprechen.

Ein Nachtrag ist kein Ereignis. Die Geschichten sind Wochen alt; sie in 26
Postfächer zu legen, meldete Neuigkeit, wo Vollständigkeit hergestellt wird,
und 23 Nachträge × jedes aktivierte Profil wären in einem Schlag mehr Hinweise
als der gesamte Bestand.

Die Stille SHALL **nicht** daran hängen, dass `push_routing` für
`release_note` heute `push = false` trägt. Diese Zeile ist umschaltbar; die
Zusage gilt der fehlenden `notifications`-Zeile, aus der Push seine Aufträge
zieht.

Der Nachtrag SHALL `send_release_note()` NOT rufen. Die Funktion ist der
einzige Schreiber des Fan-outs; sie zu umgehen ist die Zusage, nicht ein
Nebeneffekt der Umgehung.

Die Stille SHALL an **zwei** Wächtern hängen, und beide SHALL geprüft sein:
`hinweis_neuer_beitrag()` verlässt sich für `kind <> 'member'` ohne Hinweis,
und `beitrag_ankuendigen()` wählt ausschließlich `kind = 'member'`. Der zweite
ist nicht überflüssig: der erste stempelt `angekuendigt_am` nur im
Mitglieds-Zweig, Release-Zeilen bleiben dort also NULL und sähen für einen
Nachlauf ohne Art-Filter wie unangekündigte Beiträge aus.

#### Scenario: Der Nachtrag erzeugt keinen Hinweis

- **WHEN** der Nachtrag aller freigegebenen Geschichten läuft
- **THEN** ist die Zeilenzahl in `notifications` davor und danach dieselbe

#### Scenario: Der Nachtrag erzeugt keinen Push

- **WHEN** der Nachtrag aller freigegebenen Geschichten läuft
- **THEN** ist die Zeilenzahl in `push_zustellungen` davor und danach dieselbe

#### Scenario: Der Nachlauf für geplante Beiträge holt keine Release-Karte nach

- **WHEN** `beitrag_ankuendigen()` nach dem Nachtrag läuft, während die
  nachgetragenen Zeilen `angekuendigt_am IS NULL` tragen
- **THEN** wählt er keine davon aus und erzeugt keinen Hinweis

#### Scenario: Die Glocke bleibt leer

- **WHEN** ein aktiviertes Mitglied nach dem Nachtrag die Glocke öffnet
- **THEN** steht dort kein Hinweis auf eine der nachgetragenen Geschichten,
  und der Ungelesen-Zähler ist unverändert

#### Scenario: Eine echte Zustellung meldet sich weiterhin

- **WHEN** nach dem Nachtrag eine neue Release-Note über die Admin-Fläche
  zugestellt wird
- **THEN** bekommt jedes aktivierte Mitglied genau eine `notifications`-Zeile
  vom Typ `release_note`, und die Feed-Karte erscheint wie bisher

### Requirement: Die Fläche der Neuerungen zeigt jede zugestellte Mitteilung

Das System SHALL auf der Fläche, die zugestellte Release-Notes auflistet,
**jede** zugestellte Mitteilung erreichbar machen. Die Fläche lädt seitenweise;
sie SHALL einen Weg anbieten, die nächste Seite nachzuladen, solange weitere
Mitteilungen vorliegen.

Eine Liste, die ohne Nachladen bei der ersten Seite endet, SHALL NOT als
vollständig erscheinen. Die Fläche heisst „alle Neuerungen"; eine stille Grenze
bei der Seitengrösse machte aus einer Auslassung eine Aussage über den
Bestand — dieselbe Klasse Fehler, gegen die `fetchAngekuendigt()` ausdrücklich
ohne Seite lädt.

Ein Tiefenlink auf eine einzelne Mitteilung SHALL diese auch dann öffnen, wenn
sie **nicht** auf der geladenen Seite steht. Die Glocke und die Release-Karte
im Feed bauen genau solche Verweise; ein Verweis, der auf einer vollen Liste
funktioniert und auf einer langen stumm bleibt, ist von einem defekten Knopf
nicht zu unterscheiden.

Eine unbekannte oder gelöschte Kennung SHALL weiterhin **nichts** öffnen — ein
leeres Fenster wäre schlechter als keines.

#### Scenario: Die einundzwanzigste Mitteilung ist erreichbar

- **WHEN** mehr zugestellte Mitteilungen vorliegen, als eine Seite fasst, und
  ein Mitglied die Fläche öffnet und nachlädt
- **THEN** erscheinen auch die Mitteilungen jenseits der ersten Seite

#### Scenario: Ein Tiefenlink öffnet eine Mitteilung ausserhalb der ersten Seite

- **WHEN** ein Mitglied dem Verweis einer Release-Karte folgt, deren Mitteilung
  nicht auf der ersten Seite steht
- **THEN** öffnet sich diese Mitteilung

#### Scenario: Kein Nachladen mehr, wenn nichts mehr da ist

- **WHEN** alle zugestellten Mitteilungen geladen sind
- **THEN** bietet die Fläche kein weiteres Nachladen an

#### Scenario: Eine unbekannte Kennung öffnet nichts

- **WHEN** ein Tiefenlink eine Kennung nennt, zu der es keine zugestellte
  Mitteilung gibt
- **THEN** öffnet sich nichts, und die Fläche bleibt bedienbar
