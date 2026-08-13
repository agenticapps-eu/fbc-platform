## ADDED Requirements

### Requirement: Die Mitgliedersuche ist aus der Kopfzeile erreichbar

Der Rahmen SHALL ein Suchfeld tragen, das Mitglieder über dieselbe RPC
`search_directory` findet, die das Verzeichnis benutzt. Es SHALL NOT eine zweite
Suchimplementierung, eine zweite RPC oder einen zweiten Index einführen — die
Kopfzeile ist ein **Einstieg**, keine eigene Fähigkeit.

Ab **zwei** Zeichen des **getrimmten** Textes SHALL eine Abfrage laufen,
**entprellt mit 300 ms**. Unter zwei Zeichen SHALL gar nicht abgefragt werden.

Es SHALL höchstens **fünf** Treffer zeigen. Die Kappung SHALL als solche benannt
sein, denn sie ist heute weder eine Rangfolge noch ein serverseitiges Limit:
`search_directory` kennt kein `LIMIT` und sortiert `order by p.name nulls last`.
„Die ersten fünf" heißt deshalb **alphabetisch die ersten fünf aller Treffer**,
geladen und clientseitig gekürzt. Bei der erwarteten Größenordnung des
Verzeichnisses ist das hingenommen; es SHALL hingeschrieben und nicht
angenommen sein.

Eine Trefferzeile SHALL Avatarbild, Name und **eine** Einordnungszeile tragen.
Die Einordnung SHALL aus den Feldern gebildet werden, die die RPC **tatsächlich
liefert** — `company`, `roles`, `branche`, `short_bio`. Eine
**Berufsbezeichnung SHALL NOT** verlangt werden: ein solches Feld gibt es im
Rückgabetyp nicht, und es zu fordern hieße, es zu erfinden.

Solange sich roher und entprellter Text unterscheiden, SHALL die Liste **keine
Treffer des vorigen Begriffs** zeigen. Fällt der getrimmte Text unter zwei
Zeichen, SHALL die Liste sofort leeren. Eine bestehende Hervorhebung SHALL bei
jedem Wechsel des Begriffs oder der Trefferliste zurückgesetzt werden — sonst
öffnet Enter ein Mitglied, das zur aktuellen Eingabe nicht mehr passt.

Ein Treffer SHALL beim Auswählen das Profil dieses Mitglieds öffnen.

Die Suche SHALL **nur Mitglieder** durchsuchen. Events, Beiträge und
Academy-Inhalte SHALL NOT durchsucht werden.

#### Scenario: Ab zwei Zeichen erscheinen Treffer

- **WHEN** ein aktiviertes Mitglied ab Stufe `discover` zwei oder mehr Zeichen
  eingibt, die auf mindestens ein Profil passen
- **THEN** erscheint nach der Entprellung eine Liste von höchstens fünf Treffern
  mit Avatarbild, Name und einer Einordnungszeile aus vorhandenen Feldern

#### Scenario: Ein einzelnes Zeichen fragt nicht ab

- **WHEN** genau ein Zeichen im Feld steht, oder zwei Zeichen, die getrimmt eines
  ergeben
- **THEN** läuft keine Abfrage und es erscheint keine Trefferliste

#### Scenario: Schnelles Tippen löst eine Abfrage aus, nicht viele

- **WHEN** mehrere Zeichen innerhalb der Entprellzeit nacheinander eingegeben
  werden
- **THEN** läuft genau eine Abfrage, und zwar mit dem zuletzt eingegebenen Text

#### Scenario: Veraltete Treffer verschwinden beim Weitertippen

- **WHEN** bei angezeigter Trefferliste ein weiteres Zeichen getippt wird und die
  Entprellzeit noch läuft
- **THEN** zeigt die Liste nicht mehr die Treffer des vorigen Begriffs
- **AND** eine zuvor gesetzte Hervorhebung ist aufgehoben

#### Scenario: Ein Treffer öffnet das Profil

- **WHEN** ein Treffer ausgewählt wird
- **THEN** öffnet sich das Profil dieses Mitglieds

### Requirement: Der Suchbegriff geht an das Verzeichnis über

Enter im Suchfeld sowie ein Weg „alle Ergebnisse" SHALL für einen Aufrufer ab
Stufe `discover` auf das Mitgliederverzeichnis führen und den Suchbegriff
**dorthin übernehmen**.

**Unterhalb von `discover` SHALL dieser Weg NICHT ins Verzeichnis führen.**
`/mitglieder` liegt hinter einem Stufen-Gate; die Verzeichnisoberfläche entsteht
dort gar nicht, und der Begriff verschwände in einer Wand. Stattdessen SHALL der
Aufrufer auf die Aufstiegsseite geführt werden.

