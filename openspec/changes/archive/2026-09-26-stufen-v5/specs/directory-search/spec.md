## MODIFIED Requirements

### Requirement: Richer profile fields are gated by membership rank

The system SHALL reserve full profile rows and extended data (beyond the
`profiles_public` subset) for the profile's owner OR a caller with
`level_rank >= 4` (`discover` in the ladder introduced by AGE-903), enforced by
the base-table policy `profiles_select_self_or_discover` (`has_level(4)`).
Because `search_directory` runs as `SECURITY INVOKER`, a below-Discover or
anonymous caller SHALL see at most their own full row through it.

**The policy name outlives its number on purpose.** It was minted when
`discover` meant rank 3; it now guards rank 4, which `discover` means after
AGE-903. Renaming it would rewrite six call sites for a cosmetic gain and cost
the trail from the migration that created it. The number in the body is the
authority, never the name.

#### Scenario: Below-Discover caller sees at most their own full row

- **WHEN** a member with `level_rank < 4` invokes `search_directory`
- **THEN** the base-table RLS yields only their own row (no other members' full rows)

#### Scenario: Discover-and-above caller sees the full directory

- **WHEN** a member with `level_rank >= 4` invokes `search_directory`
- **THEN** all `is_public` members' rows are returned

### Requirement: Der Suchbegriff geht an das Verzeichnis über

Enter im Suchfeld sowie ein Weg „alle Ergebnisse" SHALL für einen Aufrufer ab
**Rang 4** (`discover` nach AGE-903) auf das Mitgliederverzeichnis führen und
den Suchbegriff **dorthin übernehmen**.

**Unterhalb von Rang 4 SHALL dieser Weg NICHT ins Verzeichnis führen.**
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

- **WHEN** ein Mitglied ab Rang 4 einen Suchbegriff eingibt und Enter drückt
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

<!-- Der Titel bleibt zeichengleich, über drei Schwellenwechsel hinweg.
     `openspec archive` ordnet Szenarien über ihre Überschrift zu und bricht ab,
     wenn eine verschwindet — ein umbenannter Titel wirkt wie ein gelöschtes
     Szenario. Die Hausregel dazu: den RUMPF schärfen, nie den Titel.

     Der Rumpf stand auf `basic` und steht jetzt auf `active`, dem Schlüssel,
     der nach AGE-903 denselben Rang 1 trägt. Er liegt unterhalb JEDER Schwelle,
     die dieses Szenario je hatte (`discover` Rang 3, `connect` Rang 2, jetzt
     Rang 4) — die Zusage bleibt unter allen drei Lesarten wahr. Der
     interessante neue Fall (Rang 2 und 3 kommen jetzt NICHT mehr durch) steht
     im Szenario „Ein Rang unterhalb des Clubs wird abgewiesen". -->

- **WHEN** ein aktiviertes Mitglied auf `active` einen Begriff eingibt und Enter
  drückt
- **THEN** öffnet sich die Aufstiegsseite statt des Verzeichnisses

#### Scenario: Ein Rang unterhalb des Clubs wird abgewiesen

- **WHEN** ein aktiviertes Mitglied auf Rang 2 (`boost`) oder Rang 3
  (`connect`) einen Begriff eingibt und Enter drückt
- **THEN** öffnet sich die Aufstiegsseite statt des Verzeichnisses — genau
  diese beiden Ränge kamen vor AGE-903 noch durch

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
   eigene Rang unter **4**, SHALL ein Hinweis erscheinen, der die nötige
   Stufe nennt und zum Aufstieg führt. „Keine Mitglieder gefunden" wäre dort
   unwahr: es gibt Treffer, das Konto darf sie nicht sehen.
3. **Echter Nulltreffer.** Kommt eine erfolgreiche, leere Antwort ab Rang 4,
   SHALL eine benannte Meldung samt Weg ins Verzeichnis erscheinen, keine leere
   Liste.

Der eigene Rang SHALL **ausschließlich** die Formulierung des leeren Falls
bestimmen. Er SHALL NOT die Abfrage unterdrücken und SHALL NOT Treffer
verbergen: die Policy gibt einem Konto unterhalb Rang 4 die **eigene** Zeile
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

<!-- Titel zeichengleich zur heutigen Fassung, Rumpf auf `active` geschaerft —
     siehe die Begruendung am Szenario „Unterhalb von discover fuehrt Enter auf
     die Aufstiegsseite". `active` traegt nach AGE-903 denselben Rang 1 wie
     `basic` davor und liegt unterhalb JEDER Schwelle, die dieses Szenario je
     hatte; die Zusage bleibt unter allen Lesarten wahr. -->

- **WHEN** ein aktiviertes Mitglied auf `active` sucht **und** die
  Abfrage erfolgreich keine Zeile liefert
- **THEN** erscheint ein Hinweis, der die nötige Stufe nennt und zum Aufstieg
  führt
- **AND** es erscheint keine Meldung, es sei nichts gefunden worden

#### Scenario: Unterhalb discover wird die eigene Zeile trotzdem gezeigt

<!-- Titel zeichengleich, Rumpf auf `active`. Genau dieser Fall ist der Grund
     fuer den Selbst-Zweig im Eintrittstor von `search_directory`: ein Konto
     unterhalb der Verzeichnisschwelle findet in der Kopfzeilen-Suche weiterhin
     sich selbst. Der Zweig wird mit AGE-903 WICHTIGER, nicht unwichtiger: die
     Schwelle steigt von Rang 2 auf Rang 4, also faellt ein groesserer Teil des
     Bestands darunter. -->

- **WHEN** ein aktiviertes Mitglied auf `active` nach seinem eigenen
  Namen sucht und die Abfrage seine eigene Zeile liefert
- **THEN** erscheint dieser Treffer normal
- **AND** er wird nicht wegen der Stufe unterdrückt

#### Scenario: Echter Nulltreffer ist formuliert

- **WHEN** ein Mitglied ab Rang 4 einen Begriff eingibt, auf den kein Profil
  passt
- **THEN** erscheint eine benannte Meldung samt Weg ins Verzeichnis, keine leere
  Liste

#### Scenario: Ein nicht aktiviertes Konto findet nichts

- **WHEN** ein Konto ohne bestätigte Aktivierung `search_directory` mit einem
  Begriff aufruft, der auf mehrere Profile passt
- **THEN** kommt keine fremde Zeile zurück

### Requirement: Das Verzeichnis trennt alle Mitglieder von den eigenen Kontakten

Das System SHALL `/mitglieder` in zwei Reiter teilen: „Alle Mitglieder" und
„Meine Kontakte". Beide SHALL **immer** sichtbar sein und je einen Zähler
tragen. Der Reiter „Meine Kontakte" SHALL auch dann stehen, wenn das Mitglied
keinen einzigen Kontakt hat — der Weg soll auffindbar sein, bevor der erste
Kontakt entsteht.

„Immer" heißt: für jeden, der die Fläche überhaupt erreicht. `/mitglieder` ist
über `navItems.minTier` ab **Rang 4** (`discover` nach AGE-903) freigegeben, und
`search_directory` gäbe einem Aufrufer darunter ohnehin höchstens die eigene
Zeile. Ein Mitglied unterhalb Rang 4 SHALL NOT hier bedient werden, obwohl es
Kontaktanfragen annehmen und damit Kontakte haben kann. Das ist eine
ausdrückliche **Nicht-Zusage**: diese Anforderung schafft unterhalb des Clubs
keinen Weg zu den eigenen Kontakten, und der Reiter ist kein Ersatz für einen
solchen. Wer ihn schaffen will, braucht eine Fläche unterhalb des Rang-Gates —
`/kontakte` trägt kein `minTier` und wäre der Ort.

**Die Nicht-Zusage wiegt mit AGE-903 schwerer und bleibt trotzdem stehen.** Die
Schwelle stieg von Rang 2 auf Rang 4, also fallen mehr Konten darunter — und
weil `open_contact` auf `true` steht, darf jedes aktivierte Konto weiterhin
Kontaktanfragen senden und annehmen. Ein Konto unterhalb des Clubs kann damit
Kontakte haben, die es hier nicht sieht. Das ist kein neuer Zustand, nur ein
häufigerer; der Ort für die Abhilfe bleibt `/kontakte`.

Das ist ausdrücklich die andere Entscheidung als beim bedingten
Navigationseintrag für offene Anfragen (AGE-592). Der Unterschied ist der
Gegenstand: eine offene Anfrage ist ein **Vorgang**, der kommt und geht, ein
Reiter ist ein **Ort**. Ein Ort, der erscheint und verschwindet, macht die
Navigation unvorhersehbar.

„Meine Kontakte" SHALL die Mitglieder zeigen, mit denen eine **angenommene**
Kontaktanfrage besteht — in beide Richtungen, also unabhängig davon, wer
angefragt hat.

Der Zähler an einem Reiter SHALL dieselbe Menge zählen, die der Reiter zeigt.
Insbesondere SHALL er NICHT die Zahl der angenommenen Anfragen zeigen, wenn die
Liste nur die davon im Verzeichnis sichtbaren Mitglieder enthält: ein Kontakt,
dessen Profil nicht gelistet ist, hat keine Karte, und eine Zahl ohne
zugehörige Karte liest sich als Fehler. Diese Kante ist real, weil die
Sichtbarkeit im Verzeichnis (`is_public`, Rang, Aktivierung) und der Status der
Kontaktanfrage voneinander unabhängig sind.

Suche und Filter SHALL innerhalb des gewählten Reiters wirken, nicht über ihn
hinweg. Wer in „Meine Kontakte" sucht, sucht unter seinen Kontakten.

Der Reiter SHALL fünf Zustände unterscheiden und SHALL NOT sie zu „leer"
zusammenfassen:

1. **lädt** — eine der beiden Abfragen läuft. Es erscheint ein Ladezustand und
   **kein** Zähler. Eine Null, die gleich zu einer Sieben wird, ist eine falsche
   Aussage, kein Ladezustand.
2. **Kontaktabfrage gescheitert** — es erscheint ein Fehlerhinweis. `undefined`
   SHALL NOT als leere Menge gelesen werden: das machte aus einem Fehlschlag
   eine beruhigende Null und wäre genau der stille Fehlschlag, gegen den
   AGE-591/593 gebaut wurden.
3. **keine Kontakte** — eine Einladung zur ersten Kontaktaufnahme. Normalzustand
   für ein neues Mitglied, keine Fehlermeldung.
4. **Kontakte vorhanden, keiner im Verzeichnis sichtbar** — ein eigener Hinweis.
   SHALL NOT die Einladung aus 3 zeigen: das Mitglied hat Kontakte, und es zur
   ersten Kontaktaufnahme aufzufordern wäre schlicht falsch.
5. **Kontakte vorhanden, keiner passt zum Filter** — ein Hinweis auf den Filter.

Suche und Filter SHALL beim Wechsel des Reiters **stehen bleiben**. Ein Wechsel
ändert die Grundmenge, nicht die Frage an sie; ein Filter, der beim Umschalten
verschwindet, zwingt zur Wiedereingabe und liest sich als Fehler. Die Zähler
beider Reiter SHALL dabei die Zahl **unter dem aktuellen Filter** zeigen — sonst
widerspricht der Zähler erneut seiner Liste.

Der Schlüssel, unter dem die Kontaktmenge zwischengespeichert wird, SHALL die
Kennung des Betrachters tragen, und beim Wechsel der Identität SHALL sie
verworfen werden. Ohne das gäbe der geteilte Zwischenspeicher dem zweiten Konto
im selben Browser die Kontaktmenge des ersten. Dieselbe Regel gilt bereits für
die Suchergebnisse („Suchergebnisse überleben keinen Wechsel der Identität").

#### Scenario: Beide Reiter stehen auch ohne Kontakte

- **WHEN** ein Mitglied ab Rang 4 ohne angenommene Kontaktanfrage
  `/mitglieder` öffnet
- **THEN** stehen beide Reiter da, „Meine Kontakte" mit dem Zähler 0

#### Scenario: Unterhalb von discover gibt es die Fläche gar nicht

<!-- Titel zeichengleich zur heutigen Fassung. Der Rumpf steht auf `active`,
     dem Schlüssel, der nach AGE-903 denselben Rang 1 trägt wie `basic` davor;
     er bleibt damit unter jeder Schwelle wahr, die dieses Szenario je hatte. -->

- **WHEN** ein Mitglied auf `active` mit einem angenommenen Kontakt
  `/mitglieder` aufruft
- **THEN** greift das bestehende Rang-Gate der Route, und weder Reiter noch
  Kontaktliste erscheinen — diese Anforderung ändert daran nichts

#### Scenario: Ein angenommener Kontakt erscheint im Reiter

- **WHEN** eine Kontaktanfrage angenommen wurde und das Gegenüber im
  Verzeichnis sichtbar ist
- **THEN** erscheint es unter „Meine Kontakte"

#### Scenario: Die Richtung der Anfrage spielt keine Rolle

- **WHEN** die angenommene Anfrage vom Gegenüber ausging statt vom Betrachter
- **THEN** erscheint es dort ebenso

#### Scenario: Eine abgelehnte oder offene Anfrage erscheint nicht

- **WHEN** eine Kontaktanfrage den Status `pending` oder `declined` trägt
- **THEN** erscheint das Gegenüber nicht unter „Meine Kontakte"

#### Scenario: Der Zähler zählt, was die Liste zeigt

- **WHEN** ein angenommener Kontakt im Verzeichnis nicht sichtbar ist
- **THEN** zeigt der Zähler dieselbe Zahl wie die Menge der dargestellten
  Karten

#### Scenario: Die Suche bleibt im Reiter

- **WHEN** im Reiter „Meine Kontakte" ein Suchbegriff eingegeben wird
- **THEN** werden nur Kontakte des Betrachters durchsucht, keine übrigen
  Mitglieder

#### Scenario: Ein Ladezustand zeigt keinen Zähler

- **WHEN** die Verzeichnis- oder die Kontaktabfrage noch läuft
- **THEN** trägt der Reiter „Meine Kontakte" keine Zahl

#### Scenario: Eine gescheiterte Kontaktabfrage ist keine Null

- **WHEN** die Abfrage der angenommenen Kontaktanfragen fehlschlägt
- **THEN** erscheint ein Fehlerhinweis und nicht „keine Kontakte"

#### Scenario: Kontakte ohne sichtbare Karte bekommen einen eigenen Hinweis

- **WHEN** alle angenommenen Kontakte im Verzeichnis unsichtbar sind
- **THEN** erscheint ein Hinweis darauf und nicht die Einladung zur ersten
  Kontaktaufnahme

#### Scenario: Der Filter bleibt beim Reiterwechsel stehen

- **WHEN** bei gesetztem Suchbegriff der Reiter gewechselt wird
- **THEN** gilt der Suchbegriff weiter, und beide Zähler zeigen die Zahl unter
  diesem Filter

#### Scenario: Der Zwischenspeicher folgt der Identität

- **WHEN** im selben Browser das Konto gewechselt wird
- **THEN** zeigt „Meine Kontakte" nicht die Kontaktmenge des vorigen Kontos

#### Scenario: Das Kartenbild wird eingepasst

- **WHEN** eine Karte ein Cover trägt, dessen Verhältnis von 3:1 abweicht
- **THEN** ist das ganze Bild sichtbar und die Karte behält ihre Höhe

#### Scenario: Der leere Reiter lädt ein

- **WHEN** „Meine Kontakte" ohne einen einzigen Kontakt geöffnet wird
- **THEN** erscheint ein einladender Hinweis und keine Fehlermeldung

### Requirement: Der Volltext gibt nicht preis, was die Ausgabe maskiert

Das System SHALL die Volltextsuche des Verzeichnisses an die **Stufe** des
Aufrufers binden, nicht nur an seine Aktivierung. Ein Aufrufer unterhalb Rang 4
SHALL ausschließlich gegen ein Suchdokument aus **Basisfeldern** geprüft werden
(`name`, `company`, `region`, `short_bio`, `branche`); ab Rang 4 SHALL
weiterhin das volle `search_doc` gelten.

Der Grund ist ein **Orakel, kein Lesezugriff**. `search_doc` enthält
`competencies` und `interests`. Die Klausel bindet den Volltext sonst nur an
`is_activated()`. Ein Aufrufer unterhalb der Feldschwelle könnte die Frage „Hat
Mitglied X die Kompetenz Y?" stellen und die Antwort daran ablesen, **ob die
Zeile stehen bleibt**. Er läse die Spalte nicht; er erführe ihren Inhalt
trotzdem.

**Die Zusage bleibt stehen, obwohl AGE-903 ihre Lücke schliesst.** Sie entstand,
weil Liste (Rang 2) und Felder (Rang 3) auseinanderlagen; mit einer einzigen
Schwelle bei Rang 4 sieht niemand mehr die Liste, ohne die Felder zu dürfen, und
der Selbst-Zweig ist der einzige verbleibende Fall. Eine Sicherheitszusage
abzuräumen, weil sie gerade nicht auslösen kann, verwechselt „unerreichbar
heute" mit „unerreichbar" — die nächste Schwellenänderung öffnete die Lücke
wortlos wieder. Die Zahl wandert von 3 auf 4, der Satz bleibt.

#### Scenario: Ein connect-Konto findet niemanden über eine Kompetenz

<!-- Titel zeichengleich; `connect` heisst nach AGE-903 Rang 3 statt Rang 2.
     Der Rumpf nennt deshalb den RANG, und beide Ränge liegen unter 4. -->

- **WHEN** ein aktiviertes Mitglied mit Rang 3 einen Suchbegriff eingibt, der
  ausschließlich in `competencies` oder `interests` eines fremden Profils
  vorkommt
- **THEN** erscheint dieses Profil **nicht** im Ergebnis

#### Scenario: Dasselbe Konto findet über ein Basisfeld sehr wohl

- **WHEN** dasselbe Mitglied nach einem Firmennamen, einer Region oder einer
  Branche sucht
- **THEN** erscheinen die passenden Profile — soweit die Liste ihm überhaupt
  fremde Zeilen gibt; unterhalb Rang 4 ist das nur die eigene

#### Scenario: Ab discover findet dieselbe Suche wieder alles

- **WHEN** ein Mitglied ab Rang 4 denselben Kompetenz-Begriff sucht
- **THEN** erscheint das Profil — die Bindung hat die bestehende Suche für
  Berechtigte nicht verengt


## ADDED Requirements

### Requirement: Liste und erweiterte Spalten tragen dieselbe Schwelle

Das System SHALL die Liste, die Suche **und** die erweiterten Spalten des
Mitgliederverzeichnisses an **eine** Schwelle binden: Rang 4 (`discover` nach
AGE-903). Es SHALL keine zweite, niedrigere Schwelle für die Liste geben.

Als erweiterte Spalten der Verzeichnisantwort SHALL **genau** gelten:
`competencies`, `has_offers`, `has_needs`, `offer_categories` und
`need_categories`. Alle übrigen Spalten SHALL Basisfelder sein. **`branche`
SHALL zu den Basisfeldern gehören** und dafür in `profiles_public` geführt
werden; ohne diese Aufnahme fiele die Spalte still auf NULL und der Filter
`p_branche` liefe wortlos leer.

Die Aufzählung SHALL **vollständig** bleiben. Eine Spalte, die weder als
Basisfeld noch als erweitert benannt ist, ändert ihr Verhalten unbemerkt.

Die Rangzahl `4` SHALL an genau **einer** Stelle je Wirkort stehen — im
Eintrittstor von `search_directory` und in der Policy
`profiles_select_self_or_discover`. Eine Kopie driftet, sobald die Grenze sich
ändert; genau daran hing die vorige Fassung mit ihren zwei Zahlen.

Unterhalb Rang 4 SHALL ein Aufrufer **höchstens die eigene Zeile** erhalten —
nicht eine Liste mit leeren Spalten. Das ist der eigentliche Unterschied zur
abgelösten Fassung: die Maskierung fremder Zeilen entfällt, weil es fremde
Zeilen nicht mehr gibt.

Ein Filter, der auf einer erweiterten Spalte arbeitet (`p_competency`,
`p_offers`, `p_needs`, `p_theme`, `p_offering`), SHALL für einen Aufrufer
unterhalb Rang 4 ein leeres Ergebnis liefern; die Oberfläche SHALL solche
Filter dort **gar nicht anbieten**. `p_branche` SHALL NICHT dazugehören.

#### Scenario: Ein Konto unterhalb des Clubs erhält nur die eigene Zeile

- **WHEN** ein aktiviertes Mitglied mit Rang 3 (`connect`) `search_directory`
  ohne Filter aufruft
- **THEN** kommt höchstens die eigene Zeile zurück — vor AGE-903 hätte dasselbe
  Konto die vollständige Liste mit gefüllten erweiterten Spalten erhalten

#### Scenario: Ein Konto ab Rang 4 erhält Liste und erweiterte Spalten zugleich

- **WHEN** ein aktiviertes Mitglied mit Rang 4 denselben Aufruf macht
- **THEN** kommen die Basisfelder aller öffentlichen Profile aktivierter
  Eigentümer zurück **und** `competencies`, `offer_categories`,
  `need_categories`, `has_offers`, `has_needs` sind gefüllt

#### Scenario: Es gibt keinen Zustand „Liste ja, Spalten nein"

- **WHEN** ein beliebiger Rang `search_directory` aufruft
- **THEN** erhält er entweder fremde Zeilen **mit** gefüllten erweiterten
  Spalten oder gar keine fremde Zeile — nie fremde Zeilen mit leeren
  erweiterten Spalten

#### Scenario: `branche` bleibt ein Basisfeld

- **WHEN** ein Aufrufer ab Rang 4 nach einer Branche filtert
- **THEN** wirkt der Filter, und `branche` ist in der Antwort gefüllt

## REMOVED Requirements

### Requirement: Die Verzeichnisliste hat eine eigene, niedrigere Schwelle als ihre erweiterten Spalten

**Reason**: Die Anforderung sagte in ihrem Titel und in ihrem Rumpf zu, dass es
**zwei** Schwellen gibt und dass sie getrennte Wirkung haben („eine Absenkung
der Listenschwelle SHALL NOT erweiterte Felder freigeben"). AGE-903 legt beide
auf Rang 4 zusammen. Damit ist die Zusage nicht nachgeschärft, sondern
gegenstandslos: sie beschrieb den Abstand zwischen zwei Zahlen, die es nicht
mehr gibt.

Eine `MODIFIED`-Fassung schied aus zwei Gründen aus. Der Titel wäre unwahr
geworden, und `MODIFIED` darf den Titel nicht wechseln. Und der Rumpf hätte
sein Gegenteil behaupten müssen, während `MODIFIED` alles bekräftigt, was darin
steht.

**Migration**: Die Nachfolgerin ist „Liste und erweiterte Spalten tragen
dieselbe Schwelle" in derselben Capability. Sie übernimmt vollständig, was
weiter gilt: die abschliessende Aufzählung der erweiterten Spalten, die
Aufnahme von `branche` in `profiles_public`, das Verbot der wiederholten
Rangzahl und das Verhalten der Filter unterhalb der Schwelle. Was entfällt,
ist ausschliesslich die Maskierung fremder Zeilen — unterhalb Rang 4 gibt es
keine fremde Zeile mehr, die zu maskieren wäre.