Die Übernahme SHALL über die **Adresszeile** laufen, damit ein geteilter oder neu
geladener Link dieselbe Suche zeigt. Der Zustand SHALL **einen** Eigentümer
haben, und zwar so:

- Der Sucheinstieg der Kopfzeile SHALL der **einzige Schreiber** des
  Suchparameters sein. Die Verzeichnisoberfläche SHALL beim Tippen **nicht**
  in die Adresszeile zurückschreiben — sonst hallte der Wert ins Feld zurück und
  es wäre zu klären, wem die Entprellung gehört.
- Beim **Aufbau mit gesetztem Parameter** SHALL die Verzeichnisoberfläche ihren
  Suchtext **und** ihren Filterzustand unmittelbar aus dem Parameter beziehen.
  Ein bloßer Nachtrag per Effekt SHALL NOT genügen: dazwischen liefe eine
  **ungefilterte** Abfrage über das ganze Verzeichnis, die aufblitzt und im
  Zwischenspeicher landet.
- Bei einem **späteren** Navigationsereignis SHALL der Parameter den Suchtext
  nachziehen; der weitere Weg zum Filterzustand SHALL der bereits vorhandene
  entprellte bleiben, damit es nur einen gibt.
- Die Übernahme SHALL am **Navigationsereignis** hängen, nicht allein am Wert.
  Wird derselbe Begriff erneut abgeschickt, nachdem im Verzeichnis lokal
  weitergetippt wurde, SHALL die Suche trotzdem auf den abgeschickten Begriff
  zurückspringen.
- Ein Navigationsereignis SHALL einen Verlaufseintrag erzeugen, sodass der
  Zurück-Weg zur vorigen Suche führt.

Die übrigen Filter des Verzeichnisses (Thema, Branche, Region, Kompetenz,
Kompass-Kategorien) SHALL ein Wechsel des Suchbegriffs **nicht** zurücksetzen.

#### Scenario: Enter führt mit Begriff ins Verzeichnis

- **WHEN** ein Mitglied ab `discover` einen Suchbegriff eingibt und Enter drückt
- **THEN** öffnet sich das Mitgliederverzeichnis
- **AND** sein Suchfeld trägt denselben Begriff und seine Liste zeigt dessen
  Treffer

#### Scenario: Beim Aufbau mit Parameter läuft keine ungefilterte Abfrage

- **WHEN** das Verzeichnis mit bereits gesetztem Suchparameter aufgebaut wird
- **THEN** läuft keine Abfrage ohne Suchbegriff
- **AND** die erste Abfrage trägt den Begriff aus der Adresszeile

#### Scenario: Erneute Suche auf dem bereits geöffneten Verzeichnis

- **WHEN** das Verzeichnis geöffnet ist und aus der Kopfzeile ein anderer Begriff
  abgeschickt wird
- **THEN** übernimmt das Verzeichnis den neuen Begriff und zeigt dessen Treffer

#### Scenario: Derselbe Begriff nach lokaler Änderung springt zurück

- **WHEN** im Verzeichnis lokal ein anderer Text eingegeben wurde und aus der
  Kopfzeile derselbe Begriff wie zuvor abgeschickt wird
- **THEN** zeigt das Verzeichnis wieder die Suche zum abgeschickten Begriff

#### Scenario: Ein Wechsel des Begriffs erhält die übrigen Filter

- **WHEN** im Verzeichnis Filter gesetzt sind und aus der Kopfzeile ein neuer
  Begriff abgeschickt wird
- **THEN** bleiben die gesetzten Filter erhalten

#### Scenario: Unterhalb von discover führt Enter auf die Aufstiegsseite

- **WHEN** ein aktiviertes Mitglied unterhalb von `discover` einen Begriff
  eingibt und Enter drückt
- **THEN** öffnet sich die Aufstiegsseite statt des Verzeichnisses

### Requirement: Der Sucheinstieg zeigt sich nur, wem er nützt

Ein Einstieg, der für den Betrachter nichts finden kann, SHALL NOT als
funktionsfähiges Feld erscheinen. Welche Zeilen zurückkommen, entscheidet
unverändert allein die RLS; diese Anforderung regelt, was die Oberfläche daraus
macht.

**Ausgeloggt SHALL das Suchfeld entfallen** — samt Lupensymbol, in jeder
Fensterbreite. `search_directory` ist für `anon` nicht ausführbar; jede Eingabe
liefe in einen Rechtefehler. Eine namenlose Ersatzfassung SHALL NOT an seine
Stelle treten.

Der leere Fall SHALL in **drei** unterscheidbare Zustände zerfallen, und die
Unterscheidung SHALL erst **nach** einer erfolgreichen Antwort getroffen werden:

1. **Fehler.** Schlägt die Abfrage fehl — Netz, abgelaufene Sitzung, `42501` —
   SHALL ein eigener Fehlerzustand erscheinen. Er SHALL NOT als „nichts
   gefunden" oder als „Aufstieg nötig" erscheinen: das verkleidete einen
   Betriebs- oder Anmeldefehler als Such- oder Stufenaussage.
2. **Stufe zu niedrig.** Kommt eine erfolgreiche, **leere** Antwort und liegt der
   eigene Rang unter `discover`, SHALL ein Hinweis erscheinen, der die nötige
   Stufe nennt und zum Aufstieg führt. „Keine Mitglieder gefunden" wäre dort
   unwahr: es gibt Treffer, das Konto darf sie nicht sehen.
3. **Echter Nulltreffer.** Kommt eine erfolgreiche, leere Antwort ab `discover`,
   SHALL eine benannte Meldung samt Weg ins Verzeichnis erscheinen, keine leere
   Liste.

Der eigene Rang SHALL **ausschließlich** die Formulierung des leeren Falls
bestimmen. Er SHALL NOT die Abfrage unterdrücken und SHALL NOT Treffer
verbergen: die Policy gibt einem Konto unterhalb `discover` die **eigene** Zeile
zurück, und die ist ein gültiger Treffer. Ein Rang, der Ergebnisse ausblendet,
wäre eine zweite Zugriffskontrolle im Frontend — Kulisse vor einem Gate, das
schon hält.

Ein nicht aktiviertes Konto SHALL über diesen Einstieg nichts finden. Die Sperre
SHALL das bestehende Aktivierungs-Gate bleiben und SHALL NOT in der Oberfläche
nachgebaut werden; der **Nachweis** SHALL an der Datenbank geführt werden.

#### Scenario: Ausgeloggt gibt es kein Suchfeld

- **WHEN** ein ausgeloggter Besucher den Rahmen sieht, in beliebiger Fensterbreite
- **THEN** trägt die Kopfzeile weder ein Suchfeld noch ein Lupensymbol

#### Scenario: Ein Fehler erscheint als Fehler

- **WHEN** die Suchabfrage mit einem Fehler zurückkommt
- **THEN** erscheint ein Fehlerzustand
- **AND** weder eine „nichts gefunden"-Meldung noch ein Aufstiegs-Hinweis

#### Scenario: Unterhalb discover und leer erscheint der Aufstiegs-Hinweis

- **WHEN** ein aktiviertes Mitglied unterhalb von `discover` sucht **und** die
  Abfrage erfolgreich keine Zeile liefert
- **THEN** erscheint ein Hinweis, der die nötige Stufe nennt und zum Aufstieg
  führt
- **AND** es erscheint keine Meldung, es sei nichts gefunden worden

#### Scenario: Unterhalb discover wird die eigene Zeile trotzdem gezeigt

- **WHEN** ein aktiviertes Mitglied unterhalb von `discover` nach seinem eigenen
  Namen sucht und die Abfrage seine eigene Zeile liefert
- **THEN** erscheint dieser Treffer normal
- **AND** er wird nicht wegen der Stufe unterdrückt

#### Scenario: Echter Nulltreffer ist formuliert

- **WHEN** ein Mitglied ab `discover` einen Begriff eingibt, auf den kein Profil
  passt
- **THEN** erscheint eine benannte Meldung samt Weg ins Verzeichnis, keine leere
  Liste

#### Scenario: Ein nicht aktiviertes Konto findet nichts

- **WHEN** ein Konto ohne bestätigte Aktivierung `search_directory` mit einem
  Begriff aufruft, der auf mehrere Profile passt
- **THEN** kommt keine fremde Zeile zurück

### Requirement: Suchergebnisse überleben keinen Wechsel der Identität

Zwischengespeicherte Suchergebnisse SHALL an die Identität gebunden sein, die sie
geholt hat. Die Ergebnisse sind RLS-gefiltert und damit **stufen- und
kontoabhängig**; ein Zwischenspeicher ohne Identität im Schlüssel reichte
Treffer, die ein `discover`-Konto geholt hat, an ein später angemeldetes
`basic`-Konto weiter.

Der Zwischenspeicher-Schlüssel der Kopfzeilen-Suche SHALL die Kennung des
angemeldeten Kontos enthalten und SHALL NOT der Schlüssel des vollen
Verzeichnisses sein — ein auf fünf gekürztes Ergebnis unter dem
Verzeichnis-Schlüssel vergiftete dessen Zwischenspeicher.

Wechselt die Identität — Abmeldung, Ablauf der Sitzung, Anmeldung eines anderen
Kontos — SHALL eine laufende Suche verworfen und ihr Ergebnis entfernt werden,
und der Einstieg SHALL keine Treffer der vorigen Identität mehr zeigen. Das Feld
auszublenden SHALL NOT als hinreichend gelten.

> Die allgemeine Fassung dieser Regel — den Zwischenspeicher beim Abmelden zu
> **leeren** statt nur zu entwerten — ist AGE-258 und liegt in
> `finish-ui-polish`. Diese Anforderung schließt die Lücke für den hier gebauten
> Einstieg; für das übrige Verzeichnis bleibt sie offen, und das SHALL benannt
> bleiben statt stillschweigend mitgenommen zu werden.

#### Scenario: Abmelden während einer laufenden Suche

- **WHEN** eine Suchabfrage unterwegs oder die Entprellung noch nicht abgelaufen
  ist und der Nutzer sich abmeldet
- **THEN** verschwindet der Einstieg samt Trefferliste
- **AND** es wird kein Ergebnis dieser Abfrage mehr angezeigt

#### Scenario: Ein zweites Konto sieht die Treffer des ersten nicht

- **WHEN** nach einer Suche als Konto mit Stufe `discover` abgemeldet und ein
  Konto mit Stufe `basic` angemeldet wird und dasselbe Wort gesucht wird
- **THEN** erscheinen keine zwischengespeicherten Treffer der vorigen Identität

### Requirement: Der Sucheinstieg ist mit Tastatur und auf dem Telefon bedienbar

Das Feld und seine Trefferliste SHALL vollständig mit der Tastatur bedienbar
sein: ↑ und ↓ wandern durch die Treffer, Enter wählt den hervorgehobenen Treffer
(und ohne Hervorhebung gilt der Weg ins Verzeichnis bzw. auf die Aufstiegsseite),
Escape schließt die Liste und lässt den Fokus im Feld.

Die Trefferliste SHALL für Hilfstechnik als zusammengehörige Auswahl ausgezeichnet
sein, und der hervorgehobene Treffer SHALL als der aktive benannt sein.

Die Liste SHALL schließen bei Auswahl eines Treffers, beim Weg ins Verzeichnis,
bei einem Klick außerhalb und bei jedem Routenwechsel. Der Rahmen wird beim
Navigieren **nicht** neu aufgebaut; ohne diese Regel bliebe die Liste über der
Zielseite stehen.

Unterhalb der Umbruchbreite, ab der das Feld heute entfällt, SHALL ein
Lupensymbol die Suche öffnen. Die geöffnete Fassung SHALL Sperre und
Fokus-Falle des vorhandenen Overlay-Verhaltens benutzen statt einer eigenen —
und SHALL zusätzlich selbst regeln, was jenes **nicht** mitbringt: den
Anfangsfokus ins Suchfeld, das Schließen per Escape und über den Hintergrund, die
Rückgabe des Fokus an das Lupensymbol, und das **automatische Schließen beim
Überschreiten der Umbruchbreite** — sonst verbirgt CSS die Fassung, während die
Sperre stehen bleibt.

#### Scenario: Pfeiltasten und Enter wählen einen Treffer

- **WHEN** bei offener Trefferliste ↓ und dann Enter gedrückt wird
- **THEN** öffnet sich das Profil des hervorgehobenen Treffers

#### Scenario: Escape schließt, ohne den Fokus zu verlieren

- **WHEN** bei offener Trefferliste Escape gedrückt wird
- **THEN** schließt die Liste und der Fokus bleibt im Suchfeld

#### Scenario: Die Liste bleibt nicht über der Zielseite stehen

- **WHEN** aus der offenen Trefferliste heraus navigiert wird — durch Auswahl,
  durch den Weg ins Verzeichnis oder durch einen Klick außerhalb
- **THEN** ist die Liste danach geschlossen

#### Scenario: Auf dem Telefon öffnet ein Lupensymbol die Suche

- **WHEN** ein eingeloggtes Mitglied den Rahmen in schmaler Fensterbreite sieht
  und das Lupensymbol betätigt
- **THEN** öffnet sich das Suchfeld mit dem Fokus darin, ist beschreibbar und
  liefert dieselben Treffer wie in breiter Ansicht

#### Scenario: Verbreitern schließt die Telefon-Fassung

- **WHEN** die geöffnete Telefon-Fassung die Umbruchbreite nach oben überschreitet
- **THEN** schließt sie, und die Seite ist wieder scrollbar
